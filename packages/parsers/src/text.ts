export function toSafeIdPart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "unknown";
}

export function extractMarkdownTable(
  markdown: string,
  header: string
): string[][] {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() === header);

  if (headerIndex === -1) {
    throw new Error(`Missing markdown table header: ${header}`);
  }

  const separatorIndex = headerIndex + 1;
  if (!/^\|\s*-+/.test(lines[separatorIndex]?.trim() ?? "")) {
    throw new Error(`Missing markdown table separator for: ${header}`);
  }

  const rows: string[][] = [];
  for (let index = separatorIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith("|")) {
      break;
    }

    rows.push(
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim())
    );
  }

  if (rows.length === 0) {
    throw new Error(`Markdown table has no rows: ${header}`);
  }

  return rows;
}

export function extractMarkdownField(markdown: string, label: string): string {
  const pattern = new RegExp(`^${label}:\\s*(.+)$`, "im");
  const match = markdown.match(pattern);

  if (!match) {
    throw new Error(`Missing markdown field: ${label}`);
  }

  return match[1].trim();
}
