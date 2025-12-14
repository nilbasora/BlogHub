import type { SiteSettings, PostsIndexItem } from "@/core/content/types"

export type ThemeField =
  | { key: string; label: string; type: "string"; default: string }
  | { key: string; label: string; type: "boolean"; default: boolean }
  | { key: string; label: string; type: "select"; options: string[]; default: string }
  | { key: string; label: string; type: "number"; default: number; min?: number; max?: number; step?: number }

export type ThemeSchema = {
  title: string
  fields: ThemeField[]
}

export type ThemeHomeProps = {
  settings: SiteSettings
  themeVars: Record<string, unknown>
  posts: PostsIndexItem[]
}

export type ThemePostProps = {
  settings: SiteSettings
  themeVars: Record<string, unknown>
  post: PostsIndexItem
  content: string
}

export type ThemeModule = {
  id: string
  schema: ThemeSchema
  defaults: Record<string, unknown>
  render: {
    Home: (props: ThemeHomeProps) => JSX.Element
    Post: (props: ThemePostProps) => JSX.Element
  }
}
