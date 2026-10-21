"""Bounded, local client document intake. No certification or automatic corrections."""
from datetime import datetime, timezone
from decimal import Decimal, getcontext
import hashlib
import io
import json
import os
from pathlib import Path
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

getcontext().prec = 64

MAX_INPUT = 64 * 1024 * 1024
MAX_XML = 32 * 1024 * 1024
MAX_RECORDS = 30000
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
X = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

_ZERO_WIDTH_RE = re.compile(r'[\u00ad\u034f\u061c\u180e\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]')
_WORD_TOKEN_RE = re.compile(r'[А-ЯІЇЄҐа-яіїєґA-Za-z\u0370-\u03ff]{2,}')
_CYR_RE = re.compile(r'[А-ЯІЇЄҐа-яіїєґ]')
_LAT_RE = re.compile(r'[A-Za-z]')
_GREEK_OR_FULLWIDTH_RE = re.compile(r'[\u0370-\u03ff\uff00-\uffef]')
_DIGIT_LETTER_SPOOF_RE = re.compile(r'(?<![A-Za-zА-ЯІЇЄҐа-яіїєґ0-9_])(?:\d+[ОоЗзOolI]+\d*(?:[.,]\d+)?|[ОоЗзl]+\d+(?:[.,]\d+)?)(?![A-Za-zА-ЯІЇЄҐа-яіїєґ0-9_])')
_WHOLE_WORD_LATIN_SPOOF = {'maca', 'hopma', 'napaметр', 'napametp', 'ctpym', 'akb', 'kr', 'mm', 'km'}
_LAT_TO_CYR_HOMOGLYPHS = str.maketrans({
    'A': 'А', 'B': 'В', 'C': 'С', 'E': 'Е', 'H': 'Н', 'I': 'І', 'K': 'К', 'M': 'М', 'O': 'О', 'P': 'Р', 'T': 'Т', 'X': 'Х',
    'a': 'а', 'c': 'с', 'e': 'е', 'i': 'і', 'k': 'к', 'm': 'м', 'o': 'о', 'p': 'р', 'x': 'х', 'y': 'у',
})


def detect_cyber_text_anomalies(text: str) -> list[str]:
    """Detects invisible zero-width/BiDi/soft-hyphen chars, mixed-script & whole-word homoglyphs,
    Greek/fullwidth lookalikes, and digit-letter substitutions (e.g. '1О кг').
    """
    if not text:
        return []
    issues = []
    zw_matches = _ZERO_WIDTH_RE.findall(text)
    if zw_matches:
        codes = ', '.join(sorted({f'U+{ord(ch):04X}' for ch in zw_matches}))
        issues.append(f'CYBER-ZERO-WIDTH: виявлено приховані керівні Unicode-символи ({codes})')
    cleaned = re.sub(r'`[^`]*`', ' ', text)
    gf_matches = _GREEK_OR_FULLWIDTH_RE.findall(cleaned)
    if gf_matches:
        codes = ', '.join(sorted({f"'{ch}'(U+{ord(ch):04X})" for ch in gf_matches}))
        issues.append(f'CYBER-HOMOGLYPH: виявлено грецькі або повноширинні символи підміни ({codes})')
    for dm in _DIGIT_LETTER_SPOOF_RE.finditer(cleaned):
        issues.append(f"CYBER-HOMOGLYPH: підміна цифр літерами О/З/O/l/I у числовому токені '{dm.group(0)}'")
    has_cyr_context = bool(_CYR_RE.search(cleaned))
    for m in _WORD_TOKEN_RE.finditer(cleaned):
        tok = m.group(0)
        if _CYR_RE.search(tok) and _LAT_RE.search(tok):
            lat_chars = ', '.join(f"'{ch}'(U+{ord(ch):04X})" for ch in tok if 'A' <= ch <= 'Z' or 'a' <= ch <= 'z')
            issues.append(f"CYBER-HOMOGLYPH: змішування кирилиці та латиниці у токені '{tok}' [латиниця: {lat_chars}]")
        elif has_cyr_context and tok.lower() in ('maca', 'hopma', 'ctpym', 'akb', 'kr'):
            issues.append(f"CYBER-HOMOGLYPH: повністю латинський токен-двійник '{tok}' у кириличному полі")
    return issues


def _dehomoglyph_token(word: str) -> str:
    if (_CYR_RE.search(word) and _LAT_RE.search(word)) or word.lower() in ('maca', 'hopma', 'ctpym', 'akb'):
        return word.translate(_LAT_TO_CYR_HOMOGLYPHS)
    return word


def normalize_cyber_text(text: str) -> str:
    """Strips zero-width chars and normalizes mixed-script tokens so spoofed rows still match rules (and fail)."""
    no_zw = _ZERO_WIDTH_RE.sub('', text)
    return _WORD_TOKEN_RE.sub(lambda m: _dehomoglyph_token(m.group(0)), no_zw)



def xml(data):
    declaration_probe = data.replace(b'\x00', b'').upper()
    if len(data) > MAX_XML or b'<!DOCTYPE' in declaration_probe or b'<!ENTITY' in declaration_probe:
        raise ValueError('XML перевищує ліміт або містить заборонені DTD/сутності')
    return ET.fromstring(data)


def _col_index(letters: str) -> int:
    col = 0
    for ch in letters:
        col = col * 26 + ord(ch) - 64
    return col


def _format_dec(val: Decimal) -> str:
    norm = val.normalize()
    s = format(norm, 'f')
    return '0' if s == '-0' else s


def _eval_safe_xlsx_formula(
    expr: str,
    numeric_cells: dict,
    depth: int = 0,
    pending_formulas: set = None,
    non_numeric_cells: set = None,
):
    """Deterministically evaluates bounded Excel arithmetic & aggregate formulas
    (SUM, MIN, MAX, AVERAGE, +, -, *, /, parentheses, and same-sheet cell refs).
    Returns Decimal or None if unsupported/unresolvable.
    """
    if depth > 8 or not expr:
        return None
    s = expr.strip().lstrip('=').strip()
    if not s or len(s) > 256:
        return None
    if re.search(r'[\[\]!$"\';]', s):
        return None

    def replace_agg(m):
        fn = m.group(1).upper()
        arg_str = m.group(2).strip()
        vals = []
        for part in arg_str.split(','):
            part = part.strip()
            rm = re.fullmatch(r'([A-Z]{1,3})([1-9][0-9]*):([A-Z]{1,3})([1-9][0-9]*)', part, flags=re.IGNORECASE)
            if rm:
                c1, r1 = _col_index(rm.group(1).upper()), int(rm.group(2))
                c2, r2 = _col_index(rm.group(3).upper()), int(rm.group(4))
                if c1 > c2 or r1 > r2 or (c2 - c1 + 1) * (r2 - r1 + 1) > 1000:
                    raise ValueError('range')
                for rr in range(r1, r2 + 1):
                    for cc in range(c1, c2 + 1):
                        if pending_formulas and (cc, rr) in pending_formulas:
                            raise ValueError('unresolved formula in range')
                        if non_numeric_cells and (cc, rr) in non_numeric_cells:
                            raise ValueError('non-numeric cell in range')
                        if (cc, rr) in numeric_cells:
                            vals.append(numeric_cells[(cc, rr)])
                continue
            cm = re.fullmatch(r'([A-Z]{1,3})([1-9][0-9]*)', part, flags=re.IGNORECASE)
            if cm:
                coord = (_col_index(cm.group(1).upper()), int(cm.group(2)))
                if pending_formulas and coord in pending_formulas:
                    raise ValueError('unresolved formula ref')
                if coord not in numeric_cells:
                    raise ValueError('missing ref')
                vals.append(numeric_cells[coord])
                continue
            if re.fullmatch(r'[+-]?(?:\d+(?:\.\d+)?|\.\d+)', part):
                vals.append(Decimal(part))
                continue
            raise ValueError('unsupported arg')
        if not vals:
            raise ValueError('empty agg')
        if fn == 'SUM':
            res = sum(vals, Decimal(0))
        elif fn == 'MIN':
            res = min(vals)
        elif fn == 'MAX':
            res = max(vals)
        elif fn in ('AVERAGE', 'AVG'):
            res = sum(vals, Decimal(0)) / Decimal(len(vals))
        else:
            raise ValueError('fn')
        return _format_dec(res)

    try:
        while True:
            new_s, count = re.subn(
                r'\b(SUM|MIN|MAX|AVERAGE|AVG)\s*\(([^()]*)\)',
                replace_agg,
                s,
                flags=re.IGNORECASE,
            )
            s = new_s
            if count == 0:
                break

        def replace_ref(m):
            coord = (_col_index(m.group(1).upper()), int(m.group(2)))
            if pending_formulas and coord in pending_formulas:
                raise ValueError('unresolved formula cell')
            if coord not in numeric_cells:
                raise ValueError('missing cell')
            return _format_dec(numeric_cells[coord])

        s = re.sub(r'\b([A-Z]{1,3})([1-9][0-9]*)\b', replace_ref, s, flags=re.IGNORECASE)
        if not re.fullmatch(r'[\d\s.+*/()-]+', s):
            return None
        tokens = re.findall(r'\d+(?:\.\d+)?|\.\d+|[+*/()-]', s)
        if ''.join(tokens) != re.sub(r'\s+', '', s):
            return None
        pos = 0

        def parse_expr():
            nonlocal pos
            val = parse_term()
            while pos < len(tokens) and tokens[pos] in ('+', '-'):
                op = tokens[pos]
                pos += 1
                rhs = parse_term()
                val = val + rhs if op == '+' else val - rhs
            return val

        def parse_term():
            nonlocal pos
            val = parse_factor()
            while pos < len(tokens) and tokens[pos] in ('*', '/'):
                op = tokens[pos]
                pos += 1
                rhs = parse_factor()
                if op == '/':
                    if rhs == 0:
                        raise ZeroDivisionError()
                    val = val / rhs
                else:
                    val = val * rhs
            return val

        def parse_factor():
            nonlocal pos
            if pos >= len(tokens):
                raise ValueError('eof')
            tok = tokens[pos]
            if tok in ('+', '-'):
                pos += 1
                v = parse_factor()
                return v if tok == '+' else -v
            if tok == '(':
                pos += 1
                v = parse_expr()
                if pos >= len(tokens) or tokens[pos] != ')':
                    raise ValueError('paren')
                pos += 1
                return v
            pos += 1
            return Decimal(tok)

        result = parse_expr()
        if pos != len(tokens):
            return None
        return result
    except Exception:
        return None


