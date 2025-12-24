import { useEffect } from "react"
import type { SiteSettingsLike } from "./SeoProvider"

type SeoInput = {
  title?: string | null
  description?: string | null
  image?: string | null
  canonicalPath?: string | null
  canonicalUrl?: string | null
  ogType?: string | null           // "website" | "article"
  twitterCard?: string | null      // "summary" | "summary_large_image"
  noindex?: boolean | null
}

const isBlank = (v?: string | null) => !v || v.trim() === ""

function toAbsolute(baseUrl: string, maybeRelative: string) {
  return new URL(maybeRelative, baseUrl).toString()
}

function setMetaName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute("name", name)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

function setMetaProp(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute("property", property)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement("link")
    el.setAttribute("rel", rel)
    document.head.appendChild(el)
  }
  el.setAttribute("href", href)
}

export function useSeo(site: SiteSettingsLike, page: SeoInput) {
  useEffect(() => {
    const baseUrl = (site.siteUrl || "").trim()

    const title = !isBlank(page.title) ? page.title!.trim() : (site.siteName || "").trim()
    const description =
      !isBlank(page.description) ? page.description!.trim() : (site.tagline || "").trim()

    // Title
    if (!isBlank(title)) document.title = title

    // Description
    if (!isBlank(description)) setMetaName("description", description)

    // Canonical URL
    let canonical = ""
    if (!isBlank(page.canonicalUrl)) canonical = page.canonicalUrl!.trim()
    else if (!isBlank(page.canonicalPath) && !isBlank(baseUrl)) {
      canonical = toAbsolute(baseUrl, page.canonicalPath!.trim())
    }
    if (!isBlank(canonical)) setLink("canonical", canonical)

    // Robots
    if (page.noindex) setMetaName("robots", "noindex,nofollow")

    // Image absolute
    let image = ""
    if (!isBlank(page.image)) {
      image = !isBlank(baseUrl) ? toAbsolute(baseUrl, page.image!.trim()) : page.image!.trim()
    } else if (!isBlank(site.logo)) {
      image = !isBlank(baseUrl) ? toAbsolute(baseUrl, site.logo!.trim()) : site.logo!.trim()
    }

    // OpenGraph
    if (!isBlank(title)) setMetaProp("og:title", title)
    if (!isBlank(description)) setMetaProp("og:description", description)
    if (!isBlank(site.siteName)) setMetaProp("og:site_name", site.siteName!.trim())
    if (!isBlank(canonical)) setMetaProp("og:url", canonical)
    setMetaProp("og:type", (page.ogType || "website").trim())
    if (!isBlank(image)) setMetaProp("og:image", image)

    // Twitter
    setMetaName("twitter:card", (page.twitterCard || "summary_large_image").trim())
    if (!isBlank(title)) setMetaName("twitter:title", title)
    if (!isBlank(description)) setMetaName("twitter:description", description)
    if (!isBlank(image)) setMetaName("twitter:image", image)
  }, [
    site.siteUrl,
    site.siteName,
    site.tagline,
    site.logo,
    page.title,
    page.description,
    page.image,
    page.canonicalPath,
    page.canonicalUrl,
    page.ogType,
    page.twitterCard,
    page.noindex,
  ])
}
