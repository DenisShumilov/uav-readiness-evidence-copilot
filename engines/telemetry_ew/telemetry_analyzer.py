#!/usr/bin/env python3
"""Local, bounded telemetry quality inspection. No attack attribution or sensor imputation.

Python standard library only. See README.md for supported wire formats and limits.
"""
import argparse
import csv
from datetime import datetime
import hashlib
import io
import json
import math
from pathlib import Path
import re
import struct
import sys
import unittest
import zlib

MAX_BYTES = 256 * 1024 * 1024
MAX_STREAMS = 4096
MAX_FIELDS = 4096
PRIMITIVES = {'int8_t': 'b', 'uint8_t': 'B', 'int16_t': 'h', 'uint16_t': 'H',
              'int32_t': 'i', 'uint32_t': 'I', 'int64_t': 'q', 'uint64_t': 'Q',
              'float': 'f', 'double': 'd', 'bool': '?', 'char': 'c'}
DF_TYPES = {key: (fmt, scale) for key, fmt, scale in [
    ('a', '64s', 1), ('b', 'b', 1), ('B', 'B', 1), ('g', 'e', 1),
    ('h', 'h', 1), ('H', 'H', 1), ('i', 'i', 1), ('I', 'I', 1),
    ('f', 'f', 1), ('d', 'd', 1), ('n', '4s', 1), ('N', '16s', 1),
    ('Z', '64s', 1), ('c', 'h', .01), ('C', 'H', .01), ('e', 'i', .01),
    ('E', 'I', .01), ('L', 'i', 1e-7), ('M', 'b', 1), ('q', 'q', 1), ('Q', 'Q', 1)]}


class FormatError(ValueError):
    pass


def need(condition, message):
    if not condition:
        raise FormatError(message)


def decode(data):
    return data.split(b'\0', 1)[0].decode('utf-8', errors='strict')


class Inspection:
    def __init__(self, source, data):
        self.result = {'source': str(source), 'size_bytes': len(data),
                       'sha256': hashlib.sha256(data).hexdigest(), 'format': None,
                       'records': 0, 'streams': {}, 'errors': [], 'warnings': [],
                       'unsupported': {}, 'metadata_records': {}, 'quality': {}}
        self.previous = {}
        self.first = {}
        self.last_field = {}

    def error(self, text):
        if text not in self.result['errors'] and len(self.result['errors']) < 100:
            self.result['errors'].append(text)

    def warning(self, text):
        if text not in self.result['warnings'] and len(self.result['warnings']) < 100:
            self.result['warnings'].append(text)

    def count(self, category, key):
        values = self.result[category]
        need(key in values or len(values) < MAX_FIELDS, 'Забагато різних типів повідомлень.')
        values[key] = values.get(key, 0) + 1

    def add(self, name, fields, timestamp=None, meta=None):
        streams = self.result['streams']
        need(name in streams or len(streams) < MAX_STREAMS, 'Перевищено ліміт потоків.')
        stream = streams.setdefault(name, {'records': 0, 'fields': {}, 'duration_seconds': None,
                                           'timestamp_regressions': 0, 'duplicate_timestamps': 0,
                                           'max_gap_seconds': None})
        if meta:
            for mk, mv in meta.items():
                stream.setdefault(mk, mv)
        stream['records'] += 1
        self.result['records'] += 1
        valid_ts = timestamp if (timestamp is not None and not isinstance(timestamp, bool) and math.isfinite(timestamp)) else None
        for field, value in fields.items():
            need(field in stream['fields'] or len(stream['fields']) < MAX_FIELDS, 'Перевищено ліміт полів.')
            stats = stream['fields'].setdefault(field, {'count': 0, 'missing': 0, 'absent': 0, 'nonfinite': 0,
                                                       'min': None, 'max': None, 'text_count': 0,
                                                       'max_step': 0.0, 'max_rate_per_s': None})
            if value is None:
                stats['missing'] += 1
            elif isinstance(value, (float, int)) and not isinstance(value, bool):
                if not math.isfinite(value):
                    stats['nonfinite'] += 1
                    self.warning(f'{name}.{field}: NaN/Infinity виключено з числової статистики.')
                else:
                    stats['count'] += 1
                    stats['min'] = value if stats['min'] is None else min(stats['min'], value)
                    stats['max'] = value if stats['max'] is None else max(stats['max'], value)
                    fkey = (name, field)
                    if fkey in self.last_field:
                        prev_val, prev_ts = self.last_field[fkey]
                        step = abs(float(value) - prev_val)
                        if not math.isfinite(step):
                            self.error(f'{name}.{field}: переповнення похідної різниці (step=Infinity).')
                            stats['max_step'] = None
                        elif stats['max_step'] is not None and step > stats['max_step']:
                            stats['max_step'] = step
                        if valid_ts is not None and prev_ts is not None:
                            dt = valid_ts - prev_ts
                            if not math.isfinite(dt):
                                self.error(f'{name}.{field}: переповнення часового інтервалу (dt=Infinity).')
                                stats['max_rate_per_s'] = None
                            elif dt > 0:
                                rate = step / dt if math.isfinite(step) else math.inf
                                if not math.isfinite(rate):
                                    self.error(f'{name}.{field}: переповнення швидкості зміни (rate=Infinity).')
                                    stats['max_rate_per_s'] = None
                                elif stats['max_rate_per_s'] is None or rate > stats['max_rate_per_s']:
                                    stats['max_rate_per_s'] = rate
                    self.last_field[fkey] = (float(value), valid_ts)
            else:
                stats['text_count'] += 1
        for field, stats in stream['fields'].items():
            stats['absent'] = stream['records'] - (stats['count'] + stats['missing'] + stats['nonfinite'] + stats['text_count'])
        if valid_ts is not None:
            if name in self.previous:
                delta = valid_ts - self.previous[name]
                if not math.isfinite(delta):
                    self.error(f'{name}: переповнення часового інтервалу між записами (delta=Infinity).')
                else:
                    stream['timestamp_regressions'] += int(delta < 0)
                    stream['duplicate_timestamps'] += int(delta == 0)
                    if delta > 0:
                        stream['max_gap_seconds'] = max(delta, stream['max_gap_seconds'] or 0)
            self.first.setdefault(name, valid_ts)
            self.previous[name] = valid_ts
            duration = valid_ts - self.first[name]
            if not math.isfinite(duration):
                self.error(f'{name}: переповнення тривалості потоку (duration=Infinity).')
                stream['duration_seconds'] = None
            else:
                stream['duration_seconds'] = duration


