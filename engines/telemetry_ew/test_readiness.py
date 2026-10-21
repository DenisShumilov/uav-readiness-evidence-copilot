"""Independent protocol fixtures: bytes are built here, never by the parser under test."""
import gzip
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('telemetry_analyzer.py')

def ulog_record(kind, payload):
    return struct.pack('<HB', len(payload), ord(kind)) + payload

def ulog_fixture():
    return (b'ULog\x01\x12\x35\x01' + struct.pack('<Q', 123456) +
            ulog_record('F', b'vehicle_gps_position:uint64_t timestamp;int32_t lat;int32_t lon;int32_t alt;float vel_m_s;uint8_t fix_type;uint8_t satellites_used;') +
            ulog_record('A', struct.pack('<BH', 0, 42) + b'vehicle_gps_position') +
            ulog_record('D', struct.pack('<HQiiifBB', 42, 1000000, 501234567, 301234567, 123450, 12.5, 3, 12)) +
            ulog_record('D', struct.pack('<HQiiifBB', 42, 3000000, 501234577, 301234577, 123550, 13.5, 3, 13)))

def df_fixture():
    fmt = b'QB B H LL ff'.replace(b' ', b'')
    labels = b'TimeUS,Status,NSats,HDop,Lat,Lng,Alt,Spd'
    definition = b'\xa3\x95\x80' + struct.pack('<BB4s16s64s', 150, 31, b'GPS', fmt, labels)
    record = b'\xa3\x95\x96' + struct.pack('<QBBHiiff', 1000000, 3, 12, 90, 501234567, 301234567, 123.5, 12.5)
    return definition + record

def ubx_fixture():
    payload = bytearray(92)
    struct.pack_into('<IHBBBBBB', payload, 0, 123000, 2026, 10, 20, 14, 11, 0, 3)
    payload[20], payload[21], payload[23] = 3, 1, 12
    struct.pack_into('<iiii', payload, 24, 301234567, 501234567, 160000, 123450)
    struct.pack_into('<i', payload, 48, 12000)  # north velocity, NOT airspeed
    struct.pack_into('<i', payload, 60, 12500)
    struct.pack_into('<H', payload, 76, 135)
    body = b'\x01\x07' + struct.pack('<H', len(payload)) + payload
    a = b = 0
    for byte in body:
        a = (a + byte) & 255
        b = (b + a) & 255
    return b'\xb5\x62' + body + bytes([a, b])

def nmea_fixture():
    body = 'GPGGA,141100.00,5007.4074,N,03007.4074,E,1,12,0.9,123.45,M,36.55,M,,'
    checksum = 0
    for ch in body.encode():
        checksum ^= ch
    return f'${body}*{checksum:02X}\r\n'.encode()

