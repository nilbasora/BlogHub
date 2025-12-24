import { readRepoTextFile } from "@/core/github/readFile"

export async function loadMarkdownPostFromRepo(mdPath: string, branch: string = "develop"): Promise<string> {
  // mdPath is expected to be a repo path like "public/posts/hello.md" or similar
  return readRepoTextFile({
    repoFilePath: mdPath.replace(/^\/+/, ""),
    branch,
  })
}