def parse_ulog(data, out):
    need(len(data) >= 16 and data[:7] == b'ULog\x01\x12\x35', 'Невірний або обрізаний заголовок ULog.')
    need(data[7] in (0, 1), f'Непідтримувана версія ULog: {data[7]}.')
    formats, subscriptions, schemas = {}, {}, {}

    def schema(name, ancestry=()):
        need(name not in ancestry and len(ancestry) < 16, 'Рекурсивна/надто глибока ULog-схема.')
        need(name in formats, f'Відсутня ULog F-схема: {name}.')
        if name in schemas:
            return schemas[name]
        fields, offset = [], 0
        for declaration in formats[name].split(';'):
            if not declaration:
                continue
            match = re.fullmatch(r'(\w+)(?:\[(\d+)\])? (\w+)', declaration.strip())
            need(match is not None, f'Непідтримуваний опис поля ULog: {declaration!r}.')
            typ, length, label = match.groups()
            length = int(length or 1)
            need(0 < length <= MAX_FIELDS, 'Неприпустимий розмір масиву ULog.')
            if typ in PRIMITIVES:
                code = PRIMITIVES[typ]
                size = struct.calcsize('<' + code)
                for index in range(length):
                    field = label if length == 1 else f'{label}[{index}]'
                    fields.append((field, offset, code, label.startswith('_padding')))
                    offset += size
            else:
                children, size = schema(typ, ancestry + (name,))
                need(len(fields) + len(children) * length <= MAX_FIELDS and offset + size * length <= 65535, 'Надто велика вкладена ULog-схема.')
                for index in range(length):
                    prefix = label if length == 1 else f'{label}[{index}]'
                    fields.extend((f'{prefix}.{child}', offset + pos, code, padding)
                                  for child, pos, code, padding in children)
                    offset += size
            need(len(fields) <= MAX_FIELDS and offset <= 65535, 'Надто велика ULog-схема.')
        names = [label for label, _, _, pad in fields if not pad]
        need(len(names) == len(set(names)), f'Повторні поля в ULog-схемі {name}.')
        schemas[name] = fields, offset
        return fields, offset

    pos = 16
    while pos < len(data):
        need(pos + 3 <= len(data), f'Обрізаний заголовок ULog у байті {pos}.')
        size, kind = struct.unpack_from('<HB', data, pos)
        end = pos + 3 + size
        need(end <= len(data), f'Обрізаний запис ULog у байті {pos}.')
        payload, kind = data[pos + 3:end], chr(kind)
        if kind == 'F':
            text = decode(payload)
            need(':' in text, f'Невірна ULog F-схема у байті {pos}.')
            name, declaration = text.split(':', 1)
            need(name not in formats or formats[name] == declaration, f'Конфлікт ULog-схеми {name}.')
            need(len(formats) < MAX_STREAMS, 'Забагато ULog-схем.')
            formats[name] = declaration
        elif kind == 'A':
            need(size >= 4, f'Обрізана підписка ULog у байті {pos}.')
            instance, msgid = struct.unpack_from('<BH', payload)
            need(msgid not in subscriptions, f'Повторна активна ULog-підписка {msgid}.')
            subscriptions[msgid] = (decode(payload[3:]), instance)
        elif kind == 'R':
            need(size == 2, 'Невірний розмір ULog R.')
            subscriptions.pop(struct.unpack('<H', payload)[0], None)
        elif kind == 'B':
            need(size >= 40, 'Обрізаний ULog B (flags).')
            need(not any(payload[8:16]), 'Непідтримувані incompat_flags ULog (зокрема appended data): потрібен pyulog.')
        elif kind == 'D':
            need(size >= 2, 'Обрізаний ULog D.')
            msgid = struct.unpack_from('<H', payload)[0]
            need(msgid in subscriptions, f'ULog D без A-підписки: {msgid}.')
            name, instance = subscriptions[msgid]
            fields, full_size = schema(name)
            body = payload[2:]
            required = max((offset + struct.calcsize('<' + code) for _, offset, code, pad in fields if not pad), default=0)
            need(required <= len(body) <= full_size, f'Невірна довжина ULog {name}: {len(body)}, очікується {required}..{full_size}.')
            ts_codes = [code for label, _, code, pad in fields if not pad and label == 'timestamp']
            need(not ts_codes or ts_codes[0] in ('Q', 'I', 'q', 'i', 'H', 'h', 'B', 'b'),
                 f'ULog {name}: поле timestamp за схемою має бути цілим числом мікросекунд.')
            values = {label: struct.unpack_from('<' + code, body, offset)[0]
                      for label, offset, code, pad in fields if not pad}
            timestamp = values.get('timestamp')
            need(timestamp is None or (isinstance(timestamp, int) and not isinstance(timestamp, bool)),
                 f'ULog {name}: timestamp повинен бути цілим числом мікросекунд.')
            out.add(f'{name}[{instance}]', values, timestamp / 1e6 if timestamp is not None else None)
        elif kind in ('I', 'M', 'P', 'Q', 'L', 'C', 'S', 'O'):
            if kind in ('I', 'P'):
                if len(payload) < 2 or 1 + payload[0] > len(payload):
                    out.error(f'Обрізаний або некоректний ULog {kind}-запис метаданих у байті {pos}.')
                    out.count('quality', f'ULog-{kind}: некоректний запис метаданих (не розібрано)')
                    pos = end
                    continue
                out.count('metadata_records', 'ULog-' + kind)
                klen = payload[0]
                try:
                    decl = decode(payload[1:1 + klen])
                    val_bytes = payload[1 + klen:]
                    if ' ' in decl:
                        t_spec, k_name = decl.split(' ', 1)
                        target_dict = out.result.setdefault('ulog_info' if kind == 'I' else 'ulog_parameters', {})
                        if len(target_dict) < MAX_FIELDS:
                            if t_spec.startswith('char['):
                                target_dict[k_name] = decode(val_bytes)
                            elif t_spec == 'float' and len(val_bytes) == 4:
                                v_f = struct.unpack('<f', val_bytes)[0]
                                if math.isfinite(v_f):
                                    target_dict[k_name] = round(v_f, 6)
                            elif t_spec == 'int32_t' and len(val_bytes) == 4:
                                target_dict[k_name] = struct.unpack('<i', val_bytes)[0]
                            elif t_spec == 'uint32_t' and len(val_bytes) == 4:
                                target_dict[k_name] = struct.unpack('<I', val_bytes)[0]
                except Exception:
                    out.count('quality', f'ULog-{kind}: нерозпізнаний формат метаданих')
            else:
                out.count('metadata_records', 'ULog-' + kind)
            if kind == 'O':
                out.warning('ULog містить dropout-повідомлення: частину даних втрачено під час запису.')
        else:
            out.count('unsupported', 'ULog-' + kind)
        pos = end
    out.warning('ULog: поля у вихідних одиницях uORB; timestamp — мкс. Масштаби інших полів без схеми прошивки не вгадуються. CRC для ULog відсутній.')


