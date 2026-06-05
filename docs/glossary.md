# Glossary

Glossary means a dictionary of project terms.

The rule for this project:

If a technical word appears, explain it simply.

## Core Terms

- manual = інструкція або технічний паспорт деталі.
- pinout = карта контактів на платі.
- BOM = список деталей.
- config dump = файл із налаштуваннями.
- evidence = доказ.
- evidence graph = карта доказів: що з чим пов'язано і чим підтверджено.
- traceability = зв'язок "вимога -> доказ -> перевірка".
- parser = код, який читає файл і дістає з нього дані.
- schema = правила, як мають виглядати дані.
- fixture = навчальний тестовий файл.
- artifact = файл, який ми завантажили або згенерували.
- readiness score = оцінка готовності.
- QA = перевірка якості.
- CLI = запуск через командний рядок.
- repo = папка проєкту з Git.
- package = окрема частина коду або модуль.
- subagent = окремий помічник з конкретною роллю.
- skill = готова інструкція для агента.
- red-team = критична перевірка ризиків.
- self-review = самоперевірка після роботи.
- locked = заблоковано, бо нема доказу.
- synthetic = фейковий, навчальний, не з реального використання.
- scaffold = каркас проєкту, тобто папки й базові файли без логіки.
- runtime logic = код, який реально виконує дію.
- telemetry = живі дані з системи, наприклад статус або сенсори.
- MVP = перша мала версія проєкту.
- Zod = бібліотека для перевірки даних у TypeScript.
- TypeScript = JavaScript із типами, тобто код із чіткішими правилами.
- markdown = простий формат текстових документів.
- YAML = формат даних, схожий на список з відступами.
- JSON = формат даних у вигляді ключів і значень.
- CSV = таблиця у текстовому файлі.
- PPTX = файл презентації PowerPoint.
- hash = короткий цифровий відбиток файлу.
- integrity = цілісність файлу, тобто файл не змінили непомітно.
- validation = перевірка, що дані відповідають правилам.
- dependency = зовнішня бібліотека або інструмент, від якого залежить проєкт.
- metadata = службові дані про файл, наприклад дата або прихована інформація.
- structured data = дані з чіткою формою, наприклад таблиця або JSON.
- AI-agent plugin = набір можливостей для AI-агента: інструменти, skills, підключення або команди.
- Claude Code plugin = plugin для Claude Code, який може додавати skills, команди або інтеграції.
- built-in skill = вбудована навичка, яка вже є в системі.
- MCP server = міст між AI-агентом і зовнішнім сервісом або інструментом.
- LSP plugin = інструмент для підказок і перевірки коду в редакторі.
- hook = автоматична дія, яка запускається у певний момент, наприклад перед commit.
- monitor = спостерігач, який регулярно перевіряє стан чогось.
- npm package = бібліотека коду для JavaScript або TypeScript проєкту.
- plugin bloat = забагато plugin, які дають мало користі й додають ризик.
- marketplace = каталог, де можна знайти і встановити plugins.
- install now = можна встановити зараз після підтвердження користувача.
- create local = краще зробити локальний skill або agent у проєкті.
- use built-in = використати те, що вже доступно.
- later = відкласти на майбутню фазу.
- reject = не використовувати.

## Teaching Rule

When writing to the user, do not say only:

`parser`

Say:

`parser (код, який читає файл і дістає з нього дані)`

When a term repeats many times, explain it at least the first time in each answer.

## Do Not Confuse

- plugin = набір інструментів для агента.
- skill = рецепт для агента.
- subagent = спеціаліст із роллю.
- npm package = деталь для коду.

Simple rule:

AI-agent plugin helps the agent work. npm package helps the app code work.
