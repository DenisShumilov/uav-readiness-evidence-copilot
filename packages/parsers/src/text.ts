const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  є: "ye",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "yi",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ь: "",
  ю: "yu",
  я: "ya",
  ё: "yo",
  ъ: "",
  ы: "y",
  э: "e"
};

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function toSafeIdPart(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "unknown";
  }

  let transliterated = "";
  let hasOtherNonAscii = false;
  for (const ch of trimmed.toLowerCase()) {
    if (ch in CYRILLIC_TO_LATIN) {
      transliterated += CYRILLIC_TO_LATIN[ch];
    } else if (ch.charCodeAt(0) > 127) {
      hasOtherNonAscii = true;
      transliterated += "-";
    } else {
      transliterated += ch;
    }
  }

  const normalized = transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    return [...trimmed].every((c) => c.charCodeAt(0) <= 127)
      ? "unknown"
      : `u-${fnv1aHex(trimmed)}`;
  }

  return hasOtherNonAscii ? `${normalized}-${fnv1aHex(trimmed)}` : normalized;
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
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}:[ \\t]*(.*)$`, "im");
  const match = markdown.match(pattern);

  if (!match) {
    throw new Error(`Missing markdown field: ${label}`);
  }

  const value = match[1].trim();
  if (!value) {
    throw new Error(`Missing markdown field: ${label}`);
  }

  return value;
}
