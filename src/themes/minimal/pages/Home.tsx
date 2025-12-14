import { Link } from "@tanstack/react-router"
import type { ThemeHomeProps } from "@/core/themes/types"

export function Home({ settings, themeVars, posts }: ThemeHomeProps) {
  const layout = themeVars.layout === "wide" ? "max-w-5xl" : "max-w-3xl"
  const brandName = String(themeVars.brandName ?? settings.siteName)
  const showTagline = Boolean(themeVars.showTagline)

  const published = posts
    .filter((p) => p.status === "published")
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className={`p-6 mx-auto ${layout}`}>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">{brandName}</h1>
        {showTagline && settings.tagline ? (
          <p className="mt-2 opacity-80">{settings.tagline}</p>
        ) : null}
      </header>

      <div className="space-y-4">
        {published.map((p) => (
          <div key={p.id} className="border rounded-lg p-4">
            <Link to={p.url} className="text-lg font-medium underline">
              {p.title}
            </Link>
            {p.excerpt ? <p className="mt-2 text-sm opacity-80">{p.excerpt}</p> : null}
            <div className="mt-2 text-xs opacity-70">{p.date}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
