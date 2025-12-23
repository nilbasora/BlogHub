import { getRepoRef } from "./repo"

const API = "https://api.github.com"

type GitRef = {
  ref: string
  object: { sha: string; type: string; url: string }
}

async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    const err = new Error(`GitHub API error (${res.status}): ${text || res.statusText}`)
    ;(err as any).status = res.status
    ;(err as any).body = text
    throw err
  }

  return (await res.json()) as T
}

async function getHeadSha(token: string, branch: string): Promise<string> {
  const { owner, repo } = getRepoRef()
  const ref = await gh<GitRef>(token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`)
  return ref.object.sha
}

async function branchExists(token: string, branch: string): Promise<boolean> {
  try {
    await getHeadSha(token, branch)
    return true
  } catch (e: any) {
    if (e?.status === 404) return false
    throw e
  }
}

async function createBranchFromSha(token: string, branch: string, sha: string) {
  const { owner, repo } = getRepoRef()
  return gh<GitRef>(token, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha,
    }),
  })
}

type MergeResponse = {
  sha: string
  merged: boolean
  message?: string
}

async function mergeIntoDevelop(token: string) {
  const { owner, repo } = getRepoRef()
  // Merge main -> develop
  return gh<MergeResponse>(token, `/repos/${owner}/${repo}/merges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base: "develop",
      head: "main",
      commit_message: "chore: sync develop with main",
    }),
  })
}

async function resetBranchToSha(token: string, branch: string, sha: string) {
  const { owner, repo } = getRepoRef()
  // Force-move refs/heads/<branch> to previous sha
  return gh<GitRef>(token, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha, force: true }),
  })
}

/**
 * Ensures:
 * - main exists (hard requirement)
 * - develop exists (create from main if missing)
 * - develop is up to date by merging main -> develop
 *
 * If merge conflicts: throws a friendly error.
 * If merge succeeded but later something fails, caller can rollback using returned rollback info.
 */
export async function ensureDevelopSyncedWithMain(token: string): Promise<{
  developExisted: boolean
  previousDevelopSha: string | null
}> {
  // 1) main must exist
  const hasMain = await branchExists(token, "main")
  if (!hasMain) {
    throw new Error("Repo must contain a 'main' branch.")
  }

  // 2) ensure develop exists
  const developExisted = await branchExists(token, "develop")
  let previousDevelopSha: string | null = null

  if (!developExisted) {
    const mainSha = await getHeadSha(token, "main")
    await createBranchFromSha(token, "develop", mainSha)
  } else {
    previousDevelopSha = await getHeadSha(token, "develop")
  }

  // 3) merge main -> develop
  try {
    await mergeIntoDevelop(token)
  } catch (e: any) {
    // Merge conflict is typically 409
    if (e?.status === 409) {
      throw new Error(
        "Cannot sync branches: merging 'main' into 'develop' causes conflicts. Please resolve conflicts on GitHub first."
      )
    }
    throw e
  }

  return { developExisted, previousDevelopSha }
}

/**
 * Rollback helper if you ever need to revert develop after a merge succeeded.
 */
export async function rollbackDevelop(token: string, previousDevelopSha: string | null) {
  if (!previousDevelopSha) return
  await resetBranchToSha(token, "develop", previousDevelopSha)
}
