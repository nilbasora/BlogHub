import { getGithubToken } from "./oauth"

const API = "https://api.github.com"

export type GithubUser = {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
}

export async function githubFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getGithubToken()
  if (!token) throw new Error("Not authenticated")

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
    throw new Error(`GitHub API error (${res.status}): ${text || res.statusText}`)
  }

  return (await res.json()) as T
}

export async function fetchViewer(): Promise<GithubUser> {
  return githubFetch<GithubUser>("/user")
}
