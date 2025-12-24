import { createFileRoute, notFound } from "@tanstack/react-router"
import { loadRoutesManifest } from "@/core/content/loadRoutesManifest"
import { loadPostsIndex } from "@/core/content/loadPostsIndex"
import { loadMarkdownPost } from "@/core/content/loadMarkdownPost"
import { loadSettings } from "@/core/content/loadSettings"
import { resolveTheme } from "@/core/themes/resolveTheme"
import { usePreviewSettings } from "@/core/preview/PreviewSettingsProvider"
import { isPreviewMode } from "@/core/preview/previewSettings"
import { readPreviewPostDraft } from "@/core/preview/previewPost"
import type { PostsIndexItem, PostStatus } from "@/core/utils/types"
import { useSiteSettingsForSeo } from "@/core/seo/SeoProvider"
import { useSeo } from "@/core/seo/useSeo"

export const Route = createFileRoute("/$")({
  loader: async ({ params }) => {
    const splat = params._splat ?? ""
    const pathname = "/" + splat
    const normalized = pathname.endsWith("/") ? pathname : pathname + "/"

    // Always load repo state (used as fallback + needed for theme)
    const [settings, manifest, index] = await Promise.all([
      loadSettings(),
      loadRoutesManifest(),
      loadPostsIndex(),
    ])

    // ✅ Preview draft support:
    // If ?preview=true&postPreview=<id> and localStorage has the draft,
    // and the current path matches the draft url, render draft instead of repo content.
    if (typeof window !== "undefined" && isPreviewMode()) {
      const url = new URL(window.location.href)
      const previewId = url.searchParams.get("postPreview")
      const draft = readPreviewPostDraft()

      if (previewId && draft && (draft.id === previewId || draft.frontmatter?.id === previewId)) {
        const draftUrl = draft.url?.endsWith("/") ? draft.url : (draft.url ?? "") + "/"
        if (draftUrl === normalized) {
          const fm = (draft.frontmatter ?? {}) as Record<string, unknown>

          const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : []
          const categories = Array.isArray(fm.categories) ? fm.categories.map(String) : []

          const status: PostStatus =
            fm.status === "published" || fm.status === "draft"
              ? (fm.status as PostStatus)
              : "draft"

          const title = String(fm.title ?? "(Untitled)")
          const excerpt = fm.excerpt != null ? String(fm.excerpt) : undefined

          const post: PostsIndexItem = {
            id: String(fm.id ?? draft.id),
            title,
            slug: String(fm.slug ?? ""),
            date: String(fm.date ?? ""),
            status,

            url: normalized,

            // normalized fields (always present)
            tags,
            categories,

            // SEO normalized to null when missing
            featured_image: fm.featured_image != null ? String(fm.featured_image) : null,
            seo_title: fm.seo_title != null ? String(fm.seo_title) : null,
            seo_description: fm.seo_description != null ? String(fm.seo_description) : null,

            excerpt,

            // required by PostsIndexItem
            search: [title, excerpt ?? "", tags.join(" "), categories.join(" ")].join(" ").trim(),
          }

          return {
            settings,
            post,
            content: draft.body ?? "",
            __previewDraft: true as const,
          }
        }
      }
    }

    // Normal repo load
    const mdPath = manifest.routes[normalized]
    if (!mdPath) throw notFound()

    const post = index.posts.find((p) => p.url === normalized)
    if (!post) throw notFound()

    const content = await loadMarkdownPost(mdPath)
    return { settings, post, content }
  },
  component: PostRoute,
})

function PostRoute() {
  const { settings: repoSettings, post, content } = Route.useLoaderData()
  const preview = usePreviewSettings()

  const settings = preview.enabled && preview.settings ? preview.settings : repoSettings
  const { theme, vars } = resolveTheme(settings)

  const site = useSiteSettingsForSeo()

  const title =
    post.seo_title && post.seo_title.trim() !== ""
      ? post.seo_title
      : post.title && post.title.trim() !== ""
        ? `${post.title} · ${site.siteName ?? ""}`.trim().replace(/\s+·\s*$/, "")
        : site.siteName ?? ""

  const description =
    post.seo_description && post.seo_description.trim() !== ""
      ? post.seo_description
      : post.excerpt && post.excerpt.trim() !== ""
        ? post.excerpt
        : site.tagline ?? ""

  useSeo(site, {
    title,
    description,
    canonicalPath: post.url, // "/something/"
    canonicalUrl: site.siteUrl + post.url, // "https://example.com/something/"
    ogType: "article",
    image: post.featured_image,
    twitterCard: "summary_large_image",
  })

  return theme.render.Post({ settings, themeVars: vars, post, content })
}
