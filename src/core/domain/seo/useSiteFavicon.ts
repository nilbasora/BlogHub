import { useEffect } from "react"

export function useSiteFavicon(favicon?: string | null) {
  useEffect(() => {
    if (!favicon || favicon.trim() === "") return

    const ensure = (rel: string) => {
      let link =
        document.querySelector(`link[rel='${rel}']`) || document.createElement("link")
      link.setAttribute("rel", rel)
      link.setAttribute("href", favicon)
      document.head.appendChild(link)
    }

    ensure("icon")
    ensure("apple-touch-icon")
  }, [favicon])
}
