export function parseCsvRows(
  csvText: string,
  expectedHeaders: string[],
  label: string
): Record<string, string>[] {
  const rows = splitCsvRecords(csvText, label);

  if (rows.length < 2) {
    throw new Error(`${label} CSV must include a header and at least one row`);
  }

  const headers = rows[0];
  if (
    headers.length !== expectedHeaders.length ||
    !headers.every((header, index) => header === expectedHeaders[index])
  ) {
    throw new Error(`${label} CSV headers must be: ${expectedHeaders.join(",")}`);
  }

  return rows.slice(1).map((values, lineIndex) => {
    if (values.length !== headers.length) {
      throw new Error(`${label} CSV row ${lineIndex + 1} has an invalid cell count`);
    }

    return Object.fromEntries(
      headers.map((header, index) => [header, values[index]])
    );
  });
}

type CsvCellState =
  | "START_FIELD"
  | "IN_UNQUOTED_FIELD"
  | "IN_QUOTED_FIELD"
  | "AFTER_QUOTED_FIELD";

function splitCsvRecords(csvText: string, label: string): string[][] {
  const records: string[][] = [];
  let currentRow: string[] = [];
  let current = "";
  let state: CsvCellState = "START_FIELD";

  const pushRowIfNonEmpty = () => {
    const isBlankLine =
      currentRow.length === 1 && currentRow[0] === "" && state === "START_FIELD";
    if (!isBlankLine && currentRow.length > 0) {
      records.push(currentRow);
    }
    currentRow = [];
  };

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (state === "IN_QUOTED_FIELD") {
      if (char === '"') {
        if (next === '"') {
          current += '"';
          index += 1;
        } else {
          state = "AFTER_QUOTED_FIELD";
        }
      } else {
        current += char;
      }
      continue;
    }

    if (state === "AFTER_QUOTED_FIELD") {
      if (char === ",") {
        currentRow.push(current.trim());
        current = "";
        state = "START_FIELD";
        continue;
      }
      if (char === "\r" || char === "\n") {
        if (char === "\r" && next === "\n") {
          index += 1;
        }
        currentRow.push(current.trim());
        current = "";
        state = "START_FIELD";
        pushRowIfNonEmpty();
        continue;
      }
      throw new Error(
        `${label} CSV contains trailing characters after closing quote`
      );
    }

    if (state === "START_FIELD") {
      if (char === '"') {
        state = "IN_QUOTED_FIELD";
        continue;
      }
      if (char === ",") {
        currentRow.push("");
        current = "";
        continue;
      }
      if (char === "\r" || char === "\n") {
        if (char === "\r" && next === "\n") {
          index += 1;
        }
        if (currentRow.length > 0) {
          currentRow.push("");
          pushRowIfNonEmpty();
        }
        continue;
      }
      current += char;
      state = "IN_UNQUOTED_FIELD";
      continue;
    }

    // state === "IN_UNQUOTED_FIELD"
    if (char === '"') {
      throw new Error(`${label} CSV contains a quote inside an unquoted cell`);
    }
    if (char === ",") {
      currentRow.push(current.trim());
      current = "";
      state = "START_FIELD";
      continue;
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(current.trim());
      current = "";
      state = "START_FIELD";
      pushRowIfNonEmpty();
      continue;
    }
    current += char;
  }

  if (state === "IN_QUOTED_FIELD") {
    throw new Error(`${label} CSV contains an unterminated quoted cell`);
  }

  if (
    state === "IN_UNQUOTED_FIELD" ||
    state === "AFTER_QUOTED_FIELD" ||
    currentRow.length > 0
  ) {
    currentRow.push(current.trim());
    pushRowIfNonEmpty();
  }

  return records;
}
