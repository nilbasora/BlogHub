function stripQuotes(s: string) {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}

function parseValue(raw: string): any {
  const v = raw.trim()
  if (!v) return ""
  if (v.startsWith("[") || v.startsWith("{")) {
    try {
      return JSON.parse(v)
    } catch {
      return v
    }
  }
  if (v === "true") return true
  if (v === "false") return false
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  return stripQuotes(v)
}

export function parseFrontmatterBlock(markdown: string): {
  frontmatter: Record<string, any>
  body: string
} {
  const s = markdown ?? ""
  if (!s.startsWith("---")) {
    return { frontmatter: {}, body: s }
  }

  const end = s.indexOf("\n---", 3)
  if (end === -1) {
    return { frontmatter: {}, body: s }
  }

  const fmRaw = s.slice(3, end).trim()
  const body = s.slice(end + "\n---".length).replace(/^\s+/, "")

  const frontmatter: Record<string, any> = {}
  for (const line of fmRaw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf(":")
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1)
    frontmatter[key] = parseValue(val)
  }

  return { frontmatter, body }
}

function toYamlValue(v: any): string {
  if (Array.isArray(v) || (typeof v === "object" && v !== null)) {
    return JSON.stringify(v)
  }
  if (typeof v === "string") return `"${v.replaceAll('"', '\\"')}"`
  return String(v)
}

export function buildMarkdownFile(draft: Record<string, any>): string {
  const fmKeys = [
    "id",
    "title",
    "slug",
    "date",
    "status",
    "excerpt",
    "tags",
    "categories",
    "seo_title",
    "seo_description",
    "seo_image",
  ]

  const fmLines: string[] = []
  for (const k of fmKeys) {
    const val = draft[k]
    if (val === undefined || val === null) continue
    if (typeof val === "string" && val.trim() === "" && !["title", "slug"].includes(k)) continue
    fmLines.push(`${k}: ${toYamlValue(val)}`)
  }

  const body = (draft.body ?? "").toString().trimEnd()
  return `---\n${fmLines.join("\n")}\n---\n\n${body}\n`
}