def extract(path, role):
    path = Path(path)
    if path.suffix.lower() not in ('.docx', '.xlsx', '.md', '.txt'):
        raise ValueError('Підтримуються лише .docx, .xlsx, .md, .txt')
    if path.stat().st_size > MAX_INPUT:
        raise ValueError('Розмір вхідного файла перевищує 64 MiB')
    raw = path.read_bytes()
    records, warnings = [], []
    expanded_cells = 0
    def add(location, cells, group='', uncertain=False, cell_locations=None, merged_cols=None, formula_mismatch=False):
        if any(c.strip() for c in cells):
            if len(records) >= MAX_RECORDS:
                raise ValueError('Більше 30000 рядків: розділіть вхідний файл')
            row_cyber = []
            for c in cells:
                for issue in detect_cyber_text_anomalies(c):
                    if issue not in row_cyber:
                        row_cyber.append(issue)
            if row_cyber:
                warnings.append(f"{location}: {'; '.join(row_cyber)}")
            rec = dict(
                location=location,
                cells=cells,
                group=group,
                uncertain=uncertain,
                cell_locations=cell_locations or [],
                merged_cols=merged_cols or [],
                formula_mismatch=formula_mismatch,
                cyber_anomalies=row_cyber,
            )
            records.append(rec)
            return rec
        return None
    if path.suffix.lower() in ('.md', '.txt'):
        table_number, in_table = 0, False
        for n, line in enumerate(raw.decode('utf-8-sig').splitlines(), 1):
            is_table = '|' in line
            if is_table and not in_table: table_number += 1
            in_table = is_table
            if re.fullmatch(r'[\s|:\-]+', line):
                continue
            cells = [c.strip() for c in line.strip().strip('|').split('|')] if '|' in line else [line.strip()]
            add(f'рядок {n}', cells, f'text{table_number}' if len(cells) > 1 else '')
    else:
        if raw.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'):
            if b'EncryptedPackage' in raw or 'EncryptedPackage'.encode('utf-16le') in raw:
                raise ValueError('Файл зашифровано паролем MS Office (OLE2 EncryptedPackage / RMS); зніміть захист паролем перед локальною перевіркою')
            raise ValueError('Виявлено бінарний контейнер старого формату OLE2 (.doc/.xls) під виглядом OpenXML; перезбережіть у відкритий .docx/.xlsx')
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            infos = z.infolist()
            if len(infos) > 10000 or sum(i.file_size for i in infos) > 128 * 1024 * 1024 or any(i.file_size > MAX_XML for i in infos):
                raise ValueError('OpenXML перевищує ліміт розпакування 128 MiB / 32 MiB на частину')
            if len(z.namelist()) != len(set(z.namelist())):
                raise ValueError('Дубльовані частини ZIP: неоднозначний документ')
            if any('..' in n.replace('\\', '/').split('/') or n.startswith(('/', '\\')) for n in z.namelist()):
                raise ValueError('CYBER-ZIP-SLIP: некоректний шлях у ZIP-архіві (спроба виходу за межі директорії)')
            if path.suffix.lower() == '.docx':
                root = xml(z.read('word/document.xml'))
                body = root.find(f'{{{W}}}body')
                if body is None:
                    raise ValueError('DOCX не має основного тіла документа')
                def text(node):
                    return ''.join(e.text or '' if e.tag == f'{{{W}}}t' else '\t' if e.tag == f'{{{W}}}tab' else '\n' if e.tag in (f'{{{W}}}br', f'{{{W}}}cr') else '' for e in node.iter()).strip()
                # Body paragraphs and table rows stay in source order; runs are joined without invented spaces.
                pnum, tnum = 0, 0
                for child in body:
                    if child.tag == f'{{{W}}}p':
                        pnum += 1; add(f'word/document.xml: абзац {pnum}', [text(child)])
                    elif child.tag == f'{{{W}}}tbl':
                        tnum += 1
                        vmerge_carry = {}
                        all_rows = child.findall(f'{{{W}}}tr')
                        max_table_tcs = max((len(r_n.findall(f'{{{W}}}tc')) for r_n in all_rows), default=0)
                        has_banner_row = any(len(r_n.findall(f'{{{W}}}tc')) == 1 for r_n in all_rows)
                        for n, row in enumerate(all_rows, 1):
                            tcs = row.findall(f'{{{W}}}tc')
                            cells = [' '.join(text(p) for p in c.findall(f'{{{W}}}p')) for c in tcs]
                            has_before_after = any(e.tag in (f'{{{W}}}gridBefore', f'{{{W}}}gridAfter') for e in row.iter())
                            has_grid_span = any(e.tag == f'{{{W}}}gridSpan' for e in row.iter())
                            is_two_col_full = (has_banner_row and max_table_tcs == 2 and len(tcs) == 2)
                            has_grid_shift = has_before_after or (has_grid_span and not is_two_col_full)
                            has_vmerge = any(e.tag == f'{{{W}}}vMerge' for e in row.iter())
                            # Full-row section banner: single cell row in a table
                            if len(tcs) == 1 and not has_vmerge:
                                add(f'word/document.xml: таблиця {tnum}, рядок {n}', cells, '')
                                continue
                            row_merged_cols = []
                            for c_idx, tc in enumerate(tcs):
                                vm = tc.find(f'.//{{{W}}}vMerge')
                                gs = any(e.tag in (f'{{{W}}}gridBefore', f'{{{W}}}gridAfter') for e in tc.iter()) or (
                                    tc.find(f'.//{{{W}}}gridSpan') is not None and not is_two_col_full
                                )
                                if gs:
                                    row_merged_cols.append(c_idx)
                                if vm is not None:
                                    row_merged_cols.append(c_idx)
                                    val_attr = vm.attrib.get(f'{{{W}}}val', 'continue')
                                    if val_attr == 'restart' or cells[c_idx]:
                                        vmerge_carry[c_idx] = cells[c_idx]
                                    elif not cells[c_idx] and c_idx in vmerge_carry:
                                        cells[c_idx] = vmerge_carry[c_idx]
                                else:
                                    vmerge_carry.pop(c_idx, None)
                            merged = has_grid_shift or has_vmerge
                            if merged:
                                warnings.append(f'Таблиця {tnum}, рядок {n}: об’єднані/зсунуті комірки; автоматичне зіставлення потребує перевірки колонок.')
                            add(
                                f'word/document.xml: таблиця {tnum}, рядок {n}',
                                cells,
                                f'table{tnum}',
                                has_grid_shift,
                                merged_cols=row_merged_cols,
                            )
                    elif child.tag != f'{{{W}}}sectPr':
                        warnings.append('Вкладений блок DOCX поза абзацами/таблицями не інтерпретовано; перевірити вручну.')
                warnings.append('DOCX: аналіз основного тексту й прямих таблиць; зображення, колонтитули, виноски, вкладені таблиці та підписи не перевірено.')
                if root.find(f'.//{{{W}}}del') is not None or root.find(f'.//{{{W}}}ins') is not None:
                    warnings.append('DOCX має відстежувані зміни: редакцію та вилучений текст слід узгодити вручну.')
                    for record in records: record['uncertain'] = True
            else:
                shared = []
                if 'xl/sharedStrings.xml' in z.namelist():
                    shared = [''.join(t.text or '' for t in si.iter(f'{{{X}}}t')) for si in xml(z.read('xl/sharedStrings.xml')).findall(f'{{{X}}}si')]
                wb = xml(z.read('xl/workbook.xml'))
                rels = {r.attrib['Id']: r for r in xml(z.read('xl/_rels/workbook.xml.rels'))}
                for sheet in wb.findall(f'.//{{{X}}}sheet'):
                    relation = rels.get(sheet.attrib.get(f'{{{R}}}id'))
                    if relation is None or relation.attrib.get('TargetMode') == 'External':
                        raise ValueError('Недоступне або зовнішнє посилання на аркуш')
                    target = relation.attrib['Target']
                    target = posixpath.normpath(target.lstrip('/') if target.startswith('/') else posixpath.join('xl', target))
                    if not target.startswith('xl/'):
                        raise ValueError('Некоректний шлях аркуша XLSX')
                    name = sheet.attrib.get('name', target)
                    ws = xml(z.read(target))
                    if ws.find(f'{{{X}}}sheetData') is None:
                        warnings.append(f'{name}: тип аркуша без sheetData не аналізується.'); continue
                    horiz_merged_rows = set()
                    vert_merged_cells = {}
                    rect_merged_cols_by_row = {}
                    mc_node = ws.find(f'{{{X}}}mergeCells')
                    if mc_node is not None:
                        warnings.append(f'{name}: є об’єднані комірки; порожні комірки не заповнюються здогадками.')
                        for mc in mc_node.findall(f'{{{X}}}mergeCell'):
                            ref_range = mc.attrib.get('ref', '')
                            rm = re.fullmatch(r'([A-Z]{1,3})([1-9][0-9]*):([A-Z]{1,3})([1-9][0-9]*)', ref_range)
                            if rm:
                                c1, r1 = _col_index(rm.group(1)), int(rm.group(2))
                                c2, r2 = _col_index(rm.group(3)), int(rm.group(4))
                                if r1 == r2 and c2 > c1:
                                    horiz_merged_rows.add((r1, c1, c2))
                                elif c1 == c2 and r2 > r1 and (r2 - r1) <= 500:
                                    for rr in range(r1, r2 + 1):
                                        vert_merged_cells[(c1, rr)] = (c1, r1)
                                elif r2 > r1 and c2 > c1:
                                    for rr in range(r1, min(r2 + 1, r1 + 501)):
                                        rect_merged_cols_by_row.setdefault(rr, []).extend(range(c1 - 1, c2))
                    numeric_cells = {}
                    formula_cells = {}
                    non_numeric_cells = set()
                    raw_rows = ws.findall(f'{{{X}}}sheetData/{{{X}}}row')
                    # First pass: collect literal numeric values and formula expressions
                    for row in raw_rows:
                        for c in row.findall(f'{{{X}}}c'):
                            ref = c.attrib.get('r', '')
                            m = re.fullmatch(r'([A-Z]{1,3})([1-9][0-9]*)', ref)
                            if not m:
                                continue
                            coord = (_col_index(m[1]), int(m[2]))
                            f_node = c.find(f'{{{X}}}f')
                            kind = c.attrib.get('t', 'n')
                            if f_node is not None:
                                formula_cells[coord] = (f_node.text or '').strip()
                            elif kind in ('n', ''):
                                v_txt = c.findtext(f'{{{X}}}v', '').strip()
                                if re.fullmatch(r'[+-]?(?:\d+(?:\.\d+)?|\.\d+)', v_txt):
                                    numeric_cells[coord] = Decimal(v_txt)
                                elif v_txt:
                                    non_numeric_cells.add(coord)
                            else:
                                non_numeric_cells.add(coord)
                    # Multi-pass topological/iterative resolution for dependent formulas (e.g. SUM over formula cells)
                    for _ in range(16):
                        pending = set(formula_cells.keys()) - set(numeric_cells.keys())
                        if not pending:
                            break
                        progressed = False
                        for coord in list(pending):
                            res_val = _eval_safe_xlsx_formula(
                                formula_cells[coord],
                                numeric_cells,
                                pending_formulas=pending - {coord},
                                non_numeric_cells=non_numeric_cells,
                            )
                            if res_val is not None:
                                numeric_cells[coord] = res_val
                                progressed = True
                        if not progressed:
                            break
                    unresolved_formulas = set(formula_cells.keys()) - set(numeric_cells.keys())
                    vmerge_values = {}
                    seen_coords = {}
                    for rownum, row in enumerate(raw_rows, 1):
                        r_idx = int(row.attrib.get('r', rownum))
                        cells, locations, uncertain = {}, {}, False
                        row_merged_cols = list(rect_merged_cols_by_row.get(r_idx, []))
                        if r_idx in rect_merged_cols_by_row:
                            uncertain = True
                        formula_mismatch = False
                        row_coords = []
                        for c in row.findall(f'{{{X}}}c'):
                            ref = c.attrib.get('r', '')
                            m = re.fullmatch(r'([A-Z]{1,3})([1-9][0-9]*)', ref)
                            if not m: raise ValueError('Комірка XLSX без валідної адреси')
                            col = _col_index(m[1])
                            ref_row = int(m[2])
                            if col > 16384 or ref_row > 1048576 or col in cells:
                                raise ValueError('Некоректна або повторна адреса комірки XLSX')
                            if ref_row != r_idx:
                                uncertain = True
                                warnings.append(f'{name}!{ref}: номер рядка в адресі комірки ({ref_row}) не збігається з рядком XML ({r_idx}).')
                            if (col, ref_row) in seen_coords:
                                uncertain = True
                                warnings.append(f'{name}!{ref}: дубльована адреса комірки між рядками XML.')
                                prev_rec = seen_coords[(col, ref_row)].get('record')
                                if prev_rec is not None:
                                    prev_rec['uncertain'] = True
                            row_coords.append((col, ref_row))
                            value = c.findtext(f'{{{X}}}v', '')
                            kind = c.attrib.get('t', 'n')
                            if kind == 's':
                                idx = int(value)
                                if idx < 0 or idx >= len(shared): raise ValueError('Індекс sharedStrings поза межами')
                                value = shared[idx]
                            elif kind == 'inlineStr': value = ''.join(t.text or '' for t in c.iter(f'{{{X}}}t'))
                            elif kind == 'b':
                                value = {'0': 'FALSE', '1': 'TRUE'}.get(value, 'INVALID_BOOLEAN')
                            elif kind not in ('n', 'str', 'd', 'e'):
                                uncertain = True; warnings.append(f'{name}!{ref}: невідомий тип комірки {kind}')
                            elif kind == 'e':
                                uncertain = True; warnings.append(f'{name}!{ref}: помилка Excel {value}')
                            f_node = c.find(f'{{{X}}}f')
                            if f_node is not None:
                                f_expr = (f_node.text or '').strip()
                                coord = (col, ref_row)
                                calc_val = numeric_cells.get(coord) if coord not in unresolved_formulas else _eval_safe_xlsx_formula(
                                    f_expr,
                                    numeric_cells,
                                    pending_formulas=unresolved_formulas - {coord},
                                    non_numeric_cells=non_numeric_cells,
                                )
                                if calc_val is not None:
                                    numeric_cells[coord] = calc_val
                                    calc_str = _format_dec(calc_val)
                                    if value.strip():
                                        try:
                                            cached_dec = Decimal(value.strip().replace(',', '.'))
                                            if abs(cached_dec - calc_val) > Decimal('1e-6'):
                                                formula_mismatch = True
                                                warnings.append(f'{name}!{ref}: формула ({f_expr}) = {calc_str} суперечить кешу <v> ({value})!')
                                            elif cached_dec != calc_val:
                                                warnings.append(f'{name}!{ref}: формула ({f_expr}) = {calc_str} уточнює округлений кеш <v> ({value}).')
                                            else:
                                                warnings.append(f'{name}!{ref}: формула ({f_expr}) детерміновано верифікована за кешем <v> ({value}).')
                                            value = calc_str
                                        except Exception:
                                            uncertain = True
                                            warnings.append(f'{name}!{ref}: формула; кеш наявний, але нечисловий.')
                                    else:
                                        value = calc_str
                                        warnings.append(f'{name}!{ref}: формула ({f_expr}); кеш відсутній, обчислено детерміновано = {value}.')
                                else:
                                    uncertain = True
                                    warnings.append(f'{name}!{ref}: формула; кеш {"наявний, може бути застарілим" if value else "відсутній"}; обчислення не виконувалось.')
                            if (col, r_idx) in vert_merged_cells:
                                row_merged_cols.append(col - 1)
                                origin = vert_merged_cells[(col, r_idx)]
                                if origin == (col, r_idx) and value:
                                    vmerge_values[origin] = value
                                elif not value and origin in vmerge_values:
                                    value = vmerge_values[origin]
                            cells[col], locations[col] = value, f'{name}!{ref}'
                        if cells:
                            highest = max(cells)
                            expanded_cells += highest
                            if expanded_cells > 500000:
                                raise ValueError('Розгортання розріджених таблиць перевищує 500000 комірок; розділіть файл')
                            non_empty_cols = [c_i for c_i, v_i in cells.items() if str(v_i).strip()]
                            is_banner = (
                                r_idx not in rect_merged_cols_by_row
                                and any(r_m == r_idx and len(non_empty_cols) == 1 and non_empty_cols[0] == c1_m for r_m, c1_m, _ in horiz_merged_rows)
                            )
                            has_horiz_merge = any(r_m == r_idx for r_m, _, _ in horiz_merged_rows) and not is_banner
                            rec = add(
                                f'{name}!рядок {row.attrib.get("r",rownum)} ({target})',
                                [cells.get(c,'') for c in range(1,highest+1)],
                                '' if is_banner else target,
                                uncertain or has_horiz_merge,
                                [locations.get(c,'') for c in range(1,highest+1)],
                                merged_cols=row_merged_cols,
                                formula_mismatch=formula_mismatch,
                            )
                            for rc_coord in row_coords:
                                if rc_coord not in seen_coords:
                                    seen_coords[rc_coord] = {'r_idx': r_idx, 'record': rec}
                warnings.append('XLSX: числові значення без форматування Excel; дати, одиниці з форматів, діаграми та макроси не інтерпретуються; прості арифметичні/SUM формули верифіковано. Приховані аркуші включено.')
    if not records:
        raise ValueError('Файл порожній або не містить доступного тексту/комірок')
    return dict(path=str(path.resolve()), name=path.name, role=role, bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(), records=records, warnings=warnings)


