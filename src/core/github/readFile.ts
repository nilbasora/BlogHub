// @/core/github/readFile.ts
import { configuredRepoRequest, GitHubApiError } from "./client"

type GithubContentGet = {
  type: "file" | "dir"
  encoding?: "base64"
  content?: string
  sha: string
  path: string
}

function base64DecodeUtf8(b64: string) {
  // GitHub returns base64 with newlines sometimes
  const clean = b64.replace(/\n/g, "")
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export async function readRepoTextFile(opts: {
  repoFilePath: string
  branch?: string
}): Promise<string> {
  const { repoFilePath, branch } = opts
  const refParam = branch ? `?ref=${encodeURIComponent(branch)}` : ""

  try {
    const data = await configuredRepoRequest<GithubContentGet>(
      `/contents/${encodeURIComponent(repoFilePath)}${refParam}`
    )

    if (data.type !== "file") {
      throw new Error(`Expected a file at ${repoFilePath}, got ${data.type}`)
    }
    if (!data.content) {
      throw new Error(`Empty content returned for ${repoFilePath}`)
    }

    // Contents API returns base64 by default for files
    return base64DecodeUtf8(data.content)
  } catch (e) {
    if (e instanceof GitHubApiError && e.status === 404) {
      throw new Error(`File not found in repo: ${repoFilePath}${branch ? ` (ref: ${branch})` : ""}`)
    }
    throw e
  }
}

export async function readRepoJsonFile<T>(opts: {
  repoFilePath: string
  branch?: string
}): Promise<T> {
  const text = await readRepoTextFile(opts)
  return JSON.parse(text) as T
}
