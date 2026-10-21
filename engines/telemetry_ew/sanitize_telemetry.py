#!/usr/bin/env python3
"""
sanitize_telemetry.py — Історичний демонстраційний інструмент зсуву координат для синтетичних фіксованих схем.
УВАГА: НЕ є засобом сертифікованої OPSEC-деідентифікації або анонімізації клієнтських логів.
Працює лише для чотирьох вузьких синтетичних схем і відхиляє невідомі/пошкоджені записи:
  1. `NMEA 0183` (`.nmea`, `.txt`) — зсув координат лише у валідних `$GNGGA`/`$GPGGA`/`$GNRMC`/`$GPRMC` з перевіркою вхідного XOR checksum `*XX`;
  2. `ArduPilot DataFlash` (`.bin`) — лише за наявності підтвердженої фіксованої `FMT`-схеми `GPS` (`msg_type=130`, 40 байтів);
  3. `PX4 ULog` (`.ulg`) — лише за наявності підтверджених записів `F` та `A` для фіксованої схеми `vehicle_gps_position`;
  4. `u-blox UBX` (`.ubx`) — лише для валідних фреймів `NAV-PVT` (`0x01 0x07`, 84 або 92 байти) та `RXM-MEASX` (`0x02 0x14`) з перевіркою Fletcher-8.
"""

import argparse
import re
import secrets
import struct
import sys
import time
from pathlib import Path
from typing import Dict, Optional, Tuple


EXPECTED_DF_GPS_FMT = (130, 40, "QBBHiiiHHffB", "TimeUS,Status,NSats,HDop,Lat,Lng,Alt,Spd,GCrs,Cn0M,Cn0S,Mask")
EXPECTED_ULOG_GPS_SCHEMA = (
    "uint64_t timestamp;int32_t lat;int32_t lon;int32_t alt;int32_t alt_baro;"
    "float vel_m_s;float vel_air_m_s;float c_n0_m_dbhz;float std_cn0_dbhz;"
    "uint8_t fix_type;uint8_t satellites_used;uint8_t jamming_indicator;"
    "uint8_t spoofing_state;uint8_t constellations;"
)


def nmea_checksum(sentence_body: str) -> str:
    csum = 0
    for ch in sentence_body:
        csum ^= ord(ch)
    return f"{csum:02X}"


def ubx_fletcher8(data: bytes) -> Tuple[int, int]:
    """Обчислює контрольну суму Fletcher-8 (CK_A, CK_B) для пакета u-blox UBX (від class до кінця payload)."""
    ck_a = 0
    ck_b = 0
    for b in data:
        ck_a = (ck_a + b) & 0xFF
        ck_b = (ck_b + ck_a) & 0xFF
    return ck_a, ck_b