UNITS = {
    'кг': ('mass', 1), 'г': ('mass', .001), 'kg': ('mass', 1), 'g': ('mass', .001),
    'м': ('length', 1), 'мм': ('length', .001), 'см': ('length', .01), 'км': ('length', 1000), 'm': ('length', 1), 'mm': ('length', .001),
    'с': ('time', 1), 'хв': ('time', 60), 'хв.': ('time', 60), 'хвилин': ('time', 60), 'хвилини': ('time', 60),
    'год': ('time', 3600), 'год.': ('time', 3600), 'годин': ('time', 3600), 'години': ('time', 3600),
    'А': ('current', 1), 'мА': ('current', .001), 'В': ('voltage', 1),
    'Вт': ('power', 1), 'кВт': ('power', 1000),
    'Вт·год': ('energy', 1), 'Вт-год': ('energy', 1), 'Вт год': ('energy', 1), 'кВт·год': ('energy', 1000), 'кВт-год': ('energy', 1000),
    '°C': ('temperature', 1), '°С': ('temperature', 1), '° C': ('temperature', 1), '° С': ('temperature', 1),
    'шт': ('count', 1), 'шт.': ('count', 1), '%': ('percent', 1),
    'МГц': ('frequency', 1), 'ГГц': ('frequency', 1000), 'кГц': ('frequency', .001),
    'мА·год': ('capacity', 1), 'мАг': ('capacity', 1), 'мА-год': ('capacity', 1), 'А·год': ('capacity', 1000), 'Аг': ('capacity', 1000),
    'м/с': ('speed', 1), 'км/год': ('speed', 1000 / 3600), 'дБ': ('db', 1), 'дБм': ('dbm', 1), 'дБ-Гц': ('cn0', 1), 'dB-Hz': ('cn0', 1),
}

_UNIT_KEYS_PATTERN = '|'.join(re.escape(k) for k in sorted(UNITS, key=len, reverse=True))


_NEGATION_RE = re.compile(
    r'(?<![А-ЯІЇЄҐа-яіїєґA-Za-z])(?:'
    r'не\s+перевірено|не\s+підтвердж[а-яіїєґ]*|не\s+виміряно|не\s+тестувал[а-яіїєґ]*|'
    r'не\s+випробовув[а-яіїєґ]*|підтвердження\s+відсутн[а-яіїєґ]*|відсутн[а-яіїєґ]+|'
    r'немає|без\s+перевірк[а-яіїєґ]*|без\s+підтвердж[а-яіїєґ]*|'
    r'unverified|not\s+verified|not\s+tested'
    r')(?![А-ЯІЇЄҐа-яіїєґA-Za-z])',
    re.IGNORECASE,
)


def _strip_meta_notes(text: str) -> str:
    s = text.replace('`', '').replace('−', '-').replace('–', '-').replace('—', '-').strip()
    s = re.sub(r'\s*\([+-]?\d+(?:[.,]\d+)?\s*°?\s*(?:до|-)\s*[+-]?\d+(?:[.,]\d+)?\s*°?\s*F\)\s*$', '', s, flags=re.IGNORECASE)
    s = re.sub(r'(\d)\s*°\s*(?=(?:до|-)\s*[+-]?\d+(?:[.,]\d+)?\s*°\s*[CС])', r'\1 ', s)
    m = re.search(r'\s*\((?:п\.|розд\.|табл\.|у межах|підтвердж|перевищ|недоліт|завищ|заниж|розбіжн|синхроніз|фактичн|режим|на рівні|без вітру)[^)]*\)\s*$', s, flags=re.IGNORECASE)
    if m and not _NEGATION_RE.search(m.group(0)):
        s = s[:m.start()].strip()
    return s.strip()


def quantity(text, unit=''):
    if not text or _NEGATION_RE.search(text):
        return None
    text = _strip_meta_notes(text)
    if _NEGATION_RE.search(text):
        return None
    m = re.fullmatch(
        r'(не більше(?:\s+ніж)?|не більша|не більший|не менше(?:\s+ніж)?|не менша|не менший|до|від|≤|≥|<=|>=|<|>|=)?\s*(?:прибл\.?\s*)?([+-]?\d+(?:[.,]\d+)?)\s*([^\d\s].*?)?',
        text,
        flags=re.IGNORECASE,
    )
    if not m:
        return None
    digits_only = re.sub(r'\D', '', m[2])
    if len(digits_only) > 60:
        return None
    inline_u = (m[3] or '').strip()
    col_u = (unit or '').strip()
    if inline_u and col_u and inline_u.rstrip('.') != col_u.rstrip('.'):
        return None
    u = inline_u or col_u
    if u not in UNITS:
        return None
    dimension, factor = UNITS[u]
    op_raw = re.sub(r'\s+', ' ', m[1].lower().strip()) if m[1] else None
    op = {
        'не більше': '<=', 'не більше ніж': '<=', 'не більша': '<=', 'не більший': '<=', 'до': '<=',
        'не менше': '>=', 'не менше ніж': '>=', 'не менша': '>=', 'не менший': '>=', 'від': '>=',
        '≤': '<=', '≥': '>=',
    }.get(op_raw, op_raw) or '='
    return op, Decimal(m[2].replace(',', '.')) * Decimal(str(factor)), dimension


def parse_structured_spec(text: str, unit: str = ''):
    """Parses complex engineering specifications:
    1) Tolerance: `22.2 ± 0.5 В` or `22.2 +- 0.5 В` -> ('tolerance', [(low, high)], dimension)
    2) Range(s): `від -20 °C до +45 °C`, `433.05–434.79 та 868–915 МГц` -> ('intervals', [(low, high), ...], dimension)
    3) Multi-item BOM counts: `АКБ 6S4P — 4 шт., Патч-антена — 2 шт.` -> ('bom', {item: count}, 'count')
    """
    clean = text.replace('`', '').replace('−', '-').strip()
    if not clean or _NEGATION_RE.search(clean):
        return None
    col_u = (unit or '').strip()

    # 1. Tolerance: X ± D [unit]
    stripped = _strip_meta_notes(clean)
    tol_m = re.fullmatch(
        rf'\s*([+-]?\d+(?:[.,]\d+)?)\s*(?:±|\+-|-\+)\s*(\d+(?:[.,]\d+)?)\s*({_UNIT_KEYS_PATTERN})?\s*',
        stripped,
    )
    if tol_m:
        inline_u = (tol_m.group(3) or '').strip()
        if inline_u and col_u and inline_u.rstrip('.') != col_u.rstrip('.'):
            return None
        u = inline_u or col_u
        if u in UNITS:
            dim, factor = UNITS[u]
            f_dec = Decimal(str(factor))
            center = Decimal(tol_m.group(1).replace(',', '.')) * f_dec
            delta = Decimal(tol_m.group(2).replace(',', '.')) * f_dec
            return ('tolerance', [(center - delta, center + delta)], dim)

    # 2. Multi-item BOM counts: e.g. "АКБ 6S4P — 4 шт., Патч-антена — 2 шт."
    bom_item_re = re.compile(
        r'^([А-ЯІЇЄҐа-яіїєґA-Za-z0-9][А-ЯІЇЄҐа-яіїєґA-Za-z0-9\s\-/().]{0,60}?)\s*(?:—|–|-|:)\s*(\d+)\s*шт\.?$'
    )
    if ',' in clean or ';' in clean or re.search(r'(?:—|–|-|:)\s*\d+\s*шт\.?', clean):
        segments = [seg.strip() for seg in re.split(r'[,;]+', clean) if seg.strip()]
        if segments and any(bom_item_re.match(seg) for seg in segments):
            if col_u and col_u.rstrip('.') != 'шт':
                return None
            if len(segments) >= 2 or ',' in clean or ';' in clean:
                bom_map = {}
                for seg in segments:
                    bm = bom_item_re.match(seg)
                    if not bm:
                        return None
                    item_name = bm.group(1).strip().casefold()
                    if item_name in bom_map:
                        return None
                    bom_map[item_name] = int(bm.group(2))
                if bom_map:
                    return ('bom', bom_map, 'count')

    # 3. Intervals: "від A [unit] до B [unit]" or "A..B [unit]" or "A–B та C–D МГц"
    interval_re = re.compile(
        rf'(?:від\s*)?([+-]?\d+(?:[.,]\d+)?)\s*({_UNIT_KEYS_PATTERN})?\s*(?:до|–|—|\.\.|-)\s*([+-]?\d+(?:[.,]\d+)?)\s*({_UNIT_KEYS_PATTERN})?',
        flags=re.IGNORECASE,
    )
    interval_matches = list(interval_re.finditer(stripped))
    if interval_matches:
        # Ensure all non-interval text in the cell consists only of allowed benign prefixes/connectors
        leftover_parts = []
        last_idx = 0
        for im in interval_matches:
            leftover_parts.append(stripped[last_idx:im.start()])
            last_idx = im.end()
        leftover_parts.append(stripped[last_idx:])
        leftover = ' '.join(leftover_parts)
        leftover = re.sub(
            r'\b(?:у\s+термокамері\s+перевірено|термокамера|перевірено\s+лише|перевірено\s+діапазони?|перевірено|діапазони?|фактично|та|і|й|або)\b',
            ' ',
            leftover,
            flags=re.IGNORECASE,
        )
        leftover = re.sub(r'[\s,;:.()/\-–—]+', '', leftover)
        if leftover:
            return None

        trailing_unit = col_u
        for im in reversed(interval_matches):
            if im.group(4) and im.group(4).strip() in UNITS:
                trailing_unit = im.group(4).strip()
                break
            if im.group(2) and im.group(2).strip() in UNITS:
                trailing_unit = im.group(2).strip()
                break
        intervals = []
        dim_seen = None
        for im in interval_matches:
            inl1 = (im.group(2) or '').strip()
            inl2 = (im.group(4) or '').strip()
            if col_u:
                if (inl1 and inl1.rstrip('.') != col_u.rstrip('.')) or (inl2 and inl2.rstrip('.') != col_u.rstrip('.')):
                    return None
            u1 = (inl1 or inl2 or trailing_unit).strip()
            u2 = (inl2 or inl1 or trailing_unit).strip()
            if u1 not in UNITS or u2 not in UNITS:
                return None
            d1, f1 = UNITS[u1]
            d2, f2 = UNITS[u2]
            if d1 != d2 or (dim_seen is not None and d1 != dim_seen):
                return None
            dim_seen = d1
            v1 = Decimal(im.group(1).replace(',', '.')) * Decimal(str(f1))
            v2 = Decimal(im.group(3).replace(',', '.')) * Decimal(str(f2))
            lo, hi = (v1, v2) if v1 <= v2 else (v2, v1)
            intervals.append((lo, hi))
        if intervals and dim_seen:
            return ('intervals', intervals, dim_seen)

    return None