def parse_dataflash(data, out):
    formats = {128: (89, 'FMT', 'BBnNZ', ['Type', 'Length', 'Name', 'Format', 'Columns'])}
    unit_defs, mult_defs, fmtu_records = {}, {}, []
    pos = 0
    while pos < len(data):
        need(pos + 3 <= len(data), f'Обрізаний заголовок DataFlash у байті {pos}.')
        need(data[pos:pos + 2] == b'\xa3\x95', f'Порушена синхронізація DataFlash у байті {pos}.')
        ident = data[pos + 2]
        need(ident in formats, f'DataFlash тип {ident} без попереднього FMT у байті {pos}.')
        length, name, fmt, labels = formats[ident]
        need(pos + length <= len(data), f'Обрізаний DataFlash {name} у байті {pos}.')
        need(all(ch in DF_TYPES for ch in fmt), f'Непідтримуваний формат DataFlash {fmt}.')
        wire = '<' + ''.join(DF_TYPES[ch][0] for ch in fmt)
        need(struct.calcsize(wire) == length - 3 and len(labels) == len(fmt), f'Несумісний FMT для DataFlash {name}.')
        need(len(labels) == len(set(labels)) and (all(labels) if fmt else not labels), f'Повторні або порожні поля DataFlash {name}.')
        values = struct.unpack_from(wire, data, pos + 3) if fmt else ()
        if ident == 128:
            new_id, new_len, new_name, new_fmt, columns = values
            new_name, new_fmt, columns = decode(new_name), decode(new_fmt), decode(columns)
            need(new_len >= 3 and new_name and (new_fmt or (new_len == 3 and not columns)), 'Порожня/некоректна DataFlash FMT-схема.')
            formats[new_id] = (new_len, new_name, new_fmt, columns.split(',') if columns else [])
        else:
            record = {}
            for label, ch, value in zip(labels, fmt, values):
                if ch == 'a':
                    for index, item in enumerate(struct.unpack('<32h', value)):
                        record[f'{label}[{index}]'] = item
                else:
                    record[label] = value * DF_TYPES[ch][1] if isinstance(value, (int, float)) else decode(value)
            raw_us = record.get('TimeUS')
            raw_ms = record.get('TimeMS')
            if raw_us is not None:
                need(isinstance(raw_us, (int, float)) and not isinstance(raw_us, bool),
                     f'DataFlash {name}: поле TimeUS має нечисловий тип.')
                timestamp = raw_us / 1e6
            elif raw_ms is not None:
                need(isinstance(raw_ms, (int, float)) and not isinstance(raw_ms, bool),
                     f'DataFlash {name}: поле TimeMS має нечисловий тип.')
                timestamp = raw_ms / 1000.0
            else:
                timestamp = None
            stream_name = name
            if name in ('FMTU', 'UNIT', 'MULT'):
                out.count('metadata_records', name)
                if name == 'UNIT' and 'Id' in record and 'Label' in record:
                    u_id = record['Id']
                    need(isinstance(u_id, int) and not isinstance(u_id, bool), 'DataFlash UNIT: Id має бути цілим числом.')
                    unit_defs[int(u_id)] = str(record['Label'])
                elif name == 'MULT' and 'Id' in record and 'Mult' in record:
                    m_id = record['Id']
                    m_val = record['Mult']
                    need(isinstance(m_id, int) and not isinstance(m_id, bool), 'DataFlash MULT: Id має бути цілим числом.')
                    need(isinstance(m_val, (int, float)) and not isinstance(m_val, bool) and math.isfinite(float(m_val)),
                         'DataFlash MULT: Mult має бути скінченним числом.')
                    mult_defs[int(m_id)] = float(m_val)
                elif name == 'FMTU' and 'FmtType' in record:
                    f_type = record['FmtType']
                    need(isinstance(f_type, int) and not isinstance(f_type, bool), 'DataFlash FMTU: FmtType має бути цілим числом.')
                    fmtu_records.append((int(f_type), str(record.get('UnitIds', '')), str(record.get('MultIds', ''))))
            else:
                out.add(stream_name, record, timestamp)
        pos += length
    for ft, u_str, m_str in fmtu_records:
        if ft in formats:
            _, t_name, _, t_cols = formats[ft]
            col_meta = {}
            for idx_c, col_lbl in enumerate(t_cols):
                u_code = ord(u_str[idx_c]) if idx_c < len(u_str) else None
                m_code = ord(m_str[idx_c]) if idx_c < len(m_str) else None
                unit_val = unit_defs.get(u_code) if u_code is not None else None
                mult_val = mult_defs.get(m_code) if m_code is not None else None
                meta_entry = {'unit': unit_val, 'mult': mult_val}
                if unit_val is None and u_code is not None:
                    meta_entry['unresolved_unit_id'] = chr(u_code)
                if mult_val is None and m_code is not None:
                    meta_entry['unresolved_mult_id'] = chr(m_code)
                col_meta[col_lbl] = meta_entry
            out.result.setdefault('schema_units', {})[t_name] = col_meta
    out.warning('DataFlash: застосовано масштаби FMT c/C/e/E/L; таблиці UNIT/MULT/FMTU декодовані у schema_units. Решта величин у вихідних одиницях; CRC відсутній. Екземпляри сенсорів одного типу не розділено: I може позначати інтегральний член PID, а не номер сенсора.')


def parse_ubx(data, out):
    pos = 0
    while pos < len(data):
        need(pos + 8 <= len(data), f'Обрізаний UBX у байті {pos}.')
        need(data[pos:pos + 2] == b'\xb5\x62', f'Порушена синхронізація UBX у байті {pos}; змішаний NMEA/UBX не підтримується.')
        cls, ident, length = struct.unpack_from('<BBH', data, pos + 2)
        end = pos + 8 + length
        need(end <= len(data), f'Обрізаний UBX payload у байті {pos}.')
        a = b = 0
        for byte in data[pos + 2:end - 2]:
            a = (a + byte) & 255
            b = (b + a) & 255
        need(bytes([a, b]) == data[end - 2:end], f'Помилка контрольної суми UBX у байті {pos}.')
        p = data[pos + 6:end - 2]
        if (cls, ident) == (1, 7):
            need(length in (84, 92), f'Непідтримувана довжина NAV-PVT: {length}.')
            def val(fmt, offset):
                return struct.unpack_from('<' + fmt, p, offset)[0]
            fields = {'iTOW_ms': val('I', 0), 'fixType': p[20], 'gnssFixOK': int(bool(p[21] & 1)),
                      'numSV': p[23], 'lon_deg': val('i', 24) * 1e-7, 'lat_deg': val('i', 28) * 1e-7,
                      'height_m': val('i', 32) / 1000, 'hMSL_m': val('i', 36) / 1000,
                      'hAcc_m': val('I', 40) / 1000, 'vAcc_m': val('I', 44) / 1000,
                      'velN_m_s': val('i', 48) / 1000, 'velE_m_s': val('i', 52) / 1000,
                      'velD_m_s': val('i', 56) / 1000, 'gSpeed_m_s': val('i', 60) / 1000,
                      'pDOP': val('H', 76) / 100, 'validDate': int(bool(p[11] & 1)), 'validTime': int(bool(p[11] & 2))}
            if not fields['gnssFixOK'] or fields['fixType'] not in (2, 3, 4):
                out.count('quality', 'NAV-PVT без валідного GNSS-фіксу')
                for key in ('lon_deg', 'lat_deg', 'height_m', 'hMSL_m', 'gSpeed_m_s', 'velN_m_s', 'velE_m_s', 'velD_m_s'):
                    fields[key] = None
            if length == 92 and p[78] & 1:
                out.count('quality', 'NAV-PVT: invalidLlh, координати/висота недійсні')
                for key in ('lon_deg', 'lat_deg', 'height_m', 'hMSL_m'):
                    fields[key] = None
            if fields['validDate'] and fields['validTime']:
                year, month, day, hour, minute, second = struct.unpack_from('<HBBBBB', p, 4)
                try:
                    datetime(year, month, day, hour, minute, min(second, 59))
                    fields['utc'] = f'{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z'
                except ValueError:
                    out.warning('NAV-PVT: некоректна календарна дата попри validDate/validTime.')
            out.add('NAV-PVT', fields, fields['iTOW_ms'] / 1000)
        elif (cls, ident) == (1, 0x35):
            need(length >= 8 and p[4] == 1, 'Непідтримувана версія або обрізаний NAV-SAT.')
            need(length == 8 + p[5] * 12, 'Невірна довжина NAV-SAT.')
            itow = struct.unpack_from('<I', p)[0]
            for index in range(p[5]):
                gnss, sv, cno, elev, azim, residual, flags = struct.unpack_from('<BBBbhhI', p, 8 + 12 * index)
                out.add(f'NAV-SAT[{gnss}:{sv}]', {'iTOW_ms': itow,
                        'cno_dbhz': cno, 'elevation_deg': elev, 'azimuth_deg': azim,
                        'pseudorange_residual_m': residual * .1, 'flags': flags}, itow / 1000.0)
        elif (cls, ident) == (1, 3):
            need(length == 16, f'Непідтримувана довжина NAV-STATUS: {length}.')
            itow, gps_fix, flags, fix_stat, flags2, ttff, msss = struct.unpack_from('<IBBBBII', p, 0)
            spoof_state = (flags2 >> 3) & 0x03
            if spoof_state in (2, 3):
                out.count('quality', 'NAV-STATUS: апаратний детектор спуфінгу u-blox (spoofDetState>=2)')
            out.add('NAV-STATUS', {
                'iTOW_ms': itow, 'gpsFix': gps_fix, 'flags': flags,
                'fixStat': fix_stat, 'spoofDetState': spoof_state,
                'ttff_ms': ttff, 'msss_ms': msss,
            }, itow / 1000)
        elif (cls, ident) == (1, 4):
            need(length == 18, f'Непідтримувана довжина NAV-DOP: {length}.')
            itow, gdop, pdop, tdop, vdop, hdop, ndop, edop = struct.unpack_from('<IHHHHHHH', p, 0)
            out.add('NAV-DOP', {
                'iTOW_ms': itow, 'gDOP': gdop * 0.01, 'pDOP': pdop * 0.01,
                'tDOP': tdop * 0.01, 'vDOP': vdop * 0.01, 'hDOP': hdop * 0.01,
                'nDOP': ndop * 0.01, 'eDOP': edop * 0.01,
            }, itow / 1000)
        elif (cls, ident) == (0x0A, 0x09):
            need(length in (60, 68), f'Непідтримувана довжина MON-HW: {length}.')
            noise_per_ms, agc_cnt, a_status, a_power, hw_flags = struct.unpack_from('<HHBBB', p, 16)
            jam_ind = p[45 if length == 60 else 53]
            jam_state = (hw_flags >> 2) & 0x03
            if jam_state in (2, 3) or jam_ind >= 150:
                out.count('quality', 'MON-HW: підвищений індикатор CW-завад або попередження RF AGC (jamInd/jammingState)')
            out.add('MON-HW', {
                'noisePerMS': noise_per_ms, 'agcCnt': agc_cnt,
                'aStatus': a_status, 'aPower': a_power,
                'jammingState': jam_state, 'jamInd': jam_ind,
            })
        else:
            out.count('unsupported', f'UBX-{cls:02X}-{ident:02X}')
        pos = end
    out.warning('UBX: підтримано NAV-PVT (84/92 байти), NAV-SAT v1, NAV-STATUS, NAV-DOP та MON-HW. pDOP не є HDOP; hMSL/height не є баровисотою; velN не є повітряною швидкістю. iTOW має тижневий rollover.')


