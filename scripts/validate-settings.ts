import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { SiteSettings } from "@/core/utils/types.js"

const ROOT = process.cwd()
const SETTINGS_PATH = path.join(ROOT, "public", "site", "settings.json")
const THEMES_DIR = path.join(ROOT, "src", "themes")

type ThemeField =
  | { key: string; label: string; type: "string"; default: string }
  | { key: string; label: string; type: "boolean"; default: boolean }
  | { key: string; label: string; type: "number"; default: number; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: "select"; options: string[]; default: string }

type ThemeModule = {
  id: string
  schema: { title: string; fields: ThemeField[] }
  defaults: Record<string, unknown>
  render: { Home: Function; Post: Function }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8"))
}

function fail(msg: string): never {
  throw new Error(msg)
}

function assertString(v: unknown, p: string) {
  if (typeof v !== "string" || v.length === 0) fail(`${p} must be a non-empty string`)
}

function normalizeThemeVars(theme: ThemeModule, storedVars: unknown) {
  const warnings: string[] = []
  const stored = isRecord(storedVars) ? storedVars : {}

  const out: Record<string, unknown> = { ...theme.defaults }

  for (const field of theme.schema.fields) {
    const key = field.key
    const def = theme.defaults[key]

    const v = stored[key]
    if (v === undefined) {
      out[key] = def
      continue
    }

    switch (field.type) {
      case "string":
        out[key] = typeof v === "string" ? v : (warnings.push(`"${key}" expected string`), def)
        break
      case "boolean":
        if (typeof v === "boolean") out[key] = v
        else if (typeof v === "string" && (v.toLowerCase() === "true" || v.toLowerCase() === "false")) {
          out[key] = v.toLowerCase() === "true"
          warnings.push(`"${key}" coerced from string`)
        } else {
          warnings.push(`"${key}" expected boolean`)
          out[key] = def
        }
        break
      case "number": {
        let num: number | undefined
        if (typeof v === "number" && !Number.isNaN(v)) num = v
        else if (typeof v === "string") {
          const n = Number(v)
          if (!Number.isNaN(n)) {
            num = n
            warnings.push(`"${key}" coerced from string`)
          }
        }
        if (num === undefined) {
          warnings.push(`"${key}" expected number`)
          out[key] = def
          break
        }
        if (field.min !== undefined) num = Math.max(field.min, num)
        if (field.max !== undefined) num = Math.min(field.max, num)
        out[key] = num
        break
      }
      case "select":
        if (typeof v === "string" && field.options.includes(v)) out[key] = v
        else {
          warnings.push(`"${key}" expected one of: ${field.options.join(", ")}`)
          out[key] = def
        }
        break
    }
  }

  // unknown keys
  for (const k of Object.keys(stored)) {
    if (!theme.schema.fields.some((f) => f.key === k)) warnings.push(`unknown theme var "${k}" ignored`)
  }

  return { vars: out, warnings }
}

async function importThemeFromFolder(folderName: string): Promise<ThemeModule> {
  const entryTs = path.join(THEMES_DIR, folderName, "index.ts")
  const entryTsx = path.join(THEMES_DIR, folderName, "index.tsx")
  const entryPath = fs.existsSync(entryTs) ? entryTs : entryTsx

  if (!fs.existsSync(entryPath)) fail(`Theme "${folderName}" is missing index.ts(x)`)

  const mod = await import(pathToFileURL(entryPath).href)
  if (!("theme" in mod)) fail(`Theme "${folderName}" index must export { theme }`)

  return mod.theme as ThemeModule
}

async function main() {
  const fix = process.argv.includes("--fix")

  console.log(`🔎 Validating settings.json…${fix ? " (fix mode)" : ""}`)

  if (!fs.existsSync(SETTINGS_PATH)) fail(`Missing: ${SETTINGS_PATH}`)

  const settings = readJson<SiteSettings>(SETTINGS_PATH)

  // basic shape checks
  assertString(settings.siteName, "siteName")
  if (!settings.permalinks || !isRecord(settings.permalinks)) fail(`permalinks must be an object`)
  assertString(settings.permalinks.post, "permalinks.post")

  if (!settings.theme || !isRecord(settings.theme)) fail(`theme must be an object`)
  assertString(settings.theme.active, "theme.active")

  // theme must exist
  const themeFolder = path.join(THEMES_DIR, settings.theme.active)
  if (!fs.existsSync(themeFolder)) {
    fail(`theme.active "${settings.theme.active}" does not match any folder in src/themes/`)
  }

  const theme = await importThemeFromFolder(settings.theme.active)

  // normalize & report
  const normalized = normalizeThemeVars(theme, settings.theme.vars)

  if (normalized.warnings.length) {
    console.warn("⚠️ Theme vars warnings:")
    for (const w of normalized.warnings) console.warn("  -", w)
  }

  const before = JSON.stringify(settings.theme.vars ?? {})
  const after = JSON.stringify(normalized.vars)

  if (fix && before !== after) {
    settings.theme.vars = normalized.vars

    fs.writeFileSync(
      SETTINGS_PATH,
      JSON.stringify(settings, null, 2) + "\n",
      "utf8"
    )

    console.log("🛠️ settings.json updated with normalized theme vars.")
  } else if (fix) {
    console.log("🛠️ settings.json already normalized. No changes.")
  }

  console.log(`✅ settings.json OK (theme: ${theme.id})`)
}

main().catch((e) => {
  console.error("❌ settings validation failed")
  console.error(e?.message ?? e)
  process.exit(1)
})
