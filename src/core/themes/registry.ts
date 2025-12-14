import type { ThemeModule } from "./types"
import { theme as minimal } from "@/themes/minimal"
import { theme as clean } from "@/themes/clean"

const THEMES: ThemeModule[] = [minimal, clean]

export function listThemes() {
  return THEMES
}

export function getThemeById(id: string): ThemeModule | undefined {
  return THEMES.find((t) => t.id === id)
}