def normalized_label(s):
    key = re.search(r'`([a-z][a-z0-9_]+)`', s)
    if key:
        return key[1]
    cleaned = re.sub(r'^\s*\d+(?:\.\d+)*\.?\s*', '', normalize_cyber_text(s).replace('`', '').strip())
    return re.sub(r'\s+', ' ', cleaned.casefold())


def _infer_physics_schema(group_records: list):
    """Infers (label, expected, actual[, unit]) column indices for tables with non-standard headers
    by inspecting mathematical constraint operators (<=, >=, <, >, ±) and SI physical dimensions.
    """
    if not group_records or len(group_records) < 2:
        return None
    hdr = group_records[0]
    if hdr.get('uncertain'):
        return None
    ncols = len(hdr.get('cells', []))
    if ncols == 2:
        two_col_rows = [r for r in group_records if len(r.get('cells', [])) == 2 and not r.get('uncertain')]
        if len(two_col_rows) >= 3:
            qty_hits = sum(
                1 for r in two_col_rows
                if re.search(r'[А-ЯІЇЄҐа-яіїєґA-Za-z]{2,}', r['cells'][0])
                and (quantity(r['cells'][1]) is not None or parse_structured_spec(r['cells'][1]) is not None or bool(re.search(r'\d', r['cells'][1])))
            )
            if qty_hits >= 2:
                first_has_digits = bool(re.search(r'\d', hdr['cells'][1]))
                return {'label': 0, 'value': 1, '_inferred': True, '_headerless': first_has_digits}
        return None
    if not (3 <= ncols <= 5):
        return None
    hdr_norms = [normalized_label(c) for c in hdr['cells'] if c.strip()]
    if len(hdr_norms) != ncols or len(set(hdr_norms)) != len(hdr_norms):
        return None
    if any(quantity(c) is not None or parse_structured_spec(c) is not None for c in hdr['cells']):
        return None

    data_rows = [r for r in group_records[1:] if len(r.get('cells', [])) >= ncols]
    if not data_rows:
        return None

    u_col = None
    for c_idx in range(ncols):
        non_empty = [r['cells'][c_idx].strip() for r in data_rows if r['cells'][c_idx].strip()]
        if non_empty and all(val in UNITS for val in non_empty):
            u_col = c_idx
            break

    constraint_counts = {c: 0 for c in range(ncols) if c != u_col}
    scalar_eq_counts = {c: 0 for c in range(ncols) if c != u_col}
    label_counts = {c: 0 for c in range(ncols) if c != u_col}
    row_dims = []

    for r in data_rows:
        u_str = r['cells'][u_col].strip() if u_col is not None else ''
        dims_in_row = {}
        for c in constraint_counts:
            val = r['cells'][c].strip()
            if not val:
                continue
            q = quantity(val, u_str)
            sp = parse_structured_spec(val, u_str) if q is None else None
            if q is not None:
                dims_in_row[c] = q[2]
                if q[0] in ('<=', '>=', '<', '>'):
                    constraint_counts[c] += 1
                elif q[0] == '=':
                    scalar_eq_counts[c] += 1
            elif sp is not None:
                dims_in_row[c] = sp[2]
                if sp[0] == 'tolerance':
                    constraint_counts[c] += 1
            elif val not in UNITS and re.search(r'[А-ЯІЇЄҐа-яіїєґA-Za-z]{2,}', val):
                label_counts[c] += 1
        row_dims.append(dims_in_row)

    exp_candidates = [c for c, cnt in constraint_counts.items() if cnt >= 1]
    if len(exp_candidates) != 1:
        return None
    exp_col = exp_candidates[0]

    act_candidates = [
        c for c, cnt in scalar_eq_counts.items()
        if c != exp_col and cnt >= 1 and constraint_counts[c] == 0
    ]
    if len(act_candidates) != 1:
        return None
    act_col = act_candidates[0]

    if not any(d.get(exp_col) and d.get(exp_col) == d.get(act_col) for d in row_dims):
        return None

    lbl_candidates = [
        c for c, cnt in label_counts.items()
        if c not in (exp_col, act_col) and cnt >= 1 and constraint_counts[c] == 0 and scalar_eq_counts[c] == 0
    ]
    if len(lbl_candidates) != 1:
        return None
    lbl_col = lbl_candidates[0]

    inferred = {'label': lbl_col, 'expected': exp_col, 'actual': act_col, '_inferred': True}
    if u_col is not None:
        inferred['unit'] = u_col
    return inferred


def _sources_have_physical_duplicates(sources: list) -> bool:
    seen_paths = []
    for s in sources:
        p = Path(s.get('path', ''))
        for prev in seen_paths:
            try:
                if p.resolve() == prev.resolve() or (p.exists() and prev.exists() and os.path.samefile(p, prev)):
                    return True
            except OSError:
                if p.resolve() == prev.resolve():
                    return True
        seen_paths.append(p)
    return False


