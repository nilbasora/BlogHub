import type { SiteSettings } from "@/core/utils/types"
import { withBase } from "@/core/config/paths"

export async function loadSettings(): Promise<SiteSettings> {
  const res = await fetch(withBase("site/settings.json"))
  if (!res.ok) throw new Error("Failed to load settings.json")
  return res.json()
}
