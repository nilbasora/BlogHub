import type { ThemeModule, SiteSettings } from "@/core/utils/types"
import { getThemeById } from "./registry"
import { normalizeThemeVars } from "./validateVars"

export function resolveTheme(settings: SiteSettings): {
  theme: ThemeModule
  vars: Record<string, unknown>
  warnings: string[]
} {
  const id = settings.theme?.active ?? "minimal"
  const theme = getThemeById(id) ?? getThemeById("minimal")!

  const normalized = normalizeThemeVars(theme, settings.theme?.vars)

  return {
    theme,
    vars: normalized.vars,
    warnings: normalized.warnings,
  }
}
