import type { ReactElement } from "react"

// ----------------------------
// Shared helpers
// ----------------------------
export type ISODateString = string

export type GeneratedManifest<V extends number = 1> = {
  version: V
  generatedAt: ISODateString
}

export type UnknownRecord = Record<string, unknown>

// ----------------------------
// Settings
// ----------------------------
export type SiteSettings = {
  siteName?: string
  tagline?: string
  siteUrl?: string
  language?: string
  logo?: string
  favicon?: string
  cd?: boolean
  indexCategories?: boolean
  permalinks: {
    post: string
  }
  theme: {
    active: string
    vars: UnknownRecord
  }
}

// ----------------------------
// Posts
// ----------------------------
export type PostStatus = "draft" | "published"

export type PostFrontmatter = {
  id: string
  title: string
  slug: string
  date: ISODateString
  status: PostStatus

  excerpt?: string
  tags?: string[]
  categories?: string[]

  featured_image?: string | null
  seo_title?: string | null
  seo_description?: string | null
}

export type PostsIndexItem = PostFrontmatter & {
  url: string

  // normalized fields (always present in index)
  tags: string[]
  categories: string[]

  // SEO fields may be normalized to null
  featured_image?: string | null
  seo_title?: string | null
  seo_description?: string | null

  search: string
}

export type PostsIndex = GeneratedManifest<1> & {
  posts: PostsIndexItem[]
}

// ----------------------------
// Routes
// ----------------------------
export type RoutesManifest = GeneratedManifest<1> & {
  routes: Record<string, string> // url -> markdown path
}

// ----------------------------
// Markdown parsing
// ----------------------------
export type ParsedMarkdownPost = {
  frontmatter: UnknownRecord
  content: string
}

// ----------------------------
// Media
// ----------------------------
export type MediaType = "image" | "video" | "gif" | "other"

export type MediaIndexItem = {
  path: string // e.g. "/media/foo.png"
  type: MediaType
  createdAt?: ISODateString
}

export type MediaIndex = GeneratedManifest<number> & {
  items: MediaIndexItem[]
}

export type MediaUsage = GeneratedManifest<number> & {
  usage: Record<string, string[]> // path -> [postId...]
}

// UI model
export type MediaRow = MediaIndexItem & {
  usedBy: string[]
}

// ----------------------------
// Theme module API
// ----------------------------
export type ThemeField =
  | { key: string; label: string; type: "string"; default: string }
  | { key: string; label: string; type: "boolean"; default: boolean }
  | { key: string; label: string; type: "select"; options: string[]; default: string }
  | {
      key: string
      label: string
      type: "number"
      default: number
      min?: number
      max?: number
      step?: number
    }

export type ThemeSchema = {
  title: string
  fields: ThemeField[]
}

export type ThemeVars = UnknownRecord

export type ThemeHomeProps = {
  settings: SiteSettings
  themeVars: ThemeVars
  posts: PostsIndexItem[]
}

export type ThemePostProps = {
  settings: SiteSettings
  themeVars: ThemeVars
  post: PostsIndexItem
  content: string
}

export type ThemeModule = {
  id: string
  schema: ThemeSchema
  defaults: ThemeVars
  render: {
    Home: (props: ThemeHomeProps) => ReactElement
    Post: (props: ThemePostProps) => ReactElement
  }
}
