# Синтетичне демо готовності до обслуговування

*Українською · [English](README.en.md)*

**Другий** набір синтетичних прикладів (synthetic example bundle), за формою відмінний від `demo-uav-readiness`. Він задіює той самий конвеєр (pipeline): парсери (parsers) → граф доказів (evidence graph) → правила готовності (readiness rules) → звіти (reports), але працює на записах у стилі технічного обслуговування (maintenance) і дає помітно вищу оцінку готовності (здебільшого впорядкований пакет).

```text
Intended use:  educational documentation QA demo only.
Dataset type:  fully synthetic.
Fidelity:      medium — looks like engineering paperwork, not real maintenance data.
Creation:      handcrafted synthetic records with cross-referenced IDs.
Limitations:   not operationally valid; dates, IDs, and contents are artificial.
Safety:        no real coordinates, routes, telemetry, serial numbers, names, or operational content.
```

## Запуск

```powershell
npm run demo:maintenance
```

Результат записується до `examples/demo-maintenance-readiness/output/` (не комітиться).

## Що це демонструє

На відміну від суворого пакета `demo-uav-readiness` (44/100, "Blocked"), цей пакет здебільшого підкріплений доказами і потрапляє у смугу **"Reviewable, but incomplete"** (придатний до перегляду, але неповний) — проте інструмент усе одно виконує свою роботу: він позначає частковий запис і залишає відсутнє підтвердження утилізації (disposal sign-off) **заблокованим** (locked). Докази, а не оптимізм.