class Readiness(unittest.TestCase):
    def run_file(self, data, suffix, expected=0):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / ('client' + suffix)
            report = Path(directory) / 'report.md'
            result = Path(directory) / 'result.json'
            source.write_bytes(data)
            run = subprocess.run([sys.executable, str(SCRIPT), '--input', str(source), '--report', str(report), '--json', str(result)], capture_output=True, text=True, timeout=15)
            self.assertEqual(run.returncode, expected, run.stdout + run.stderr)
            self.assertEqual(source.read_bytes(), data)
            self.assertTrue(report.exists(), run.stderr)
            obj = json.loads(result.read_text())
            self.assertEqual(obj['sha256'], hashlib.sha256(data).hexdigest())
            self.assertNotIn('100% ідентичний', report.read_text())
            return obj, report.read_text()

    def test_ulog_uses_format_and_subscription(self):
        obj, report = self.run_file(ulog_fixture(), '.ulg')
        self.assertEqual(obj['records'], 2)
        stream = obj['streams']['vehicle_gps_position[0]']
        self.assertEqual(stream['fields']['lat']['min'], 501234567)
        self.assertEqual(stream['fields']['vel_m_s']['max'], 13.5)
        self.assertEqual(stream['duration_seconds'], 2.0)
        self.assertNotIn('190328', report)

    def test_dataflash_uses_fmt_fields_and_scaling(self):
        obj, _ = self.run_file(df_fixture(), '.bin')
        gps = obj['streams']['GPS']['fields']
        self.assertAlmostEqual(gps['Lat']['min'], 50.1234567)
        self.assertEqual(gps['Alt']['min'], 123.5)
        self.assertEqual(gps['Spd']['min'], 12.5)

    def test_ubx_does_not_invent_reference_sensors(self):
        obj, report = self.run_file(ubx_fixture(), '.ubx')
        fields = obj['streams']['NAV-PVT']['fields']
        self.assertEqual(fields['hMSL_m']['min'], 123.45)
        self.assertEqual(fields['height_m']['min'], 160.0)
        self.assertEqual(fields['velN_m_s']['min'], 12.0)
        self.assertEqual(fields['gSpeed_m_s']['min'], 12.5)
        self.assertEqual(fields['pDOP']['min'], 1.35)
        self.assertNotIn('baro', fields)
        self.assertNotIn('EW_JAMMING', report)

    def test_nmea_coordinates_checksum_and_altitude(self):
        obj, _ = self.run_file(nmea_fixture(), '.nmea')
        self.assertAlmostEqual(obj['streams']['GPGGA']['fields']['lat_deg']['min'], 50.1234566667)
        self.assertEqual(obj['streams']['GPGGA']['fields']['alt_msl_m']['min'], 123.45)

    def test_csv_custom_fields_and_timestamp_units(self):
        obj, _ = self.run_file(b'timestamp_us,lat_deg,voltage_v\n1000000,50.1,12.2\n3000000,50.2,11.8\n', '.csv')
        self.assertEqual(obj['records'], 2)
        self.assertEqual(obj['streams']['CSV']['duration_seconds'], 2)
        self.assertEqual(obj['streams']['CSV']['fields']['voltage_v']['min'], 11.8)

    def test_invalid_or_truncated_files_fail_with_report(self):
        cases = [(b'', '.ulg'), (b'not a real log', '.bin'), (ulog_fixture()[:-1], '.ulg'),
                 (ubx_fixture()[:-1], '.ubx'), (ubx_fixture()[:-1] + b'\x00', '.ubx'),
                 (df_fixture()[:-1], '.bin'), (nmea_fixture()[:-4] + b'00\r\n', '.nmea'),
                 (b'timestamp_s,value\n1,NaN\n', '.csv'), (b'a,b\n1,2,3\n', '.csv')]
        for data, suffix in cases:
            with self.subTest(suffix=suffix, size=len(data)):
                obj, _ = self.run_file(data, suffix, expected=2)
                self.assertTrue(obj['errors'])

    def test_unsupported_ulog_incompatibility_flags_fail(self):
        data = ulog_fixture()[:16] + ulog_record('B', b'\0' * 8 + b'\x02' + b'\0' * 31) + ulog_fixture()[16:]
        obj, _ = self.run_file(data, '.ulg', expected=2)
        self.assertTrue(obj['errors'])

    def test_unsupported_ubx_reports_no_supported_records(self):
        obj, _ = self.run_file(b'\xb5\x62\x0a\x04\x00\x00\x0e\x34', '.ubx', expected=2)
        self.assertEqual(obj['records'], 0)
        self.assertTrue(obj['unsupported'])

    def test_dataflash_integral_is_not_sensor_instance(self):
        definition = b'\xa3\x95\x80' + struct.pack('<BB4s16s64s', 151, 15, b'PIDR', b'Qf', b'TimeUS,I')
        data = definition + b'\xa3\x95\x97' + struct.pack('<Qf', 1000000, 1.5) + b'\xa3\x95\x97' + struct.pack('<Qf', 2000000, 2.5)
        obj, _ = self.run_file(data, '.bin')
        self.assertEqual(list(obj['streams']), ['PIDR'])
        self.assertEqual(obj['streams']['PIDR']['fields']['I']['max'], 2.5)

    def test_ulog_noninteger_timestamp_fails_with_report(self):
        data = (ulog_fixture()[:16] + ulog_record('F', b'bad:char timestamp;') +
                ulog_record('A', struct.pack('<BH', 0, 1) + b'bad') +
                ulog_record('D', struct.pack('<H', 1) + b'x'))
        self.run_file(data, '.ulg', expected=2)

    def test_dataflash_duplicate_fields_fail(self):
        definition = b'\xa3\x95\x80' + struct.pack('<BB4s16s64s', 151, 11, b'TEST', b'ff', b'Value,Value')
        data = definition + b'\xa3\x95\x97' + struct.pack('<ff', 1, 2)
        self.run_file(data, '.bin', expected=2)

    def test_ubx_invalid_llh_is_missing_not_zero_or_valid_position(self):
        data = bytearray(ubx_fixture())
        data[6 + 78] = 1
        a = b = 0
        for byte in data[2:-2]:
            a = (a + byte) & 255
            b = (b + a) & 255
        data[-2:] = bytes([a, b])
        obj, _ = self.run_file(bytes(data), '.ubx')
        fields = obj['streams']['NAV-PVT']['fields']
        self.assertIsNone(fields['lat_deg']['min'])
        self.assertEqual(fields['lat_deg']['missing'], 1)
        self.assertTrue(obj['quality'])

    def test_ulog_nested_fields_and_omitted_trailing_padding(self):
        data = (ulog_fixture()[:16] + ulog_record('F', b'outer:uint64_t timestamp;inner point;uint8_t[3] _padding0;') +
                ulog_record('F', b'inner:float[2] value;') +
                ulog_record('A', struct.pack('<BH', 2, 1) + b'outer') +
                ulog_record('D', struct.pack('<HQff', 1, 1000000, 1.5, 2.5)))
        obj, _ = self.run_file(data, '.ulg')
        self.assertEqual(obj['streams']['outer[2]']['fields']['point.value[1]']['min'], 2.5)

    def test_ulog_recursive_schema_fails(self):
        data = (ulog_fixture()[:16] + ulog_record('F', b'bad:bad self;') +
                ulog_record('A', struct.pack('<BH', 0, 1) + b'bad') + ulog_record('D', struct.pack('<H', 1)))
        self.run_file(data, '.ulg', expected=2)

    def test_csv_duplicate_headers_fail(self):
        self.run_file(b'time_s,value,value\n1,2,3\n', '.csv', expected=2)

    def test_nmea_missing_cn0_is_not_jamming(self):
        obj, report = self.run_file(nmea_fixture().split(b'*')[0] + b'\n', '.nmea')
        self.assertTrue(obj['warnings'])
        self.assertFalse(obj['quality'])
        self.assertNotIn('EW_JAMMING', report)

    def test_missing_input_is_not_replaced_by_samples(self):
        run = subprocess.run([sys.executable, str(SCRIPT), '--input', '/does/not/exist/client.ulg'], capture_output=True, text=True)
        self.assertEqual(run.returncode, 2)

    def test_output_cannot_overwrite_input(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'client.csv'
            data = b'timestamp_s,value\n1,2\n'
            source.write_bytes(data)
            run = subprocess.run([sys.executable, str(SCRIPT), '--input', str(source), '--report', str(source)], capture_output=True)
            self.assertEqual(run.returncode, 2)
            self.assertEqual(source.read_bytes(), data)

    def test_gzip_compressed_logs_and_ulog_info_params_and_dataflash_fmtu(self):
        info_decl = b'char[6] sys_name'
        info_rec = ulog_record('I', bytes([len(info_decl)]) + info_decl + b'PX4_EW')
        param_decl = b'float MPC_XY_VEL_MAX'
        param_rec = ulog_record('P', bytes([len(param_decl)]) + param_decl + struct.pack('<f', 18.5))
        raw_ulg = ulog_fixture()[:16] + info_rec + param_rec + ulog_fixture()[16:]
        gz_ulg = gzip.compress(raw_ulg)
        obj, _ = self.run_file(gz_ulg, '.ulg.gz')
        self.assertEqual(obj.get('compressed'), 'gzip')
        self.assertEqual(obj.get('uncompressed_bytes'), len(raw_ulg))
        self.assertEqual(obj['ulog_info']['sys_name'], 'PX4_EW')
        self.assertAlmostEqual(obj['ulog_parameters']['MPC_XY_VEL_MAX'], 18.5, places=4)

        # DataFlash UNIT + MULT + FMTU resolution
        fmt_unit = b'\xa3\x95\x80' + struct.pack('<BB4s16s64s', 129, 68, b'UNIT', b'bZ', b'Id,Label')
        fmt_mult = b'\xa3\x95\x80' + struct.pack('<BB4s16s64s', 130, 12, b'MULT', b'bd', b'Id,Mult')
        fmt_fmtu = b'\xa3\x95\x80' + struct.pack('<BB4s16s64s', 131, 44, b'FMTU', b'QBNN', b'TimeUS,FmtType,UnitIds,MultIds')
        rec_unit = b'\xa3\x95\x81' + struct.pack('<b64s', ord('m'), b'meters')
        rec_mult = b'\xa3\x95\x82' + struct.pack('<bd', ord('0'), 1.0)
        rec_fmtu = b'\xa3\x95\x83' + struct.pack('<QB16s16s', 500, 150, b'mmmmmmmm', b'00000000')
        df_with_fmtu = fmt_unit + fmt_mult + fmt_fmtu + rec_unit + rec_mult + df_fixture()[:89] + rec_fmtu + df_fixture()[89:]
        obj_df, _ = self.run_file(df_with_fmtu, '.bin')
        self.assertEqual(obj_df['schema_units']['GPS']['Alt']['unit'], 'meters')
        self.assertEqual(obj_df['schema_units']['GPS']['Alt']['mult'], 1.0)

    def test_ubx_mon_hw_jamming_and_nav_status_spoofing_and_nav_dop(self):
        def make_ubx(cls_id, msg_id, payload):
            body = bytes([cls_id, msg_id]) + struct.pack('<H', len(payload)) + payload
            a = b = 0
            for byte in body:
                a = (a + byte) & 255
                b = (b + a) & 255
            return b'\xb5\x62' + body + bytes([a, b])

        # NAV-STATUS (0x01 0x03, 16 bytes): flags2 spoofing indicated (2 << 3 = 16)
        nav_status_pl = struct.pack('<IBBBBII', 123000, 3, 1, 0, 2 << 3, 1500, 45000)
        # NAV-DOP (0x01 0x04, 18 bytes)
        nav_dop_pl = struct.pack('<IHHHHHHH', 123000, 150, 135, 80, 110, 95, 70, 65)
        # MON-HW (0x0A 0x09, 60 bytes): jamInd=195 at offset 45, flags jammingState=2 (2 << 2 = 8) at offset 22
        mon_hw_pl = bytearray(60)
        struct.pack_into('<HHBBB', mon_hw_pl, 16, 115, 4200, 2, 1, 2 << 2)
        mon_hw_pl[45] = 195

        stream_bytes = ubx_fixture() + make_ubx(1, 3, nav_status_pl) + make_ubx(1, 4, nav_dop_pl) + make_ubx(0x0A, 0x09, bytes(mon_hw_pl))
        obj, _ = self.run_file(stream_bytes, '.ubx')
        self.assertEqual(obj['streams']['NAV-STATUS']['fields']['spoofDetState']['max'], 2)
        self.assertAlmostEqual(obj['streams']['NAV-DOP']['fields']['hDOP']['min'], 0.95)
        self.assertEqual(obj['streams']['MON-HW']['fields']['jamInd']['max'], 195)
        self.assertEqual(obj['streams']['MON-HW']['fields']['jammingState']['max'], 2)
        self.assertTrue(any('NAV-STATUS' in k for k in obj['quality']))
        self.assertTrue(any('MON-HW' in k for k in obj['quality']))

    def test_mavlink_v2_tlog_with_crc16_mcrf4xx(self):
        def mav_crc(buf, extra):
            crc = 0xFFFF
            for b in buf + bytes([extra]):
                tmp = b ^ (crc & 0xFF)
                tmp = (tmp ^ (tmp << 4)) & 0xFF
                crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xFFFF
            return crc

        # MAVLink v2 GPS_RAW_INT (#24, extra=24)
        pl = struct.pack('<QiiiHHHHBB', 2000000, 504501000, 305235000, 450000, 90, 120, 1820, 8420, 3, 11)
        hdr_body = bytes([len(pl), 0, 0, 1, 1, 1, 24, 0, 0]) + pl
        crc = mav_crc(hdr_body, 24)
        pkt = struct.pack('>Q', 1700000000000000) + b'\xfd' + hdr_body + struct.pack('<H', crc)
        obj, _ = self.run_file(pkt, '.tlog')
        self.assertEqual(obj['format'], 'MAVLINK')
        self.assertAlmostEqual(obj['streams']['MAVLINK_GPS_RAW_INT']['fields']['alt_msl_m']['min'], 450.0)
        self.assertAlmostEqual(obj['streams']['MAVLINK_GPS_RAW_INT']['fields']['vel_m_s']['min'], 18.2)

    def test_ulog_signed_int32_timestamp_rejected(self):
        payload = (
            b'ULog\x01\x12\x35\x01' + struct.pack('<Q', 0) + ulog_record('B', bytes(40))
            + ulog_record('F', b'audit:int32_t timestamp;float value;')
            + ulog_record('A', struct.pack('<BH', 0, 1) + b'audit')
            + ulog_record('D', struct.pack('<Hif', 1, -1, 2.0))
        )
        obj, _ = self.run_file(payload, '.ulg', expected=2)
        self.assertTrue(obj['errors'])
        self.assertEqual(obj['records'], 0)


from telemetry_analyzer import ReferenceControllerVectorsTest  # noqa: E402,F401


if __name__ == '__main__':
    unittest.main()
