import { createFileRoute, notFound } from "@tanstack/react-router"
import { loadRoutesManifest } from "@/core/content/loadRoutesManifest"
import { loadPostsIndex } from "@/core/content/loadPostsIndex"
import { loadMarkdownPost } from "@/core/content/loadMarkdownPost"
import { loadSettings } from "@/core/content/loadSettings"
import { resolveTheme } from "@/core/themes/resolveTheme"
import { usePreviewSettings } from "@/core/preview/PreviewSettingsProvider"
import { isPreviewMode } from "@/core/preview/previewSettings"
import { readPreviewPostDraft } from "@/core/preview/previewPost"

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
          const fm = draft.frontmatter ?? {}
          const post = {
            id: String(fm.id ?? draft.id),
            title: String(fm.title ?? "(Untitled)"),
            slug: String(fm.slug ?? ""),
            url: normalized,
            date: String(fm.date ?? ""),
            excerpt: fm.excerpt,
            tags: Array.isArray(fm.tags) ? fm.tags : [],
            categories: Array.isArray(fm.categories) ? fm.categories : [],
            status: fm.status ?? "draft",
            // keep any extra fields if your Post type allows it
            ...fm,
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

  return theme.render.Post({ settings, themeVars: vars, post, content })
}