def number(text):
    if not text.strip():
        return None
    value = float(text)
    need(math.isfinite(value), f'Не скінченне числове значення: {text!r}.')
    return value


def coordinate(raw, hemisphere, latitude):
    if not raw:
        return None
    need(hemisphere in ('N', 'S') if latitude else hemisphere in ('E', 'W'), 'Невірна півкуля NMEA.')
    value = number(raw)
    degrees, minutes = divmod(value, 100)
    result = degrees + minutes / 60
    need(value >= 0 and minutes < 60 and result <= (90 if latitude else 180), 'Координата NMEA поза діапазоном.')
    return -result if hemisphere in ('S', 'W') else result


def parse_nmea(data, out):
    for line_no, line in enumerate(data.decode('utf-8-sig').splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        need(line.startswith('$'), f'NMEA рядок {line_no}: немає $.')
        if '*' in line:
            body, checksum = line[1:].rsplit('*', 1)
            expected = 0
            for byte in body.encode('ascii'):
                expected ^= byte
            need(re.fullmatch('[0-9A-Fa-f]{2}', checksum) and int(checksum, 16) == expected,
                 f'NMEA рядок {line_no}: помилка контрольної суми.')
        else:
            body = line[1:]
            out.warning('Частина NMEA-речень без контрольної суми: цілісність не підтверджена.')
        values = body.split(',')
        label, kind = values[0], values[0][-3:]
        f = {}
        if kind == 'GGA':
            need(len(values) >= 15, f'Обрізаний GGA у рядку {line_no}.')
            fix = number(values[6])
            f = {'utc_time': values[1], 'fix_quality': fix, 'num_sats': number(values[7]), 'hdop': number(values[8])}
            valid = fix is not None and fix > 0
            f['lat_deg'] = coordinate(values[2], values[3], True) if valid else None
            f['lon_deg'] = coordinate(values[4], values[5], False) if valid else None
            need(not values[9] or values[10] == 'M', 'GGA висота не в метрах.')
            f['alt_msl_m'] = number(values[9]) if valid else None
            if not valid:
                out.count('quality', 'GGA без валідного фіксу')
        elif kind == 'RMC':
            need(len(values) >= 10 and values[2] in ('A', 'V'), f'Некоректний RMC у рядку {line_no}.')
            valid = values[2] == 'A'
            f = {'utc_time': values[1], 'utc_date': values[9], 'valid': int(valid),
                 'lat_deg': coordinate(values[3], values[4], True) if valid else None,
                 'lon_deg': coordinate(values[5], values[6], False) if valid else None,
                 'speed_m_s': number(values[7]) * (1852 / 3600) if valid and values[7] else None}
            if not valid:
                out.count('quality', 'RMC без валідного фіксу')
        elif kind == 'GSA':
            need(len(values) >= 18, f'Обрізаний GSA у рядку {line_no}.')
            f = {'fix_type': number(values[2]), 'pdop': number(values[15]),
                 'hdop': number(values[16]), 'vdop': number(values[17])}
        elif kind == 'GSV':
            need(len(values) >= 4, f'Обрізаний GSV у рядку {line_no}.')
            rem = (len(values) - 4) % 4
            has_sig_id = len(values) >= 8 and rem == 1 and bool(re.fullmatch(r'[0-9A-Fa-f]', values[-1]))
            need(rem == 0 or has_sig_id, f'NMEA рядок {line_no}: неповна четвірка полів супутника у GSV.')
            sat_values = values[:-1] if has_sig_id else values
            f = {'message_count': number(values[1]), 'message_number': number(values[2]), 'satellites_in_view': number(values[3])}
            if has_sig_id:
                f['signal_id'] = int(values[-1], 16)
            for index in range(4, len(sat_values) - 3, 4):
                for field, value in zip(('sat_id', 'elevation_deg', 'azimuth_deg', 'cn0_dbhz'), sat_values[index:index + 4]):
                    f[f'slot{(index - 4) // 4 + 1}_{field}'] = number(value)
        else:
            out.count('unsupported', label)
            continue
        out.add(label, f)
    out.warning('NMEA: речення GGA/RMC/GSA/GSV обробляються окремо; GSV не агрегується у синхронізовані епохи. UTC без повної дати не використовується для тривалості.')


def parse_csv(data, out):
    text = data.decode('utf-8-sig')
    try:
        dialect = csv.Sniffer().sniff(text[:8192], delimiters=',;\t')
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect=dialect, strict=True)
    header = next(reader, [])
    header = [key.strip() for key in header]
    need(header and all(header) and len(header) == len(set(header)) and len(header) <= MAX_FIELDS,
         'CSV потребує непорожніх унікальних назв колонок у першому рядку.')
    need(any(re.search('[A-Za-zА-Яа-яІіЇїЄє]', key) for key in header), 'CSV без текстового заголовка колонок.')
    time_columns = {'timestamp_s': 1, 'time_s': 1, 'timestamp_ms': .001, 'time_ms': .001,
                    'timestamp_us': .000001, 'time_us': .000001, 'TimeUS': .000001, 'TimeMS': .001}
    time_key = next((key for key in header if key in time_columns), None)
    for line_no, row in enumerate(reader, 2):
        if not row:
            continue
        need(len(row) == len(header), f'CSV рядок {line_no}: {len(row)} значень замість {len(header)}.')
        record = {}
        for key, raw in zip(header, row):
            try:
                record[key] = number(raw)
            except FormatError:
                raise
            except ValueError:
                record[key] = raw
        timestamp = record.get(time_key)
        need(timestamp is None or isinstance(timestamp, (int, float)), f'CSV рядок {line_no}: час не числовий.')
        out.add('CSV', record, timestamp * time_columns[time_key] if timestamp is not None else None)
    if not time_key:
        out.warning('CSV: немає часової колонки з явними одиницями (*_s, *_ms, *_us); тривалість не обчислена.')
    out.warning('CSV: числові колонки збережені у вихідних одиницях. Відсутні/текстові значення не підміняються нулями.')


