import { createFileRoute } from "@tanstack/react-router"
import { loadPostsIndex } from "@/core/content/local"
import { loadSettings } from "@/core/content/local"
import { resolveTheme } from "@/core/domain/themes/resolveTheme"
import { usePreviewSettings } from "@/core/storage/PreviewSettingsProvider"
import { useSeo } from "@/core/domain/seo/useSeo"
import { useSiteSettingsForSeo } from "@/core/domain/seo/SeoProvider"

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
  const site = useSiteSettingsForSeo()

  useSeo(site, {
    title: settings.siteName,              // "BlogHub"
    description: settings.tagline,         // "Static CMS on GitHub Pages"
    canonicalPath: "/",                    // builds absolute with settings.siteUrl
    canonicalUrl: settings.siteUrl,       // "https://example.com"
    ogType: "website",
    image: settings.logo,                 // builds absolute with settings.siteUrl
  })

  return theme.render.Home({ settings, themeVars: vars, posts: index.posts })
}




