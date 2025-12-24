import type { PostsIndex } from "@/core/utils/types"
import { withBase } from "@/core/config/paths"

export async function loadPostsIndex(): Promise<PostsIndex> {
  const res = await fetch(withBase("content/generated/posts-index.json"))
  if (!res.ok) throw new Error("Failed to load posts-index.json")
  return res.json()
}
