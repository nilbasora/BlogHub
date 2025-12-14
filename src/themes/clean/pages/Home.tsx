import { Link } from "@tanstack/react-router"
import type { ThemeHomeProps } from "@/core/themes/types"

export function Home({ settings, themeVars, posts }: ThemeHomeProps) {
  const brandName = String(themeVars.brandName ?? settings.siteName)
  const cardStyle = themeVars.cardStyle === "border" ? "border" : "shadow"

  const published = posts
    .filter((p) => p.status === "published")
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="p-6 mx-auto max-w-4xl">
      <header className="mb-10">
        <div className="text-xs uppercase tracking-widest opacity-60">Blog</div>
        <h1 className="text-4xl font-bold mt-2">{brandName}</h1>
        {settings.tagline ? <p className="mt-3 opacity-80">{settings.tagline}</p> : null}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {published.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl p-5 bg-white/50 ${cardStyle === "border" ? "border" : "shadow"}`}
          >
            <Link to={p.url} className="text-lg font-semibold underline">
              {p.title}
            </Link>
            {p.excerpt ? <p className="mt-2 text-sm opacity-80">{p.excerpt}</p> : null}
            <div className="mt-3 text-xs opacity-60">{p.date}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
