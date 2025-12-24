// @/core/content/loadPostsIndexFromRepo.ts
import type { PostsIndex } from "@/core/utils/types"
import { readRepoJsonFile } from "@/core/github/readFile"

export async function loadPostsIndexFromRepo(branch: string = "develop"): Promise<PostsIndex> {
  return readRepoJsonFile<PostsIndex>({
    repoFilePath: "public/generated/posts-index.json",
    branch,
  })
}