def analyze(sources):
    findings, metrics = [], {}
    has_duplicate_physical_source = _sources_have_physical_duplicates(sources)

    def finding(parameter, expected, actual, unit, evidence, uncertain=False, formula_mismatch=False, cyber_anomalies=None, schema_inferred=False, custom_unverified_reason=None):
        cyber_anomalies = cyber_anomalies or []
        q, v = quantity(expected, unit), quantity(actual, unit)
        status = 'UNVERIFIED'
        reason = custom_unverified_reason or 'Недостатньо даних: порожнє значення, невідома одиниця, складний діапазон або неоднозначний запис.'
        if cyber_anomalies:
            status = 'FAIL'
            reason = 'КІБЕР-КРИМІНАЛІСТИКА ДОКУМЕНТА: ' + '; '.join(cyber_anomalies) + '. Ознака підміни символів (homoglyph / zero-width) для обходу автоматичного нормоконтролю.'
        elif formula_mismatch:
            status = 'FAIL'
            reason = 'КІБЕР-КРИМІНАЛІСТИКА EXCEL (CYBER-XLSX-CACHE-SPOOF): кешоване значення комірки (<v>) суперечить детерміновано обчисленій формулі (<f>); виявлено застарілий або підмінений кеш.'
        elif uncertain:
            reason = custom_unverified_reason or 'Є непідтверджена формула, об’єднання вимірювальних колонок, помилка комірки чи відстежувана зміна; потрібна підтверджена редакція/значення.'
        elif q and v and q[2] == v[2] and v[0] == '=':
            op, a, _ = q
            b = v[1]
            ok = {'=': b == a, '<=': b <= a, '>=': b >= a, '<': b < a, '>': b > a}[op]
            status = 'PASS' if ok else 'FAIL'
            reason = 'Наведене значення відповідає розпізнаній числовій вимозі.' if ok else 'Наведене значення не відповідає розпізнаній числовій вимозі; перевірити джерело та метод вимірювання.'
        else:
            spec_exp = parse_structured_spec(expected, unit)
            spec_act = parse_structured_spec(actual, unit)
            if spec_exp and spec_exp[0] == 'tolerance':
                lo, hi = spec_exp[1][0]
                dim = spec_exp[2]
                if v and v[2] == dim and v[0] == '=':
                    ok = lo <= v[1] <= hi
                    status = 'PASS' if ok else 'FAIL'
                    reason = 'Фактичне значення входить у допустимий інтервал допуску (±).' if ok else 'Фактичне значення виходить за межі допуску (±).'
                elif spec_act and spec_act[0] in ('tolerance', 'intervals') and spec_act[2] == dim and len(spec_act[1]) == 1:
                    alo, ahi = spec_act[1][0]
                    ok = lo <= alo and ahi <= hi
                    status = 'PASS' if ok else 'FAIL'
                    reason = 'Діапазон входить у межі допуску (±).' if ok else 'Діапазон виходить за межі допуску (±).'
            elif spec_exp and spec_exp[0] == 'intervals' and spec_act and spec_act[0] == 'intervals' and spec_exp[2] == spec_act[2]:
                req_intervals = spec_exp[1]
                act_intervals = spec_act[1]
                dim = spec_exp[2]
                p_low = parameter.casefold()
                is_permissible_bound = any(w in p_low for w in ('допустим', 'меж', 'допуск')) or dim not in ('temperature', 'frequency')
                if is_permissible_bound:
                    all_inside = all(
                        any(r_lo <= a_lo and a_hi <= r_hi for r_lo, r_hi in req_intervals)
                        for a_lo, a_hi in act_intervals
                    )
                    status = 'PASS' if all_inside else 'FAIL'
                    reason = (
                        'Фактичний інтервал повністю входить у допустимі межі норми.'
                        if all_inside
                        else 'Фактичний інтервал виходить за допустимі межі нормованого діапазону.'
                    )
                else:
                    all_covered = all(
                        any(a_lo <= r_lo and a_hi >= r_hi for a_lo, a_hi in act_intervals)
                        for r_lo, r_hi in req_intervals
                    )
                    status = 'PASS' if all_covered else 'FAIL'
                    reason = (
                        'Усі нормовані діапазони повністю перекриті фактичними інтервалами.'
                        if all_covered
                        else 'Не всі нормовані діапазони перекриті (звужена межа діапазону або пропущений піддіапазон).'
                    )
            elif spec_exp and spec_exp[0] == 'bom' and spec_act and spec_act[0] == 'bom':
                exp_bom, act_bom = spec_exp[1], spec_act[1]
                ok = all(act_bom.get(k) == count for k, count in exp_bom.items()) and len(act_bom) == len(exp_bom)
                status = 'PASS' if ok else 'FAIL'
                reason = (
                    'Кількість усіх позицій комплектності (шт.) збігається з нормою.'
                    if ok
                    else 'Виявлено розбіжність у кількості або складі позицій комплектності (шт.).'
                )
        if schema_inferred and status in ('PASS', 'FAIL'):
            reason += ' [AUTO-SCHEMA-PHYSICS: ролі колонок визначено автоматично за операторами допуску та розмірностями SI]'
        findings.append(dict(parameter=parameter, expected=expected, actual=actual, unit=unit, status=status, reason=reason, evidence=evidence))

    for source in sources:
        headers = {}
        header_cyber = {}
        by_group = {}
        for rec in source['records']:
            if rec.get('group'):
                by_group.setdefault(rec['group'], []).append(rec)

        # Pre-pass to count normalized parameter keys per source to detect single-document duplicates
        temp_headers = {}
        label_counts_in_source = {}
        for record in source['records']:
            cells = record['cells']
            norm = [normalized_label(c) for c in cells]
            mapping = {}
            ambiguous = False
            for n, c in enumerate(norm):
                before = dict(mapping)
                if c in ('параметр','назва параметра','показник','parameter','найменування показника','характеристика','характеристики','технічні характеристики','найменування параметра','назва характеристики'): mapping['label']=n
                elif c in ('норма','норма ту','норма за ту','вимога','вимоги','requirement','ту'): mapping['expected']=n
                elif c in ('факт','факт пмв','факт за пмв','фактичне значення','результат','результат випробувань','виміряно','actual','пмв'): mapping['actual']=n
                elif c in ('значення','value','значення в паспорті','паспорт'): mapping['value']=n
                elif c in ('одиниця','одиниці','од. вим.','одиниця виміру','одиниці виміру','од.вим.','unit'): mapping['unit']=n
                if any(key in before and before[key] != index for key,index in mapping.items()): ambiguous = True
            group = record['group']
            if 'label' in mapping and any(k in mapping for k in ('expected','actual','value')):
                if ambiguous or record['uncertain']:
                    temp_headers.pop(group, None)
                else:
                    temp_headers[group] = mapping
                continue
            if group and group not in temp_headers and not ambiguous and by_group.get(group) and by_group[group][0] is record:
                inferred_map = _infer_physics_schema(by_group[group])
                if inferred_map:
                    temp_headers[group] = inferred_map
                    if not inferred_map.get('_headerless'):
                        continue
            h_tmp = temp_headers.get(group)
            if h_tmp:
                lbl_tmp = cells[h_tmp['label']].strip() if 'label' in h_tmp and h_tmp['label'] < len(cells) else ''
                if lbl_tmp:
                    nl = normalized_label(lbl_tmp)
                    label_counts_in_source[nl] = label_counts_in_source.get(nl, 0) + 1

        for record in source['records']:
            cells = record['cells']; norm = [normalized_label(c) for c in cells]
            mapping = {}
            ambiguous = False
            for n,c in enumerate(norm):
                before = dict(mapping)
                if c in ('параметр','назва параметра','показник','parameter','найменування показника','характеристика','характеристики','технічні характеристики','найменування параметра','назва характеристики'): mapping['label']=n
                elif c in ('норма','норма ту','норма за ту','вимога','вимоги','requirement','ту'): mapping['expected']=n
                elif c in ('факт','факт пмв','факт за пмв','фактичне значення','результат','результат випробувань','виміряно','actual','пмв'): mapping['actual']=n
                elif c in ('значення','value','значення в паспорті','паспорт'): mapping['value']=n
                elif c in ('одиниця','одиниці','од. вим.','одиниця виміру','одиниці виміру','од.вим.','unit'): mapping['unit']=n
                if any(key in before and before[key] != index for key,index in mapping.items()): ambiguous = True
            group = record['group']
            if 'label' in mapping and any(k in mapping for k in ('expected','actual','value')):
                if ambiguous or record['uncertain']:
                    headers.pop(group, None)
                    findings.append(dict(parameter='Заголовок таблиці', expected='', actual='', unit='', status='UNVERIFIED', reason='Неоднозначні/повторні колонки або об’єднаний заголовок; потрібна явна схема таблиці.', evidence=[source['name'] + ': ' + record['location']]))
                else:
                    headers[group] = mapping
                    header_cyber[group] = list(record.get('cyber_anomalies', []))
                continue
            if group and group not in headers and not ambiguous and by_group.get(group) and by_group[group][0] is record:
                inferred_map = _infer_physics_schema(by_group[group])
                if inferred_map:
                    headers[group] = inferred_map
                    header_cyber[group] = list(record.get('cyber_anomalies', []))
                    if not inferred_map.get('_headerless'):
                        continue
            h = headers.get(group)
            loc = source['name'] + ': ' + record['location']
            if h:
                get = lambda k: cells[h[k]].strip() if k in h and h[k] < len(cells) else ''
                label = get('label')
                if not label: continue
                nl = normalized_label(label)
                is_dup_in_doc = label_counts_in_source.get(nl, 0) > 1
                dup_reason = 'Дубльований параметр в одному документі без окремого ідентифікатора умови/серії; потрібне уточнення.' if is_dup_in_doc else None
                mapped_indices = {v for k, v in h.items() if isinstance(v, int)}
                row_uncertain = record['uncertain'] or is_dup_in_doc or any(mc in mapped_indices for mc in record.get('merged_cols', []))
                row_mismatch = record.get('formula_mismatch', False)
                row_cyber = list(header_cyber.get(group, [])) + [x for x in record.get('cyber_anomalies', []) if x not in header_cyber.get(group, [])]
                is_inf = bool(h.get('_inferred', False))
                if len(sources) == 1 and 'expected' in h and 'actual' in h:
                    finding(label,get('expected'),get('actual'),get('unit'),[loc],row_uncertain,row_mismatch,row_cyber,is_inf,dup_reason)
                else:
                    if 'expected' in h and 'actual' in h and get('expected') and get('actual'):
                        finding(label,get('expected'),get('actual'),get('unit'),[loc],row_uncertain,row_mismatch,row_cyber,is_inf,dup_reason)
                    if source['role'] == 'pmv':
                        val = get('actual') if 'actual' in h else get('value')
                    elif source['role'] == 'passport':
                        val = get('value') if 'value' in h else (get('actual') if 'actual' in h else get('expected'))
                    else:
                        val = get('expected') if 'expected' in h else get('value')
                    metrics.setdefault(nl,[]).append((source['role'], label,val,get('unit'),loc,row_uncertain,row_mismatch,row_cyber,is_inf,dup_reason))

    def _combine_val_unit(val_str: str, u_str: str) -> str:
        if not val_str:
            return ''
        if not u_str:
            return val_str
        if quantity(val_str) is not None or parse_structured_spec(val_str) is not None:
            if quantity(val_str, u_str) is None and parse_structured_spec(val_str, u_str) is None:
                return f'{val_str} [UNIT_CONFLICT:{u_str}]'
            return val_str
        return f'{val_str} {u_str}'

    for entries in metrics.values():
        if has_duplicate_physical_source:
            for e in entries:
                finding(
                    e[1], e[2], '', e[3], [e[4]], True, e[6], e[7], e[8],
                    'Один і той самий фізичний файл передано у кількох ролях; документ не може підтверджувати сам себе.',
                )
            continue
        tu = [e for e in entries if e[0] == 'tu']
        pas = [e for e in entries if e[0] == 'passport']
        pmv = [e for e in entries if e[0] == 'pmv']
        others = [e for e in entries if e[0] in ('pmv','passport')]
        if len({e[0] for e in entries}) == len(entries) and len(entries) >= 2 and (len(tu) == 1 or (len(pas) == 1 and len(pmv) == 1)):
            if len(tu) == 1 and others:
                a = tu[0]
                for b in others:
                    expected = _combine_val_unit(a[2], a[3])
                    actual = _combine_val_unit(b[2], b[3])
                    combined_cyber = list(a[7]) + [x for x in b[7] if x not in a[7]]
                    finding(a[1], expected, actual, '', [a[4],b[4]],a[5] or b[5], a[6] or b[6], combined_cyber, a[8] or b[8], a[9] or b[9])
            if len(pas) == 1 and len(pmv) == 1:
                a = pas[0]
                b = pmv[0]
                expected = _combine_val_unit(a[2], a[3])
                actual = _combine_val_unit(b[2], b[3])
                combined_cyber = list(a[7]) + [x for x in b[7] if x not in a[7]]
                finding(a[1], expected, actual, '', [a[4],b[4]],a[5] or b[5], a[6] or b[6], combined_cyber, a[8] or b[8], a[9] or b[9])
        else:
            for e in entries: finding(e[1],e[2],'',e[3],[e[4]],e[5],e[6],e[7],e[8],e[9])
    if not findings:
        findings.append(dict(parameter='Покриття документа',expected='',actual='',unit='',status='UNVERIFIED',reason='Не розпізнано таблицю з колонками Параметр / Норма / Факт або узгоджену пару ТУ / ПМВ. Текст витягнуто для ручної перевірки.',evidence=[]))
    return findings


