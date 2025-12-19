import { Outlet, createRootRoute } from "@tanstack/react-router"
import { PreviewSettingsProvider } from "@/core/preview/PreviewSettingsProvider"

export const Route = createRootRoute({
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
      <div className="min-h-dvh">
        <Outlet />
      </div>
    </PreviewSettingsProvider>
  )
}
