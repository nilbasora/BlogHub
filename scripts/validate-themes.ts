import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = process.cwd()
const THEMES_DIR = path.join(ROOT, "src", "themes")

type ThemeField =
  | { key: string; label: string; type: "string"; default: string }
  | { key: string; label: string; type: "boolean"; default: boolean }
  | { key: string; label: string; type: "number"; default: number; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: "select"; options: string[]; default: string }

type ThemeSchema = {
  title: string
  fields: ThemeField[]
}

type ThemeModule = {
  id: string
  schema: ThemeSchema
  defaults: Record<string, unknown>
  render: {
    Home: Function
    Post: Function
  }
}

function isDir(p: string) {
  return fs.existsSync(p) && fs.statSync(p).isDirectory()
}

function hasIndexFile(themePath: string) {
  return fs.existsSync(path.join(themePath, "index.ts")) || fs.existsSync(path.join(themePath, "index.tsx"))
}

function fail(msg: string) {
  throw new Error(msg)
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function assertString(v: unknown, path: string) {
  if (typeof v !== "string" || v.length === 0) fail(`${path} must be a non-empty string`)
}

function assertBoolean(v: unknown, path: string) {
  if (typeof v !== "boolean") fail(`${path} must be boolean`)
}

function assertNumber(v: unknown, path: string) {
  if (typeof v !== "number" || Number.isNaN(v)) fail(`${path} must be a number`)
}

function assertFunction(v: unknown, path: string) {
  if (typeof v !== "function") fail(`${path} must be a function`)
}

function validateField(field: unknown, idx: number) {
  const p = `schema.fields[${idx}]`
  if (!isObject(field)) fail(`${p} must be an object`)

  assertString(field.key, `${p}.key`)
  assertString(field.label, `${p}.label`)
  assertString(field.type, `${p}.type`)

  const type = field.type as string

  if (type === "string") {
    assertString(field.default, `${p}.default`)
    return field as ThemeField
  }

  if (type === "boolean") {
    assertBoolean(field.default, `${p}.default`)
    return field as ThemeField
  }

  if (type === "number") {
    assertNumber(field.default, `${p}.default`)
    if ("min" in field && field.min !== undefined) assertNumber(field.min, `${p}.min`)
    if ("max" in field && field.max !== undefined) assertNumber(field.max, `${p}.max`)
    if ("step" in field && field.step !== undefined) assertNumber(field.step, `${p}.step`)
    return field as ThemeField
  }

  if (type === "select") {
    if (!Array.isArray(field.options) || field.options.length === 0 || !field.options.every((o) => typeof o === "string")) {
      fail(`${p}.options must be a non-empty string[]`)
    }
    assertString(field.default, `${p}.default`)
    if (!field.options.includes(field.default as string)) {
      fail(`${p}.default must be one of options`)
    }
    return field as ThemeField
  }

  fail(`${p}.type must be one of: string | boolean | number | select`)
}

function validateThemeModule(theme: unknown, folderName: string): ThemeModule {
  if (!isObject(theme)) fail(`theme export must be an object`)

  assertString(theme.id, "id")
  if (theme.id !== folderName) fail(`theme.id must equal folder name "${folderName}" (got "${theme.id}")`)

  if (!isObject(theme.schema)) fail(`schema must be an object`)
  assertString(theme.schema.title, "schema.title")

  if (!Array.isArray(theme.schema.fields)) fail(`schema.fields must be an array`)
  const fields = theme.schema.fields.map((f, i) => validateField(f, i))

  // check duplicate keys
  const keys = new Set<string>()
  for (const f of fields) {
    if (keys.has(f.key)) fail(`Duplicate schema field key "${f.key}"`)
    keys.add(f.key)
  }

  if (!isObject(theme.defaults)) fail(`defaults must be an object`)

  // defaults must include all schema keys
  for (const k of keys) {
    if (!(k in theme.defaults)) fail(`defaults missing key "${k}" declared in schema.fields`)
  }

  if (!isObject(theme.render)) fail(`render must be an object`)
  assertFunction(theme.render.Home, "render.Home")
  assertFunction(theme.render.Post, "render.Post")

  return theme as ThemeModule
}

async function main() {
  if (!isDir(THEMES_DIR)) {
    console.error(`❌ Themes folder not found: ${THEMES_DIR}`)
    process.exit(1)
  }

  const entries = fs.readdirSync(THEMES_DIR)
  const themeFolders = entries
    .map((name) => ({ name, full: path.join(THEMES_DIR, name) }))
    .filter((e) => isDir(e.full))
    .filter((e) => !e.name.startsWith("_") && !e.name.startsWith("."))

  if (themeFolders.length === 0) {
    console.warn("⚠️ No themes found.")
    return
  }

  console.log(`🔎 Validating ${themeFolders.length} theme(s)…`)

  const ids = new Set<string>()
  let okCount = 0

  for (const t of themeFolders) {
    try {
      if (!hasIndexFile(t.full)) {
        console.error(`❌ ${t.name}: missing index.ts or index.tsx`)
        process.exitCode = 1
        continue
      }

      // Prefer index.ts, fall back to index.tsx
      const entryPath =
        fs.existsSync(path.join(t.full, "index.ts"))
          ? path.join(t.full, "index.ts")
          : path.join(t.full, "index.tsx")

      const mod = await import(pathToFileURL(entryPath).href)

      if (!("theme" in mod)) {
        console.error(`❌ ${t.name}: index must export { theme }`)
        process.exitCode = 1
        continue
      }

      const theme = validateThemeModule(mod.theme, t.name)

      if (ids.has(theme.id)) {
        console.error(`❌ Duplicate theme id "${theme.id}"`)
        process.exitCode = 1
        continue
      }
      ids.add(theme.id)

      okCount++
      console.log(`✅ ${t.name} OK`)
    } catch (err: any) {
      console.error(`❌ ${t.name}: ${err?.message ?? String(err)}`)
      process.exitCode = 1
    }
  }

  if (process.exitCode) {
    console.error(`\n❌ Theme validation failed (${okCount}/${themeFolders.length} passed).`)
    process.exit(1)
  }

  console.log(`\n✅ All themes valid (${okCount}/${themeFolders.length}).`)
}

main().catch((e) => {
  console.error("❌ validate-themes crashed")
  console.error(e)
  process.exit(1)
})
