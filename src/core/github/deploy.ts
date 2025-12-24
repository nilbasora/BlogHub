// @/core/github/deploy.ts
import { configuredRepoRequest, GitHubApiError } from "./client"

type MergeResponse = {
  sha: string
  merged: boolean
  message?: string
}

export async function deployDevelopToMain() {
  try {
    return await configuredRepoRequest<MergeResponse>(`/merges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base: "main",
        head: "develop",
        commit_message: "chore: deploy develop to main",
      }),
    })
  } catch (e) {
    if (e instanceof GitHubApiError && e.status === 409) {
      throw new Error(
        "Deploy failed: merging 'develop' into 'main' causes conflicts. Please resolve conflicts on GitHub first."
      )
    }
    throw e
  }
}
