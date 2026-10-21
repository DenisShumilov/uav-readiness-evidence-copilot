export function sanitizeMarkdownInline(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/([#`[\]<>|])/g, "\\$1");
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

export function sanitizeHref(value: string): string {
  const trimmed = value.trim();
  if (
    !trimmed ||
    hasControlChars(trimmed) ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(trimmed)
  ) {
    return "#";
  }
  return trimmed
    .split("/")
    .map((seg) =>
      seg === "." || seg === ".."
        ? seg
        : encodeURIComponent(seg)
            .replace(/\(/g, "%28")
            .replace(/\)/g, "%29")
    )
    .join("/");
}
