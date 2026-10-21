# Синтетична демонстрація готовності в умовах конфлікту даних

*Українською · [English](README.en.md)*

Лише синтетичні демо-дані. Не є операційно достовірними.

**Третій** синтетичний (повністю штучний) набір даних, який містить навмисну суперечність, щоб
продемонструвати **бар'єр конфлікту** (conflict gate) у правилах оцінки готовності.

```text
Intended use:  educational documentation QA demo only.
Dataset type:  fully synthetic.
Fidelity:      medium — looks like document-control paperwork, not real data.
Limitations:   not operationally valid; revisions, IDs, and contents are artificial.
Safety:        no real coordinates, routes, telemetry, serial numbers, names, or operational content.
```

## Запуск

```powershell
npm run demo:conflict
```

Результат записується до `examples/demo-conflict-readiness/output/` (не комітиться у репозиторій).

## Що це показує

Цей пакет майже повністю підкріплений доказами — 11 підтверджених тверджень (verified claims). Але
інструмент **сам виявляє суперечність**: покажчик документів (document index) декларує ревізію `TM-3`, а
аудиторська примітка (audit note) — `TM-2`. Код порівнює ці значення між документами і **виводить статус
`conflict`** (`claim.crosscheck.training-manual`) — статус не вписано вручну у фікстуру.

Лише на основі логічних висновків (deductions) пакет отримав би оцінку ~90/100. Але **бар'єр конфлікту**
(conflict gate) обмежує вердикт до **49/100 (Blocked)**: суперечність ніколи не може читатися як «готово»
(ready), доки джерела не узгоджуються між собою. Саме цю чесну поведінку покликаний продемонструвати весь
проєкт — докази та узгодженість понад оптимізм.
