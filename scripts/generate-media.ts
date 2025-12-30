// scripts/generate-media-index.ts
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import matter from "gray-matter"
import { globSync } from "glob"
import { imageSize } from "image-size"

import type {
  ISODateString,
  MediaIndex,
  MediaIndexItem,
  MediaType,
  PostFrontmatter,
} from "@/core/utils/types"

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, "public")
const POSTS_DIR = path.join(CONTENT_DIR, "posts")
const MEDIA_DIR = path.join(CONTENT_DIR, "media")
const GENERATED_DIR = path.join(CONTENT_DIR, "generated")

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function toPosix(p: string) {
  return p.split(path.sep).join("/")
}

function stripQueryAndHash(p: string) {
  return p.split("?")[0]!.split("#")[0]!
}

function mediaTypeFromExt(filePath: string): MediaType {
  const ext = path.extname(filePath).toLowerCase()
  if ([".png", ".jpg", ".jpeg", ".webp", ".avif", ".bmp", ".tif", ".tiff", ".svg"].includes(ext))
    return "image"
  if (ext === ".gif") return "gif"
  if ([".mp4", ".webm", ".mov", ".m4v", ".mkv", ".avi"].includes(ext)) return "video"
  return "other"
}

function makeStableId(mediaUrlPath: string) {
  // Stable ID across machines/runs: based on URL-ish path
  return crypto.createHash("sha1").update(mediaUrlPath).digest("hex")
}

function normalizeMediaUrlPath(urlPath: string): string {
  const p = stripQueryAndHash(urlPath).trim()
  if (p.startsWith("/media/")) return p
  if (p.startsWith("media/")) return `/${p}`
  return p
}

function extractMediaRefsFromText(text: string): string[] {
  // Finds /media/... references in markdown/html/frontmatter text
  const matches = text.match(/\/media\/[^\s"')>\]]+/g) ?? []
  return matches.map(stripQueryAndHash)
}

function getImageDimensions(absPath: string): { width?: number; height?: number } {
  const ext = path.extname(absPath).toLowerCase()
  // SVG dimensions are not reliably inferable without parsing viewBox; skip
  if (ext === ".svg") return {}

  try {
    const dim = imageSize(absPath)
    return {
      width: typeof dim.width === "number" ? dim.width : undefined,
      height: typeof dim.height === "number" ? dim.height : undefined,
    }
  } catch {
    return {}
  }
}

function mainSyncPart(): {
  mediaFilesRelPosix: string[]
  usedByByMediaUrlPath: Map<string, Set<string>>
} {
  // 1) list media files
  const mediaFilesRel = globSync("**/*", {
    cwd: MEDIA_DIR,
    nodir: true,
    dot: false,
  })
  const mediaFilesRelPosix = mediaFilesRel.map(toPosix)

  // 2) scan posts to map /media/... -> Set<postId>
  const postFiles = globSync("**/*.md", { cwd: POSTS_DIR })
  const usedByByMediaUrlPath = new Map<string, Set<string>>()

  for (const file of postFiles) {
    const fullPath = path.join(POSTS_DIR, file)
    const raw = fs.readFileSync(fullPath, "utf8")
    const parsed = matter(raw)
    const fm = parsed.data as PostFrontmatter
    const postId = (fm as any)?.id as string | undefined
    if (!postId) continue

    const refs = new Set<string>()

    // featured_image can be anything; only track if it points into /media/
    const featured = (fm as any)?.featured_image as string | undefined
    if (typeof featured === "string" && featured.includes("/media/")) {
      for (const r of extractMediaRefsFromText(featured)) refs.add(normalizeMediaUrlPath(r))
    }

    // body references
    for (const r of extractMediaRefsFromText(parsed.content)) {
      refs.add(normalizeMediaUrlPath(r))
    }

    for (const ref of refs) {
      if (!ref.startsWith("/media/")) continue
      if (!usedByByMediaUrlPath.has(ref)) usedByByMediaUrlPath.set(ref, new Set())
      usedByByMediaUrlPath.get(ref)!.add(postId)
    }
  }

  return { mediaFilesRelPosix, usedByByMediaUrlPath }
}

function main() {
  console.log("📦 Generating media index…")

  ensureDir(GENERATED_DIR)

  const { mediaFilesRelPosix, usedByByMediaUrlPath } = mainSyncPart()

  const index: MediaIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    items: [],
  }

  for (const relPosix of mediaFilesRelPosix) {
    const absPath = path.join(MEDIA_DIR, relPosix)
    const urlPath = `/media/${relPosix}`

    const st = fs.statSync(absPath)
    const type = mediaTypeFromExt(absPath)
    const id = makeStableId(urlPath)
    const usedBy = Array.from(usedByByMediaUrlPath.get(urlPath) ?? []).sort()

    // Always include these fields
    const item: MediaIndexItem = {
      id,
      path: urlPath,
      type,
      usedBy,
      createdAt: (st.birthtime ?? st.ctime)?.toISOString?.() as ISODateString | undefined,
    }

    // For videos: do NOT add size/width/height
    if (type === "image" || type === "gif") {
      const dims = getImageDimensions(absPath)
      item.size = typeof st.size === "number" ? st.size : undefined
      item.width = dims.width
      item.height = dims.height
    }

    // For "other": include size + createdAt (but no width/height)
    if (type === "other") {
      item.size = typeof st.size === "number" ? st.size : undefined
    }

    index.items.push(item)
  }

  // Stable output order
  index.items.sort((a, b) => a.path.localeCompare(b.path))

  fs.writeFileSync(
    path.join(GENERATED_DIR, "media-index.json"),
    JSON.stringify(index, null, 2),
    "utf8"
  )

  console.log(`✅ Media index generated: ${index.items.length} items`)
}

main()
