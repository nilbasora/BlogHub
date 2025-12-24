import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import { globSync } from "glob"

import {
  SiteSettings,
  PostFrontmatter,
  PostsIndex,
  RoutesManifest,
} from "@/core/utils/types"
import { resolvePostPermalink } from "./permalink"
import { buildSearchText } from "./utils"

const ROOT = process.cwd()
const POSTS_DIR = path.join(ROOT, "posts")
const GENERATED_DIR = path.join(ROOT, "generated")
const GENERATED_POSTS_DIR = path.join(GENERATED_DIR, "posts")

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function ensureCleanDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

function main() {
  console.log("📦 Generating content…")

  const settings = readJson<SiteSettings>(
    path.join(CONTENT_DIR, "site/settings.json")
  )

  const postFiles = globSync("**/*.md", { cwd: POSTS_DIR })

  const postsIndex: PostsIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    posts: [],
  }

  const routesManifest: RoutesManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    routes: {},
  }

  ensureDir(GENERATED_DIR)
  ensureCleanDir(GENERATED_POSTS_DIR)

  for (const file of postFiles) {
    const fullPath = path.join(POSTS_DIR, file)
    const raw = fs.readFileSync(fullPath, "utf8")

    // Parse frontmatter in Node (build-time), not in browser
    const parsed = matter(raw)
    const post = parsed.data as PostFrontmatter

    if (!post.id || !post.slug || !post.date) {
      console.warn(`⚠️ Skipping invalid post: ${file}`)
      continue
    }

    const url = resolvePostPermalink(post, settings)

    // Write body-only markdown copy (no frontmatter) into public/generated/posts/
    const safeName = file.replaceAll("/", "__") // flatten nested folders if any
    const generatedBodyPath = `public/generated/posts/${safeName}`

    fs.writeFileSync(
      path.join(ROOT, generatedBodyPath),
      parsed.content.trimStart(),
      "utf8"
    )

    // Manifest points to generated body markdown (browser-friendly)
    routesManifest.routes[url] = `/${generatedBodyPath}`

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

  fs.writeFileSync(
    path.join(GENERATED_DIR, "posts-index.json"),
    JSON.stringify(postsIndex, null, 2)
  )

  fs.writeFileSync(
    path.join(GENERATED_DIR, "routes-manifest.json"),
    JSON.stringify(routesManifest, null, 2)
  )

  console.log("✅ Content generated")
}

main()