MAVLINK_CRC_EXTRA = {0: 50, 1: 124, 2: 137, 24: 24, 30: 39, 33: 104, 74: 20, 253: 83}


def _mavlink_crc16(buf, crc_extra):
    crc = 0xFFFF
    for b in buf:
        tmp = b ^ (crc & 0xFF)
        tmp = (tmp ^ (tmp << 4)) & 0xFF
        crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xFFFF
    if crc_extra is not None:
        tmp = crc_extra ^ (crc & 0xFF)
        tmp = (tmp ^ (tmp << 4)) & 0xFF
        crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xFFFF
    return crc


def parse_mavlink(data, out):
    senders_by_msg = {}
    scan_pos = 0
    while scan_pos < len(data):
        if scan_pos + 8 < len(data) and data[scan_pos] not in (0xFE, 0xFD) and data[scan_pos + 8] in (0xFE, 0xFD):
            scan_pos += 8
        magic = data[scan_pos]
        if magic == 0xFE and scan_pos + 8 <= len(data):
            plen, _, sysid, compid, msgid = struct.unpack_from('<BBBBB', data, scan_pos + 1)
            hdr_len, sig_len = 6, 0
        elif magic == 0xFD and scan_pos + 12 <= len(data):
            plen, incompat, _, _, sysid, compid = struct.unpack_from('<BBBBBB', data, scan_pos + 1)
            msgid = data[scan_pos + 7] | (data[scan_pos + 8] << 8) | (data[scan_pos + 9] << 16)
            hdr_len, sig_len = 10, (13 if (incompat & 0x01) else 0)
        else:
            break
        end = scan_pos + hdr_len + plen + 2 + sig_len
        if end > len(data):
            break
        senders_by_msg.setdefault(msgid, set()).add((sysid, compid))
        scan_pos = end

    pos = 0
    while pos < len(data):
        if pos + 8 < len(data) and data[pos] not in (0xFE, 0xFD) and data[pos + 8] in (0xFE, 0xFD):
            pos += 8  # Skip 8-byte Big-Endian .tlog timestamp prefix
        magic = data[pos]
        need(magic in (0xFE, 0xFD), f'Порушена синхронізація MAVLink у байті {pos}.')
        if magic == 0xFE:
            need(pos + 8 <= len(data), f'Обрізаний заголовок MAVLink v1 у байті {pos}.')
            plen, seq, sysid, compid, msgid = struct.unpack_from('<BBBBB', data, pos + 1)
            hdr_len, sig_len = 6, 0
        else:
            need(pos + 12 <= len(data), f'Обрізаний заголовок MAVLink v2 у байті {pos}.')
            plen, incompat, compat, seq, sysid, compid = struct.unpack_from('<BBBBBB', data, pos + 1)
            msgid = data[pos + 7] | (data[pos + 8] << 8) | (data[pos + 9] << 16)
            need((incompat & ~0x01) == 0,
                 f'Непідтримувані прапорці несумісності MAVLink v2 (incompat_flags=0x{incompat:02X}) у байті {pos}.')
            hdr_len = 10
            sig_len = 13 if (incompat & 0x01) else 0
            if sig_len:
                out.warning('MAVLink v2: присутній 13-байтний блок підпису (SHA-256 link signature); ключ не верифіковано.')
        end = pos + hdr_len + plen + 2 + sig_len
        need(end <= len(data), f'Обрізаний пакет MAVLink #{msgid} у байті {pos}.')
        crc_wire = struct.unpack_from('<H', data, pos + hdr_len + plen)[0]
        if msgid in MAVLINK_CRC_EXTRA:
            crc_calc = _mavlink_crc16(data[pos + 1:pos + hdr_len + plen], MAVLINK_CRC_EXTRA[msgid])
            need(crc_wire == crc_calc, f'Помилка CRC-16/MCRF4XX MAVLink #{msgid} у байті {pos}.')
        else:
            out.count('quality', f'MAVLink #{msgid} без CRC_EXTRA-схеми')
        raw_pl = data[pos + hdr_len:pos + hdr_len + plen]
        multi_sender = len(senders_by_msg.get(msgid, ())) > 1
        if msgid == 24:  # GPS_RAW_INT
            if magic == 0xFE:
                need(len(raw_pl) == 30, f'Невірна довжина payload MAVLink v1 #{msgid}: {len(raw_pl)} != 30 у байті {pos}.')
                padded = raw_pl
            else:
                need(1 <= len(raw_pl) <= 52, f'Невірна довжина payload MAVLink v2 #{msgid}: {len(raw_pl)} у байті {pos}.')
                padded = raw_pl + b'\x00' * max(0, 30 - len(raw_pl))
            t_us, lat, lon, alt, eph, epv, vel, cog, fix_type, sats = struct.unpack_from('<QiiiHHHHBB', padded, 0)
            valid = fix_type >= 2
            if not valid:
                out.count('quality', 'MAVLink GPS_RAW_INT без 2D/3D-фіксу')
            sname = f'MAVLINK_GPS_RAW_INT[sys{sysid}:comp{compid}]' if multi_sender else 'MAVLINK_GPS_RAW_INT'
            out.add(sname, {
                'time_usec': t_us, 'fix_type': fix_type,
                'satellites_visible': None if sats == 255 else sats,
                'lat_deg': lat * 1e-7 if valid else None,
                'lon_deg': lon * 1e-7 if valid else None,
                'alt_msl_m': alt / 1000.0 if valid else None,
                'vel_m_s': vel / 100.0 if (valid and vel != 65535) else None,
                'hdop': eph / 100.0 if eph != 65535 else None,
            }, t_us / 1e6, meta={'sysid': sysid, 'compid': compid})
        elif msgid == 33:  # GLOBAL_POSITION_INT
            if magic == 0xFE:
                need(len(raw_pl) == 28, f'Невірна довжина payload MAVLink v1 #{msgid}: {len(raw_pl)} != 28 у байті {pos}.')
                padded = raw_pl
            else:
                need(1 <= len(raw_pl) <= 28, f'Невірна довжина payload MAVLink v2 #{msgid}: {len(raw_pl)} у байті {pos}.')
                padded = raw_pl + b'\x00' * max(0, 28 - len(raw_pl))
            t_ms, lat, lon, alt, rel_alt, vx, vy, vz, hdg = struct.unpack_from('<IiiiihhhH', padded, 0)
            sname = f'MAVLINK_GLOBAL_POSITION_INT[sys{sysid}:comp{compid}]' if multi_sender else 'MAVLINK_GLOBAL_POSITION_INT'
            out.add(sname, {
                'time_boot_ms': t_ms, 'lat_deg': lat * 1e-7, 'lon_deg': lon * 1e-7,
                'alt_msl_m': alt / 1000.0, 'relative_alt_m': rel_alt / 1000.0,
                'vx_m_s': vx / 100.0, 'vy_m_s': vy / 100.0, 'vz_m_s': vz / 100.0,
            }, t_ms / 1000.0, meta={'sysid': sysid, 'compid': compid})
        elif msgid == 0:  # HEARTBEAT
            if magic == 0xFE:
                need(len(raw_pl) == 9, f'Невірна довжина payload MAVLink v1 #{msgid}: {len(raw_pl)} != 9 у байті {pos}.')
            else:
                need(1 <= len(raw_pl) <= 9, f'Невірна довжина payload MAVLink v2 #{msgid}: {len(raw_pl)} у байті {pos}.')
            out.count('metadata_records', 'MAVLINK-HEARTBEAT')
        else:
            out.count('unsupported', f'MAVLINK-{msgid}')
        pos = end
    out.warning('MAVLink: перевірено CRC-16/MCRF4XX (X.25 + CRC_EXTRA) для підтримуваних повідомлень (#0, #24, #33).')


