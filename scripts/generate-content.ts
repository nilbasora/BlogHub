import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import matter from "gray-matter"
import { globSync } from "glob"

import {
  SiteSettings,
  PostFrontmatter,
  PostsIndex,
  RoutesManifest,
} from "@/core/domain/types"
import { resolvePostPermalink } from "./permalink"
import { buildSearchText } from "./utils"

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, "public")
const POSTS_DIR = path.join(CONTENT_DIR, "posts")
const GENERATED_DIR = path.join(CONTENT_DIR, "generated")
const GENERATED_POSTS_DIR = path.join(GENERATED_DIR, "posts")
const CACHE_PATH = path.join(GENERATED_DIR, ".content-cache.json")

type ContentCache = {
  version: 1
  posts: Record<string, { hash: string }>
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null
  return readJson<T>(filePath)
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function hashText(text: string): string {
  return crypto.createHash("sha1").update(text).digest("hex")
}

function writeIfChanged(filePath: string, content: string): boolean {
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, "utf8")
    if (current === content) return false
  }
  fs.writeFileSync(filePath, content, "utf8")
  return true
}

function main() {
  console.log("ðŸ“¦ Generating contentâ€¦")

  const settings = readJson<SiteSettings>(
    path.join(CONTENT_DIR, "site/settings.json")
  )

  const postFiles = globSync("**/*.md", { cwd: POSTS_DIR }).sort()
  const cache =
    readJsonIfExists<ContentCache>(CACHE_PATH) ?? { version: 1, posts: {} }
  const previousPosts = cache.posts ?? {}
  const currentSet = new Set(postFiles)
  const nextCache: ContentCache = { version: 1, posts: {} }
  let changed = false

  const postsIndex: PostsIndex = {
    version: 1,
    generatedAt: "",
    posts: [],
  }

  const routesManifest: RoutesManifest = {
    version: 1,
    generatedAt: "",
    routes: {},
  }

  ensureDir(GENERATED_DIR)
  ensureDir(GENERATED_POSTS_DIR)

  for (const oldFile of Object.keys(previousPosts)) {
    if (currentSet.has(oldFile)) continue
    const safeName = oldFile.replaceAll("/", "__")
    const generatedDiskPath = path.join(GENERATED_POSTS_DIR, safeName)
    if (fs.existsSync(generatedDiskPath)) {
      fs.rmSync(generatedDiskPath, { force: true })
    }
    changed = true
  }

  for (const file of postFiles) {
    const fullPath = path.join(POSTS_DIR, file)
    const raw = fs.readFileSync(fullPath, "utf8")
    const hash = hashText(raw)
    nextCache.posts[file] = { hash }
    if (previousPosts[file]?.hash !== hash) changed = true

    // Parse frontmatter in Node (build-time), not in browser
    const parsed = matter(raw)
    const post = parsed.data as PostFrontmatter

    if (!post.id || !post.slug || !post.date) {
      console.warn(`âš ï¸ Skipping invalid post: ${file}`)
      continue
    }

    const url = resolvePostPermalink(post, settings)

    // Flatten nested folders if any (safe filename for output)
    const safeName = file.replaceAll("/", "__")

    // URL path (what the browser/static route should fetch) â€” no "/public"
    const generatedUrlPath = `/generated/posts/${safeName}`

    // Disk path (where the file is actually written) â€” inside /public
    const generatedDiskPath = path.join(GENERATED_POSTS_DIR, safeName)

    // Write body-only markdown copy (no frontmatter) into public/generated/posts/
    const body = parsed.content.trimStart()
    if (writeIfChanged(generatedDiskPath, body)) changed = true

    // Manifest points to URL path (browser-friendly)
    routesManifest.routes[url] = generatedUrlPath

    postsIndex.posts.push({
      id: post.id,
      title: post.title,
      slug: post.slug,
      url,
      date: post.date,
      excerpt: post.excerpt,
      tags: post.tags ?? [],
      categories: post.categories ?? [],
      status: post.status,
      search: buildSearchText([
        post.title,
        post.excerpt,
        ...(post.tags ?? []),
        ...(post.categories ?? []),
      ]),
    })
  }

  const prevPostsIndex = readJsonIfExists<PostsIndex>(
    path.join(GENERATED_DIR, "posts-index.json")
  )
  const prevRoutesManifest = readJsonIfExists<RoutesManifest>(
    path.join(GENERATED_DIR, "routes-manifest.json")
  )

  const generatedAt = changed
    ? new Date().toISOString()
    : prevPostsIndex?.generatedAt ?? new Date().toISOString()

  postsIndex.generatedAt = generatedAt
  routesManifest.generatedAt = changed
    ? generatedAt
    : prevRoutesManifest?.generatedAt ?? generatedAt

  writeIfChanged(
    path.join(GENERATED_DIR, "posts-index.json"),
    JSON.stringify(postsIndex, null, 2)
  )

  writeIfChanged(
    path.join(GENERATED_DIR, "routes-manifest.json"),
    JSON.stringify(routesManifest, null, 2)
  )

  writeIfChanged(CACHE_PATH, JSON.stringify(nextCache, null, 2))

  console.log("âœ… Content generated")
}

main()
