import type { ThemeModule } from "./types"
import { minimalTheme } from "@/themes/minimal"
import { cleanTheme } from "@/themes/clean"

const THEMES: ThemeModule[] = [minimalTheme, cleanTheme]

export function listThemes() {
  return THEMES
}

export function getThemeById(id: string): ThemeModule | undefined {
  return THEMES.find((t) => t.id === id)
}
