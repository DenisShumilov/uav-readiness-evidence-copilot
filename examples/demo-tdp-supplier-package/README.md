# Technical Data Package (TDP, технічний пакет даних)-style демо пакета постачальника

*Українською · [English](README.en.md)*

Synthetic demo data only. Not operationally valid.

Лише синтетичні демо-дані. Не є операційно достовірними.

Це навчальна мапа публічно відомих категорій документації. Це **не** інструмент сертифікації чи
відповідності стандартам.

**Четвертий** синтетичний набір подано як review worksheet (робочий аркуш перевірки), який
документаційна команда готує з вхідного пакета постачальника для вигаданого малого UAS airframe kit:
`NORDWING-7 trainer airframe kit`. Сценарій упізнаваний для defense-tech документаційних команд, але
кожен рядок вигаданий і статичний.

## Запуск

```powershell
npm run demo:tdp
```

Результат записується до `examples/demo-tdp-supplier-package/output/` (не комітиться у репозиторій).

## Що це показує

Видимі worksheet-файли лежать в `input/`:

- `vendor_BOM.csv`
- `acceptance_test_log.csv`
- `qa_inspection_notes.md`
- `manual_excerpt.md`

Той самий зміст продубльовано в чотири поточні кореневі імена парсерів (`BOM.csv`, `test_log.csv`,
`qa_notes.md`, `demo_manual.md`), тому набір використовує наявні парсери без нового parser code
(коду читання файлів).

Закладені знахідки рецензування:

- два непідтверджені worksheet-твердження лишаються `locked`;
- fastener set lot certificate cross-reference лишається `partial`, бо certificate посилається на lot id,
  якого немає в BOM index;
- worksheet BOM-комірка `revision` каже `nordwing-kit=R03`, а рядок QA notes каже
  `Revision: nordwing-kit=R02`, тому спрацьовує conflict gate.

Очікуваний вердикт: **49/100 (Blocked)**. Оцінка стосується тільки повноти й узгодженості
документації; це не реальний дозвільний висновок.

Правило маркування: кожен файл є лише синтетичними демо-даними і не є операційно достовірним.

Контекст стандартів: див. [Як це лягає на реальну практику документації](../../docs/standards.md).