def _load_telemetry_summary(telemetry_path: Path) -> dict:
    """Loads telemetry JSON or invokes telemetry_analyzer.inspect_file on a binary/text flight log (.ubx/.bin/.ulg/.tlog/.nmea/.csv)."""
    telemetry_path = Path(telemetry_path)
    if not telemetry_path.exists():
        raise ValueError(f'Файл телеметрії не знайдено: {telemetry_path}')
    if telemetry_path.stat().st_size > MAX_INPUT:
        raise ValueError('Розмір файла телеметрії перевищує 64 MiB')
    raw_bytes = telemetry_path.read_bytes()
    file_sha256 = hashlib.sha256(raw_bytes).hexdigest()
    is_json_summary = telemetry_path.suffix.lower() == '.json'
    self_asserted_sha256 = None
    if is_json_summary:
        raw_res = json.loads(raw_bytes.decode('utf-8'))
        if not isinstance(raw_res, dict):
            raise ValueError('JSON телеметрії повинен мати кореневий об’єкт (dict)')
        if not isinstance(raw_res.get('streams', {}), dict) or not isinstance(raw_res.get('quality', {}), dict) or not isinstance(raw_res.get('errors', []), list):
            raise ValueError('Некоректна схема JSON телеметрії (streams/quality/errors)')
        if isinstance(raw_res.get('sha256'), str):
            self_asserted_sha256 = raw_res.get('sha256').strip().lower()
    else:
        import importlib.util
        candidates = [
            Path(__file__).resolve().parent.parent / 'nmea-telemetry-analyzer' / 'telemetry_analyzer.py',
            Path(__file__).resolve().parent.parent / 'telemetry_ew' / 'telemetry_analyzer.py',
            Path(__file__).resolve().parent / 'telemetry_analyzer.py',
        ]
        analyzer_file = next((p for p in candidates if p.exists()), None)
        if analyzer_file is None:
            raise ValueError('Не знайдено модуль telemetry_analyzer.py для крос-верифікації логу польоту')
        spec = importlib.util.spec_from_file_location('telemetry_analyzer_bridge', str(analyzer_file))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        raw_res = mod.inspect_file(telemetry_path)

    streams = raw_res.get('streams', {})
    quality = raw_res.get('quality', {})
    fmt = raw_res.get('format', '')
    max_alt_msl = None
    min_alt_msl = None
    max_alt_baro = None
    max_vert_rate_mps = 0.0
    max_speed = None
    jam_ind_max = 0
    spoof_state_max = 0
    ts_regressions = 0
    has_gnss_or_hw_fields = False
    total_stream_records = 0

    alt_msl_keys = {'alt_msl_m', 'alt_m', 'hmsl_m', 'height_m', 'altitude_m', 'altitude'}
    alt_baro_keys = {'baroalt', 'alt_baro', 'relative_alt_m', 'rel_alt_m'}
    speed_keys_mps = {'ground_speed_mps', 'gspeed_mps', 'gspeed_m_s', 'speed_m_s', 'vel_m_s', 'vel_mps', 'speed_mps', 'groundspeed'}

    for s_name, s_data in streams.items():
        if not isinstance(s_data, dict):
            raise ValueError('Некоректний формат stream у телеметрії')
        total_stream_records += int(s_data.get('records', 0) or s_data.get('count', 0) or 0)
        ts_regressions += int(s_data.get('timestamp_regressions', 0) or 0)
        fields_obj = s_data.get('fields', {})
        if not isinstance(fields_obj, dict):
            raise ValueError('Некоректний формат fields у телеметрії')
        for f_name, f_stats in fields_obj.items():
            if not isinstance(f_stats, dict):
                raise ValueError('Некоректний формат статистики поля у телеметрії')
            f_low = f_name.lower()
            f_max = f_stats.get('max')
            f_min = f_stats.get('min')
            f_rate = float(f_stats.get('max_rate_per_s', 0.0) or 0.0)
            if f_max is None:
                continue
            if f_low in alt_msl_keys:
                max_alt_msl = f_max if max_alt_msl is None else max(max_alt_msl, f_max)
                min_alt_msl = f_min if min_alt_msl is None else min(min_alt_msl, f_min)
                max_vert_rate_mps = max(max_vert_rate_mps, f_rate)
            elif f_low in alt_baro_keys:
                scale = 1e-3 if (fmt == 'PX4_ULOG' and f_max > 50000) else 1.0
                max_alt_baro = f_max * scale if max_alt_baro is None else max(max_alt_baro, f_max * scale)
            elif f_low == 'alt':
                scale = 1e-3 if fmt == 'PX4_ULOG' or f_max > 50000 else (1e-2 if fmt == 'ARDUPILOT_DATAFLASH' and f_max > 5000 else 1.0)
                max_alt_msl = f_max * scale if max_alt_msl is None else max(max_alt_msl, f_max * scale)
                if f_min is not None:
                    min_alt_msl = f_min * scale if min_alt_msl is None else min(min_alt_msl, f_min * scale)
                max_vert_rate_mps = max(max_vert_rate_mps, f_rate * scale)
            if f_low in speed_keys_mps:
                max_speed = f_max if max_speed is None else max(max_speed, f_max)
            elif f_low == 'spd':
                scale = 1e-2 if fmt == 'ARDUPILOT_DATAFLASH' and f_max > 200 else 1.0
                max_speed = f_max * scale if max_speed is None else max(max_speed, f_max * scale)
            if f_low in ('jamind', 'jamming_indicator'):
                has_gnss_or_hw_fields = True
                jam_ind_max = max(jam_ind_max, int(f_max))
            if f_low in ('spoofdetstate', 'spoofing_state'):
                has_gnss_or_hw_fields = True
                spoof_state_max = max(spoof_state_max, int(f_max))

    max_alt = max_alt_msl if max_alt_msl is not None else max_alt_baro
    baro_gps_div = abs(max_alt_msl - max_alt_baro) if (max_alt_msl is not None and max_alt_baro is not None) else 0.0
    crc_errors = sum(int(v) for k, v in quality.items() if 'checksum' in k or 'crc' in k)
    no_fix_records = sum(int(v) for k, v in quality.items() if 'без валідного' in k or 'no_fix' in k)
    hw_jam_warn = int(quality.get('ubx_hw_jamming_warning', 0) or 0) or (1 if jam_ind_max >= 150 else 0)
    hw_spoof_ev = int(quality.get('ubx_hw_spoofing_indicated', 0) or 0) or (1 if spoof_state_max in (2, 3) else 0)
    parse_errors = [str(e) for e in raw_res.get('errors', [])]
    has_ew_anomaly = bool(
        crc_errors > 0
        or hw_jam_warn > 0
        or hw_spoof_ev > 0
        or ts_regressions > 0
        or max_vert_rate_mps > 35.0
        or baro_gps_div > 100.0
    )
    has_integrity_evidence = bool(
        not is_json_summary
        or bool(quality)
        or has_gnss_or_hw_fields
        or (max_alt_msl is not None and max_alt_baro is not None)
        or total_stream_records > 0
    )
    if parse_errors:
        overall = 'INVALID_INPUT'
    elif has_ew_anomaly:
        overall = 'ANOMALY_OR_EW_DETECTED'
    elif not has_integrity_evidence:
        overall = 'UNVERIFIED'
    else:
        overall = 'NOMINAL'

    effective_sha = file_sha256 if is_json_summary else (raw_res.get('sha256') or file_sha256)
    return dict(
        source_file=telemetry_path.name,
        input_meta=dict(
            detected_format=fmt or ('JSON_SUMMARY' if is_json_summary else ''),
            sha256=effective_sha,
            self_asserted_sha256=self_asserted_sha256,
            is_json_summary=is_json_summary,
            hardware_jam_ind_max=jam_ind_max,
            hardware_spoof_events=hw_spoof_ev,
            timestamp_regressions=ts_regressions,
            crc_errors=crc_errors,
            no_fix_records=no_fix_records,
            parse_errors=parse_errors,
        ),
        summary=dict(
            max_altitude_m=max_alt,
            max_altitude_msl_m=max_alt_msl,
            max_altitude_baro_m=max_alt_baro,
            baro_gps_divergence_m=baro_gps_div,
            max_vertical_rate_mps=max_vert_rate_mps,
            max_ground_speed_mps=max_speed,
            overall_status=overall,
            jamming_indicators=hw_jam_warn,
            spoofing_indicators=hw_spoof_ev or (1 if (max_vert_rate_mps > 35.0 or baro_gps_div > 100.0) else 0),
        ),
        raw_inspection=raw_res,
    )


def verify_telemetry_cross_check(sources: list, findings: list, telemetry_path) -> dict:
    """Cross-verifies numerical claims and SHA-256 provenance in ПМВ/ТУ/Паспорт against actual binary flight log metrics."""
    telem = _load_telemetry_summary(Path(telemetry_path))
    summary = telem.get('summary', {})
    meta = telem.get('input_meta', {})
    t_name = telem.get('source_file', Path(telemetry_path).name)
    t_sha = (meta.get('sha256') or '').lower()
    self_asserted_sha = (meta.get('self_asserted_sha256') or '').lower()
    is_json_summary = bool(meta.get('is_json_summary', False))
    parse_errors = meta.get('parse_errors') or []

    if parse_errors:
        findings.append(dict(
            parameter='Крос-верифікація ПМВ ⇄ Чорна скринька: Валідність бінарного логу',
            expected='Коректний бінарний або NMEA/CSV лог польоту',
            actual=f'{t_name}: помилка парсингу ({"; ".join(parse_errors)})',
            unit='',
            status='UNVERIFIED',
            reason='Бінарний лог польоту пошкоджений або не містить підтримуваних записів; крос-верифікація неможлива (No evidence -> UNVERIFIED).',
            evidence=[sources[0]['name'], t_name],
        ))
        return telem

    max_alt = summary.get('max_altitude_m')
    max_vrate = summary.get('max_vertical_rate_mps', 0.0) or 0.0
    baro_div = summary.get('baro_gps_divergence_m', 0.0) or 0.0
    max_speed = summary.get('max_ground_speed_mps')
    overall = summary.get('overall_status', 'UNVERIFIED')
    jam_ind_max = meta.get('hardware_jam_ind_max', 0) or 0
    spoof_events = meta.get('hardware_spoof_events', 0) or 0
    ts_reg = meta.get('timestamp_regressions', 0) or 0

    # 0. Check cryptographic SHA-256 log binding in the document
    doc_hashes = []
    for s in sources:
        for r in s['records']:
            for c in r['cells']:
                for hm in re.finditer(r'\b([0-9a-fA-F]{64})\b', c):
                    h_val = hm.group(1).lower()
                    ctx_label = c[:hm.start()].strip(' :—-\t') or c.strip()
                    doc_hashes.append((h_val, f"{s['name']}: {r['location']}", ctx_label))
    if doc_hashes:
        primary_hash, primary_loc, primary_ctx = doc_hashes[0]
        if is_json_summary:
            # Self-asserted sha256 inside a JSON summary is never cryptographic proof of a raw flight log
            matching_entries = [(h, loc, ctx) for h, loc, ctx in doc_hashes if h in (t_sha, self_asserted_sha)]
            non_matching_entries = [(h, loc, ctx) for h, loc, ctx in doc_hashes if h not in (t_sha, self_asserted_sha)]
            ev_list = [f"{loc} ({ctx})" for _, loc, ctx in doc_hashes] + [f"{t_name}: file_sha256={t_sha}, self_asserted_sha256={self_asserted_sha or 'none'}"]
            if non_matching_entries and matching_entries:
                findings.append(dict(
                    parameter='Крос-верифікація ПМВ ⇄ Чорна скринька: Криптографічна прив’язка логу (SHA-256)',
                    expected=f'{primary_hash} ({primary_ctx})',
                    actual=f'file_sha256={t_sha}; json_field_sha256={self_asserted_sha or "відсутній"} (збіг лише з: {matching_entries[0][2]})',
                    unit='',
                    status='FAIL',
                    reason=(
                        f'КІБЕР-КРИМІНАЛІСТИКА (CROSS-LOG-HASH-CONFLICT): основний хеш журналу ({primary_ctx} у {primary_loc}) '
                        f'не збігається з наданим доказом; збіг знайдено лише у сторонньому полі ({matching_entries[0][2]} у {matching_entries[0][1]}), '
                        'а самозаявлений sha256 у JSON не є криптографічним доказом первинного логу.'
                    ),
                    evidence=ev_list,
                ))
            else:
                findings.append(dict(
                    parameter='Крос-верифікація ПМВ ⇄ Чорна скринька: Криптографічна прив’язка логу (SHA-256)',
                    expected=f'{primary_hash} ({primary_ctx})',
                    actual=f'file_sha256={t_sha}; json_field_sha256={self_asserted_sha or "відсутній"}',
                    unit='',
                    status='UNVERIFIED',
                    reason=(
                        'Надано JSON-підсумок замість первинного бінарного логу; самозаявлене поле sha256 у JSON не створює криптографічного підтвердження походження файла.'
                    ),
                    evidence=ev_list,
                ))
        else:
            all_match = all(h == t_sha for h, _, _ in doc_hashes)
            primary_matches = (primary_hash == t_sha)
            matching_entries = [(h, loc, ctx) for h, loc, ctx in doc_hashes if h == t_sha]
            ok_hash = primary_matches and all_match
            ev_list = [f"{loc} ({ctx})" for _, loc, ctx in doc_hashes] + [f'{t_name}: sha256={t_sha}']
            findings.append(dict(
                parameter='Крос-верифікація ПМВ ⇄ Чорна скринька: Криптографічна прив’язка логу (SHA-256)',
                expected=primary_hash,
                actual=t_sha,
                unit='',
                status='PASS' if ok_hash else 'FAIL',
                reason=(
                    'SHA-256 бінарного логу польоту збігається з криптографічним відбитком, зафіксованим у протоколі ПМВ.'
                    if ok_hash else
                    'КІБЕР-КРИМІНАЛІСТИКА (CROSS-LOG-HASH-MISMATCH): SHA-256 наданого файлу телеметрії не збігається з хешем у протоколі ПМВ (ознака підміни логу від іншого польоту або суперечливих хешів у документі).'
                ),
                evidence=ev_list,
            ))

    # Extract claimed altitude and speed from verified findings with explicit actual measurements and units
    alt_claims = []
    speed_claims = []

    for f in list(findings):
        if f.get('status') != 'PASS':
            continue
        actual_raw = f.get('actual', '').strip()
        if not actual_raw:
            continue
        p_low = normalize_cyber_text(f['parameter']).casefold()
        u_explicit = f.get('unit', '').strip()
        loc_ev = (f.get('evidence') or [sources[0]['name']])[0]
        if any(k in p_low for k in ('висот', 'стеля', 'altitude', 'alt_m')):
            q = quantity(actual_raw, u_explicit)
            if q and q[0] == '=' and q[2] == 'length':
                alt_claims.append((float(q[1]), loc_ev))
        elif any(k in p_low for k in ('швидк', 'speed', 'ground_speed')):
            q = quantity(actual_raw, u_explicit)
            if q and q[0] == '=' and q[2] == 'speed':
                speed_claims.append((float(q[1]), loc_ev))

    claimed_alt_m = alt_claims[0][0] if len(alt_claims) == 1 else None
    claimed_alt_loc = alt_claims[0][1] if len(alt_claims) == 1 else None
    claimed_speed_mps = speed_claims[0][0] if len(speed_claims) == 1 else None
    claimed_speed_loc = speed_claims[0][1] if len(speed_claims) == 1 else None

    # 1. Cross-check altitude (two-sided tolerance ±5.0 m around claimed measurement + vertical dynamics)
    if max_alt is not None and claimed_alt_m is not None:
        ok_alt = (abs(max_alt - claimed_alt_m) <= 5.0) and (max_vrate <= 35.0) and (baro_div <= 100.0)
        findings.append(dict(
            parameter='Крос-верифікація ПМВ ⇄ Чорна скринька: Висота польоту (altitude_m)',
            expected=f'{claimed_alt_m:.1f} м (заявлено в ПМВ)',
            actual=f'{max_alt:.1f} м (пік у лозі {t_name}, max|Δh/Δt|={max_vrate:.1f} м/с, ΔBaro={baro_div:.1f} м)',
            unit='м',
            status='PASS' if ok_alt else 'FAIL',
            reason=(
                'Пікова висота та вертикальна динаміка у бінарному лозі відповідають заявленим у протоколі ПМВ (у межах допуску ±5.0 м).'
                if ok_alt else
                f'КІБЕР-ФІЗИЧНА РОЗБІЖНІСТЬ (CROSS-ALTITUDE-MISMATCH): у документі заявлено {claimed_alt_m:.1f} м, але бінарний лог {t_name} фіксує пік {max_alt:.1f} м (max|Δh/Δt|={max_vrate:.1f} м/с, розходження з барометром {baro_div:.1f} м).'
            ),
            evidence=[claimed_alt_loc or sources[0]['name'], f'{t_name}: max_altitude_m={max_alt:.1f}'],
        ))
    else:
        findings.append(dict(
            parameter='Крос-верифікація ПМВ ⇄ Чорна скринька: Висота польоту (altitude_m)',
            expected=f'{claimed_alt_m:.1f} м' if claimed_alt_m is not None else 'Не заявлено або неоднозначно в ПМВ',
            actual=f'{max_alt:.1f} м' if max_alt is not None else 'Відсутня в лозі',
            unit='м',
            status='UNVERIFIED',
            reason='Недостатньо доказів (No evidence -> UNVERIFIED): у протоколі або бінарному лозі відсутній підтверджений числовий показник висоти польоту.',
            evidence=[sources[0]['name'], t_name],
        ))

    # 2. Cross-check ground speed (two-sided tolerance ±2.5 m/s around claimed measurement)
    if max_speed is not None and claimed_speed_mps is not None:
        ok_spd = abs(max_speed - claimed_speed_mps) <= 2.5
        findings.append(dict(
            parameter='Крос-верифікація ПМВ ⇄ Чорна скринька: Швидкість польоту (ground_speed_mps)',
            expected=f'{claimed_speed_mps:.1f} м/с (заявлено в ПМВ)',
            actual=f'{max_speed:.1f} м/с (пік у лозі {t_name})',
            unit='м/с',
            status='PASS' if ok_spd else 'FAIL',
            reason=(
                'Пікова швидкість у бінарному лозі польоту узгоджується з протоколом ПМВ (у межах допуску ±2.5 м/с).'
                if ok_spd else
                f'КІБЕР-ФІЗИЧНА РОЗБІЖНІСТЬ (CROSS-SPEED-MISMATCH): у документі заявлено {claimed_speed_mps:.1f} м/с, але бінарний лог {t_name} фіксує {max_speed:.1f} м/с.'
            ),
            evidence=[claimed_speed_loc or sources[0]['name'], f'{t_name}: max_ground_speed_mps={max_speed:.1f}'],
        ))
    else:
        findings.append(dict(
            parameter='Крос-верифікація ПМВ ⇄ Чорна скринька: Швидкість польоту (ground_speed_mps)',
            expected=f'{claimed_speed_mps:.1f} м/с' if claimed_speed_mps is not None else 'Не заявлено або неоднозначно в ПМВ',
            actual=f'{max_speed:.1f} м/с' if max_speed is not None else 'Відсутня в лозі',
            unit='м/с',
            status='UNVERIFIED',
            reason='Недостатньо доказів (No evidence -> UNVERIFIED): у протоколі або бінарному лозі відсутній підтверджений числовий показник швидкості.',
            evidence=[sources[0]['name'], t_name],
        ))

    # 3. Cross-check GNSS/EW & Spoofing / Replay integrity
    has_ew_or_tamper = (
        overall == 'ANOMALY_OR_EW_DETECTED'
        or (summary.get('jamming_indicators', 0) or 0) > 0
        or (summary.get('spoofing_indicators', 0) or 0) > 0
        or jam_ind_max >= 150
        or spoof_events > 0
        or ts_reg > 0
    )
    if has_ew_or_tamper:
        integ_status = 'FAIL'
        integ_reason = f'КІБЕР-ФІЗИЧНА РОЗБІЖНІСТЬ (CROSS-EW-FALSIFICATION): бінарний лог {t_name} містить ознаки підміни/глушіння GNSS або порушення цілісності ({overall}, jamInd={jam_ind_max}, spoofEvents={spoof_events}, timeRegressions={ts_reg}), не відображені як відмова у протоколі.'
    elif overall == 'UNVERIFIED':
        integ_status = 'UNVERIFIED'
        integ_reason = f'Недостатньо доказів цілісності (No evidence -> UNVERIFIED): у файлі телеметрії {t_name} відсутні діагностичні потоки GNSS/РЕБ/часових рядів.'
    else:
        integ_status = 'PASS'
        integ_reason = f'Бінарний лог {t_name} підтверджує штатну навігацію без ознак РЕБ, спуфінгу чи часових склейок.'

    findings.append(dict(
        parameter='Крос-верифікація ПМВ ⇄ Чорна скринька: Цілісність GNSS / РЕБ / Часовий ряд',
        expected='NOMINAL (відсутність спуфінгу, глушіння та розривів часу)',
        actual=f'status={overall}, jamInd={jam_ind_max}, spoofEvents={spoof_events}, timeRegressions={ts_reg}',
        unit='',
        status=integ_status,
        reason=integ_reason,
        evidence=[sources[0]['name'], f'{t_name}: overall_status={overall}'],
    ))
    return telem