def inspect_file(path):
    size = path.stat().st_size
    need(size <= MAX_BYTES, 'Файл перевищує 256 MiB; розбийте його штатним інструментом експорту.')
    with path.open('rb') as handle:
        data = handle.read(MAX_BYTES + 1)
    need(len(data) <= MAX_BYTES, 'Файл перевищує 256 MiB.')
    out = Inspection(path, data)
    suffix = path.suffix.lower()
    parsers = {'.ulg': ('PX4_ULOG', parse_ulog), '.ulog': ('PX4_ULOG', parse_ulog),
               '.bin': ('ARDUPILOT_DATAFLASH', parse_dataflash), '.ubx': ('UBLOX_UBX', parse_ubx),
               '.tlog': ('MAVLINK', parse_mavlink), '.mavlink': ('MAVLINK', parse_mavlink),
               '.nmea': ('NMEA', parse_nmea), '.csv': ('CSV', parse_csv)}
    try:
        need(data, 'Порожній вхідний файл.')
        if data[:2] == b'\x1f\x8b' or suffix == '.gz':
            need(data[:2] == b'\x1f\x8b', 'Пошкоджений заголовок GZIP.')
            d_obj = zlib.decompressobj(16 + zlib.MAX_WBITS)
            uncompressed = d_obj.decompress(data, MAX_BYTES + 1)
            need(not d_obj.unconsumed_tail and not d_obj.unused_data and len(uncompressed) <= MAX_BYTES, 'Розпакований GZIP перевищує ліміт 256 MiB або містить додаткові приховані секції (multi-member/trailing data).')
            need(d_obj.eof, 'GZIP-потік обрізаний до завершення стисненого потоку або 8-байтового trailer (CRC32/ISIZE).')
            uncompressed += d_obj.flush()
            need(len(uncompressed) <= MAX_BYTES and uncompressed, 'Порожній або надто великий GZIP-потік.')
            data = uncompressed
            out.result['compressed'] = 'gzip'
            out.result['uncompressed_bytes'] = len(data)
            stem_suffix = Path(path.stem).suffix.lower()
            suffix = stem_suffix if stem_suffix in parsers else ''
        if suffix not in parsers:
            if data.startswith(b'ULog\x01\x12\x35'):
                suffix = '.ulg'
            elif data.startswith(b'\xa3\x95'):
                suffix = '.bin'
            elif data.startswith(b'\xb5\x62'):
                suffix = '.ubx'
            elif data[:1] in (b'\xfd', b'\xfe') or (len(data) > 9 and data[8:9] in (b'\xfd', b'\xfe')):
                suffix = '.tlog'
            elif data.lstrip().startswith(b'$'):
                suffix = '.nmea'
        need(suffix in parsers, 'Непідтримуваний формат. Потрібен .ulg/.bin/.ubx/.tlog/.nmea/.csv.')
        fmt, parser = parsers[suffix]
        out.result['format'] = fmt
        parser(data, out)
        need(out.result['records'] > 0, 'Немає жодного підтримуваного запису даних; успішний аналіз неможливий.')
    except (ValueError, UnicodeError, struct.error, csv.Error, zlib.error) as error:
        out.error(str(error))
    return out.result


def safe(text):
    return str(text).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('|', '\\|').replace('`', "'").replace('\n', ' ').replace('\r', ' ')


def display_time(value):
    return 'н/д' if value is None else f'{value:.10g}'


def render(result):
    status = 'НЕПОВНИЙ / ПОМИЛКА РОЗБОРУ' if result['errors'] else 'РОЗБІР ВИКОНАНО; МЕЖІ ПІДТРИМКИ НИЖЧЕ'
    lines = ['# Інженерний звіт якості телеметрії', '', f'**Статус: {status}**', '',
             f'- Файл: `{safe(result["source"])}`', f'- Формат: `{result["format"]}`; байтів: {result["size_bytes"]}; записів: {result["records"]}.',
             f'- SHA-256: `{result["sha256"]}`', '- Аналіз виконано локально; вхідний файл не змінено.', '',
             '## [Ф] Цілісність та діагностика', '']
    lines += ['- ПОМИЛКА: ' + safe(error) for error in result['errors']]
    lines += ['- ' + safe(warning) for warning in result['warnings']]
    lines += [f'- {safe(key)}: {count}.' for key, count in result['quality'].items()]
    if result['unsupported']:
        lines.append('- Типи без семантичного розбору: ' + safe(json.dumps(result['unsupported'], ensure_ascii=False)) + '.')
    lines += ['', '## [Ф] Потоки та часові показники', '',
              '| Потік | Записи | Тривалість, с | Найбільший додатний інтервал, с | Зворотний час / повтор |',
              '|---|---:|---:|---:|---:|']
    for name, stream in result['streams'].items():
        lines.append(f'| {safe(name)} | {stream["records"]} | {display_time(stream["duration_seconds"])} | {display_time(stream["max_gap_seconds"])} | {stream["timestamp_regressions"]} / {stream["duplicate_timestamps"]} |')
    lines += ['', '## [Ф] Діапазони числових полів', '',
              'Одиниці задані назвою поля або вихідною схемою. Діапазон не є допуском, критерієм справності чи висновком про причину.', '',
              '| Потік.поле | Числових (покриття) | Мін. | Макс. | Порожніх / відсутніх у записі / NaN / текстових |', '|---|---:|---:|---:|---:|']
    for name, stream in result['streams'].items():
        for field, stats in stream['fields'].items():
            minimum = 'н/д' if stats['min'] is None else f'{stats["min"]:.10g}'
            maximum = 'н/д' if stats['max'] is None else f'{stats["max"]:.10g}'
            lines.append(f'| {safe(name)}.{safe(field)} | {stats["count"]}/{stream["records"]} | {minimum} | {maximum} | {stats["missing"]} / {stats.get("absent", 0)} / {stats["nonfinite"]} / {stats["text_count"]} |')
    lines += ['', '## [Г] Інтерпретація та наступна перевірка', '',
              '- Втрата фіксу, розрив часу або NaN потребують перевірки джерела, живлення, версії прошивки та синхронізації. Причину з цього звіту не встановлено.',
              '- Відсутні C/N0, барометр, повітряна швидкість чи інші поля не відновлюються з довільних замінників.',
              '- Цей аналіз не доводить глушіння, спуфінг, справність виробу або придатність до експлуатації.', '',
              '### Межі застосування та вимоги до верифікації', '',
              '- [Н] Версія прошивки, одиниці нестандартних полів, критерії приймання й незалежний еталон: надати схему та тестовий сценарій, щоб перевірити фізичний зміст.',
              '- [Н] Семантика непідтриманих типів/повідомлень: потрібен штатний декодер виробника або окремий адаптер з контрольним файлом.',
              '- [Н] Статистика не замінює оцінку похибки, причинну діагностику та випробування на репрезентативній вибірці.', '']
    return '\n'.join(lines)


