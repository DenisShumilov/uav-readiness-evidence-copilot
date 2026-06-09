# Синтетична демонстрація готовності в умовах конфлікту даних

*Українською · [English](README.en.md)*

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

Цей пакет майже повністю підкріплений доказами — 10 підтверджених тверджень (verified claims). Але одне
твердження перебуває в стані **конфлікту** (conflict): покажчик документів (document index) вказує одну
ревізію, тоді як аудиторська примітка (audit note) показує іншу.

Лише на основі логічних висновків (deductions) пакет отримав би оцінку ~90/100. Але **бар'єр конфлікту**
(conflict gate) обмежує вердикт до **49/100 (Blocked)**: суперечність ніколи не може читатися як «готово»
(ready), доки джерела не узгоджуються між собою. Саме цю чесну поведінку покликаний продемонструвати весь
проєкт — докази та узгодженість понад оптимізм.
