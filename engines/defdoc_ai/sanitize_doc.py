#!/usr/bin/env python3
"""
sanitize_doc.py — Клієнтський Pre-Flight Деідентифікатор технічної документації ОВТ (DefDoc AI v2.0).
Нативно підтримує:
  - `.docx` (парсинг та in-place токенізація `word/document.xml`: параграфи `<w:p>` і таблиці `<w:tbl>` через `zipfile` + `xml.etree.ElementTree`);
  - `.xlsx` (парсинг та in-place токенізація `xl/sharedStrings.xml` і `xl/worksheets/sheet1.xml`);
  - `.md` / `.txt`.
Працює 100% офлайн на стандартній бібліотеці Python 3.9+ (0 зовнішніх залежностей).
"""

import argparse
import hashlib
import io
import json
import platform
import re
import sys
import time
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
X_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
MAX_INPUT = 64 * 1024 * 1024
MAX_UNZIPPED = 128 * 1024 * 1024
MAX_XML = 32 * 1024 * 1024
_WORD_XML_PART_RE = re.compile(r"^word/(?:document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$")


def _has_forbidden_dtd(data: bytes) -> bool:
    probe = data.replace(b"\x00", b"").upper()
    return len(data) > MAX_XML or b"<!DOCTYPE" in probe or b"<!ENTITY" in probe


def _validate_zip_container(zin: zipfile.ZipFile) -> None:
    infos = zin.infolist()
    if len(infos) > 10000 or sum(i.file_size for i in infos) > MAX_UNZIPPED or any(i.file_size > MAX_XML for i in infos):
        raise ValueError("OpenXML перевищує ліміт розпакування 128 MiB / 32 MiB на частину")
    names = zin.namelist()
    if len(names) != len(set(names)):
        raise ValueError("Дубльовані частини ZIP: неоднозначний документ")
    if any(".." in n.replace("\\", "/").split("/") or n.startswith(("/", "\\")) for n in names):
        raise ValueError("CYBER-ZIP-SLIP: некоректний шлях у ZIP-архіві")


