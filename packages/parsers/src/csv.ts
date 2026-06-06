export function parseCsvRows(
  csvText: string,
  expectedHeaders: string[],
  label: string
): Record<string, string>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error(`${label} CSV must include a header and at least one row`);
  }

  const headers = splitCsvLine(lines[0]);
  if (
    headers.length !== expectedHeaders.length ||
    !headers.every((header, index) => header === expectedHeaders[index])
  ) {
    throw new Error(`${label} CSV headers must be: ${expectedHeaders.join(",")}`);
  }

  return lines.slice(1).map((line, lineIndex) => {
    const values = splitCsvLine(line);
    if (values.length !== headers.length) {
      throw new Error(`${label} CSV row ${lineIndex + 1} has an invalid cell count`);
    }

    return Object.fromEntries(
      headers.map((header, index) => [header, values[index]])
    );
  });
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    throw new Error(`${line} contains an unterminated quoted cell`);
  }

  values.push(current.trim());
  return values;
}
