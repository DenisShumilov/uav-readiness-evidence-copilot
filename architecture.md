# Архітектура системи та інженерний розбір підсистем (`v2.5.0`)

*Українською · [English](architecture.en.md) · [На головну](../README.md)*

> Розробляю локальні інструменти для звірки технічних документів і таблиць. Вони знаходять розбіжності, показують джерела висновків та окремо позначають те, що не вдалося перевірити. Починаємо з одного вашого процесу й узгодженого набору файлів.

Цей документ описує внутрішню архітектуру **UAV Readiness & Evidence Copilot (`v2.5.0`)**: поділ між клієнтським веб-стендом і репозиторієм, карту модулів, Триконтурну Матрицю Можливостей, математичні моделі 6 базових підсистем та детермінований конвеєр оцінки повноти пакета доказів.

---

## 1. Архітектурний поділ: Веб-стенд швидкої перевірки ⇄ GitHub-репозиторій

1. **[Живий веб-стенд (`https://denisshumilov.github.io/uav-readiness-evidence-copilot/`)](https://denisshumilov.github.io/uav-readiness-evidence-copilot/)** виконує роль автономного клієнтського термінала з **дворівневою подачею результатів**:
   - **Рівень 1 (Автоматизована локальна звірка за лічені секунди з прив'язкою до точних координат джерел):** без перевантаження екрана байтовими дампами показує підсумковий статус (`ГОТОВО` / `ПОТРЕБУЄ УСУНЕННЯ` / `ЗАБЛОКОВАНО` / `UNVERIFIED`), інтегральний бал `0–100` та 4-стовпцеву таблицю «Спочатку проблеми» (`Параметр | Результат / статус | Джерела | Наступна дія`).
   - **Рівень 2 (Побайтова специфікація за запитом):** кожен пункт звіту розгортається у детальний технічний протокол із первинними XML-вузлами OOXML, векторами розмірностей SI, зрізами бінарних фреймів телеметрії та деревами `ASN.1 DER`.
2. **GitHub-репозиторій (`uav-readiness-evidence-copilot`)** містить повний вихідний код усіх рушіїв, формальні схеми даних (`schemas/`), еталонні тестові пакети (`examples/`) та наскрізні автотести, які гарантують математичний паритет між браузерним JS-кодом (`docs/tools-engine.js`) і серверним/консольним ядром (`packages/rules`, `engines/`).

---

## 2. Повна карта репозиторію (`Repository Map`)

| Каталог / Модуль | Технологічний стек | Інженерна роль у системі |
|---|---|---|
| `docs/index.html`, `docs/tools/*.html` | HTML5 / CSS / JS | Клієнтський веб-стенд (`8 interactive local browser tools`) із дворівневим інтерфейсом результатів |
| `docs/tools-engine.js` | Vanilla JS (ES2022) | Браузерний рушій оцінки готовності, синхронізований за вагами штрафів із `@uav-readiness/rules` (перевіряється у `siteParity.test.ts`) |
| `docs/multi-file-verifier-bundle.js` | Vanilla JS | Пакетний крос-верифікатор комплектів документів (`ТУ ⇄ ПМВ ⇄ Паспорт ⇄ Лог ⇄ КЕП`), дедуплікація за `SHA-256` |
| `docs/pdf-scan-ocr-engine.js` | JS / WASM / Matrix OCR | Колірна деконволюція Беєра-Ламберта для видалення синіх мокрих печаток та динамічне розпізнавання значень із `bbox` |
| `docs/encrypted-report-share.js` | WebCrypto API | Шифрування звітів за `AES-256-GCM` (`PBKDF2`, `100 000` ітерацій, 128-бітний CSPRNG ключ) у клієнтський якір `#diag=` за `RFC 3986` |
| `docs/coi-airgap-enclave-sw.js` | Service Worker | Ізоляція кешу `shmlv-airgap-enclave-v2.5.0`, блокування зовнішніх origin та мутуючих методів |
| `engines/defdoc_ai/defdoc_auditor.py` | Python 3.10+ (stdlib) | Консольний аудитор пакетів конструкторської документації, звірка допусків і регресійний бенчмарк |
| `engines/defdoc_ai/document_intake.py` | Python 3.10+ (`zipfile`, `xml`) | Побайтова декомпресія OOXML, перерахунок дерева формул Excel, реконструкція `gridSpan`/`vMerge` та 7D SI-вектори |
| `engines/defdoc_ai/sanitize_doc.py` | Python 3.10+ | Токенізація PII/чутливих сутностей у `.docx`, `.xlsx`, `.md` із перевіркою `leaked_pii_tokens_remaining = 0` |
| `engines/defdoc_ai/test_client_intake.py` | Python `unittest` | Набір із 22 регресійних тестів клієнтського парсингу, формул Excel та захисту від XXE/Zip-Slip |
| `engines/telemetry_ew/telemetry_analyzer.py` | Python 3.10+ (`struct`, `zlib`) | Бінарний аналізатор логів `DataFlash`, `ULog`, `MAVLink v1/v2`, `UBX`, `NMEA 0183` та `GZIP` |
| `engines/telemetry_ew/sanitize_telemetry.py` | Python 3.10+ | Узгоджене OPSEC-знеособлення координат геолокації у польотних логах |
| `engines/telemetry_ew/test_readiness.py` | Python `unittest` | Набір із 22 регресійних тестів бінарних парсерів телеметрії |
| `packages/core` | TypeScript / Zod | Схеми даних артефактів, тверджень (`EvidenceClaim`) та алгоритм виявлення міждокументних конфліктів ревізій |
| `packages/parsers` | TypeScript | Детерміновані парсери комплектів (`BOM.csv`, `demo_manual.md`, `test_log.csv`, `qa_notes.md`) та дизамбігуація дубльованих ID |
| `packages/evidence` | TypeScript | Побудова незмінного графа доказів (`BuiltEvidenceGraph`) і агрегація лічильників |
| `packages/rules` | TypeScript | Незалежне виведення статусів (`deriveEvidenceStatuses`) і обчислення бала готовності (`CONFLICT_CEILING = 49`, `Zero-Evidence Ceiling = 0`) |
| `packages/reports` | TypeScript | Генерація `readiness-report.md`, `engineering-review.html`, `traceability-matrix.csv`, `artifact-hashes.json`, `readiness.sarif` |
| `packages/cli` | TypeScript / Node.js | Консольний інтерфейс `uav-readiness` для автоматизації перевірок у CI/CD |
| `packages/qa` | TypeScript / Vitest / Playwright | Наскрізні тести CLI, валідація JSON Schema (`Ajv` + 12 негативних мутацій), Playwright Chromium E2E та `selfAudit.ts` |

---

## 3. Триконтурна Матриця Можливостей (`Browser Local UI` vs `Python CLI Engines` vs `TypeScript Core & CLI`)

| Контур | Формати та структура входу | Що реально перевіряється | Який вихід формується | Чесні обмеження | Чим підтверджено (тест / команда) |
|---|---|---|---|---|---|
| **1. Browser Local UI (`docs/*.js`, `docs/index.html`, `universal-ai-cockpit.html`)** | `.docx`, `.xlsx`, `.csv`, `.tsv`, `.pdf` (растровий скан `560×220` + векторний `/FlateDecode`), `.p7s` (`ASN.1 DER`), `.bin`, `.ulg`, `.tlog`, `.ubx`, `.nmea`, `.c/.cpp/.py/.lua` | Міждокументні колізії ТТХ (7D SI-вектори), кеш формул Excel (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT` та `+`, `-`, `*`, `/`), відсікання мокрої печатки та WASM-OCR, структурна цілісність `CMS SignedData` (`.p7s`) за `SignerInfo.sid`, заголовки та CRC бінарних логів, дублікати за `SHA-256` | Чотиристовпцева таблиця «Спочатку проблеми» (`Параметр \| Результат / статус \| Джерела \| Наступна дія`), криптокапсула `#diag=` (`AES-256-GCM` + 128-бітний CSPRNG ключ), експорт Markdown/CSV/JSON | У браузері НЕ виконується математична перевірка підпису `ДСТУ 4145-2002` та запити OCSP/CRL (`UNVERIFIED_CRYPTO`); OCR розрахований на вирівняні скани; 1 документ без пари отримує `SINGLE_SOURCE_UNVERIFIED` | `npm test` (`siteParity.test.ts`, `browserIntegration.test.ts`, `browserE2E.test.ts` на Playwright Chromium) |
| **2. Python CLI Engines (`engines/defdoc_ai/*`, `engines/telemetry_ew/*`)** | `.docx`, `.xlsx`, `.md`, `.txt` + бінарні логи `.bin`, `.ulg`, `.tlog`, `.ubx`, `.nmea`, `.csv`, `.gz` (до `64 MiB`, ZIP-ліміт `128 MiB`) | Таблиці `<w:tbl>` із `gridSpan`/`vMerge`, інтервали, допуски `±`, комплектність BOM, крос-звірка ПМВ проти бінарного логу польоту, контрольні суми `Fletcher-8` / `CRC-16/MCRF4XX` / `XOR`, OPSEC-токенізація PII (`leaked_pii_tokens_remaining = 0`) | Markdown-звіт аудиту (`.audit.md`), очищені `.sanitized.docx/.xlsx`, JSON-статистика деідентифікації та телеметрії, 4-файловий бандл для TypeScript-ядра | Не розпізнає суперечності у вільному прозовому тексті без таблиць і нестандартні колонки без одиниць SI чи операторів норми (`UNVERIFIED`); не робить причинних висновків про РЕБ | `python3 engines/defdoc_ai/defdoc_auditor.py --self-test`, `--test-client`, `--benchmark`, `sanitize_doc.py --json-stats`, `telemetry_analyzer.py --self-test` |
| **3. TypeScript Core & CLI (`packages/core`, `parsers`, `rules`, `evidence`, `reports`, `cli`)** | Строгий 4-файловий контракт пакета доказів: `BOM.csv`, `demo_manual.md`, `test_log.csv`, `qa_notes.md` (демо та реальні BYOD-папки без банера `SYNTHETIC DEMO`) | Прив'язка кожного твердження до непорожнього артефакту й цитати, виявлення висячих посилань (`dangling_evidence`), статус тестів (`fail`/`blocked` → `locked`), конфлікти ревізій `subject=value` (`CONFLICT_CEILING = 49`), `Zero-Evidence Ceiling = 0` | `readiness-assessment.json`, `evidence-graph.json`, `readiness-report.md`, `traceability-matrix.csv` (із захистом від CSV-ін'єкцій), `artifact-hashes.json`, `readiness.sarif` (`SARIF 2.1.0`) | Оцінює виключно повноту і узгодженість наданого пакета документів (не льотну придатність виробу); статус `verified` (`reviewer_upper_bound`) означає наявність джерела та відсутність виявлених протиріч | `npm test`, `npm run qa:self-audit`, `npm run demo:readiness`, `npm run demo:conflict`, `npm run demo:lock`, `npm run demo:pack` |

---

## 4. Інженерний розбір 6 підсистем

### 4.1. Підсистема 1: Побайтовий розбір OOXML (`.docx`/`.xlsx`), кеш формул Excel та 7D SI-вектори
- Реконструкція таблиць `<w:tbl>` із підтримкою `<w:gridSpan>` та `<w:vMerge>` і форензик ревізій `w:rsidR`.
- Незалежний перерахунок формул Excel (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT` та арифметичних операторів `+`, `-`, `*`, `/`) проти закешованого значення `<v>`.
- Приведення фізичних величин до 7-вимірного вектора розмірностей SI $\vec{d} = [M, L, T, I, \Theta, N, J] \in \mathbb{Z}^7$.

### 4.2. Підсистема 2: Колірна деконволюція Беєра-Ламберта (`Chromatic Stamp Drop-Out`) та локальне OCR
- Перехід у простір оптичної густини $OD_c = -\log_{10}(\max(I_c, 1)/I_{0,c})$ та придушення синьої/фіолетової мокрої печатки.
- По-гліфове розпізнавання значень із геометричними координатами `bbox` та динамічним обчисленням дельти між «Норма ТУ» і «Факт ПМВ».

### 4.3. Підсистема 3: Бінарні парсери польотних логів
- Структурний розбір `ArduPilot DataFlash (.bin)`, `PX4 ULog (.ulg)`, `MAVLink v1/v2 (.tlog)`, `u-blox UBX (.ubx)` та `NMEA 0183 (.nmea)`.
- Перевірка контрольних сум (`Fletcher-8`, `CRC-16/MCRF4XX`, `XOR`) та відмова (`WARN / UNVERIFIED`) на пошкоджених або порожніх потоках без валідних пакетів.

### 4.4. Підсистема 4: Структурний розбір КЕП (`.p7s`, `ASN.1 DER`, `CMS SignedData`)
- Сувора перевірка ієрархії RFC 5652 `ContentInfo -> SignedData`, відхилення BER indefinite length (`0x80`), обірваних TLV (`corrupted_der`) та зайвих байтів (`trailing_bytes`).
- Прив'язка сертифіката підписувача через `SignerInfo.sid` (`IssuerAndSerialNumber` / `SubjectKeyIdentifier`), витягування X.509 RDN-полів та фіксація SHA-256 відбитка стану документа на момент перевірки (для незалежного підтвердження часу потрібна зовнішня кваліфікована позначка часу TSP).
- Явне розмежування структурного статусу (`structuralStatus: "PASS" | "FAIL"`) і криптографічної межі (`cryptoStatus: "UNVERIFIED"` / `UNVERIFIED_CRYPTO`).

### 4.5. Підсистема 5: Глибоке OPSEC-очищення геолокації та PII
- Токенізація чутливих сутностей у документах та узгоджений зсув координат із повторною перевіркою `leaked_pii_tokens_remaining = 0`.

### 4.6. Підсистема 6: Оцінка повноти доказів `0–100` (`CONFLICT_CEILING = 49`) та криптокапсула `#diag=`
- Суворе виведення статусів (`packages/rules/src/deriveStatus.ts` та `packages/evidence/src/evidenceGraph.ts`): конфлікт ревізій → `conflict` (стеля `49/100`), провалений/заблокований тест → `locked`, відсутнє джерело → пониження до `partial` (`dangling_evidence`), повна відсутність підтверджених/часткових доказів → `0/100` (`UNVERIFIED`).
- Шифрування звіту в браузері алгоритмом `AES-256-GCM` із 128-бітним випадковим ключем (`32` hex-символи) у клієнтський фрагмент URL (`#diag=...`).

---

## 5. Інженерний пілот на одному узгодженому процесі та 4 метрики оцінювання

### 6 фіксованих етапів пілоту
1. **Один процес**: вибір однієї конкретної інженерної звірки (ТУ ↔ ПМВ ↔ специфікація BOM).
2. **Погоджені входи**: фіксація підтримуваних форматів і структури таблиць на знеособлених зразках.
3. **Правила**: формалізація допусків, одиниць SI та умов блокування (`FAIL` / `LOCKED` / `UNVERIFIED`).
4. **Потрібний вихід**: узгодження формату звіту, матриці трасованості та криптокапсули `#diag=`.
5. **Перевірка на відкладеному контрольному наборі (Hold-out set)**: тестування на файлах, які не використовувалися під час налаштування правил.
6. **Передача коду, тестів та інструкції**: передача автономного пакета з автотестами команді замовника.

*Час і вартість визначаються після перегляду знеособлених зразків і меж задачі.*

### 4 метрики оцінювання пілоту
1. **Повнота виявлення розбіжностей (Recall)**: `TP / (TP + FN)`
2. **Частка хибних спрацювань (False Discovery Rate)**: `FP / (TP + FP)`
3. **Частка неперевіреного (Unverified Rate)**: `UNVERIFIED / Total`
4. **Повний час роботи інженера (`T_before` vs `T_after`)**: порівняння повного часу ручної звірки пакета до впровадження (`T_before`) та часу роботи з інструментом включно з переглядом і верифікацією звіту людиною (`T_after`).

*Якщо знаменник будь-якої метрики дорівнює `0` (наприклад, `TP + FN = 0`), метрика позначається як **«не визначено на цьому наборі»** і не інтерпретується як `100%` або `0%`.*

---

## 6. Команди для відтворення всіх перевірок

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm test
npm run qa:self-audit
python3 engines/defdoc_ai/defdoc_auditor.py --self-test
python3 engines/defdoc_ai/defdoc_auditor.py --test-client
python3 engines/defdoc_ai/defdoc_auditor.py --benchmark
python3 engines/defdoc_ai/sanitize_doc.py --json-stats
python3 engines/telemetry_ew/telemetry_analyzer.py --self-test
```
