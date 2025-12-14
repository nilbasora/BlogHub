import type { ThemeModule, ThemeField } from "./types"

type NormalizeResult = {
  vars: Record<string, unknown>
  warnings: string[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function coerceFieldValue(
  field: ThemeField,
  value: unknown,
  defaultValue: unknown
): { value: unknown; warning?: string } {
  const key = field.key

  // missing -> default
  if (value === undefined) return { value: defaultValue }

  switch (field.type) {
    case "string": {
      if (typeof value === "string") return { value }
      return { value: defaultValue, warning: `theme var "${key}" expected string` }
    }

    case "boolean": {
      if (typeof value === "boolean") return { value }
      // allow "true"/"false" as a mild convenience
      if (typeof value === "string") {
        if (value.toLowerCase() === "true") return { value: true, warning: `theme var "${key}" coerced from string` }
        if (value.toLowerCase() === "false") return { value: false, warning: `theme var "${key}" coerced from string` }
      }
      return { value: defaultValue, warning: `theme var "${key}" expected boolean` }
    }

    case "number": {
      if (typeof value === "number" && !Number.isNaN(value)) {
        let v = value
        if (field.min !== undefined) v = Math.max(field.min, v)
        if (field.max !== undefined) v = Math.min(field.max, v)
        return { value: v }
      }

      // allow numeric strings
      if (typeof value === "string") {
        const n = Number(value)
        if (!Number.isNaN(n)) {
          let v = n
          if (field.min !== undefined) v = Math.max(field.min, v)
          if (field.max !== undefined) v = Math.min(field.max, v)
          return { value: v, warning: `theme var "${key}" coerced from string` }
        }
      }

      return { value: defaultValue, warning: `theme var "${key}" expected number` }
    }

    case "select": {
      if (typeof value === "string" && field.options.includes(value)) return { value }
      return {
        value: defaultValue,
        warning: `theme var "${key}" expected one of: ${field.options.join(", ")}`,
      }
    }
  }
}

export function normalizeThemeVars(
  theme: ThemeModule,
  storedVars: unknown
): NormalizeResult {
  const warnings: string[] = []

  const stored = isRecord(storedVars) ? storedVars : {}
  if (!isRecord(storedVars) && storedVars !== undefined) {
    warnings.push(`settings.theme.vars was not an object; ignored`)
  }

  // Start from defaults, then fill/validate each schema key
  const out: Record<string, unknown> = { ...theme.defaults }

  for (const field of theme.schema.fields) {
    const def = theme.defaults[field.key]
    const { value, warning } = coerceFieldValue(field, stored[field.key], def)
    out[field.key] = value
    if (warning) warnings.push(warning)
  }

  // Drop unknown keys (but warn)
  for (const k of Object.keys(stored)) {
    const known = theme.schema.fields.some((f) => f.key === k)
    if (!known) warnings.push(`unknown theme var "${k}" ignored`)
  }

  return { vars: out, warnings }
}
