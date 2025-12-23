import { getRepoRef } from "./repo"
import { getGithubToken } from "./oauth"

const API = "https://api.github.com"

type GithubContentGet = {
  sha: string
  content?: string
  encoding?: string
}

type PutContentsResponse = {
  content: { sha: string }
  commit: { sha: string; html_url: string }
}

type RepoInfo = {
  default_branch: string
}

let cachedDefaultBranch: string | null = null

function assertToken() {
  const token = getGithubToken()
  if (!token) throw new Error("Not authenticated (missing GitHub token).")
  return token
}

async function githubFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = assertToken()
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

export async function getDefaultBranch(): Promise<string> {
  if (cachedDefaultBranch) return cachedDefaultBranch
  const { owner, repo } = getRepoRef()
  const info = await githubFetch<RepoInfo>(`/repos/${owner}/${repo}`)
  cachedDefaultBranch = info.default_branch
  return cachedDefaultBranch
}

export function repoPathFromPublicUrl(publicPath: string) {
  // turns "/media/foo.png" into "public/media/foo.png" (recommended)
  const p = publicPath.replace(/^\/+/, "")
  if (p.startsWith("media/")) return `public/${p}`
  return p
}

/** UTF-8 safe base64 for text */
function base64EncodeUtf8(text: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

async function base64EncodeArrayBuffer(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export async function getFileSha(repoFilePath: string, branch?: string): Promise<string | null> {
  const { owner, repo } = getRepoRef()
  const b = branch || (await getDefaultBranch())

  try {
    const data = await githubFetch<GithubContentGet>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(repoFilePath)}?ref=${encodeURIComponent(b)}`
    )
    return data.sha
  } catch (e: any) {
    // 404 => not exists
    if (String(e?.message || "").includes("(404)")) return null
    return null
  }
}

export async function putTextFile(opts: {
  repoFilePath: string
  content: string
  message: string
  branch?: string
}): Promise<PutContentsResponse> {
  const { owner, repo } = getRepoRef()
  const branch = opts.branch || (await getDefaultBranch())
  const sha = await getFileSha(opts.repoFilePath, branch)

  const body = {
    message: opts.message,
    content: base64EncodeUtf8(opts.content),
    branch,
    ...(sha ? { sha } : {}),
  }

  return githubFetch<PutContentsResponse>(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(opts.repoFilePath)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
}

export async function putJsonFile(opts: {
  repoFilePath: string
  json: unknown
  message: string
  branch?: string
}): Promise<PutContentsResponse> {
  const content = JSON.stringify(opts.json, null, 2) + "\n"
  return putTextFile({ repoFilePath: opts.repoFilePath, content, message: opts.message, branch: opts.branch })
}

export async function putBinaryFile(opts: {
  repoFilePath: string
  file: File
  message: string
  branch?: string
}): Promise<PutContentsResponse> {
  const { owner, repo } = getRepoRef()
  const branch = opts.branch || (await getDefaultBranch())
  const sha = await getFileSha(opts.repoFilePath, branch)

  const buf = await opts.file.arrayBuffer()
  const content = await base64EncodeArrayBuffer(buf)

  const body = {
    message: opts.message,
    content,
    branch,
    ...(sha ? { sha } : {}),
  }

  return githubFetch<PutContentsResponse>(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(opts.repoFilePath)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
}

export async function deleteFile(opts: {
  repoFilePath: string
  message: string
  branch?: string
}): Promise<PutContentsResponse> {
  const { owner, repo } = getRepoRef()
  const branch = opts.branch || (await getDefaultBranch())
  const sha = await getFileSha(opts.repoFilePath, branch)
  if (!sha) throw new Error(`Cannot delete: file not found (${opts.repoFilePath})`)

  const body = { message: opts.message, sha, branch }

  return githubFetch<PutContentsResponse>(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(opts.repoFilePath)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
}
