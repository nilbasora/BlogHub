import type { SiteSettings } from "@/core/utils/types"
import { readRepoJsonFile } from "@/core/github/readFile"

export async function loadSettingsFromRepo(branch: string = "develop"): Promise<SiteSettings> {
  return readRepoJsonFile<SiteSettings>({
    repoFilePath: "public/site/settings.json",
    branch,
  })
}
