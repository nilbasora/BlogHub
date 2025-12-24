import * as React from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  readLoginError,
  clearLoginError,
  setLoginError,
  validateTokenForRepo,
  getGithubToken,
  setGithubToken,
  clearGithubToken,
} from "@/core/github/oauth"
import {
  ensureDevelopSyncedWithMain,
  rollbackDevelop,
} from "@/core/github/branches"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()

  const [err, setErr] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const [pat, setPat] = React.useState<string>("")

  const cancelRef = React.useRef(false)

  React.useEffect(() => {
    const e = readLoginError()
    if (e) {
      setErr(e)
      clearLoginError()
    }
  }, [])

  React.useEffect(() => {
    return () => {
      cancelRef.current = true
    }
  }, [])

  const next =
    new URL(window.location.href).searchParams.get("next") || "/admin/"

  function normalizeToken(input: string) {
    return input.trim()
  }

  // If a token is already stored, validate it and go straight to admin
  React.useEffect(() => {
    const stored = getGithubToken()
    if (!stored) return

    cancelRef.current = false
    setBusy(true)
    setErr(null)
    setStatus("Checking saved token…")

    ;(async () => {
      let rollbackInfo: { previousDevelopSha: string | null } | null = null

      try {
        await validateTokenForRepo(stored)
        if (cancelRef.current) return

        setStatus("Checking branches…")
        rollbackInfo = await ensureDevelopSyncedWithMain()
        if (cancelRef.current) return

        navigate({ to: next })
      } catch (e: any) {
        try {
          if (rollbackInfo?.previousDevelopSha) {
            await rollbackDevelop(rollbackInfo.previousDevelopSha)
          }
        } catch {
          // ignore rollback failures
        }

        // Token is bad or no longer has access -> remove and show login form
        clearGithubToken()

        const friendly = e?.message ?? String(e)
        setLoginError(friendly)
        setErr(friendly)
        setStatus("")
        setBusy(false)
      }
    })()
  }, [navigate, next])

  async function loginWithPat() {
    cancelRef.current = false
    setBusy(true)
    setErr(null)
    setStatus("")

    let rollbackInfo: { previousDevelopSha: string | null } | null = null

    try {
      const token = normalizeToken(pat)
      if (!token) throw new Error("Paste your GitHub PAT.")

      setStatus("Validating token…")
      await validateTokenForRepo(token)
      if (cancelRef.current) return

      setGithubToken(token)

      setStatus("Checking branches…")
      rollbackInfo = await ensureDevelopSyncedWithMain()
      if (cancelRef.current) return

      navigate({ to: next })
    } catch (e: any) {
      try {
        if (rollbackInfo?.previousDevelopSha) {
          await rollbackDevelop(rollbackInfo.previousDevelopSha)
        }
      } catch {
        // ignore rollback failures
      }

      clearGithubToken()

      const friendly = e?.message ?? String(e)
      setLoginError(friendly)
      setErr(friendly)
      setStatus("")
    } finally {
      setBusy(false)
    }
  }

  function cancel() {
    cancelRef.current = true
    setBusy(false)
    setStatus("")
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Login</h1>
          <p className="text-sm opacity-80">Enter your GitHub PAT.</p>
        </div>

        {err && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        {busy && status ? (
          <div className="rounded-md border bg-neutral-50 px-3 py-2 text-sm opacity-80">
            {status}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              name="github_pat"
              autoComplete="current-password"
              className="flex-1 rounded-md border px-3 py-2 text-sm font-mono"
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="github_pat_… / ghp_…"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
            />
          </div>

          <button
            className="w-full rounded-md border px-3 py-2 text-sm bg-neutral-900 text-white border-neutral-900 disabled:opacity-60"
            disabled={busy}
            onClick={loginWithPat}
          >
            {busy ? "Working…" : "Login"}
          </button>

          {busy && (
            <button
              className="w-full rounded-md border px-3 py-2 text-sm"
              onClick={cancel}
              type="button"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
