// @/core/github/branches.ts
import { configuredRepoRequest, GitHubApiError } from "./client"

type GitRef = {
  ref: string
  object: { sha: string; type: string; url: string }
}

type MergeResponse = {
  sha: string
  merged: boolean
  message?: string
}

async function getHeadSha(branch: string): Promise<string> {
  const ref = await configuredRepoRequest<GitRef>(`/git/ref/heads/${encodeURIComponent(branch)}`)
  return ref.object.sha
}

async function branchExists(branch: string): Promise<boolean> {
  try {
    await getHeadSha(branch)
    return true
  } catch (e) {
    if (e instanceof GitHubApiError && e.status === 404) return false
    throw e
  }
}

async function createBranchFromSha(branch: string, sha: string) {
  return configuredRepoRequest<GitRef>(`/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  })
}

async function mergeMainIntoDevelop() {
  return configuredRepoRequest<MergeResponse>(`/merges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base: "develop",
      head: "main",
      commit_message: "chore: sync develop with main",
    }),
  })
}

async function resetBranchToSha(branch: string, sha: string) {
  return configuredRepoRequest<GitRef>(`/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha, force: true }),
  })
}

/**
 * Ensures:
 * - main exists
 * - develop exists (create from main if missing)
 * - develop is up to date by merging main -> develop
 */
export async function ensureDevelopSyncedWithMain(): Promise<{
  developExisted: boolean
  previousDevelopSha: string | null
}> {
  const hasMain = await branchExists("main")
  if (!hasMain) throw new Error("Repo must contain a 'main' branch.")

  const developExisted = await branchExists("develop")
  let previousDevelopSha: string | null = null

  if (!developExisted) {
    const mainSha = await getHeadSha("main")
    await createBranchFromSha("develop", mainSha)
  } else {
    previousDevelopSha = await getHeadSha("develop")
  }

  try {
    await mergeMainIntoDevelop()
  } catch (e) {
    if (e instanceof GitHubApiError && e.status === 409) {
      throw new Error(
        "Cannot sync branches: merging 'main' into 'develop' causes conflicts. Please resolve conflicts on GitHub first."
      )
    }
    throw e
  }

  return { developExisted, previousDevelopSha }
}

export async function rollbackDevelop(previousDevelopSha: string | null) {
  if (!previousDevelopSha) return
  await resetBranchToSha("develop", previousDevelopSha)
}
