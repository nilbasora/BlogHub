import { createFileRoute, notFound } from "@tanstack/react-router"
import { loadRoutesManifest } from "@/core/content/loadRoutesManifest"
import { loadPostsIndex } from "@/core/content/loadPostsIndex"
import { loadMarkdownPost } from "@/core/content/loadMarkdownPost"
import { loadSettings } from "@/core/content/loadSettings"
import { resolveTheme } from "@/core/themes/resolveTheme"
import { usePreviewSettings } from "@/core/preview/PreviewSettingsProvider"

export const Route = createFileRoute("/$")({
  loader: async ({ params }) => {
    const splat = params._splat ?? ""
    const pathname = "/" + splat
    const normalized = pathname.endsWith("/") ? pathname : pathname + "/"

    const [settings, manifest, index] = await Promise.all([
      loadSettings(),
      loadRoutesManifest(),
      loadPostsIndex(),
    ])

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
