# 📡 ІСТОРИЧНИЙ СИНТЕТИЧНИЙ ДЕМО-ПРИКЛАД ЗВІТУ ТЕЛЕМЕТРІЇ (Legacy v2.0 Synthetic Scenario)

> [!IMPORTANT]
> **Статус документа — Історичний синтетичний демонстратор**:
> 1. Цей файл збережено виключно як ілюстрацію попереднього синтетичного сценарію v2.0 (`sample_uav_ew_flight.nmea`, `sample_ardupilot.bin`, `sample_px4.ulg`, `sample_ublox.ubx`).
> 2. **Актуальний рушій `engines/telemetry_ew/telemetry_analyzer.py` НЕ робить причинних висновків про глушіння (`EW_JAMMING`) чи спуфінг (`EW_SPOOFING`)** і не використовує наведену нижче евристичну таблицю `3 Jam / 6 Spoof / 11 OK`. Поточний аналізатор обчислює лише перевірену описову статистику прочитаних потоків і полів (`min`, `max`, `mean`, `missing`, `absent`, `max_gap_seconds`, `max_step`, `max_rate_per_s`, `schema_units`, `quality`) відповідно до [engines/telemetry_ew/README.md](README.md).
> 3. Наведені нижче таблиці не є доказом фізичної детекції РЕБ на реальному виробі.

- **Дата історичного демо-запуску**: `2026-10-18` | **Локальний CLI (Pure Python 3 Stdlib `struct`, 0 зовнішніх залежностей)**
- **Апаратний стенд**: `Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz (16 GB RAM, macOS, Python 3.9.6)`
- **Синтетичні демонстраційні файли**: `NMEA 0183 (.nmea)`, `ArduPilot DataFlash (.bin)`, `PX4 ULog (.ulg)`, `u-blox UBX (.ubx)`.
- **Підсумок синтетичного сценарію v2.0 (20 штучних епох)**: `11` номінальних епох | `3` епохи зі штучним зниженням C/N0 | `6` епох зі штучним стрибком координат/часу (історична ілюстрація, не вивід поточного `telemetry_analyzer.py`).

---

## 1. Зведена таблиця мультиформатного бенчмарку (`--self-test` на 4 форматах: `.nmea`, `.bin`, `.ulg`, `.ubx`)

| Файл логу | Бінарний протокол / Сигнатура | Розмір (байт) | Зсунуто координат (`sanitize_telemetry.py`) | Час скрабінгу (мс) | Час аналізу (`telemetry_analyzer.py`, мс) | Виявлено Jamming / Spoofing / Nominal |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`sample_uav_ew_flight.nmea`** | `NMEA 0183 ($GNGGA/$GNGSA/$GPGSV + *XX)` | `8842` | `40` | **`1.45 мс`** | **`5.10 мс`** | `3 Jam / 6 Spoof / 11 OK` ✅ |
| **`sample_ardupilot.bin`** | `ArduPilot DataFlash .bin (0xA3 0x95: FMT/GPS/ATT)` | `1567` | `20` | **`0.06 мс`** | **`0.31 мс`** | `3 Jam / 6 Spoof / 11 OK` ✅ |
| **`sample_px4.ulg`** | `PX4 ULog .ulg (ULog\x01\x12\x35: vehicle_gps_position)` | `1320` | `20` | **`0.05 мс`** | **`0.28 мс`** | `3 Jam / 6 Spoof / 11 OK` ✅ |
| **`sample_ublox.ubx`** | `u-blox UBX .ubx (0xB5 0x62: NAV-PVT + RXM-MEASX + Fletcher-8)` | `7096` | `20` | **`1.37 мс`** | **`5.73 мс`** | `3 Jam / 6 Spoof / 11 OK` ✅ |

---

## 2. Калібрувальна матриця висотно-адаптивних порогів `FLAT_MAX_STD_*` (НРК 0–5 м vs БпЛА 100–1500 м)

| Профіль платформи | Висотний коридор | Поріг `FLAT_MAX_STD_ALL` | Поріг `FLAT_MAX_STD_GPS` | Поріг `elev_cn0_corr` | Допуск `|v_gnss - v_ref|` | Допуск `|alt_gnss - alt_baro|` | Фізичне обґрунтування |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **НРК / Наземна (`UGV_0_5M`)** | `0..50 м` | **`≤ 4.0 dB-Hz`** | **`≤ 2.0 dB-Hz`** | Не вимагається | `≤ 3.5 м/с` (колісна одометрія) | `≤ 15.0 м` | Сильна багатопроменевість від землі/будівель розширює природний спектр до `4.4..8.5 dB-Hz` (еталон наземної телеметрії). |
| **БпЛА / Висота (`UAV_100_1500M`)** | `50..5000 м` | **`≤ 2.8 dB-Hz`** | **`≤ 1.6 dB-Hz`** | **`< 0.35`** (втрата залежності від кута піднесення) | `≤ 8.0 м/с` (трубка Піто / `ARSP`) | `≤ 35.0 м` (барометр `BARO`) | У чистому небі на висоті 450 м природний `std` становить `3.0..4.2 dB-Hz`, але зберігається сильна кореляція `C/N0` з кутом піднесення (`r > 0.90`). Одноантенний спуфер стискає `std <= 2.2 dB-Hz` і руйнує кореляцію (`r <= 0.25`). |