def nmea_ddmm_to_deg(val_str: str, hemi: str) -> float:
    if not val_str:
        return 0.0
    val = float(val_str)
    deg = int(val // 100)
    minutes = val - deg * 100.0
    dec = deg + minutes / 60.0
    if hemi in ("S", "W"):
        dec = -dec
    return dec


def deg_to_nmea_ddmm(dec: float, is_lon: bool) -> Tuple[str, str]:
    hemi = ("E" if dec >= 0 else "W") if is_lon else ("N" if dec >= 0 else "S")
    abs_val = abs(dec)
    deg = int(abs_val)
    minutes = (abs_val - deg) * 60.0
    if is_lon:
        return f"{deg:03d}{minutes:07.4f}", hemi
    return f"{deg:02d}{minutes:07.4f}", hemi


class TelemetrySanitizer:
    def __init__(self, delta_lat: Optional[float] = None, delta_lon: Optional[float] = None):
        if delta_lat is None:
            self.delta_lat = -8.412731 - (secrets.randbelow(10000) / 100000.0)
        else:
            self.delta_lat = delta_lat
        if delta_lon is None:
            self.delta_lon = -14.892341 - (secrets.randbelow(10000) / 100000.0)
        else:
            self.delta_lon = delta_lon
        self.shifted_epochs = 0
        self.preserved_cn0_frames = 0

    def sanitize_nmea_line(self, line: str) -> str:
        raw = line.strip()
        if not raw:
            return ""
        if not raw.startswith("$") or "*" not in raw:
            raise ValueError(f"Malformed or unchecksummed NMEA sentence: {raw!r}")
        body, csum_in = raw[1:].rsplit("*", 1)
        expected_csum = nmea_checksum(body)
        if not re.fullmatch(r"[0-9A-Fa-f]{2}", csum_in) or csum_in.upper() != expected_csum:
            raise ValueError(f"Corrupt NMEA checksum in input: *{csum_in} != *{expected_csum}")
        parts = body.split(",")
        talker_msg = parts[0]

        if talker_msg.endswith("GGA") and len(parts) >= 6 and parts[2] and parts[4]:
            lat = nmea_ddmm_to_deg(parts[2], parts[3]) + self.delta_lat
            lon = nmea_ddmm_to_deg(parts[4], parts[5]) + self.delta_lon
            parts[2], parts[3] = deg_to_nmea_ddmm(lat, is_lon=False)
            parts[4], parts[5] = deg_to_nmea_ddmm(lon, is_lon=True)
            self.shifted_epochs += 1
        elif talker_msg.endswith("RMC") and len(parts) >= 7 and parts[3] and parts[5]:
            lat = nmea_ddmm_to_deg(parts[3], parts[4]) + self.delta_lat
            lon = nmea_ddmm_to_deg(parts[5], parts[6]) + self.delta_lon
            parts[3], parts[4] = deg_to_nmea_ddmm(lat, is_lon=False)
            parts[5], parts[6] = deg_to_nmea_ddmm(lon, is_lon=True)
            self.shifted_epochs += 1
        elif talker_msg.endswith("GSV"):
            self.preserved_cn0_frames += 1
        elif talker_msg.endswith("GSA") or talker_msg == "PIMU":
            pass
        else:
            raise ValueError(
                f"Unsupported NMEA sentence {talker_msg}; legacy coordinate scrubber refuses to claim deidentification"
            )

        new_body = ",".join(parts)
        return f"${new_body}*{nmea_checksum(new_body)}"

    def sanitize_nmea_text(self, content: str) -> Tuple[str, Dict[str, float]]:
        t0 = time.perf_counter()
        self.shifted_epochs = 0
        self.preserved_cn0_frames = 0
        out_lines = [self.sanitize_nmea_line(line) for line in content.splitlines() if line.strip()]
        if not out_lines:
            raise ValueError("Empty NMEA input")
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        stats = {
            "shifted_coordinate_sentences": self.shifted_epochs,
            "preserved_gsv_cn0_sentences": self.preserved_cn0_frames,
            "elapsed_ms": round(elapsed_ms, 3),
        }
        return "\n".join(out_lines) + "\n", stats

    def sanitize_ardupilot_bin(self, data: bytes) -> Tuple[bytes, Dict[str, float]]:
        """
        Зсув координат для синтетичного ArduPilot DataFlash `.bin` (заголовок `0xA3 0x95`)
        лише за наявності підтвердженої `FMT`-схеми `GPS` (`msg_type=130`, 40 байтів).
        """
        t0 = time.perf_counter()
        if not data:
            raise ValueError("Empty DataFlash input")
        buf = bytearray(data)
        dlat_e7 = int(self.delta_lat * 1e7)
        dlon_e7 = int(self.delta_lon * 1e7)
        shifted = 0
        att_cnt = 0

        GPS_FMT = "<QBBHiiiHHffB"  # 37 bytes payload + 3 bytes header = 40 bytes
        formats: Dict[int, Tuple[int, str, str, str]] = {
            128: (89, "FMT", "BBnNZ", "Type,Length,Name,Format,Columns")
        }
        i = 0
        n = len(buf)
        while i < n:
            if i + 3 > n or buf[i] != 0xA3 or buf[i + 1] != 0x95:
                raise ValueError(f"Corrupt or desynchronized DataFlash frame at offset {i}")
            mtype = buf[i + 2]
            if mtype == 128:
                if i + 89 > n:
                    raise ValueError(f"Truncated DataFlash FMT record at offset {i}")
                tid, tlen, tname_b, tfmt_b, tcols_b = struct.unpack_from("<BB4s16s64s", buf, i + 3)
                tname = tname_b.split(b"\0", 1)[0].decode("utf-8", errors="strict")
                tfmt = tfmt_b.split(b"\0", 1)[0].decode("utf-8", errors="strict")
                tcols = tcols_b.split(b"\0", 1)[0].decode("utf-8", errors="strict")
                col_list = tcols.split(",")
                if tname == "GPS" or "Lat" in col_list or "Lng" in col_list:
                    if (tid, tlen, tfmt, tcols) != EXPECTED_DF_GPS_FMT:
                        raise ValueError(
                            f"Unsupported dynamic DataFlash GPS schema (id={tid}, len={tlen}, fmt={tfmt}); "
                            "legacy fixed-layout scrubber refuses to claim sanitization"
                        )
                formats[tid] = (tlen, tname, tfmt, tcols)
                i += 89
            else:
                if mtype not in formats:
                    raise ValueError(f"DataFlash record 0x{mtype:02X} without verified FMT schema at offset {i}")
                flen, fname, _, _ = formats[mtype]
                if i + flen > n:
                    raise ValueError(f"Truncated DataFlash {fname} record at offset {i}")
                if mtype == 130 and fname == "GPS":
                    unpacked = list(struct.unpack_from(GPS_FMT, buf, i + 3))
                    unpacked[4] += dlat_e7  # Lat
                    unpacked[5] += dlon_e7  # Lng
                    struct.pack_into(GPS_FMT, buf, i + 3, *unpacked)
                    shifted += 1
                elif mtype == 131 and fname == "ATT":
                    att_cnt += 1
                else:
                    raise ValueError(f"Unsupported DataFlash record {fname} (0x{mtype:02X}) in synthetic scrubber")
                i += flen

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        return bytes(buf), {
            "shifted_coordinate_sentences": shifted,
            "preserved_gsv_cn0_sentences": shifted + att_cnt,
            "elapsed_ms": round(elapsed_ms, 3),
        }

    def sanitize_px4_ulg(self, data: bytes) -> Tuple[bytes, Dict[str, float]]:
        """
        Зсув координат для синтетичного PX4 ULog `.ulg` (magic `ULog\\x01\\x12\\x35`)
        лише за наявності підтверджених `F` та `A` записів для фіксованої схеми `vehicle_gps_position`.
        """
        t0 = time.perf_counter()
        if len(data) < 16 or data[:7] != b"ULog\x01\x12\x35":
            raise ValueError("Invalid PX4 ULog magic header")

        buf = bytearray(data)
        dlat_e7 = int(self.delta_lat * 1e7)
        dlon_e7 = int(self.delta_lon * 1e7)
        shifted = 0

        ULOG_D_FMT = "<HQiiiiffffBBBBB"
        formats: Dict[str, str] = {}
        subscriptions: Dict[int, str] = {}
        i = 16
        n = len(buf)
        while i < n:
            if i + 3 > n:
                raise ValueError(f"Truncated ULog record header at offset {i}")
            msg_size, msg_type = struct.unpack_from("<HB", buf, i)
            rec_end = i + 3 + msg_size
            if rec_end > n:
                raise ValueError(f"Truncated ULog record payload at offset {i}")
            payload = bytes(buf[i + 3 : rec_end])
            if msg_type == ord("F"):
                text = payload.split(b"\0", 1)[0].decode("utf-8", errors="strict")
                if ":" not in text:
                    raise ValueError(f"Malformed ULog F schema at offset {i}")
                fname, fdecl = text.split(":", 1)
                if fname == "vehicle_gps_position" or "lat" in fdecl or "lon" in fdecl:
                    if fname != "vehicle_gps_position" or fdecl != EXPECTED_ULOG_GPS_SCHEMA:
                        raise ValueError(
                            f"Unsupported ULog schema layout for {fname}; "
                            "legacy fixed-layout scrubber refuses to claim sanitization"
                        )
                formats[fname] = fdecl
            elif msg_type == ord("A"):
                if msg_size < 4:
                    raise ValueError(f"Truncated ULog A subscription at offset {i}")
                _, msg_id = struct.unpack_from("<BH", payload, 0)
                tname = payload[3:].split(b"\0", 1)[0].decode("utf-8", errors="strict")
                if tname not in formats:
                    raise ValueError(f"ULog A subscription for {tname} lacks preceding F schema")
                subscriptions[msg_id] = tname
            elif msg_type == ord("D"):
                if msg_size < 2:
                    raise ValueError(f"Truncated ULog D record at offset {i}")
                msg_id = struct.unpack_from("<H", payload, 0)[0]
                if msg_id not in subscriptions:
                    raise ValueError(f"ULog D record (msg_id={msg_id}) lacks verified A/F subscription schema")
                tname = subscriptions[msg_id]
                if tname != "vehicle_gps_position" or msg_size != struct.calcsize(ULOG_D_FMT):
                    raise ValueError(f"Unsupported ULog D record layout for {tname} (size={msg_size})")
                fields = list(struct.unpack_from(ULOG_D_FMT, buf, i + 3))
                fields[2] += dlat_e7  # lat
                fields[3] += dlon_e7  # lon
                struct.pack_into(ULOG_D_FMT, buf, i + 3, *fields)
                shifted += 1
            else:
                raise ValueError(f"Unsupported ULog record type {chr(msg_type)!r} in synthetic scrubber")
            i = rec_end

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        return bytes(buf), {
            "shifted_coordinate_sentences": shifted,
            "preserved_gsv_cn0_sentences": shifted,
            "elapsed_ms": round(elapsed_ms, 3),
        }

    def sanitize_ublox_ubx(self, data: bytes) -> Tuple[bytes, Dict[str, float]]:
        """
        Зсув координат для u-blox `.ubx` (преамбула `0xB5 0x62`):
        - Відхиляє обрізані фрейми, втрату синхронізації та невірну контрольну суму Fletcher-8 (`CK_A, CK_B`);
        - У пакетах `NAV-PVT` (`0x01 0x07`, 84 або 92 байти) зсуває `lon` (offset 24) та `lat` (offset 28);
        - Зберігає `RXM-MEASX` (`0x02 0x14`) та перераховує контрольну суму Fletcher-8.
        """
        t0 = time.perf_counter()
        if not data:
            raise ValueError("Empty UBX input")
        buf = bytearray(data)
        dlat_e7 = int(self.delta_lat * 1e7)
        dlon_e7 = int(self.delta_lon * 1e7)
        shifted = 0
        measx_cnt = 0

        i = 0
        n = len(buf)
        while i < n:
            if i + 8 > n:
                raise ValueError(f"Truncated UBX frame header at offset {i}")
            if buf[i] != 0xB5 or buf[i + 1] != 0x62:
                raise ValueError(f"UBX sync lost at offset {i}")
            msg_cls, msg_id, length = struct.unpack_from("<BBH", buf, i + 2)
            pkt_end = i + 6 + length + 2
            if pkt_end > n:
                raise ValueError(f"Truncated UBX frame at offset {i} (expected {pkt_end - i} bytes, got {n - i})")
            ck_a_in, ck_b_in = buf[i + 6 + length], buf[i + 6 + length + 1]
            ck_a_calc, ck_b_calc = ubx_fletcher8(bytes(buf[i + 2 : i + 6 + length]))
            if (ck_a_in, ck_b_in) != (ck_a_calc, ck_b_calc):
                raise ValueError(f"UBX Fletcher-8 checksum mismatch at offset {i}")

            if msg_cls == 0x01 and msg_id == 0x07 and length in (84, 92):
                lon_e7, lat_e7 = struct.unpack_from("<ii", buf, i + 6 + 24)
                lon_e7 += dlon_e7
                lat_e7 += dlat_e7
                struct.pack_into("<ii", buf, i + 6 + 24, lon_e7, lat_e7)
                new_cka, new_ckb = ubx_fletcher8(bytes(buf[i + 2 : i + 6 + length]))
                buf[i + 6 + length] = new_cka
                buf[i + 6 + length + 1] = new_ckb
                shifted += 1
            elif msg_cls == 0x02 and msg_id == 0x14:
                measx_cnt += 1
            else:
                raise ValueError(f"Unsupported UBX message 0x{msg_cls:02X}-0x{msg_id:02X} (len={length}) in synthetic scrubber")

            i = pkt_end

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        return bytes(buf), {
            "shifted_coordinate_sentences": shifted,
            "preserved_gsv_cn0_sentences": measx_cnt,
            "elapsed_ms": round(elapsed_ms, 3),
        }

    def sanitize_any_file(self, path: Path, output_path: Optional[Path] = None) -> Tuple[bytes, Dict[str, float], str]:
        path = Path(path)
        if output_path is not None:
            output_path = Path(output_path)
            if path.resolve() == output_path.resolve() or (output_path.exists() and output_path.samefile(path)):
                raise ValueError("Refusing to overwrite input telemetry file in-place (identical path, symlink, or hardlink)")
        fmt = detect_log_format(path)
        raw = path.read_bytes()
        if fmt == "ARDUPILOT_DATAFLASH_BIN":
            san_bytes, stats = self.sanitize_ardupilot_bin(raw)
        elif fmt == "PX4_ULOG":
            san_bytes, stats = self.sanitize_px4_ulg(raw)
        elif fmt == "UBLOX_UBX":
            san_bytes, stats = self.sanitize_ublox_ubx(raw)
        elif fmt == "NMEA_0183":
            try:
                text = raw.decode("utf-8", errors="strict")
            except UnicodeDecodeError as exc:
                raise ValueError("NMEA input is not valid UTF-8 text") from exc
            san_text, stats = self.sanitize_nmea_text(text)
            san_bytes = san_text.encode("utf-8")
        else:
            raise ValueError(f"Unsupported format for coordinate scrubber: {fmt}")

        if output_path is not None:
            output_path.write_bytes(san_bytes)
        return san_bytes, stats, fmt


def detect_log_format(path: Path) -> str:
    if path.exists() and path.stat().st_size >= 8:
        head = path.read_bytes()[:16]
        if head[:7] == b"ULog\x01\x12\x35":
            return "PX4_ULOG"
        if head[:2] == b"\xA3\x95":
            return "ARDUPILOT_DATAFLASH_BIN"
        if head[:2] == b"\xB5\x62":
            return "UBLOX_UBX"
        if head[:1] in (b"\xFD", b"\xFE") or (len(head) >= 9 and head[8:9] in (b"\xFD", b"\xFE")):
            return "MAVLINK_TLOG"
    ext = path.suffix.lower()
    if ext == ".bin":
        return "ARDUPILOT_DATAFLASH_BIN"
    if ext in (".ulg", ".ulog"):
        return "PX4_ULOG"
    if ext == ".ubx":
        return "UBLOX_UBX"
    if ext in (".tlog", ".mavlink"):
        return "MAVLINK_TLOG"
    if ext in (".nmea", ".txt"):
        return "NMEA_0183"
    return f"UNKNOWN({ext})"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Історичний демонстраційний інструмент зсуву координат для фіксованих синтетичних схем (НЕ сертифікований засіб деідентифікації/OPSEC)."
    )
    parser.add_argument("inputs", nargs="*", help="Paths to telemetry log files")
    parser.add_argument("--output", default=None, help="Optional path to save shifted copy (must differ from input)")
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent
    if not args.inputs:
        candidates = [
            base_dir / "sample_uav_ew_flight.nmea",
            base_dir / "sample_ardupilot.bin",
            base_dir / "sample_px4.ulg",
            base_dir / "sample_ublox.ubx",
        ]
        files = [p for p in candidates if p.exists()]
    else:
        files = [Path(p) for p in args.inputs]

    if args.output and len(files) > 1:
        print("ПОМИЛКА: --output можна використовувати лише для одного вхідного файлу.", file=sys.stderr)
        return 2

    sanitizer = TelemetrySanitizer()
    try:
        for fpath in files:
            out_p = Path(args.output) if (args.output and len(files) == 1) else None
            _, stats, fmt = sanitizer.sanitize_any_file(fpath, output_path=out_p)
            print(
                f"[sanitize_telemetry] Файл: {fpath.name} ({fmt}) | "
                f"Зсунуто координатних фреймів: {stats['shifted_coordinate_sentences']} | "
                f"Збережено C/N0 фреймів: {stats['preserved_gsv_cn0_sentences']} | Час: {stats['elapsed_ms']:.2f} мс"
            )
    except (OSError, ValueError) as exc:
        print(f"ПОМИЛКА: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