class DocumentSanitizer:
    def __init__(self, salt: str = "miltech-zero-trust-2026"):
        self.salt = salt
        self.token_map: Dict[str, str] = {}
        self.counters: Dict[str, int] = {
            "ASSET": 0,
            "ORG": 0,
            "EDRPOU": 0,
            "UNIT": 0,
            "VP": 0,
            "COORD": 0,
            "PERSON": 0,
            "SERIAL": 0,
            "ADDR": 0,
        }

    def _token(self, category: str, raw_value: str) -> str:
        norm = raw_value.strip()
        key = f"{category}:{norm}"
        if key not in self.token_map:
            self.counters[category] += 1
            short_hash = hashlib.sha256((self.salt + key).encode("utf-8")).hexdigest()[:4].upper()
            self.token_map[key] = f"[{category}_{self.counters[category]:02d}_{short_hash}]"
        return self.token_map[key]

    def sanitize_text(self, text: str) -> Tuple[str, Dict[str, int]]:
        out = text

        # 1. GPS Coordinates (e.g., 50.450123, 30.523456)
        out = re.sub(
            r"\b([4-5]\d\.\d{3,8})\s*,\s*([2-4]\d\.\d{3,8})\b",
            lambda m: self._token("COORD", m.group(0)),
            out,
        )

        # 2. EDRPOU codes (8 digits after ЄДРПОУ)
        out = re.sub(
            r"(ЄДРПОУ\s+)(\d{8})\b",
            lambda m: m.group(1) + self._token("EDRPOU", m.group(2)),
            out,
        )

        # 3. Military units (в/ч А9999) and ВП МОУ numbers (ВП №4821)
        out = re.sub(
            r"(в/ч\s+)([А-ЯІЇЄҐA-Z]\d{3,5})\b",
            lambda m: m.group(1) + self._token("UNIT", m.group(2)),
            out,
        )
        out = re.sub(
            r"(ВП\s*№\s*)(\d{3,5})\b",
            lambda m: m.group(1) + self._token("VP", m.group(2)),
            out,
        )

        # 4. Organization names (ТОВ «...», ПрАТ «...», ДП «...»)
        out = re.sub(
            r"\b(ТОВ|ПрАТ|ПАТ|ДП|НВП)\s+«([^»]+)»",
            lambda m: f"{m.group(1)} {self._token('ORG', m.group(2))}",
            out,
        )

        # 5. Proprietary asset names («ОБРІЙ-М2»)
        out = re.sub(
            r"«([А-ЯІЇЄҐA-Z0-9\-]{3,25})»",
            lambda m: self._token("ASSET", m.group(1)),
            out,
        )

        # 6. Serial / tail numbers (SN-OBR-2026-0104, UA-OBR-2026-001..003)
        out = re.sub(
            r"\b(?:SN|UA)-[A-Z0-9\-]+(?:\.\.\d+)?\b",
            lambda m: self._token("SERIAL", m.group(0)),
            out,
        )

        # 7. Physical addresses (м. Київ, вул. ...)
        out = re.sub(
            r"м\.\s*[А-ЯІЇЄҐа-яіїєґ\-]+,\s*вул\.\s*[А-ЯІЇЄҐа-яіїєґ\-]+,\s*\d+[А-Яа-я]?",
            lambda m: self._token("ADDR", m.group(0)),
            out,
        )

        # 8. Full names and Surname + Initials (Коваленко Олександр Сергійович, Коваленко О.С.)
        out = re.sub(
            r"\b([А-ЯІЇЄҐ][а-яіїєґ']+\s+[А-ЯІЇЄҐ]\.\s*[А-ЯІЇЄҐ]\.)",
            lambda m: self._token("PERSON", m.group(1)),
            out,
        )
        out = re.sub(
            r"\b([А-ЯІЇЄҐ][а-яіїєґ']+\s+[А-ЯІЇЄҐ][а-яіїєґ']+\s+[А-ЯІЇЄҐ][а-яіїєґ']+вич)\b",
            lambda m: self._token("PERSON", m.group(1)),
            out,
        )

        return out, dict(self.counters)

    def sanitize_docx_bytes(self, raw_docx: bytes) -> Tuple[bytes, str]:
        """Парсить `word/document.xml` та супровідні частини (колонтитули/виноски), токенізує всі `<w:t>` (включно з розірваними runs) і повертає очищений DOCX + текст."""
        if len(raw_docx) > MAX_INPUT:
            raise ValueError("Розмір вхідного файла перевищує 64 MiB")
        in_buf = io.BytesIO(raw_docx)
        out_buf = io.BytesIO()
        extracted_lines: List[str] = []

        with zipfile.ZipFile(in_buf, "r") as zin:
            _validate_zip_container(zin)
            for item in zin.infolist():
                if item.filename.endswith(".xml") or item.filename.endswith(".rels"):
                    if _has_forbidden_dtd(zin.read(item.filename)):
                        return b"", "REJECTED: XML перевищує ліміт або містить заборонені DTD/сутності"

            with zipfile.ZipFile(out_buf, "w", zipfile.ZIP_DEFLATED) as zout:
                for item in zin.infolist():
                    data = zin.read(item.filename)
                    if _WORD_XML_PART_RE.match(item.filename):
                        root = ET.fromstring(data)
                        for elem in root.iter():
                            if elem.tag.endswith("}t") and elem.text:
                                elem.text, _ = self.sanitize_text(elem.text)
                        for p_elem in root.iter():
                            if p_elem.tag.endswith("}p"):
                                t_nodes = [t for t in p_elem.iter() if t.tag.endswith("}t")]
                                if t_nodes:
                                    joined_p = "".join((t.text or "") for t in t_nodes)
                                    san_p, _ = self.sanitize_text(joined_p)
                                    if san_p != joined_p:
                                        t_nodes[0].text = san_p
                                        for t_extra in t_nodes[1:]:
                                            t_extra.text = ""
                        body = root.find(f"{{{W_NS}}}body") or root
                        for child in body:
                            if child.tag.endswith("}p"):
                                p_text = "".join((t.text or "") for t in child.iter() if t.tag.endswith("}t")).strip()
                                if p_text:
                                    extracted_lines.append(p_text)
                            elif child.tag.endswith("}tbl"):
                                for row in child.iter():
                                    if row.tag.endswith("}tr"):
                                        cells = []
                                        for cell in row:
                                            if cell.tag.endswith("}tc"):
                                                c_text = " ".join(
                                                    "".join((t.text or "") for t in p.iter() if t.tag.endswith("}t")).strip()
                                                    for p in cell
                                                    if p.tag.endswith("}p")
                                                ).strip()
                                                cells.append(c_text)
                                        if any(cells):
                                            extracted_lines.append(" | ".join(cells))
                        data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
                    zout.writestr(item, data)

        return out_buf.getvalue(), "\n".join(extracted_lines)

    def sanitize_xlsx_bytes(self, raw_xlsx: bytes) -> Tuple[bytes, str]:
        """Парсить `xl/sharedStrings.xml` та `xl/worksheets/sheet*.xml`, токенізує рядки та повертає очищений XLSX + табличний текст."""
        if len(raw_xlsx) > MAX_INPUT:
            raise ValueError("Розмір вхідного файла перевищує 64 MiB")
        in_buf = io.BytesIO(raw_xlsx)
        out_buf = io.BytesIO()
        shared_strings: List[str] = []
        extracted_rows: List[str] = []

        with zipfile.ZipFile(in_buf, "r") as zin:
            _validate_zip_container(zin)
            for item in zin.infolist():
                if item.filename.endswith(".xml") or item.filename.endswith(".rels"):
                    if _has_forbidden_dtd(zin.read(item.filename)):
                        return b"", "REJECTED: XML перевищує ліміт або містить заборонені DTD/сутності"

            sanitized_ss_bytes: Optional[bytes] = None
            if "xl/sharedStrings.xml" in zin.namelist():
                ss_root = ET.fromstring(zin.read("xl/sharedStrings.xml"))
                for si in ss_root.iter():
                    if si.tag.endswith("}si"):
                        t_nodes = [t for t in si.iter() if t.tag.endswith("}t")]
                        txt = "".join((t.text or "") for t in t_nodes)
                        san_txt, _ = self.sanitize_text(txt)
                        shared_strings.append(san_txt)
                        if t_nodes:
                            t_nodes[0].text = san_txt
                            for t_extra in t_nodes[1:]:
                                t_extra.text = ""
                sanitized_ss_bytes = ET.tostring(ss_root, encoding="utf-8", xml_declaration=True)

            with zipfile.ZipFile(out_buf, "w", zipfile.ZIP_DEFLATED) as zout:
                for item in zin.infolist():
                    data = zin.read(item.filename)
                    if item.filename == "xl/sharedStrings.xml" and sanitized_ss_bytes is not None:
                        data = sanitized_ss_bytes
                    elif item.filename.startswith("xl/worksheets/sheet") and item.filename.endswith(".xml"):
                        ws_root = ET.fromstring(data)
                        for row in ws_root.iter():
                            if row.tag.endswith("}row"):
                                row_vals: List[str] = []
                                for c in row:
                                    if not c.tag.endswith("}c"):
                                        continue
                                    c_type = c.attrib.get("t", "")
                                    v_node = next((ch for ch in c if ch.tag.endswith("}v")), None)
                                    is_node = next((ch for ch in c if ch.tag.endswith("}is")), None)
                                    val_str = ""
                                    if c_type == "s" and v_node is not None and v_node.text is not None:
                                        idx = int(v_node.text)
                                        if 0 <= idx < len(shared_strings):
                                            val_str = shared_strings[idx]
                                    elif c_type == "inlineStr" and is_node is not None:
                                        t_nodes = [t for t in is_node.iter() if t.tag.endswith("}t")]
                                        raw_inline = "".join((t.text or "") for t in t_nodes)
                                        val_str, _ = self.sanitize_text(raw_inline)
                                        if t_nodes:
                                            t_nodes[0].text = val_str
                                            for t_extra in t_nodes[1:]:
                                                t_extra.text = ""
                                    elif v_node is not None and v_node.text is not None:
                                        val_str, _ = self.sanitize_text(v_node.text)
                                        v_node.text = val_str
                                    if val_str:
                                        row_vals.append(val_str)
                                if row_vals:
                                    extracted_rows.append(" — ".join(row_vals))
                        data = ET.tostring(ws_root, encoding="utf-8", xml_declaration=True)
                    zout.writestr(item, data)

        return out_buf.getvalue(), "\n".join(extracted_rows)

    def sanitize_file(self, path: Path, output_dir: Optional[Path] = None) -> Tuple[str, Dict[str, int], int, int]:
        ext = path.suffix.lower()
        if path.stat().st_size > MAX_INPUT:
            raise ValueError("Розмір вхідного файла перевищує 64 MiB")
        raw_bytes = path.read_bytes()
        if ext == ".docx":
            san_bytes, extracted_text = self.sanitize_docx_bytes(raw_bytes)
        elif ext == ".xlsx":
            san_bytes, extracted_text = self.sanitize_xlsx_bytes(raw_bytes)
        else:
            raw_text = raw_bytes.decode("utf-8", errors="replace")
            extracted_text, _ = self.sanitize_text(raw_text)
            san_bytes = extracted_text.encode("utf-8")

        if output_dir is not None and san_bytes:
            output_dir.mkdir(parents=True, exist_ok=True)
            out_path = output_dir / f"{path.stem}.sanitized{path.suffix}"
            out_path.write_bytes(san_bytes)

        return extracted_text, dict(self.counters), len(raw_bytes), len(san_bytes)


