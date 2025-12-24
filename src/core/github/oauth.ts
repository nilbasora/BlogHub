import { getRepoRef } from "./repo"

const API = "https://api.github.com"

// We now use a GitHub Personal Access Token (PAT) stored locally
const TOKEN_KEY = "bloghub.githubToken"
const NEXT_KEY = "bloghub.loginNext"
const LOGIN_ERROR_KEY = "bloghub.loginError"

/* ------------------------------------------------------------------ */
/* Token storage                                                      */
/* ------------------------------------------------------------------ */

export function getGithubToken(): string | null {
  try {
    const t = localStorage.getItem(TOKEN_KEY)
    return t ? t.trim() : null
  } catch {
    return null
  }
}

export function setGithubToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token.trim())
}

export function clearGithubToken() {
  localStorage.removeItem(TOKEN_KEY)
}

/* ------------------------------------------------------------------ */
/* Login navigation + error helpers                                   */
/* ------------------------------------------------------------------ */

export function readLoginNext() {
  return localStorage.getItem(NEXT_KEY) || "/admin/"
}

export function clearLoginNext() {
  localStorage.removeItem(NEXT_KEY)
}

export function setLoginError(message: string) {
  localStorage.setItem(LOGIN_ERROR_KEY, message)
}

export function readLoginError(): string | null {
  return localStorage.getItem(LOGIN_ERROR_KEY)
}

export function clearLoginError() {
  localStorage.removeItem(LOGIN_ERROR_KEY)
}

/* ------------------------------------------------------------------ */
/* PAT "login" (no OAuth / device flow)                               */
/* ------------------------------------------------------------------ */

export function normalizePat(input: string) {
  return input.trim()
}


/* ------------------------------------------------------------------ */
/* GitHub fetch helper (optional but handy)                           */
/* ------------------------------------------------------------------ */

export async function githubFetch(
  url: string,
  init: RequestInit = {},
  token?: string
) {
  const t = token ?? getGithubToken()
  if (!t) throw new Error("Not authenticated (missing GitHub token).")

  const headers = new Headers(init.headers)
  // For PATs, GitHub accepts Bearer; token also works, but Bearer is fine.
  headers.set("Authorization", `Bearer ${t}`)
  headers.set("Accept", "application/vnd.github+json")

  const res = await fetch(url, { ...init, headers })

  // Provide a clearer error for debugging
  if (!res.ok) {
    let body: any = null
    try {
      body = await res.json()
    } catch {
      // ignore
    }
    const msg =
      body?.message ||
      body?.error_description ||
      `GitHub API error (${res.status})`
    const err: any = new Error(msg)
    err.status = res.status
    err.body = body
    throw err
  }

  return res
}

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

export async function validateTokenForRepo(token: string) {
  const pat = token.trim()
  if (!pat) throw new Error("Missing GitHub token.")

  const { owner, repo } = getRepoRef()

  const res = await fetch(`${API}/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
    },
  })

  if (!res.ok) {
    // Try to show GitHub's message (e.g. Bad credentials)
    let data: any = null
    try {
      data = await res.json()
    } catch {
      // ignore
    }
    throw new Error(data?.message || "Token has no access to configured repo")
  }

  const data = (await res.json()) as any
  const perms = data?.permissions
  const canWrite = Boolean(perms?.push || perms?.admin)

  if (!canWrite) {
    throw new Error("Token does not have write permissions to repo")
  }

  return true
}
