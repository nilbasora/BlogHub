import { configuredRepoRequest, GitHubApiError } from "./client"
import type {
  BranchSyncInfo,
  GitHubCompareResponse,
  GitHubMergeResponse,
} from "@/core/utils/types"

/* =========================
   Branch sync check (core)
   ========================= */

export async function checkBranchesSync(
  base = "main",
  head = "develop"
): Promise<BranchSyncInfo> {
  const compare = await configuredRepoRequest<GitHubCompareResponse>(
    `/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    { method: "GET" }
  )

  return {
    status: compare.status,
    aheadBy: compare.ahead_by,
    behindBy: compare.behind_by,
    isSynced: compare.ahead_by === 0 && compare.behind_by === 0,
    developAheadOfMain: compare.ahead_by > 0,
    compareUrl: compare.html_url,
  }
}

/* =========================
   Boolean helper
   ========================= */

export async function areBranchesSynced(
  base = "main",
  head = "develop"
): Promise<boolean> {
  const syncInfo = await checkBranchesSync(base, head)
  return syncInfo.isSynced
}

/* =========================
   Deploy
   ========================= */

export async function deployDevelopToMain() {
  const syncInfo = await checkBranchesSync("main", "develop")

  if (syncInfo.isSynced) {
    return {
      skipped: true as const,
      reason: "Branches are synchronized (nothing to deploy).",
      details: syncInfo,
    }
  }

  if (!syncInfo.developAheadOfMain) {
    throw new Error(
      `Deploy blocked: 'develop' is not ahead of 'main' ` +
        `(status: ${syncInfo.status}, ahead: ${syncInfo.aheadBy}, behind: ${syncInfo.behindBy}).` +
        (syncInfo.compareUrl ? ` Compare: ${syncInfo.compareUrl}` : "")
    )
  }

  try {
    return await configuredRepoRequest<GitHubMergeResponse>(`/merges`, {
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
