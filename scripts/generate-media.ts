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
} from "@/core/domain/types"

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, "public")
const POSTS_DIR = path.join(CONTENT_DIR, "posts")
const MEDIA_DIR = path.join(CONTENT_DIR, "media")
const GENERATED_DIR = path.join(CONTENT_DIR, "generated")
const CACHE_PATH = path.join(GENERATED_DIR, ".media-cache.json")

type MediaCache = {
  version: 1
  files: Record<
    string,
    { hash: string; type: MediaType; size?: number; width?: number; height?: number }
  >
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T
}

function writeIfChanged(filePath: string, content: string): boolean {
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, "utf8")
    if (current === content) return false
  }
  fs.writeFileSync(filePath, content, "utf8")
  return true
}

function hashFile(absPath: string): string {
  const buf = fs.readFileSync(absPath)
  return crypto.createHash("sha1").update(buf).digest("hex")
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
  const mediaFilesRelPosix = mediaFilesRel.map(toPosix).sort()

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
  console.log("ðŸ“¦ Generating media indexâ€¦")

  ensureDir(GENERATED_DIR)

  const cache =
    readJsonIfExists<MediaCache>(CACHE_PATH) ?? { version: 1, files: {} }
  const nextCache: MediaCache = { version: 1, files: {} }

  const { mediaFilesRelPosix, usedByByMediaUrlPath } = mainSyncPart()

  const index: MediaIndex = {
    version: 1,
    generatedAt: "",
    items: [],
  }

  for (const relPosix of mediaFilesRelPosix) {
    const absPath = path.join(MEDIA_DIR, relPosix)
    const urlPath = `/media/${relPosix}`

    const st = fs.statSync(absPath)
    const type = mediaTypeFromExt(absPath)
    const id = makeStableId(urlPath)
    const usedBy = Array.from(usedByByMediaUrlPath.get(urlPath) ?? []).sort()

    const hash = hashFile(absPath)
    const cached = cache.files[relPosix]

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
      const reuseDims = cached && cached.hash === hash && cached.type === type
      const dims = reuseDims ? { width: cached.width, height: cached.height } : getImageDimensions(absPath)
      item.size = typeof st.size === "number" ? st.size : undefined
      item.width = dims.width
      item.height = dims.height
    }

    // For "other": include size + createdAt (but no width/height)
    if (type === "other") {
      item.size = typeof st.size === "number" ? st.size : undefined
    }

    nextCache.files[relPosix] = {
      hash,
      type,
      size: item.size,
      width: item.width,
      height: item.height,
    }

    index.items.push(item)
  }

  // Stable output order
  index.items.sort((a, b) => a.path.localeCompare(b.path))

  const prevIndex = readJsonIfExists<MediaIndex>(path.join(GENERATED_DIR, "media-index.json"))
  const nextFingerprint = JSON.stringify({ version: index.version, items: index.items })
  const prevFingerprint = prevIndex ? JSON.stringify({ version: prevIndex.version, items: prevIndex.items }) : null
  index.generatedAt =
    prevFingerprint && prevFingerprint === nextFingerprint
      ? prevIndex?.generatedAt ?? new Date().toISOString()
      : new Date().toISOString()

  writeIfChanged(
    path.join(GENERATED_DIR, "media-index.json"),
    JSON.stringify(index, null, 2)
  )

  writeIfChanged(CACHE_PATH, JSON.stringify(nextCache, null, 2))

  console.log(`âœ… Media index generated: ${index.items.length} items`)
}

main()
