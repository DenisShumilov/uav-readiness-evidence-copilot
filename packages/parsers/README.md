# packages/parsers

Parsers package placeholder.

Parser means code that reads a file and extracts structured data.

Future safe parsers may read:

- BOM files, meaning lists of parts;
- manual files, meaning instruction documents;
- config dumps, meaning settings files;
- test logs, meaning test tables;
- QA notes, meaning quality notes.

Phase 4 step 1:

Only `parseBOMCsv` exists.

It reads the synthetic `BOM.csv` fixture and returns schema-checked data.

Safety rule:

No live system files, operational files, or real equipment data.
