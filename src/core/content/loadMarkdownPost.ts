import { withBase } from "@/core/config/paths"

export async function loadMarkdownPost(markdownPath: string): Promise<string> {
  const res = await fetch(withBase(markdownPath))
  if (!res.ok) throw new Error(`Failed to load markdown: ${markdownPath}`)
  return res.text()
}
