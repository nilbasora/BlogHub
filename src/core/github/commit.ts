import type { SiteSettings } from "@/core/content/types"
import { deleteFile, putBinaryFile, putJsonFile, putTextFile, repoPathFromPublicUrl } from "./contents"

function fmValue(v: unknown) {
  // YAML-ish value output (simple + safe for your frontmatter)
  if (typeof v === "string") return JSON.stringify(v)
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (v == null) return "null"
  return JSON.stringify(v)
}

export function serializePostMd(frontmatter: Record<string, unknown>, body: string) {
  const lines = Object.entries(frontmatter).map(([k, v]) => `${k}: ${fmValue(v)}`)
  return `---\n${lines.join("\n")}\n---\n\n${body.trim()}\n`
}

/** SETTINGS */
export async function commitSiteSettings(settings: SiteSettings, branch?: string) {
  return putJsonFile({
    repoFilePath: "content/site/settings.json",
    json: settings,
    message: "chore: update site settings",
    branch,
  })
}

export async function commitThemeSettings(settings: SiteSettings, branch?: string) {
  return putJsonFile({
    repoFilePath: "content/site/settings.json",
    json: settings,
    message: "chore: update theme settings",
    branch,
  })
}

/** POSTS */
export async function commitPostMd(opts: {
  repoMdPath: string // e.g. "content/posts/hello-world.md"
  frontmatter: Record<string, unknown>
  body: string
  message: string
}) {
  const md = serializePostMd(opts.frontmatter, opts.body)
  return putTextFile({
    repoFilePath: opts.repoMdPath,
    content: md,
    message: opts.message,
  })
}

export async function deletePostMd(repoMdPath: string) {
  return deleteFile({
    repoFilePath: repoMdPath,
    message: "chore: delete post",
  })
}

/** MEDIA */
export async function commitMediaFile(opts: {
  publicPath: string // "/media/foo.png"
  file: File
  message?: string
}) {
  const repoFilePath = repoPathFromPublicUrl(opts.publicPath)
  return putBinaryFile({
    repoFilePath,
    file: opts.file,
    message: opts.message || `chore: upload media ${opts.publicPath}`,
  })
}

export async function deleteMediaFile(publicPath: string) {
  const repoFilePath = repoPathFromPublicUrl(publicPath)
  return deleteFile({
    repoFilePath,
    message: `chore: delete media ${publicPath}`,
  })
}
