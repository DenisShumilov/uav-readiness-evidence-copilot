"""CLI regressions: client data must never use demo findings or lose evidence."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).with_name('defdoc_auditor.py')
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
X = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

class ClientIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
    def tearDown(self):
        self.temp.cleanup()
    def run_cli(self, source, *extra):
        report = self.root / 'report.md'
        result = subprocess.run([sys.executable, str(SCRIPT), str(source), '--report', str(report), *extra], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return report.read_text(), json.loads(report.with_suffix('.json').read_text())
    def test_markdown_detects_limit_failure_and_preserves_source(self):
        src = self.root / 'client.md'
        src.write_text('| Параметр | Норма | Факт |\n|---|---|---|\n| Маса | ≤ 10 кг | 11 кг |\n')
        original = src.read_bytes()
        report, data = self.run_cli(src)
        self.assertEqual(data['counts']['FAIL'], 1)
        self.assertEqual(data['counts']['PASS'], 0)
        self.assertIn('рядок 3', report)
        self.assertEqual(src.read_bytes(), original)
        self.assertEqual(len(data['sources'][0]['sha256']), 64)
        self.assertNotIn('49/100', report)
    def test_missing_actual_is_not_pass(self):
        src = self.root / 'partial.md'
        src.write_text('| Параметр | Норма | Факт |\n|---|---|---|\n| Маса | ≤ 10 кг | |\n')
        _, data = self.run_cli(src)
        self.assertEqual(data['counts']['PASS'], 0)
        self.assertGreater(data['counts']['UNVERIFIED'], 0)
        self.assertEqual(len(data['sources']), 1)
    def test_docx_split_runs_table_and_consistent_values(self):
        src = self.root / 'client.docx'
        def cell(text): return '<w:tc><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:tc>'
        rows = '<w:tr>' + ''.join(cell(t) for t in ['Параметр','Норма','Факт']) + '</w:tr>'
        rows += '<w:tr>' + cell('Ма</w:t></w:r><w:r><w:t>са') + cell('≤ 10 кг') + cell('9 кг') + '</w:tr>'
        with zipfile.ZipFile(src,'w') as z:
            z.writestr('word/document.xml',f'<w:document xmlns:w="{W}"><w:body><w:tbl>{rows}</w:tbl></w:body></w:document>')
        report, data = self.run_cli(src)
        self.assertEqual(data['counts']['PASS'], 1)
        self.assertIn('Маса', report)
        self.assertIn('таблиця 1, рядок 2', report)
    def test_xlsx_all_sheets_inline_shared_numeric_formula_and_blank_columns(self):
        src = self.root / 'client.xlsx'
        with zipfile.ZipFile(src,'w') as z:
            z.writestr('xl/workbook.xml',f'<workbook xmlns="{X}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Перший" r:id="a"/><sheet name="Другий" r:id="b"/></sheets></workbook>')
            z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="a" Target="worksheets/sheet1.xml"/><Relationship Id="b" Target="worksheets/sheet2.xml"/></Relationships>')
            z.writestr('xl/sharedStrings.xml',f'<sst xmlns="{X}"><si><r><t>Па</t></r><r><t>раметр</t></r></si></sst>')
            z.writestr('xl/worksheets/sheet1.xml',f'<worksheet xmlns="{X}"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Норма</t></is></c><c r="C1" t="inlineStr"><is><t>Факт</t></is></c><c r="D1" t="inlineStr"><is><t>Одиниця</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Маса</t></is></c><c r="B2"><v>10</v></c><c r="C2"><v>10</v></c><c r="D2" t="inlineStr"><is><t>кг</t></is></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Струм</t></is></c><c r="C3"><v>2</v></c><c r="D3" t="inlineStr"><is><t>А</t></is></c></row></sheetData></worksheet>')
            z.writestr('xl/worksheets/sheet2.xml',f'<worksheet xmlns="{X}"><sheetData><row r="1"><c r="A1"><f>1+1</f><v>2</v></c><c r="B1"><f>2+2</f></c></row></sheetData></worksheet>')
        report,data = self.run_cli(src)
        self.assertEqual(data['counts']['PASS'],1)
        self.assertIn('Другий!A1',report)
        self.assertTrue(any('формул' in w for w in data['sources'][0]['warnings']))
        self.assertGreater(data['counts']['UNVERIFIED'],0)
    def test_explicit_partial_tu_does_not_mix_demo(self):
        src = self.root / 'tu.md'; src.write_text('Маса: 10 кг\n')
        report = self.root / 'report.md'
        result = subprocess.run([sys.executable,str(SCRIPT),'--tu',str(src),'--report',str(report)],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        data=json.loads(report.with_suffix('.json').read_text())
        self.assertEqual(len(data['sources']),1)
        self.assertEqual(data['counts']['PASS'],0)
    def test_corrupt_empty_unsupported_input_fails_without_traceback(self):
        for name, content in [('bad.docx',b'broken'),('empty.md',b''),('bad.xlsx',b'broken'),('bad.pdf',b'not pdf')]:
            with self.subTest(name=name):
                src=self.root/name; src.write_bytes(content)
                result=subprocess.run([sys.executable,str(SCRIPT),str(src),'--report',str(self.root/'report.md')],capture_output=True,text=True)
                self.assertEqual(result.returncode,2)
                self.assertNotIn('Traceback',result.stderr)
    def test_multiple_sources_compare_by_parameter_and_unit(self):
        tu=self.root/'tu.md'; pmv=self.root/'pmv.md'
        tu.write_text('| Параметр | Значення |\n|---|---|\n| Довжина | 1 м |\n')
        pmv.write_text('| Параметр | Значення |\n|---|---|\n| Довжина | 1000 мм |\n')
        report=self.root/'report.md'
        result=subprocess.run([sys.executable,str(SCRIPT),'--tu',str(tu),'--pmv',str(pmv),'--report',str(report)],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        data=json.loads(report.with_suffix('.json').read_text())
        self.assertEqual(data['counts']['PASS'],1)
        self.assertEqual(data['counts']['FAIL'],0)

    def test_utf16_dtd_is_rejected(self):
        src=self.root/'entity.docx'
        doc=f'<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE w:document [<!ENTITY a "secret">]><w:document xmlns:w="{W}"><w:body><w:p><w:r><w:t>&a;</w:t></w:r></w:p></w:body></w:document>'
        with zipfile.ZipFile(src,'w') as z: z.writestr('word/document.xml',doc.encode('utf-16'))
        result=subprocess.run([sys.executable,str(SCRIPT),str(src)],capture_output=True,text=True)
        self.assertEqual(result.returncode,2)
    def test_merged_docx_cells_do_not_produce_pass(self):
        src=self.root/'merged.docx'
        def cell(text,props=''): return f'<w:tc>{props}<w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:tc>'
        rows='<w:tr>'+''.join(cell(t) for t in ['Параметр','Норма','Факт'])+'</w:tr>'
        rows+='<w:tr>'+cell('Маса','<w:tcPr><w:gridSpan w:val="2"/></w:tcPr>')+cell('10 кг')+cell('10 кг')+'</w:tr>'
        with zipfile.ZipFile(src,'w') as z: z.writestr('word/document.xml',f'<w:document xmlns:w="{W}"><w:body><w:tbl>{rows}</w:tbl></w:body></w:document>')
        _,data=self.run_cli(src)
        self.assertEqual(data['counts']['PASS'],0)
    def test_sparse_xlsx_expansion_has_total_budget(self):
        src=self.root/'sparse.xlsx'
        with zipfile.ZipFile(src,'w') as z:
            z.writestr('xl/workbook.xml',f'<workbook xmlns="{X}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sparse" r:id="a"/></sheets></workbook>')
            z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="a" Target="worksheets/sheet1.xml"/></Relationships>')
            rows=''.join(f'<row r="{n}"><c r="XFD{n}"><v>1</v></c></row>' for n in range(1,34))
            z.writestr('xl/worksheets/sheet1.xml',f'<worksheet xmlns="{X}"><sheetData>{rows}</sheetData></worksheet>')
        result=subprocess.run([sys.executable,str(SCRIPT),str(src)],capture_output=True,text=True)
        self.assertEqual(result.returncode,2)

    def test_duplicate_semantic_headers_never_pick_last_norm(self):
        src=self.root/'ambiguous.md'; src.write_text('| Параметр | Норма | Норма | Факт |\n| Маса | ≤10 кг | ≤100 кг | 11 кг |\n')
        _,data=self.run_cli(src)
        self.assertEqual(data['counts']['PASS'],0)
    def test_separated_markdown_table_does_not_inherit_headers(self):
        src=self.root/'separated.md'; src.write_text('| Параметр | Норма | Факт |\n| Маса | 10 кг | 11 кг |\n\n| Назва | Вчора | Завтра |\n| Маса | 10 кг | 10 кг |\n')
        _,data=self.run_cli(src)
        self.assertEqual(data['counts']['PASS'],0)

    def test_boolean_cells_are_not_measurements(self):
        src=self.root/'bool.xlsx'
        def cell(ref,text): return f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>'
        with zipfile.ZipFile(src,'w') as z:
            z.writestr('xl/workbook.xml',f'<workbook xmlns="{X}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" r:id="a"/></sheets></workbook>')
            z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="a" Target="worksheets/sheet1.xml"/></Relationships>')
            rows='<row r="1">'+cell('A1','Параметр')+cell('B1','Норма')+cell('C1','Факт')+cell('D1','Одиниця')+'</row>'
            rows+='<row r="2">'+cell('A2','Маса')+cell('B2','≤10')+'<c r="C2" t="b"><v>1</v></c>'+cell('D2','кг')+'</row>'
            z.writestr('xl/worksheets/sheet1.xml',f'<worksheet xmlns="{X}"><sheetData>{rows}</sheetData></worksheet>')
        _,data=self.run_cli(src)
        self.assertEqual(data['counts']['PASS'],0)

    def test_report_hardlink_cannot_overwrite_original(self):
        src=self.root/'original.md'; src.write_text('Оригінал незмінний')
        output=self.root/'report.md'; os.link(src,output)
        result=subprocess.run([sys.executable,str(SCRIPT),str(src),'--report',str(output)],capture_output=True,text=True)
        self.assertEqual(result.returncode,2)
        self.assertEqual(src.read_text(),'Оригінал незмінний')

    def test_temperature_and_frequency_intervals_and_tolerances_and_bom(self):
        src = self.root / 'intervals_and_tolerances.md'
        src.write_text(
            '| Параметр | Норма | Факт |\n'
            '|---|---|---|\n'
            '| 1. Температура (невідповідна) | від -20 °C до +45 °C | Термокамера: від -15 °C до +45 °C |\n'
            '| 2. Температура (відповідна) | від -20 °C до +45 °C | Термокамера: від -25 °C до +50 °C |\n'
            '| 3. Частоти (неповні) | 433.05–434.79 та 868–915 МГц | Перевірено лише 868–915 МГц |\n'
            '| 4. Частоти (повні) | 433.05–434.79 та 868–915 МГц | 433.05–434.79 та 868–915 МГц |\n'
            '| 5. Напруга (у допуску) | 22.2 ± 0.5 В | 22.5 В |\n'
            '| 6. Напруга (поза допуском) | 22.2 ± 0.5 В | 23.1 В |\n'
            '| 7. Комплектність (різна) | АКБ 6S4P — 4 шт., Патч-антена — 2 шт. | АКБ 6S4P — 2 шт., Патч-антена — 1 шт. |\n'
            '| 8. Комплектність (однакова) | АКБ 6S4P — 4 шт., Патч-антена — 2 шт. | АКБ 6S4P — 4 шт., Патч-антена — 2 шт. |\n'
        )
        _, data = self.run_cli(src)
        statuses = {f['parameter']: f['status'] for f in data['findings']}
        self.assertEqual(statuses['1. Температура (невідповідна)'], 'FAIL')
        self.assertEqual(statuses['2. Температура (відповідна)'], 'PASS')
        self.assertEqual(statuses['3. Частоти (неповні)'], 'FAIL')
        self.assertEqual(statuses['4. Частоти (повні)'], 'PASS')
        self.assertEqual(statuses['5. Напруга (у допуску)'], 'PASS')
        self.assertEqual(statuses['6. Напруга (поза допуском)'], 'FAIL')
        self.assertEqual(statuses['7. Комплектність (різна)'], 'FAIL')
        self.assertEqual(statuses['8. Комплектність (однакова)'], 'PASS')

    def test_corporate_docx_section_banner_and_vmerge_category_column(self):
        src = self.root / 'corporate.docx'
        def cell(text, props=''):
            return f'<w:tc>{props}<w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:tc>'
        rows = '<w:tr>' + ''.join(cell(t) for t in ['Категорія', 'Параметр', 'Норма', 'Факт']) + '</w:tr>'
        rows += '<w:tr>' + cell('Розділ 1. Планер та живлення', '<w:tcPr><w:gridSpan w:val="4"/></w:tcPr>') + '</w:tr>'
        rows += '<w:tr>' + cell('ЛТХ', '<w:tcPr><w:vMerge w:val="restart"/></w:tcPr>') + cell('Маса БпЛА') + cell('≤ 14 кг') + cell('13.5 кг') + '</w:tr>'
        rows += '<w:tr>' + cell('', '<w:tcPr><w:vMerge/></w:tcPr>') + cell('Дальність') + cell('≥ 35 км') + cell('28.5 км') + '</w:tr>'
        with zipfile.ZipFile(src, 'w') as z:
            z.writestr('word/document.xml', f'<w:document xmlns:w="{W}"><w:body><w:tbl>{rows}</w:tbl></w:body></w:document>')
        _, data = self.run_cli(src)
        statuses = {f['parameter']: f['status'] for f in data['findings']}
        self.assertEqual(statuses, {'Маса БпЛА': 'PASS', 'Дальність': 'FAIL'})

    def test_xlsx_formula_evaluation_and_stale_cache_mismatch_detection(self):
        src = self.root / 'formulas.xlsx'
        def inline_cell(ref, text):
            return f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>'
        with zipfile.ZipFile(src, 'w') as z:
            z.writestr('xl/workbook.xml', f'<workbook xmlns="{X}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Аудит" r:id="a"/></sheets></workbook>')
            z.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="a" Target="worksheets/sheet1.xml"/></Relationships>')
            rows = '<row r="1">' + inline_cell('A1', 'Параметр') + inline_cell('B1', 'Норма') + inline_cell('C1', 'Факт') + inline_cell('D1', 'Одиниця') + '</row>'
            rows += '<row r="2">' + inline_cell('A2', 'Розділ 1. Комплектність та живлення') + '</row>'
            rows += '<row r="3">' + inline_cell('A3', 'АКБ основні') + '<c r="B3"><v>2</v></c><c r="C3"><v>2</v></c>' + inline_cell('D3', 'шт') + '</row>'
            rows += '<row r="4">' + inline_cell('A4', 'АКБ резервні') + '<c r="B4"><v>2</v></c><c r="C4"><v>2</v></c>' + inline_cell('D4', 'шт') + '</row>'
            rows += '<row r="5">' + inline_cell('A5', 'Усього АКБ (без кешу)') + '<c r="B5"><v>4</v></c><c r="C5"><f>SUM(C3:C4)</f></c>' + inline_cell('D5', 'шт') + '</row>'
            rows += '<row r="6">' + inline_cell('A6', 'Маса (підроблений кеш)') + inline_cell('B6', '≤ 10') + '<c r="C6"><f>8+4</f><v>9</v></c>' + inline_cell('D6', 'кг') + '</row>'
            merges = '<mergeCells count="1"><mergeCell ref="A2:D2"/></mergeCells>'
            z.writestr('xl/worksheets/sheet1.xml', f'<worksheet xmlns="{X}"><sheetData>{rows}</sheetData>{merges}</worksheet>')
        _, data = self.run_cli(src)
        statuses = {f['parameter']: f['status'] for f in data['findings']}
        self.assertEqual(statuses['Усього АКБ (без кешу)'], 'PASS')
        self.assertEqual(statuses['Маса (підроблений кеш)'], 'FAIL')

    def test_ole2_encrypted_package_and_legacy_ole2_detected(self):
        enc_docx = self.root / 'protected.docx'
        enc_docx.write_bytes(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1' + b'\x00' * 32 + 'EncryptedPackage'.encode('utf-16le'))
        r1 = subprocess.run([sys.executable, str(SCRIPT), str(enc_docx)], capture_output=True, text=True)
        self.assertEqual(r1.returncode, 2)
        self.assertIn('EncryptedPackage', r1.stderr)

        leg_xls = self.root / 'legacy.xlsx'
        leg_xls.write_bytes(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1' + b'\x00' * 64)
        r2 = subprocess.run([sys.executable, str(SCRIPT), str(leg_xls)], capture_output=True, text=True)
        self.assertEqual(r2.returncode, 2)
        self.assertIn('OLE2', r2.stderr)

    def test_cyber_homoglyph_and_zero_width_and_zip_slip_detection(self):
        src = self.root / 'cyber_spoof.md'
        # Row 1 uses Latin 'a' (U+0061) inside 'Мaса'; Row 2 uses Zero-Width Space U+200B; Row 3 is clean
        src.write_text(
            '| Параметр | Норма | Факт |\n'
            '|---|---|---|\n'
            '| Мaса | ≤ 10 кг | 9 кг |\n'
            '| Даль\u200bність | ≥ 30 км | 35 км |\n'
            '| Швидкість | ≤ 25 м/с | 20 м/с |\n',
            encoding='utf-8',
        )
        _, data = self.run_cli(src)
        by_param = {f['parameter']: f for f in data['findings']}
        self.assertEqual(by_param['Мaса']['status'], 'FAIL')
        self.assertIn('CYBER-HOMOGLYPH', by_param['Мaса']['reason'])
        self.assertEqual(by_param['Даль\u200bність']['status'], 'FAIL')
        self.assertIn('CYBER-ZERO-WIDTH', by_param['Даль\u200bність']['reason'])
        self.assertEqual(by_param['Швидкість']['status'], 'PASS')

        # Zip-Slip archive attack
        slip_docx = self.root / 'slip.docx'
        with zipfile.ZipFile(slip_docx, 'w') as z:
            z.writestr('../evil.xml', '<a/>')
        r_slip = subprocess.run([sys.executable, str(SCRIPT), str(slip_docx)], capture_output=True, text=True)
        self.assertEqual(r_slip.returncode, 2)
        self.assertIn('CYBER-ZIP-SLIP', r_slip.stderr)

    def test_cross_verification_pmv_against_binary_flight_log(self):
        pmv = self.root / 'pmv_claims.md'
        pmv.write_text(
            '| Параметр | Норма | Факт |\n'
            '|---|---|---|\n'
            '| Максимальна висота польоту | ≤ 500 м | 450 м |\n'
            '| Максимальна швидкість польоту | ≤ 25 м/с | 18.2 м/с |\n',
            encoding='utf-8',
        )
        ulg_candidates = [
            SCRIPT.resolve().parent.parent / 'nmea-telemetry-analyzer' / 'sample_px4.ulg',
            SCRIPT.resolve().parent.parent / 'telemetry_ew' / 'sample_px4.ulg',
        ]
        ulg = next(p for p in ulg_candidates if p.exists())
        report, data = self.run_cli(pmv, '--telemetry', str(ulg))
        cross = [f for f in data['findings'] if f['parameter'].startswith('Крос-верифікація')]
        self.assertGreaterEqual(len(cross), 2)
        self.assertTrue(any('CROSS-ALTITUDE-MISMATCH' in f['reason'] for f in cross))
        self.assertTrue(any('CROSS-EW-FALSIFICATION' in f['reason'] for f in cross))
        self.assertIn('Бортовий лог телеметрії', report)

    def test_physics_aware_column_auto_inference_and_swapped_columns(self):
        # Even when column headers are non-standard and swapped (Actual | Expected | Label),
        # AUTO-SCHEMA-PHYSICS infers roles via constraint operators (<=, ±) and SI dimensions.
        src = self.root / 'custom_factory_headers.md'
        src.write_text(
            '| Зафіксовано на стенді | Граничний допуск ТЗ | Характеристика виробу |\n'
            '|---|---|---|\n'
            '| 13.9 кг | ≤ 13.5 кг | Маса споряджена |\n'
            '| 22.5 В | 22.2 ± 0.5 В | Напруга борту |\n',
            encoding='utf-8',
        )
        _, data = self.run_cli(src)
        by_param = {f['parameter']: f for f in data['findings']}
        self.assertEqual(by_param['Маса споряджена']['status'], 'FAIL')
        self.assertIn('AUTO-SCHEMA-PHYSICS', by_param['Маса споряджена']['reason'])
        self.assertEqual(by_param['Напруга борту']['status'], 'PASS')
        self.assertIn('AUTO-SCHEMA-PHYSICS', by_param['Напруга борту']['reason'])

    def test_dirty_benchmark_corpus_runs_cleanly(self):
        res = subprocess.run([sys.executable, str(SCRIPT), '--benchmark'], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, res.stderr)
        summary = json.loads(res.stdout)
        self.assertTrue(summary['all_assertions_matched'])
        self.assertEqual(summary['false_positives'], 0)
        self.assertGreaterEqual(summary['true_positives_caught'], 11)
        self.assertEqual(summary['honest_unverified_blind_spots'], 2)

    def test_circular_xlsx_formula_and_count_aggregate(self):
        src = self.root / 'circular_and_count.xlsx'
        def inline_cell(ref, text):
            return f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>'
        with zipfile.ZipFile(src, 'w') as z:
            z.writestr('xl/workbook.xml', f'<workbook xmlns="{X}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Audit" sheetId="1" r:id="a"/></sheets><calcPr iterate="0"/></workbook>')
            z.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="a" Target="worksheets/sheet1.xml"/></Relationships>')
            rows = '<row r="1">' + inline_cell('A1', 'Параметр') + inline_cell('B1', 'Норма') + inline_cell('C1', 'Факт') + inline_cell('D1', 'Одиниця') + '</row>'
            rows += '<row r="2">' + inline_cell('A2', 'Маса') + inline_cell('B2', '≤ 10') + '<c r="C2"><f>SUM(C2:C3)</f><v>9</v></c>' + inline_cell('D2', 'кг') + '</row>'
            rows += '<row r="3"><c r="C3"><v>9</v></c></row>'
            rows += '<row r="4"><c r="C4"><v>5</v></c></row>'
            rows += '<row r="5">' + inline_cell('A5', 'Кількість вимірів') + '<c r="B5"><v>2</v></c><c r="C5"><f>COUNT(C3:C4)</f></c>' + inline_cell('D5', 'шт') + '</row>'
            z.writestr('xl/worksheets/sheet1.xml', f'<worksheet xmlns="{X}"><sheetData>{rows}</sheetData></worksheet>')
        _, data = self.run_cli(src)
        statuses = {f['parameter']: f['status'] for f in data['findings']}
        self.assertEqual(statuses['Маса'], 'UNVERIFIED')
        self.assertEqual(statuses['Кількість вимірів'], 'PASS')

    def test_sanitizer_contact_pii_feminine_patronymic_and_docprops_core_xml(self):
        from sanitize_doc import DocumentSanitizer
        san = DocumentSanitizer()
        contact = 'Email: example@example.invalid; телефон: +380 00 000 00 00; Петренко Олена Іванівна.'
        san_text, counts = san.sanitize_text(contact)
        self.assertNotIn('example@example.invalid', san_text)
        self.assertNotIn('+380 00 000 00 00', san_text)
        self.assertNotIn('Петренко Олена Іванівна', san_text)
        self.assertEqual(counts['CONTACT_PII'], 2)
        self.assertEqual(counts['PERSON'], 1)
        self.assertEqual(san.count_leaked_tokens(san_text), 0)

        person = 'Коваленко О.С.'
        docx = self.root / 'core-property.docx'
        with zipfile.ZipFile(docx, 'w') as z:
            z.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>')
            z.writestr('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="a" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="b" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>')
            z.writestr('word/document.xml', f'<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:t>{person}</w:t></w:r></w:p></w:body></w:document>')
            z.writestr('docProps/core.xml', f'<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>{person}</dc:creator></cp:coreProperties>')
        san2 = DocumentSanitizer()
        san2.sanitize_file(docx, output_dir=self.root)
        with zipfile.ZipFile(self.root / 'core-property.sanitized.docx') as z:
            core = z.read('docProps/core.xml').decode('utf-8')
            body = z.read('word/document.xml').decode('utf-8')
        self.assertNotIn(person, core)
        self.assertNotIn(person, body)
        self.assertEqual(san2.leaked_pii_tokens_remaining, 0)

if __name__ == '__main__': unittest.main()
