// @/core/github/client.ts
import { getGithubToken } from "./oauth"
import type { RepoRef } from "./repo"
import { getRepoRef } from "./repo"

const API = "https://api.github.com"

export class GitHubApiError extends Error {
  status: number
  body: string
  url: string

  constructor(opts: { status: number; body: string; url: string; message?: string }) {
    super(opts.message || `GitHub API error (${opts.status})`)
    this.name = "GitHubApiError"
    this.status = opts.status
    this.body = opts.body
    this.url = opts.url
  }
}

function defaultHeaders(init?: RequestInit): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    ...(init?.headers || {}),
  }
}

function assertToken(token?: string) {
  const t = token ?? getGithubToken()
  if (!t) throw new Error("Not authenticated (missing GitHub token).")
  return t
}

/**
 * Low-level JSON request.
 * - Adds GitHub headers + Bearer token
 * - Throws GitHubApiError with status/body/url on non-2xx
 */
export async function githubRequest<T>(path: string, init?: RequestInit, opts?: { token?: string }): Promise<T> {
  const token = assertToken(opts?.token)
  const url = `${API}${path}`

  const res = await fetch(url, {
    ...init,
    headers: {
      ...defaultHeaders(init),
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new GitHubApiError({
      status: res.status,
      body,
      url,
      message: `GitHub API error (${res.status}): ${body || res.statusText}`,
    })
  }

  // Some endpoints can return empty body; be defensive
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

/** Repo-scoped helper: pass `/repos/:owner/:repo/...` tail only. */
export function repoRequest<T>(
  repoRef: RepoRef,
  repoPath: string,
  init?: RequestInit,
  opts?: { token?: string }
): Promise<T> {
  return githubRequest<T>(`/repos/${repoRef.owner}/${repoRef.repo}${repoPath}`, init, opts)
}

/** Convenience: repoRequest using env-configured repo */
export function configuredRepoRequest<T>(repoPath: string, init?: RequestInit, opts?: { token?: string }) {
  return repoRequest<T>(getRepoRef(), repoPath, init, opts)
}
