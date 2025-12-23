import type { SiteSettings } from "@/core/content/types"

export function getWriteBranch(settings: SiteSettings): "main" | "develop" {
  return settings.cd ? "main" : "develop"
}

export function shouldShowDeploy(settings: SiteSettings): boolean {
  // Deploy only makes sense when you commit to develop
  return !settings.cd
}
