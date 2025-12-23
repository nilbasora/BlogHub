import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { startGithubLogin, readLoginError, clearLoginError } from "@/core/github/oauth"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const e = readLoginError()
    if (e) {
      setErr(e)
      clearLoginError()
    }
  }, [])

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Login</h1>
          <p className="text-sm opacity-80">Sign in with GitHub to access the admin.</p>
        </div>

        {err ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <button
          className="w-full rounded-md border px-3 py-2 text-sm bg-neutral-900 text-white border-neutral-900"
          onClick={async () => {
            const next = new URL(window.location.href).searchParams.get("next") || "/admin/"
            await startGithubLogin(next)
          }}
        >
          Login with GitHub
        </button>
      </div>
    </div>
  )
}
