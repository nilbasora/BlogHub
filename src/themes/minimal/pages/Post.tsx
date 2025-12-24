import type { ThemePostProps } from "@/core/utils/types"
import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import { Link } from "@tanstack/react-router"

export function Post({ settings, themeVars, post, content }: ThemePostProps) {
  const layout = themeVars.layout === "wide" ? "max-w-5xl" : "max-w-3xl"
  const brandName = String(themeVars.brandName ?? settings.siteName)

  return (
    <div className={`p-6 mx-auto ${layout}`}>
      <header className="mb-6">
        <Link to="/" className="text-sm underline opacity-80">
          ← {brandName}
        </Link>
        <h1 className="text-3xl font-semibold mt-3">{post.title}</h1>
        <div className="mt-2 text-xs opacity-70">{post.date}</div>
      </header>

      <MarkdownRenderer content={content} />
    </div>
  )
}
