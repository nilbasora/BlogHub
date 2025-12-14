import type { RoutesManifest } from "./types"
import { withBase } from "@/core/config/paths"

export async function loadRoutesManifest(): Promise<RoutesManifest> {
  const res = await fetch(withBase("content/generated/routes-manifest.json"))
  if (!res.ok) throw new Error("Failed to load routes-manifest.json")
  return res.json()
}
