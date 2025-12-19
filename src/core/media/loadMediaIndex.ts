import type { MediaIndex } from "./types"

export async function loadMediaIndex(): Promise<MediaIndex> {
  try {
    const res = await fetch("/content/generated/media-index.json", { cache: "no-store" })
    if (!res.ok) throw new Error("media-index not found")
    return (await res.json()) as MediaIndex
  } catch {
    return { version: 1, generatedAt: new Date().toISOString(), items: [] }
  }
}
