import type { PostsIndexItem } from "@/core/domain/types"
import { buildSearchText } from "./buildSearchText"

export function searchPosts(posts: PostsIndexItem[], query: string): PostsIndexItem[] {
  const q = buildSearchText([query])
  if (!q) return posts
  return posts.filter((post) => {
    const haystack = post.search || buildSearchText([
      post.title,
      post.excerpt,
      ...(post.tags ?? []),
      ...(post.categories ?? []),
    ])
    return haystack.includes(q)
  })
}
