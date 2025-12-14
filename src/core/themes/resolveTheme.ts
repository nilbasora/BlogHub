import type { SiteSettings } from "@/core/content/types"
import type { ThemeModule } from "./types"
import { getThemeById } from "./registry"

export function resolveTheme(settings: SiteSettings): {
  theme: ThemeModule
  vars: Record<string, unknown>
} {
  const id = settings.theme?.active ?? "minimal"
  const theme = getThemeById(id) ?? getThemeById("minimal")!

  // Merge defaults + stored vars (stored vars override defaults)
  const vars = { ...theme.defaults, ...(settings.theme?.vars ?? {}) }

  return { theme, vars }
}
