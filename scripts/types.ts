export type SiteSettings = {
  siteName: string
  tagline?: string
  siteUrl?: string
  permalinks: {
    post: string
  }
  theme: {
    active: string
    vars: Record<string, unknown>
  }
}

export type PostFrontmatter = {
  id: string
  title: string
  slug: string
  date: string
  status: "draft" | "published"
  excerpt?: string
  tags?: string[]
  categories?: string[]
}

export type PostsIndexItem = {
  id: string
  title: string
  slug: string
  url: string
  date: string
  excerpt?: string
  tags: string[]
  categories: string[]
  status: "draft" | "published"
  search: string
}

export type PostsIndex = {
  version: 1
  generatedAt: string
  posts: PostsIndexItem[]
}

export type RoutesManifest = {
  version: 1
  generatedAt: string
  routes: Record<string, string>
}