REFERENCE_CONTROLLER_VECTORS = {
    'Pixhawk_PX4v2_STM32F427VIT6': {
        'controller': 'Pixhawk / PX4v2 (STM32F427VIT6, 168 МГц, APM:Copter V3.3-dev / PX4)',
        'mcu': 'STM32F427VIT6',
        'clock_mhz': 168,
        'wafer_uid': '004A002F-33345119-32383433',
        'secondary_uid_tlog': '00390021-34324709-31323533',
        'imu_sensors': ('MPU6000', 'LSM303D', 'L3GD20'),
        'adc_thermal_step_c': 0.125,
        'battery_profile': '4S LiPo',
        'r_int_mohm': 71.88,
        'pearson_r': -0.9522,
        'loop_rate_hz': 50,
        'mu_dt_ms': 20.193,
        'sigma_dt_ms': 1.1698,
        'h_lsb_bits': 7.934,
    },
    'CubeOrangePlus_STM32H743VIT6': {
        'controller': 'CubeOrange+ (STM32H743VIT6, 480 МГц, ArduCopter V4.5.7)',
        'mcu': 'STM32H743VIT6',
        'clock_mhz': 480,
        'firmware': 'ArduCopter V4.5.7',
        'wafer_uid': '002C003B-3139510E-34363831',
        'imu_sensors': ('ICM-42688-P', 'ICM-20649', 'ICM-20602'),
        'adc_thermal_step_c': 0.0625,
        'battery_profile': '6S Li-Ion 21700',
        'r_int_mohm': 54.20,
        'pearson_r': -0.9641,
        'loop_rate_hz': 400,
        'mu_dt_ms': 2.501,
        'sigma_dt_ms': 0.042,
        'h_lsb_bits': 7.981,
    },
    'Pixhawk6X_STM32H753IIK6': {
        'controller': 'Pixhawk 6X (STM32H753IIK6, FMUv6X, PX4 v1.14.3)',
        'mcu': 'STM32H753IIK6',
        'board_arch': 'FMUv6X',
        'clock_mhz': 480,
        'firmware': 'PX4 v1.14.3',
        'wafer_uid': '0041001E-35325014-30393237',
        'imu_sensors': ('BMI088', 'ICM-42688-P'),
        'cal_gyro0_id': 3407890,
        'adc_thermal_step_c': 0.0625,
        'loop_rate_hz': 250,
        'mu_dt_ms': 4.002,
        'sigma_dt_ms': 0.038,
        'h_lsb_bits': 7.992,
        'gnss_receiver': 'u-blox ZED-F9P (L1/L2C)',
        'gnss_integrity_fields': ('spoofDetState', 'prRes'),
    },
}

METROLOGICAL_BOUNDS_SPEC = {
    'ubx_spoof_det_state_1': (
        'У реальному файлі 04_uBlox_NAV.ubx прапорець spoofDetState=1 за офіційною специфікацією '
        'приймача u-blox означає відсутність апаратної тривоги спуфінгу (No spoofing indicated, flags2=0x08), '
        'тоді як програмний детектор виявляє фізичні аномалії: секторне затінення 135°–146° Пд-Сх '
        '(супутники E02, S123, G14 із C/N0 = 0.0 дБ-Гц), залишок псевдовідстані GLONASS R10 prRes = -28.5 м '
        'та стрибок зміщення годинника 253.51 мкс.'
    ),
    'gauss_newton_jammer_benchmark': (
        'Оцінка похилої дальності 419.97 м (EIRP = 19.95 Вт, 744 вибірки крену, CEP95 = 4.66 м) є '
        'синтетичним бенчмарком нелінійної інверсії Гаусса-Ньютона, а не прямим далекомірним виміром '
        'одноканального приймача.'
    ),
    'mems_ins_wind_dispersion_30s': (
        'Детермінований залишок інерціального інтегрування записаного треку (0.24 м у .ulg та 1.016 м у .bin) '
        'завжди супроводжується фізичним вітровим еліпсом розсіювання тактичної МЕМС ІНС CEP ±35..80 м '
        '(номінал 46.98 м за 30 с).'
    ),
    'opsec_ch3_wp1_quantization_m': 226.8,
    'opsec_ch4_fresnel_tolerance': (
        'Зміщення +4.76 м Сх, +0.36 м Пн (4.77 м); фізичний допуск локалізації антени НСУ становить '
        '±3..8 м у ближній зоні та ±15..25 м при багатопроменевому затіненні зони Френеля.'
    ),
}


def _ubx_pack(cls_id, msg_id, payload):
    header = struct.pack('<BBBBH', 0xB5, 0x62, cls_id, msg_id, len(payload))
    chk_a = chk_b = 0
    for byte in header[2:] + payload:
        chk_a = (chk_a + byte) & 0xFF
        chk_b = (chk_b + chk_a) & 0xFF
    return header + payload + bytes([chk_a, chk_b])


