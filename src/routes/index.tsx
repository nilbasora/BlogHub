import { createFileRoute } from "@tanstack/react-router"
import { loadPostsIndex } from "@/core/content/loadPostsIndex"
import { loadSettings } from "@/core/content/loadSettings"
import { resolveTheme } from "@/core/themes/resolveTheme"
import { usePreviewSettings } from "@/core/preview/PreviewSettingsProvider"

export const Route = createFileRoute("/")({
  loader: async () => {
    const [settings, index] = await Promise.all([loadSettings(), loadPostsIndex()])
    return { settings, index }
  },
  component: HomeRoute,
})

function HomeRoute() {
  const { settings: repoSettings, index } = Route.useLoaderData()
  const preview = usePreviewSettings()

  const settings = preview.enabled && preview.settings ? preview.settings : repoSettings
  const { theme, vars } = resolveTheme(settings)

  return theme.render.Home({ settings, themeVars: vars, posts: index.posts })
}
