import type { SiteSettings } from "./types"
import { withBase } from "@/core/config/paths"

export async function loadSettings(): Promise<SiteSettings> {
  const res = await fetch(withBase("content/site/settings.json"))
  if (!res.ok) throw new Error("Failed to load settings.json")
  return res.json()
}
