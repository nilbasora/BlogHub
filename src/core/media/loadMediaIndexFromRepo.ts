// @/core/content/loadMediaIndexFromRepo.ts
import type { MediaIndex } from "@/core/utils/types"
import { readRepoJsonFile } from "@/core/github/readFile"

export async function loadMediaIndexFromRepo(branch: string = "develop"): Promise<MediaIndex> {
  return readRepoJsonFile<MediaIndex>({
    repoFilePath: "public/generated/media-index.json",
    branch,
  })
}