---

## 3. Посекундна таблиця детекції РЕБ-атак (20 епох польоту БпЛА)

| Епоха | UTC штамп | Профіль | Sats / Сузір'я | `mean C/N0` | `std(all)` | `elev_corr` | `v_gnss / v_air` (м/с) | `alt_gnss / baro` (м) | Вердикт аналізатора та першопричина (Root Cause) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **01** | `181026 100001.00` | `UAV_100_1500M` | `12 / 3` | `36.7` | **`6.50`** | `+0.99` | `20.8 / 21.0` | `172 / 170` | **✅ NOMINAL**: Multi-GNSS 3D OK (3 constellations, elev_corr=0.99) |
| **02** | `181026 100002.00` | `UAV_100_1500M` | `12 / 3` | `36.7` | **`6.50`** | `+0.99` | `20.8 / 21.0` | `242 / 240` | **✅ NOMINAL**: Multi-GNSS 3D OK (3 constellations, elev_corr=0.99) |
| **03** | `181026 100003.00` | `UAV_100_1500M` | `12 / 3` | `36.7` | **`6.50`** | `+0.99` | `20.8 / 21.0` | `312 / 310` | **✅ NOMINAL**: Multi-GNSS 3D OK (3 constellations, elev_corr=0.99) |
| **04** | `181026 100004.00` | `UAV_100_1500M` | `12 / 3` | `36.7` | **`6.50`** | `+0.99` | `20.8 / 21.0` | `382 / 380` | **✅ NOMINAL**: Multi-GNSS 3D OK (3 constellations, elev_corr=0.99) |
| **05** | `181026 100005.00` | `UAV_100_1500M` | `12 / 3` | `38.8` | **`3.06`** | `+0.98` | `21.9 / 22.0` | `451 / 450` | **✅ NOMINAL**: Multi-GNSS 3D OK (3 constellations, elev_corr=0.98) |
| **06** | `181026 100006.00` | `UAV_100_1500M` | `12 / 3` | `38.8` | **`3.06`** | `+0.98` | `21.9 / 22.0` | `451 / 450` | **✅ NOMINAL**: Multi-GNSS 3D OK (3 constellations, elev_corr=0.98) |
| **07** | `181026 100007.00` | `UAV_100_1500M` | `12 / 3` | `38.8` | **`3.06`** | `+0.98` | `21.9 / 22.0` | `451 / 450` | **✅ NOMINAL**: Multi-GNSS 3D OK (3 constellations, elev_corr=0.98) |
| **08** | `181026 100008.00` | `UAV_100_1500M` | `12 / 3` | `38.8` | **`3.06`** | `+0.98` | `21.9 / 22.0` | `451 / 450` | **✅ NOMINAL**: Multi-GNSS 3D OK (3 constellations, elev_corr=0.98) |
| **09** | `181026 100009.00` | `UAV_100_1500M` | `12 / 3` | `38.8` | **`3.06`** | `+0.98` | `21.9 / 22.0` | `451 / 450` | **✅ NOMINAL**: Multi-GNSS 3D OK (3 constellations, elev_corr=0.98) |
| **10** | `181026 100010.00` | `UAV_100_1500M` | `3 / 1` | `15.8` | **`1.48`** | `+0.98` | `19.5 / 22.0` | `448 / 450` | **⚠️ EW_JAMMING**: Broadband Jamming: C/N0 mean=15.8 dB-Hz (<= 23.0), sats=3, HDOP=9.8 |
| **11** | `181026 100011.00` | `UAV_100_1500M` | `3 / 1` | `15.8` | **`1.48`** | `+0.98` | `19.5 / 22.0` | `448 / 450` | **⚠️ EW_JAMMING**: Broadband Jamming: C/N0 mean=15.8 dB-Hz (<= 23.0), sats=3, HDOP=9.8 |
| **12** | `181026 100012.00` | `UAV_100_1500M` | `3 / 1` | `15.8` | **`1.48`** | `+0.98` | `19.5 / 22.0` | `448 / 450` | **⚠️ EW_JAMMING**: Broadband Jamming: C/N0 mean=15.8 dB-Hz (<= 23.0), sats=3, HDOP=9.8 |
| **13** | `181026 100013.00` | `UAV_100_1500M` | `8 / 1` | `42.0` | **`0.71`** | `+0.21` | `68.5 / 22.0` | `1150 / 450` | **🚨 EW_SPOOFING**: Flat C/N0 Spectrum (UAV_100_1500M): std_all=0.71 dB-Hz (<= 2.8), mean=42.0 dB-Hz, elev_corr=0.21; Single-Constellation Collapse ($GNGSA): only GPS L1 active (GLONASS/Galileo dropped); Velocity Incoherence: GNSS=68.5 m/s vs Airspeed/Ref=22.0 m/s; Altitude Incoherence: GNSS=1150.0 m vs Baro=450.0 m (Δ=700.0 m); Coordinate Teleport: Δpos=4680.3 m in 1s |
| **14** | `181026 100014.00` | `UAV_100_1500M` | `8 / 1` | `42.0` | **`0.71`** | `+0.21` | `68.5 / 22.0` | `1150 / 450` | **🚨 EW_SPOOFING**: Flat C/N0 Spectrum (UAV_100_1500M): std_all=0.71 dB-Hz (<= 2.8), mean=42.0 dB-Hz, elev_corr=0.21; Single-Constellation Collapse ($GNGSA): only GPS L1 active (GLONASS/Galileo dropped); Velocity Incoherence: GNSS=68.5 m/s vs Airspeed/Ref=22.0 m/s; Altitude Incoherence: GNSS=1150.0 m vs Baro=450.0 m (Δ=700.0 m) |
| **15** | `190328 100015.00` | `UAV_100_1500M` | `8 / 1` | `42.0` | **`0.71`** | `+0.21` | `68.5 / 22.0` | `1150 / 450` | **🚨 EW_SPOOFING**: Flat C/N0 Spectrum (UAV_100_1500M): std_all=0.71 dB-Hz (<= 2.8), mean=42.0 dB-Hz, elev_corr=0.21; Single-Constellation Collapse ($GNGSA): only GPS L1 active (GLONASS/Galileo dropped); Velocity Incoherence: GNSS=68.5 m/s vs Airspeed/Ref=22.0 m/s; Altitude Incoherence: GNSS=1150.0 m vs Baro=450.0 m (Δ=700.0 m); Time-Jump Attack: UTC Date jumped 181026 -> 190328 |
| **16** | `190328 100016.00` | `UAV_100_1500M` | `8 / 1` | `42.0` | **`0.71`** | `+0.21` | `68.5 / 22.0` | `1150 / 450` | **🚨 EW_SPOOFING**: Flat C/N0 Spectrum (UAV_100_1500M): std_all=0.71 dB-Hz (<= 2.8), mean=42.0 dB-Hz, elev_corr=0.21; Single-Constellation Collapse ($GNGSA): only GPS L1 active (GLONASS/Galileo dropped); Velocity Incoherence: GNSS=68.5 m/s vs Airspeed/Ref=22.0 m/s; Altitude Incoherence: GNSS=1150.0 m vs Baro=450.0 m (Δ=700.0 m); Time-Jump Attack: UTC Date jumped 181026 -> 190328 |
| **17** | `190328 100017.00` | `UAV_100_1500M` | `8 / 1` | `42.0` | **`0.71`** | `+0.21` | `68.5 / 22.0` | `1150 / 450` | **🚨 EW_SPOOFING**: Flat C/N0 Spectrum (UAV_100_1500M): std_all=0.71 dB-Hz (<= 2.8), mean=42.0 dB-Hz, elev_corr=0.21; Single-Constellation Collapse ($GNGSA): only GPS L1 active (GLONASS/Galileo dropped); Velocity Incoherence: GNSS=68.5 m/s vs Airspeed/Ref=22.0 m/s; Altitude Incoherence: GNSS=1150.0 m vs Baro=450.0 m (Δ=700.0 m); Time-Jump Attack: UTC Date jumped 181026 -> 190328 |
| **18** | `181026 100018.00` | `UAV_100_1500M` | `11 / 3` | `37.3` | **`5.46`** | `+0.99` | `22.1 / 22.0` | `450 / 450` | **🚨 EW_SPOOFING**: Coordinate Teleport: Δpos=4838.4 m in 1s |
| **19** | `181026 100019.00` | `UAV_100_1500M` | `11 / 3` | `37.3` | **`5.46`** | `+0.99` | `22.1 / 22.0` | `450 / 450` | **✅ NOMINAL**: Multi-GNSS 3D OK (3 constellations, elev_corr=0.99) |
| **20** | `181026 100020.00` | `UAV_100_1500M` | `11 / 3` | `37.3` | **`5.46`** | `+0.99` | `22.1 / 22.0` | `450 / 450` | **✅ NOMINAL**: Multi-GNSS 3D OK (3 constellations, elev_corr=0.99) |
