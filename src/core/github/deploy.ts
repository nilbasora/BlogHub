import { githubFetch } from "./api"
import { getRepoRef } from "./repo"

type MergeResponse = {
  sha: string
  merged: boolean
  message?: string
}

export async function deployDevelopToMain() {
  const { owner, repo } = getRepoRef()

  try {
    // Merge develop -> main
    return await githubFetch<MergeResponse>(`/repos/${owner}/${repo}/merges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base: "main",
        head: "develop",
        commit_message: "chore: deploy develop to main",
      }),
    })
  } catch (e: any) {
    // GithubFetch wraps errors, but message includes status+body.
    // Merge conflicts usually return 409.
    const msg = String(e?.message ?? e)

    if (msg.includes("(409)")) {
      throw new Error(
        "Deploy failed: merging 'develop' into 'main' causes conflicts. Please resolve conflicts on GitHub first."
      )
    }

    throw e
  }
}
