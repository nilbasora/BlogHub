import * as React from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  readLoginError,
  clearLoginError,
  setLoginError,
  setGithubToken,
  clearGithubToken,
  startGithubLoginDevice,
  pollDeviceFlowToken,
  validateTokenForRepo,
  type DeviceSession,
} from "@/core/github/oauth"
import { ensureDevelopSyncedWithMain, rollbackDevelop } from "@/core/github/branches"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()

  const [err, setErr] = React.useState<string | null>(null)
  const [session, setSession] = React.useState<DeviceSession | null>(null)
  const [status, setStatus] = React.useState("")
  const [busy, setBusy] = React.useState(false)

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

  async function start() {
    cancelRef.current = false
    setBusy(true)
    setErr(null)
    setStatus("")
    setSession(null)

    const next =
      new URL(window.location.href).searchParams.get("next") || "/admin/"

    let rollbackInfo: { previousDevelopSha: string | null } | null = null

    try {
      setStatus("Starting GitHub login…")

      const s = await startGithubLoginDevice(next)
      if (cancelRef.current) return

      setSession(s)

      if (s.verification_uri && s.verification_uri !== "about:blank") {
        window.open(s.verification_uri, "_blank", "noopener,noreferrer")
      }

      setStatus("Waiting for authorization on GitHub…")

      const token = await pollDeviceFlowToken({
        device_code: s.device_code,
        interval: s.interval,
        expires_in: s.expires_in,
        onUpdate: setStatus,
        isCancelled: () => cancelRef.current,
      })
      if (cancelRef.current) return

      setStatus("Validating repository access…")
      await validateTokenForRepo(token)

      setStatus("Checking branches (main / develop)…")
      rollbackInfo = await ensureDevelopSyncedWithMain()

      // ✅ only store token when everything is good
      setGithubToken(token)

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

      setSession(null)
      setStatus("")
    } finally {
      setBusy(false)
    }
  }

  function cancel() {
    cancelRef.current = true
    setBusy(false)
    setStatus("")
    setSession(null)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Login</h1>
          <p className="text-sm opacity-80">
            Sign in with GitHub to access the admin.
          </p>
        </div>

        {err && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        {session ? (
          <div className="rounded-md border bg-neutral-50 p-4 space-y-3">
            <div className="text-sm">
              1) Open{" "}
              <a
                className="underline"
                href={session.verification_uri}
                target="_blank"
                rel="noreferrer"
              >
                {session.verification_uri}
              </a>
            </div>

            <div className="text-sm">2) Enter this code:</div>

            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border bg-white px-3 py-2 font-mono text-lg tracking-widest">
                {session.user_code}
              </div>
              <button
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() =>
                  navigator.clipboard.writeText(session.user_code).catch(() => {})
                }
              >
                Copy
              </button>
            </div>

            {status && (
              <div className="text-sm opacity-80">{status}</div>
            )}

            <button
              className="w-full rounded-md border px-3 py-2 text-sm"
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="w-full rounded-md border px-3 py-2 text-sm bg-neutral-900 text-white border-neutral-900 disabled:opacity-60"
            disabled={busy}
            onClick={start}
          >
            {busy ? "Working…" : "Login with GitHub"}
          </button>
        )}
      </div>
    </div>
  )
}
