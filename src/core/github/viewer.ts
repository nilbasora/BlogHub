// @/core/github/viewer.ts
import { githubRequest } from "./client"

export type GithubUser = {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
}

export function fetchViewer(): Promise<GithubUser> {
  return githubRequest<GithubUser>("/user")
}
