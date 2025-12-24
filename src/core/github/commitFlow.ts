import type { SiteSettings } from "@/core/utils/types"
import { deployDevelopToMain } from "./deploy"

export async function maybeAutoDeploy(settings: SiteSettings) {
  if (!settings.cd) return
  await deployDevelopToMain()
}
