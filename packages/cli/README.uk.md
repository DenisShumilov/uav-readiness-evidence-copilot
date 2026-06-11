# packages/cli

*[English](README.md) · Українською*

> CLI (command-line interface — інструмент командного рядка) для запуску рушія готовності документації на теці з підтриманими документами.

Частина монорепозиторію [UAV Readiness & Evidence Copilot](../../README.uk.md).

## Команди

```bash
uav-readiness check <dir>
uav-readiness demo
```

`check` переглядає `.csv` та `.md` файли й шукає чотири підтримані input contracts
(input contract — очікувана форма вхідного файлу):

- BOM CSV: `item_id,item_name,category,quantity,record_status,evidence_id,notes`
- Markdown-інструкція: рядок `SYNTHETIC DEMO` і таблиця `| Claim | Status | Evidence |`
- CSV журналу перевірок: `check_id,check_name,check_type,result,evidence_status,evidence_id,notes`
- Markdown QA-нотаток: рядок `SYNTHETIC DEMO`, таблиця `| Evidence ID | Status | Meaning |` і поля `Finding ID` / `Status` / `Reason` / `Impact`

Непідтримані файли пропускаються і показуються у summary (summary — короткий підсумок).
Відсутні або нерозбірні підтримані входи не валять CLI; вони створюють claims (claims —
твердження) зі статусом `locked`, бо правило таке: `no evidence -> locked`.

## Результати

```bash
uav-readiness check ./docs --json out/readiness.json --sarif out/readiness.sarif --md out/readiness.md --min-score 70
```

- `--json` записує перевірений readiness assessment (оцінку готовності документації).
- `--sarif` записує SARIF (формат GitHub code scanning).
- `--md` записує markdown-звіт.
- `--min-score` повертає exit code `1`, якщо оцінка нижча за поріг.
- `--quiet` робить CI-логи короткими.

## Межі безпеки

Цей CLI читає статичні файли документації, виводить статус доказів і записує звіти. Він не запускає,
не керує і не затверджує жодну реальну систему.
