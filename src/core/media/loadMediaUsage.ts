import type { MediaUsage } from "@/core/utils/types"

export async function loadMediaUsage(): Promise<MediaUsage> {
  try {
    const res = await fetch("/content/generated/media-usage.json", { cache: "no-store" })
    if (!res.ok) throw new Error("media-usage not found")
    return (await res.json()) as MediaUsage
  } catch {
    return { version: 1, generatedAt: new Date().toISOString(), usage: {} }
  }
}