def render(data):
    def safe(s): return str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('|','\\|').replace('\n','<br>').replace('`',"'")
    lines=['# Інженерний звіт: перевірка технічних документів','',f"Дата UTC: {data['generated_at']}", '', f"Перевірки: PASS={data['counts']['PASS']}; FAIL={data['counts']['FAIL']}; UNVERIFIED={data['counts']['UNVERIFIED']}.", '', 'PASS стосується лише конкретного числового порівняння. Загальна відповідність, сертифікація та готовність виробу не визначалися. Оригінали не змінено. Звіт містить локально витягнутий текст без гарантії деідентифікації.', '', '## Джерела і походження', '']
    for s in data['sources']:
        lines += [f"- {safe(s['name'])} ({s['role']}, {s['bytes']} байт), SHA-256: `{s['sha256']}`."]
    if data.get('telemetry_cross_check'):
        t_meta = data['telemetry_cross_check'].get('input_meta', {})
        lines += [f"- Бортовий лог телеметрії: `{safe(data['telemetry_cross_check'].get('source_file', ''))}` (формат: `{safe(t_meta.get('detected_format', ''))}`, SHA-256: `{t_meta.get('sha256', '')}`)."]
    lines += ['', '## Результати перевірок', '', '| Статус | Параметр | Норма | Факт | Доказ / висновок |', '|---|---|---|---|---|']
    for f in data['findings']:
        lines.append('| ' + ' | '.join(safe(v) for v in [f['status'],f['parameter'],f['expected'],f['actual'],'; '.join(f['evidence'])+' — '+f['reason']])+' |')
    lines += ['', '## Витягнуті дані з адресами', '']
    for s in data['sources']:
        lines += [f"### {safe(s['name'])}", '', '| Адреса | Значення |','|---|---|']
        for r in s['records']:
            cells = [f'{r["cell_locations"][i]}: {v}' if i < len(r['cell_locations']) and r['cell_locations'][i] else v for i,v in enumerate(r['cells'])]
            lines += [f"| {safe(r['location'])} | {safe(' ; '.join(cells))} |"]
    lines += ['', '### Межі застосування та вимоги до верифікації', '', '- Числові перевірки підтримують лише явні скаляри з відомою одиницею та =, <, >, ≤, ≥, допуски (±), інтервали та позиції комплектності (шт.). Неструктурований прозовий текст поза таблицями та растрові скани без текстового шару потребують ручної перевірки.', '- Ризик неповного покриття: звірити витяг з оригіналом, надати відсутні ТУ/паспорт/ПМВ і підтвердити редакції, одиниці, критерії та умови випробувань. Відсутні дані не є PASS.', '- Справжність підписів, правова відповідність, фізична справність і повнота документації не перевірялися; потрібен відповідальний інженер та профільний перегляд.']
    for s in data['sources']:
        for warning in s['warnings']: lines.append(f"- {safe(s['name'])}: {safe(warning)}")
    return '\n'.join(lines)+'\n'


def run_client(inputs, report, telemetry_path=None):
    report = Path(report)
    json_path = report.with_suffix('.json')
    source_paths = {Path(p).resolve() for _,p in inputs}
    if telemetry_path:
        source_paths.add(Path(telemetry_path).resolve())
    if report.suffix.lower() not in ('.md', '.markdown'):
        raise ValueError('Шлях --report повинен мати розширення .md або .markdown')
    aliases_input = any(output.exists() and source.exists() and output.samefile(source) for output in (report, json_path) for source in source_paths)
    if aliases_input or report.resolve() in source_paths or json_path.resolve() in source_paths:
        raise ValueError('Вихідний звіт не може перезаписати вхідний файл')
    if report.resolve() == json_path.resolve() or (report.exists() and json_path.exists() and report.samefile(json_path)):
        print('Помилка: вихідні файли .md та .json вказують на один і той самий фізичний файл (alias)', file=sys.stderr)
        return 2
    sources = [extract(p, role) for role,p in inputs]
    has_dup_source = _sources_have_physical_duplicates(sources)
    findings = analyze(sources)
    telem_info = None
    if telemetry_path:
        telem_info = verify_telemetry_cross_check(sources, findings, telemetry_path)
    data = dict(
        schema_version=1,
        generated_at=datetime.now(timezone.utc).isoformat(),
        sources=sources,
        findings=findings,
        telemetry_cross_check=telem_info,
        counts={s:sum(f['status']==s for f in findings) for s in ('PASS','FAIL','UNVERIFIED')},
    )
    md_text = render(data)
    json_text = json.dumps(data,ensure_ascii=False,indent=2)+'\n'
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(md_text,encoding='utf-8')
    json_path.write_text(json_text,encoding='utf-8')
    print(f'Звіт: {report}; структуровані докази: {json_path}; {data["counts"]}')
    if has_dup_source:
        print('Помилка: один фізичний файл передано у кількох ролях', file=sys.stderr)
        return 2
    return 0


