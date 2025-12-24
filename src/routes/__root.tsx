import { Outlet, createRootRoute } from "@tanstack/react-router"
import { PreviewSettingsProvider, usePreviewSettings } from "@/core/preview/PreviewSettingsProvider"
import { loadSettings } from "@/core/content/loadSettings"
import { useSiteFavicon } from "@/core/seo/useSiteFavicon"
import { SeoProvider } from "@/core/seo/SeoProvider"

export const Route = createRootRoute({
  loader: async () => {
    const settings = await loadSettings()
    return { settings }
  },
  component: Root,
  notFoundComponent: () => (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="mt-2 opacity-80">Page not found.</p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <pre className="mt-4 text-xs whitespace-pre-wrap opacity-80">
        {String(error)}
      </pre>
    </div>
  ),
})

function Root() {
  return (
    <PreviewSettingsProvider>
      <RootInner />
    </PreviewSettingsProvider>
  )
}

function RootInner() {
  const { settings: repoSettings } = Route.useLoaderData()
  const preview = usePreviewSettings()
  const settings = preview.enabled && preview.settings ? preview.settings : repoSettings

  useSiteFavicon(settings.favicon)

  return (
    <SeoProvider settings={settings}>
      <div className="min-h-dvh">
        <Outlet />
      </div>
    </SeoProvider>
  )
}
