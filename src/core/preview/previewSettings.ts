import type { SiteSettings } from "@/core/content/types"

const KEY = "bloghub.previewSettings"

export const PREVIEW_AUTO_KEY = "bloghub.previewAuto"

export function isPreviewMode(): boolean {
  const url = new URL(window.location.href)
  return url.searchParams.get("preview") === "true"
}

export function readPreviewSettings(): SiteSettings | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as SiteSettings
  } catch {
    return null
  }
}

export function writePreviewSettings(settings: SiteSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
}

export function clearPreviewSettings() {
  localStorage.removeItem(KEY)
}

export function previewSettingsStorageKey() {
  return KEY
}
