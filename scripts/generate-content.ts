import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import { globSync } from "glob"

import {
  SiteSettings,
  PostFrontmatter,
  PostsIndex,
  RoutesManifest,
} from "./types"
import { resolvePostPermalink } from "./permalink"
import { buildSearchText } from "./utils"

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, "content")
const POSTS_DIR = path.join(CONTENT_DIR, "posts")
const GENERATED_DIR = path.join(CONTENT_DIR, "generated")

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
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

  for (const file of postFiles) {
    const fullPath = path.join(POSTS_DIR, file)
    const raw = fs.readFileSync(fullPath, "utf8")
    const { data } = matter(raw)

    const post = data as PostFrontmatter
    if (!post.id || !post.slug || !post.date) {
      console.warn(`⚠️ Skipping invalid post: ${file}`)
      continue
    }

    const url = resolvePostPermalink(post, settings)

    routesManifest.routes[url] = `/content/posts/${file}`

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

  ensureDir(GENERATED_DIR)

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
