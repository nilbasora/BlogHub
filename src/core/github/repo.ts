export type RepoRef = { owner: string; repo: string }

export function getRepoRef(): RepoRef {
  const raw = String(import.meta.env.VITE_REPO_URL || "").trim()
  if (!raw) throw new Error("Missing VITE_REPO_URL")

  const cleaned = raw.replace(/\.git$/, "").replace(/\/+$/, "")

  // owner/repo
  const direct = cleaned.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/)
  if (direct) return { owner: direct[1], repo: direct[2] }

  // https url
  try {
    const u = new URL(cleaned)
    if (u.hostname !== "github.com") throw new Error("VITE_REPO_URL must be github.com")
    const parts = u.pathname.split("/").filter(Boolean)
    if (parts.length < 2) throw new Error("VITE_REPO_URL must include /OWNER/REPO")
    return { owner: parts[0], repo: parts[1] }
  } catch {
    // ssh url
    const ssh = cleaned.match(/^git@github\.com:([^/]+)\/([^/]+)$/)
    if (ssh) return { owner: ssh[1], repo: ssh[2] }
    throw new Error("Invalid VITE_REPO_URL. Use https://github.com/OWNER/REPO")
  }
}
