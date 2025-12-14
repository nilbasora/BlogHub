import { createFileRoute, notFound } from "@tanstack/react-router"
import { loadRoutesManifest } from "@/core/content/loadRoutesManifest"
import { loadPostsIndex } from "@/core/content/loadPostsIndex"
import { loadMarkdownPost } from "@/core/content/loadMarkdownPost"
import { loadSettings } from "@/core/content/loadSettings"
import { resolveTheme } from "@/core/themes/resolveTheme"

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
    const { theme, vars } = resolveTheme(settings)

    return { settings, themeId: theme.id, themeVars: vars, post, content }
  },
  component: PostRoute,
})

function PostRoute() {
  const { settings, themeVars, post, content } = Route.useLoaderData()
  const { theme } = resolveTheme(settings)
  return theme.render.Post({ settings, themeVars, post, content })
}
