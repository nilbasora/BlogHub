import { createFileRoute } from "@tanstack/react-router"
import { loadPostsIndex } from "@/core/content/loadPostsIndex"
import { loadSettings } from "@/core/content/loadSettings"
import { resolveTheme } from "@/core/themes/resolveTheme"

export const Route = createFileRoute("/")({
  loader: async () => {
    const [settings, index] = await Promise.all([loadSettings(), loadPostsIndex()])
    const { theme, vars, warnings } = resolveTheme(settings)
    if (import.meta.env.DEV && warnings.length) console.warn("[theme vars]", warnings)
    return { settings, index, themeId: theme.id, themeVars: vars }
  },
  component: HomeRoute,
})

function HomeRoute() {
  const { settings, index, themeVars } = Route.useLoaderData()
  const { theme } = resolveTheme(settings)
  return theme.render.Home({ settings, themeVars, posts: index.posts })
}
