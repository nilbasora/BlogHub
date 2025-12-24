// @/core/github/useViewer.ts
import * as React from "react"
import type { GithubUser } from "./viewer"
import { fetchViewer } from "./viewer"

let cached: GithubUser | null = null

export function useViewer() {
  const [user, setUser] = React.useState<GithubUser | null>(cached)
  const [loading, setLoading] = React.useState<boolean>(!cached)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let alive = true
    if (cached) return

    setLoading(true)
    fetchViewer()
      .then((u) => {
        cached = u
        if (!alive) return
        setUser(u)
        setError(null)
      })
      .catch((e) => {
        if (!alive) return
        setError(e?.message ?? String(e))
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [])

  return { user, loading, error }
}

export function clearViewerCache() {
  cached = null
}
