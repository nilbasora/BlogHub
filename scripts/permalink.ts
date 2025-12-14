import { PostFrontmatter, SiteSettings } from "./types"

export function resolvePostPermalink(
  post: PostFrontmatter,
  settings: SiteSettings
): string {
  const template = settings.permalinks.post

  const date = new Date(post.date)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date for post ${post.id}`)
  }

  const map: Record<string, string> = {
    ":year": date.getUTCFullYear().toString(),
    ":month": String(date.getUTCMonth() + 1).padStart(2, "0"),
    ":day": String(date.getUTCDate()).padStart(2, "0"),
    ":slug": post.slug,
    ":category": post.categories?.[0] ?? "",
  }

  let url = template
  for (const key in map) {
    url = url.replaceAll(key, map[key])
  }

  // normalize
  if (!url.startsWith("/")) url = "/" + url
  if (!url.endsWith("/")) url += "/"

  return url
}
