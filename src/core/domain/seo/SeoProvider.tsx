import React, { createContext, useContext } from "react"

export type SiteSettingsLike = {
  siteName?: string | null
  tagline?: string | null
  siteUrl?: string | null
  language?: string | null
  logo?: string | null
  favicon?: string | null
}

const SeoContext = createContext<SiteSettingsLike | null>(null)

export function SeoProvider({ settings, children }: { settings: SiteSettingsLike; children: React.ReactNode }) {
  return <SeoContext.Provider value={settings}>{children}</SeoContext.Provider>
}

export function useSiteSettingsForSeo() {
  const ctx = useContext(SeoContext)
  if (!ctx) throw new Error("useSiteSettingsForSeo must be used inside <SeoProvider>")
  return ctx
}
