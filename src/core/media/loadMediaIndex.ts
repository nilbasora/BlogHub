import type { MediaIndex } from "@/core/utils/types"
import { withBase } from "@/core/config/paths"

export async function loadMediaIndex(): Promise<MediaIndex> {
  const res = await fetch(withBase("generated/media-index.json"))
  if (!res.ok) throw new Error("Failed to load media-index.json")
  return res.json()
}