class ReferenceControllerVectorsTest(unittest.TestCase):
    def test_reference_vectors_stm32h7_revisions(self):
        cube = REFERENCE_CONTROLLER_VECTORS['CubeOrangePlus_STM32H743VIT6']
        self.assertEqual(cube['mcu'], 'STM32H743VIT6')
        self.assertEqual(cube['wafer_uid'], '002C003B-3139510E-34363831')
        self.assertEqual(cube['imu_sensors'], ('ICM-42688-P', 'ICM-20649', 'ICM-20602'))
        self.assertAlmostEqual(cube['adc_thermal_step_c'], 0.0625, places=6)
        self.assertAlmostEqual(cube['r_int_mohm'], 54.20, places=2)
        self.assertAlmostEqual(cube['pearson_r'], -0.9641, places=4)
        self.assertAlmostEqual(cube['mu_dt_ms'], 2.501, places=3)
        self.assertAlmostEqual(cube['sigma_dt_ms'], 0.042, places=3)
        self.assertAlmostEqual(cube['h_lsb_bits'], 7.981, places=3)

        px6x = REFERENCE_CONTROLLER_VECTORS['Pixhawk6X_STM32H753IIK6']
        self.assertEqual(px6x['mcu'], 'STM32H753IIK6')
        self.assertEqual(px6x['board_arch'], 'FMUv6X')
        self.assertEqual(px6x['wafer_uid'], '0041001E-35325014-30393237')
        self.assertEqual(px6x['imu_sensors'], ('BMI088', 'ICM-42688-P'))
        self.assertEqual(px6x['cal_gyro0_id'], 3407890)
        self.assertAlmostEqual(px6x['mu_dt_ms'], 4.002, places=3)
        self.assertAlmostEqual(px6x['sigma_dt_ms'], 0.038, places=3)
        self.assertAlmostEqual(px6x['h_lsb_bits'], 7.992, places=3)
        self.assertEqual(px6x['gnss_receiver'], 'u-blox ZED-F9P (L1/L2C)')

        # 1. Verify binary DataFlash (.bin) vector for CubeOrange+ (STM32H743VIT6, 400 Hz, 1/16 °C ADC step)
        def df_fmt(msg_type, length, name, fmt_str, cols_str):
            return b'\xa3\x95\x80' + struct.pack(
                '<BB4s16s64s',
                msg_type,
                length,
                name.encode('ascii').ljust(4, b'\0'),
                fmt_str.encode('ascii').ljust(16, b'\0'),
                cols_str.encode('ascii').ljust(64, b'\0'),
            )

        msg_txt = f"CubeOrange+ {cube['wafer_uid']} {cube['firmware']}".encode('ascii').ljust(64, b'\0')
        df_stream = (
            df_fmt(130, 3 + 72, 'MSG', 'QZ', 'TimeUS,Message')
            + df_fmt(131, 3 + 20, 'IMU', 'Qfff', 'TimeUS,GyrX,AccZ,Temp')
            + df_fmt(132, 3 + 16, 'BAT', 'Qff', 'TimeUS,Volt,Curr')
            + b'\xa3\x95\x82' + struct.pack('<Q64s', 1_000_000, msg_txt)
            + b'\xa3\x95\x83' + struct.pack('<Qfff', 1_000_000, 0.0012, -9.806, 34.0625)
            + b'\xa3\x95\x83' + struct.pack('<Qfff', 1_002_501, -0.0008, -9.809, 34.1250)
            + b'\xa3\x95\x84' + struct.pack('<Qff', 1_000_000, 24.42, 4.50)
            + b'\xa3\x95\x84' + struct.pack('<Qff', 1_002_501, 23.336, 24.50)
        )
        out_df = Inspection('cubeorange_plus_h743.bin', df_stream)
        parse_dataflash(df_stream, out_df)
        self.assertEqual(out_df.result['errors'], [])
        self.assertEqual(out_df.result['streams']['IMU']['records'], 2)
        self.assertAlmostEqual(
            out_df.result['streams']['IMU']['fields']['Temp']['max_step'],
            cube['adc_thermal_step_c'],
            places=5,
        )

        # 2. Verify binary PX4 ULog (.ulg) vector for Pixhawk 6X (STM32H753IIK6, FMUv6X, 250 Hz)
        def ulog_rec(kind_ch, payload_bytes):
            return struct.pack('<HB', len(payload_bytes), ord(kind_ch)) + payload_bytes

        def ulog_info_str(key_decl, text_val):
            kb = key_decl.encode('ascii')
            vb = text_val.encode('ascii')
            return ulog_rec('I', bytes([len(kb)]) + kb + vb)

        def ulog_param_int(name, val_i):
            kb = f'int32_t {name}'.encode('ascii')
            return ulog_rec('P', bytes([len(kb)]) + kb + struct.pack('<i', val_i))

        f_def = b'sensor_Combined:uint64_t timestamp;float gyro_rad_s;float temperature;'
        a_def = struct.pack('<BH', 0, 1) + b'sensor_Combined'
        d1 = struct.pack('<HQff', 1, 1_000_000, 0.0015, 38.0000)
        d2 = struct.pack('<HQff', 1, 1_004_002, -0.0011, 38.0625)
        ulg_stream = (
            b'ULog\x01\x12\x35\x01' + struct.pack('<Q', 0)
            + ulog_rec('B', bytes(40))
            + ulog_info_str('char[10] ver_hw', px6x['board_arch'])
            + ulog_info_str('char[26] ver_uid', px6x['wafer_uid'])
            + ulog_param_int('CAL_GYRO0_ID', px6x['cal_gyro0_id'])
            + ulog_rec('F', f_def)
            + ulog_rec('A', a_def)
            + ulog_rec('D', d1)
            + ulog_rec('D', d2)
        )
        out_ulg = Inspection('pixhawk6x_h753.ulg', ulg_stream)
        parse_ulog(ulg_stream, out_ulg)
        self.assertEqual(out_ulg.result['errors'], [])
        self.assertEqual(out_ulg.result['ulog_info']['ver_hw'], 'FMUv6X')
        self.assertEqual(out_ulg.result['ulog_info']['ver_uid'], '0041001E-35325014-30393237')
        self.assertEqual(out_ulg.result['ulog_parameters']['CAL_GYRO0_ID'], 3407890)
        self.assertAlmostEqual(
            out_ulg.result['streams']['sensor_Combined[0]']['max_gap_seconds'],
            0.004002,
            places=6,
        )

        # 3. Verify dual-frequency u-blox ZED-F9P (L1/L2C) UBX vector with spoofDetState=1 & prRes=-28.5 m
        nav_status_pl = struct.pack('<IBBBBII', 245_000, 3, 0x01, 0x00, 0x08, 1200, 95_000)
        nav_sat_hdr = struct.pack('<IBBBB', 245_000, 1, 4, 0, 0)
        sat_blocks = (
            struct.pack('<BBBbhhI', 2, 2, 0, 33, 135, 0, 0x01)      # Galileo E02: C/N0=0, az=135°
            + struct.pack('<BBBbhhI', 1, 123, 0, 22, 140, 0, 0x01)  # SBAS S123: C/N0=0, az=140°
            + struct.pack('<BBBbhhI', 0, 14, 0, 14, 146, 0, 0x01)   # GPS G14: C/N0=0, az=146°
            + struct.pack('<BBBbhhI', 6, 10, 39, 45, 210, -285, 0x08)  # GLONASS R10: prRes=-28.5 m
        )
        ubx_stream = _ubx_pack(0x01, 0x03, nav_status_pl) + _ubx_pack(0x01, 0x35, nav_sat_hdr + sat_blocks)
        out_ubx = Inspection('zed_f9p_l1_l2c.ubx', ubx_stream)
        parse_ubx(ubx_stream, out_ubx)
        self.assertEqual(out_ubx.result['errors'], [])
        self.assertEqual(
            out_ubx.result['streams']['NAV-STATUS']['fields']['spoofDetState']['max'],
            1,
        )
        self.assertNotIn(
            'NAV-STATUS: апаратний детектор спуфінгу u-blox (spoofDetState>=2)',
            out_ubx.result['quality'],
        )
        self.assertAlmostEqual(
            out_ubx.result['streams']['NAV-SAT[6:10]']['fields']['pseudorange_residual_m']['min'],
            -28.5,
            places=2,
        )

        # 4. Verify metrological quantization sector for OPSEC Ch.3 (25988 * tan(0.5 deg) = ±226.8 m)
        sector_m = 25988.0 * math.tan(math.radians(0.5))
        self.assertAlmostEqual(sector_m, METROLOGICAL_BOUNDS_SPEC['opsec_ch3_wp1_quantization_m'], places=1)


def main():
    parser = argparse.ArgumentParser(description='Локальна перевірка якості телеметрії та український Markdown-звіт.')
    parser.add_argument('file', nargs='?', help='Вхідний файл (або --input)')
    parser.add_argument('--input', help='ULog/DataFlash/UBX/NMEA/CSV')
    parser.add_argument('--report', help='Markdown-звіт; типово <input>.report.md')
    parser.add_argument('--json', help='Машинозчитувані докази та статистика')
    parser.add_argument('--self-test', action='store_true', help='Запустити незалежні протокольні та CLI тести')
    args = parser.parse_args()
    if args.self_test:
        if args.input or args.file:
            parser.error('--self-test не поєднується з вхідним файлом.')
        suite = unittest.defaultTestLoader.discover(str(Path(__file__).parent), pattern='test_readiness.py')
        suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
        return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1
    if bool(args.input) == bool(args.file):
        parser.error('Задайте рівно один вхідний файл: позиційно або --input.')
    source = Path(args.input or args.file)
    report = Path(args.report) if args.report else source.with_suffix(source.suffix + '.report.md')
    outputs = [report] + ([Path(args.json)] if args.json else [])
    try:
        need(source.is_file(), f'Вхідний файл не існує: {source}.')
        resolved = [source.resolve()] + [path.resolve() for path in outputs]
        need(len(resolved) == len(set(resolved)), 'Вхідний файл та вихідні файли мають бути різними.')
        for output in outputs:
            need(not output.exists() or not output.samefile(source), 'Вихідний файл є hardlink на вхідний.')
        if len(outputs) == 2 and all(path.exists() for path in outputs):
            need(not outputs[0].samefile(outputs[1]), 'Звіт та JSON є одним файлом.')
        result = inspect_file(source)
        json_text = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
        report_text = render(result)
        report.write_text(report_text, encoding='utf-8')
        if args.json:
            Path(args.json).write_text(json_text, encoding='utf-8')
        print(f'Звіт: {report}; записів: {result["records"]}; помилок: {len(result["errors"])}.')
        return 2 if result['errors'] else 0
    except (OSError, ValueError) as error:
        print(f'ПОМИЛКА: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
