import type { ThemePostProps } from "@/core/themes/types"
import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import { Link } from "@tanstack/react-router"

export function Post({ settings, themeVars, post, content }: ThemePostProps) {
  const brandName = String(themeVars.brandName ?? settings.siteName)

  return (
    <div className="p-6 mx-auto max-w-3xl">
      <header className="mb-8">
        <Link to="/" className="text-sm underline opacity-80">
          ← {brandName}
        </Link>
        <h1 className="text-4xl font-bold mt-4">{post.title}</h1>
        <div className="mt-2 text-xs opacity-60">{post.date}</div>
      </header>

      <MarkdownRenderer content={content} />
    </div>
  )
}
