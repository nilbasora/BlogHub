export function buildSearchText(fields: Array<string | undefined>): string {
  return fields
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}
