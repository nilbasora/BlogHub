import type { SiteSettings } from "@/core/domain/types"

export function getWriteBranch(_settings: SiteSettings): "develop" {
  return "develop"
}

export function shouldShowDeploy(settings: SiteSettings): boolean {
  // Show Deploy button only when deploy is manual
  return !settings.cd
}
