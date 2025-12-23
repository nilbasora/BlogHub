import * as React from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  exchangeCodeForToken,
  readLoginNext,
  clearLoginNext,
  validateTokenForRepo,
  setGithubToken,
  clearGithubToken,
  setLoginError,
} from "@/core/github/oauth"
import { ensureDevelopSyncedWithMain, rollbackDevelop } from "@/core/github/branches"

export const Route = createFileRoute("/login/callback")({
  component: LoginCallbackPage,
})

function LoginCallbackPage() {
  const navigate = useNavigate()
  const [msg, setMsg] = React.useState("Completing GitHub login...")

  React.useEffect(() => {
    ;(async () => {
      let token: string | null = null
      let rollbackInfo: { previousDevelopSha: string | null } | null = null

      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")
        const state = url.searchParams.get("state")
        if (!code || !state) throw new Error("Missing code/state")

        setMsg("Exchanging code for token...")
        token = await exchangeCodeForToken(code, state)

        setMsg("Validating repo access...")
        await validateTokenForRepo(token)

        setMsg("Checking branches (main/develop)...")
        rollbackInfo = await ensureDevelopSyncedWithMain(token)

        // ✅ Only store token after repo is in a good state
        setGithubToken(token)

        const next = readLoginNext()
        clearLoginNext()
        navigate({ to: next })
      } catch (e: any) {
        // If a merge succeeded and THEN something failed, rollback develop.
        try {
          if (token && rollbackInfo?.previousDevelopSha) {
            await rollbackDevelop(token, rollbackInfo.previousDevelopSha)
          }
        } catch {
          // swallow rollback errors; we still block login
        }

        // Ensure we don't keep a token when repo checks fail
        clearGithubToken()

        const friendly = e?.message ?? String(e)
        setLoginError(friendly)

        // Send user back to login page showing the error
        navigate({ to: "/login" })
      }
    })()
  }, [navigate])

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 space-y-3">
        <div className="text-lg font-semibold">GitHub Login</div>
        <div className="text-sm opacity-80">{msg}</div>
      </div>
    </div>
  )
}