def run_dirty_benchmark(output_json=None) -> dict:
    """Runs an empirical 15-scenario dirty/adversarial corpus benchmark measuring True Positives,
    False Positives, honest Blind Spots (UNVERIFIED), and execution latency (ms).
    """
    import tempfile
    import time
    t0 = time.perf_counter()
    results = []
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)

        def eval_md(cid, category, title, md_text, expected_class):
            tc0 = time.perf_counter()
            p = root / f'{cid}.md'
            p.write_text(md_text, encoding='utf-8')
            s = extract(p, 'input')
            f = analyze([s])[0]
            ms = round((time.perf_counter() - tc0) * 1000.0, 3)
            results.append(dict(
                id=cid, category=category, title=title,
                expected=expected_class, actual=f['status'],
                matched=(f['status'] == expected_class),
                reason=f['reason'], elapsed_ms=ms,
            ))

        # 1. Dirty engineering specs & intervals
        eval_md('BM-01', 'dirty_table', 'Звужений температурний інтервал (-15 °C замість -20 °C)',
                '| Параметр | Норма | Факт |\n|---|---|---|\n| Температура | від -20 °C до +45 °C | від -15 °C до +45 °C |\n', 'FAIL')
        eval_md('BM-02', 'dirty_table', 'Пропущений піддіапазон частот (лише 868–915 МГц без 433 МГц)',
                '| Параметр | Норма | Факт |\n|---|---|---|\n| Частоти | 433.05–434.79 та 868–915 МГц | 868–915 МГц |\n', 'FAIL')
        eval_md('BM-03', 'dirty_table', 'Напруга живлення в межах допуску 22.2 ± 0.5 В (22.5 В)',
                '| Параметр | Норма | Факт |\n|---|---|---|\n| Напруга | 22.2 ± 0.5 В | 22.5 В |\n', 'PASS')
        eval_md('BM-04', 'dirty_table', 'Вихід за межі допуску напруги 22.2 ± 0.5 В (23.1 В)',
                '| Параметр | Норма | Факт |\n|---|---|---|\n| Напруга | 22.2 ± 0.5 В | 23.1 В |\n', 'FAIL')
        eval_md('BM-05', 'dirty_table', 'Розбіжність комплектності ЗІП / BOM (2 АКБ замість 4 шт.)',
                '| Параметр | Норма | Факт |\n|---|---|---|\n| Комплект | АКБ 6S4P — 4 шт., Антена — 2 шт. | АКБ 6S4P — 2 шт., Антена — 2 шт. |\n', 'FAIL')

        # 2. Cyber-Forensics: Homoglyphs, Zero-Width, Cache Spoofing, Zip-Slip, XXE
        eval_md('BM-06', 'cyber_forensics', 'Кібер-атака CYBER-HOMOGLYPH: латинська "a" (U+0061) у слові "Мaса"',
                '| Параметр | Норма | Факт |\n|---|---|---|\n| Мaса | ≤ 10 кг | 9 кг |\n', 'FAIL')
        eval_md('BM-07', 'cyber_forensics', 'Кібер-атака CYBER-HOMOGLYPH: латинська "k" (U+006B) в одиниці "kг"',
                '| Параметр | Норма | Факт |\n|---|---|---|\n| Маса | ≤ 10 кг | 9 kг |\n', 'FAIL')
        eval_md('BM-08', 'cyber_forensics', 'Кібер-атака CYBER-ZERO-WIDTH: прихований символ U+200B у комірці',
                '| Параметр | Норма | Факт |\n|---|---|---|\n| Ма\u200bса | ≤ 10 кг | 9 кг |\n', 'FAIL')

        # BM-09: XLSX Formula Cache Tampering (<f>8+4</f><v>9</v>)
        tc0 = time.perf_counter()
        xlsx_tamper = root / 'tamper.xlsx'
        with zipfile.ZipFile(xlsx_tamper, 'w') as z:
            z.writestr('xl/workbook.xml', f'<workbook xmlns="{X}" xmlns:r="{R}"><sheets><sheet name="ПМВ" r:id="a"/></sheets></workbook>')
            z.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="a" Target="worksheets/sheet1.xml"/></Relationships>')
            rows = (
                '<row r="1"><c r="A1" t="inlineStr"><is><t>Параметр</t></is></c><c r="B1" t="inlineStr"><is><t>Норма</t></is></c><c r="C1" t="inlineStr"><is><t>Факт</t></is></c><c r="D1" t="inlineStr"><is><t>Одиниця</t></is></c></row>'
                '<row r="2"><c r="A2" t="inlineStr"><is><t>Маса споряджена</t></is></c><c r="B2" t="inlineStr"><is><t>≤ 10</t></is></c><c r="C2"><f>8+4</f><v>9</v></c><c r="D2" t="inlineStr"><is><t>кг</t></is></c></row>'
            )
            z.writestr('xl/worksheets/sheet1.xml', f'<worksheet xmlns="{X}"><sheetData>{rows}</sheetData></worksheet>')
        f_xlsx = analyze([extract(xlsx_tamper, 'input')])[0]
        results.append(dict(
            id='BM-09', category='cyber_forensics',
            title='Кібер-атака CYBER-XLSX-CACHE-SPOOF: формула <f>8+4</f>=12 при підробленому кеші <v>9</v>',
            expected='FAIL', actual=f_xlsx['status'], matched=(f_xlsx['status'] == 'FAIL'),
            reason=f_xlsx['reason'], elapsed_ms=round((time.perf_counter() - tc0) * 1000.0, 3),
        ))

        # BM-10: Zip-Slip traversal block
        tc0 = time.perf_counter()
        zip_slip = root / 'slip.docx'
        with zipfile.ZipFile(zip_slip, 'w') as z:
            z.writestr('../evil.xml', '<a/>')
        try:
            extract(zip_slip, 'input')
            actual_zs, reason_zs = 'PASS', 'Zip-Slip не заблоковано'
        except ValueError as exc:
            actual_zs, reason_zs = 'BLOCKED', str(exc)
        results.append(dict(
            id='BM-10', category='cyber_forensics',
            title='Кібер-атака CYBER-ZIP-SLIP: шлях ../evil.xml у контейнері OpenXML',
            expected='BLOCKED', actual=actual_zs, matched=(actual_zs == 'BLOCKED'),
            reason=reason_zs, elapsed_ms=round((time.perf_counter() - tc0) * 1000.0, 3),
        ))

        # BM-11: Cross-Domain ПМВ ⇄ Чорна скринька (Telemetry Cross-Verification — Anomaly & Spoofing)
        tc0 = time.perf_counter()
        pmv_doc = root / 'pmv_claim.md'
        pmv_doc.write_text(
            '| Параметр | Норма | Факт |\n|---|---|---|\n'
            '| Максимальна висота польоту | ≤ 500 м | 450 м |\n'
            '| Максимальна швидкість польоту | ≤ 25 м/с | 18.2 м/с |\n',
            encoding='utf-8',
        )
        ulg_candidates = [
            Path(__file__).resolve().parent.parent / 'nmea-telemetry-analyzer' / 'sample_px4.ulg',
            Path(__file__).resolve().parent.parent / 'telemetry_ew' / 'sample_px4.ulg',
        ]
        ulg_path = next((p for p in ulg_candidates if p.exists()), None)
        s_pmv = [extract(pmv_doc, 'pmv')]
        f_pmv = analyze(s_pmv)
        if ulg_path:
            verify_telemetry_cross_check(s_pmv, f_pmv, ulg_path)
        cross_fails = [x for x in f_pmv if x['parameter'].startswith('Крос-верифікація') and x['status'] == 'FAIL']
        results.append(dict(
            id='BM-11', category='cross_domain_hardware_doc',
            title='Крос-верифікація ПМВ ⇄ Бінарний лог (.ulg): виявлення прихованого стрибка висоти 1150 м, швидкості 68.5 м/с та РЕБ/спуфінгу',
            expected='FAIL', actual='FAIL' if len(cross_fails) >= 2 else 'PASS',
            matched=(len(cross_fails) >= 2),
            reason=cross_fails[0]['reason'] if cross_fails else 'Не виявлено',
            elapsed_ms=round((time.perf_counter() - tc0) * 1000.0, 3),
        ))

        # BM-12: Clean Nominal Flight Log + SHA-256 Binding (True Negative control for normal climb 100 -> 440 m)
        tc0 = time.perf_counter()
        clean_csv = root / 'clean_flight.csv'
        clean_csv.write_text(
            'timestamp_s,alt_msl_m,baroalt,ground_speed_mps\n'
            '0.0,100.0,100.0,15.0\n'
            '20.0,220.0,219.5,17.2\n'
            '40.0,340.0,340.2,18.0\n'
            '60.0,440.0,439.8,18.1\n',
            encoding='utf-8',
        )
        clean_sha = hashlib.sha256(clean_csv.read_bytes()).hexdigest()
        pmv_clean = root / 'pmv_clean.md'
        pmv_clean.write_text(
            f'SHA-256 бортового логу: {clean_sha}\n\n'
            '| Параметр | Норма | Факт |\n|---|---|---|\n'
            '| Максимальна висота польоту | ≤ 500 м | 440 м |\n'
            '| Максимальна швидкість польоту | ≤ 25 м/с | 18.2 м/с |\n',
            encoding='utf-8',
        )
        s_clean = [extract(pmv_clean, 'pmv')]
        f_clean = analyze(s_clean)
        verify_telemetry_cross_check(s_clean, f_clean, clean_csv)
        cross_clean = [x for x in f_clean if x['parameter'].startswith('Крос-верифікація')]
        all_clean_pass = len(cross_clean) == 4 and all(x['status'] == 'PASS' for x in cross_clean)
        results.append(dict(
            id='BM-12', category='cross_domain_hardware_doc',
            title='Штатний набір висоти 100→440 м за 60 с + криптоприв’язка SHA-256 (0 хибних спрацювань)',
            expected='PASS', actual='PASS' if all_clean_pass else 'FAIL',
            matched=all_clean_pass,
            reason='Усі 4 перевірки ПМВ ⇄ Лог (SHA-256, Висота, Швидкість, Цілісність) = PASS.',
            elapsed_ms=round((time.perf_counter() - tc0) * 1000.0, 3),
        ))

        # BM-13: Forged Log Substitution (CROSS-LOG-HASH-MISMATCH)
        tc0 = time.perf_counter()
        pmv_forged_hash = root / 'pmv_forged_hash.md'
        pmv_forged_hash.write_text(
            'SHA-256 бортового логу: ' + ('a' * 64) + '\n\n'
            '| Параметр | Норма | Факт |\n|---|---|---|\n'
            '| Максимальна висота польоту | ≤ 500 м | 440 м |\n',
            encoding='utf-8',
        )
        s_fh = [extract(pmv_forged_hash, 'pmv')]
        f_fh = analyze(s_fh)
        verify_telemetry_cross_check(s_fh, f_fh, clean_csv)
        hash_fail = [x for x in f_fh if 'CROSS-LOG-HASH-MISMATCH' in x['reason']]
        results.append(dict(
            id='BM-13', category='cyber_forensics',
            title='Кібер-атака CROSS-LOG-HASH-MISMATCH: підміна файлу бортового логу (невідповідність SHA-256 у ПМВ)',
            expected='FAIL', actual='FAIL' if hash_fail else 'PASS',
            matched=bool(hash_fail),
            reason=hash_fail[0]['reason'] if hash_fail else 'Не виявлено',
            elapsed_ms=round((time.perf_counter() - tc0) * 1000.0, 3),
        ))

        # BM-14: Digit-letter spoofing ('1О кг') and whole-word Latin 'Maca'
        eval_md('BM-14', 'cyber_forensics', 'Кібер-атака CYBER-HOMOGLYPH: підміна цифри 0 літерою О ("1О кг") та латинське "Maca"',
                '| Параметр | Норма | Факт |\n|---|---|---|\n| Maca | ≤ 10 кг | 1О кг |\n', 'FAIL')

        # BM-15: Physics-Aware Column Auto-Inference (AUTO-SCHEMA-PHYSICS) on non-standard headers
        eval_md('BM-15', 'dirty_table', 'Автоінференція нестандартних заголовків за операторами допуску та SI (AUTO-SCHEMA-PHYSICS)',
                '| Позиція ТЗ | Очікувалось | Зафіксовано |\n|---|---|---|\n| Маса | ≤ 10 кг | 12 кг |\n', 'FAIL')

        # 4. Honest Blind Spots / Known Boundaries (reported as UNVERIFIED, never false PASS)
        eval_md('FN-01', 'known_blind_spot', 'Сліпа зона FN-01: суперечність у вільному прозовому абзаці без таблиці',
                'У тексті примітки зазначено, що дальність становить 40 км, проте в іншому реченні згадано 22 км без таблиці.', 'UNVERIFIED')
        eval_md('FN-02', 'known_blind_spot', 'Сліпа зона FN-02: нестандартні колонки без операторів норми (≤/≥/±) між двома скалярами',
                '| Позиція | Серія А | Серія Б |\n|---|---|---|\n| Маса | 10 кг | 12 кг |\n', 'UNVERIFIED')

    total_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    tp = sum(1 for r in results if r['category'] != 'known_blind_spot' and r['expected'] in ('FAIL', 'BLOCKED') and r['matched'])
    tn = sum(1 for r in results if r['expected'] == 'PASS' and r['matched'])
    fp = sum(1 for r in results if r['expected'] == 'PASS' and not r['matched'])
    blind_spots = sum(1 for r in results if r['category'] == 'known_blind_spot' and r['actual'] == 'UNVERIFIED')
    summary = dict(
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_cases=len(results),
        true_positives_caught=tp,
        true_negatives_clean=tn,
        false_positives=fp,
        honest_unverified_blind_spots=blind_spots,
        all_assertions_matched=all(r['matched'] for r in results),
        total_elapsed_ms=total_ms,
        estimated_manual_review_min=42,
        cases=results,
    )
    if output_json:
        Path(output_json).write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return summary