def extract_document_text(path: Path) -> str:
    """Читає `.docx`, `.xlsx` або `.md`/`.txt` у уніфікований текстовий потік без сторонніх бібліотек."""
    ext = path.suffix.lower()
    if path.stat().st_size > MAX_INPUT:
        raise ValueError("Розмір вхідного файла перевищує 64 MiB")
    raw_bytes = path.read_bytes()
    if ext == ".docx":
        in_buf = io.BytesIO(raw_bytes)
        lines: List[str] = []
        with zipfile.ZipFile(in_buf, "r") as zin:
            _validate_zip_container(zin)
            for name in sorted(zin.namelist()):
                if _WORD_XML_PART_RE.match(name):
                    part_bytes = zin.read(name)
                    if _has_forbidden_dtd(part_bytes):
                        raise ValueError("XML перевищує ліміт або містить заборонені DTD/сутності")
                    root = ET.fromstring(part_bytes)
                    body = root.find(f"{{{W_NS}}}body") or root
                    for child in body:
                        if child.tag.endswith("}p"):
                            p_text = "".join((t.text or "") for t in child.iter() if t.tag.endswith("}t")).strip()
                            if p_text:
                                lines.append(p_text)
                        elif child.tag.endswith("}tbl"):
                            for row in child.iter():
                                if row.tag.endswith("}tr"):
                                    cells = []
                                    for cell in row:
                                        if cell.tag.endswith("}tc"):
                                            c_text = " ".join(
                                                "".join((t.text or "") for t in p.iter() if t.tag.endswith("}t")).strip()
                                                for p in cell
                                                if p.tag.endswith("}p")
                                            ).strip()
                                            cells.append(c_text)
                                    if any(cells):
                                        lines.append(" — ".join(cells))
        return "\n".join(lines)
    if ext == ".xlsx":
        in_buf = io.BytesIO(raw_bytes)
        shared_strings: List[str] = []
        rows: List[str] = []
        with zipfile.ZipFile(in_buf, "r") as zin:
            _validate_zip_container(zin)
            if "xl/sharedStrings.xml" in zin.namelist():
                ss_bytes = zin.read("xl/sharedStrings.xml")
                if _has_forbidden_dtd(ss_bytes):
                    raise ValueError("XML перевищує ліміт або містить заборонені DTD/сутності")
                ss_root = ET.fromstring(ss_bytes)
                for si in ss_root.iter():
                    if si.tag.endswith("}si"):
                        shared_strings.append("".join((t.text or "") for t in si.iter() if t.tag.endswith("}t")))
            for name in sorted(zin.namelist()):
                if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"):
                    ws_bytes = zin.read(name)
                    if _has_forbidden_dtd(ws_bytes):
                        raise ValueError("XML перевищує ліміт або містить заборонені DTD/сутності")
                    ws_root = ET.fromstring(ws_bytes)
                    for row in ws_root.iter():
                        if row.tag.endswith("}row"):
                            r_vals: List[str] = []
                            for c in row:
                                if not c.tag.endswith("}c"):
                                    continue
                                c_type = c.attrib.get("t", "")
                                v_node = next((ch for ch in c if ch.tag.endswith("}v")), None)
                                is_node = next((ch for ch in c if ch.tag.endswith("}is")), None)
                                val_str = ""
                                if c_type == "s" and v_node is not None and v_node.text is not None:
                                    idx = int(v_node.text)
                                    if 0 <= idx < len(shared_strings):
                                        val_str = shared_strings[idx]
                                elif c_type == "inlineStr" and is_node is not None:
                                    val_str = "".join((t.text or "") for t in is_node.iter() if t.tag.endswith("}t"))
                                elif v_node is not None and v_node.text is not None:
                                    val_str = v_node.text
                                if val_str:
                                    r_vals.append(val_str)
                            if r_vals:
                                rows.append(" — ".join(r_vals))
        return "\n".join(rows)
    return path.read_text(encoding="utf-8", errors="replace")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Client-side Pre-Flight De-identifier for ОВТ Technical Documentation (.docx / .xlsx / .md)"
    )
    parser.add_argument(
        "inputs",
        nargs="*",
        help="Input files (.docx, .xlsx, .md) to sanitize",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Optional directory to write sanitized files (omit for RAM-only verification)",
    )
    parser.add_argument(
        "--json-stats",
        action="store_true",
        help="Print sanitization statistics as JSON",
    )
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent
    if not args.inputs:
        sample_dir = base_dir / "sample_data"
        files = sorted(
            list(sample_dir.glob("*.docx")) + list(sample_dir.glob("*.xlsx")) + list(sample_dir.glob("*.md"))
        )
    else:
        files = [Path(p) for p in args.inputs]

    t0 = time.perf_counter()
    sanitizer = DocumentSanitizer()
    processed = []
    out_dir = Path(args.output_dir) if args.output_dir else None

    for fpath in files:
        _, _, raw_len, san_len = sanitizer.sanitize_file(fpath, output_dir=out_dir)
        processed.append(
            {
                "file": fpath.name,
                "format": fpath.suffix.lower().lstrip(".").upper(),
                "raw_bytes": raw_len,
                "sanitized_bytes": san_len,
            }
        )

    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    summary = {
        "files_processed": len(processed),
        "elapsed_ms": round(elapsed_ms, 3),
        "redaction_counts": sanitizer.counters,
        "total_redactions": sum(sanitizer.counters.values()),
        "platform": platform.platform(),
        "python": platform.python_version(),
        "files": processed,
    }

    if args.json_stats:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print(
            f"[sanitize_doc] Опрацьовано файлів: {summary['files_processed']} "
            f"({', '.join(p['file'] for p in processed)}) | "
            f"Замінено чутливих сутностей: {summary['total_redactions']} | "
            f"Час виконання: {summary['elapsed_ms']:.2f} мс"
        )
        for k, v in summary["redaction_counts"].items():
            if v > 0:
                print(f"  - {k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
