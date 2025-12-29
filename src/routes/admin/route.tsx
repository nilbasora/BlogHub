import * as React from "react"
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { AdminTopbar } from "@/components/admin/AdminTopbar"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { getGithubToken, validateTokenForRepo } from "@/core/github/oauth"
import { checkBranchesSync, deployDevelopToMain } from "@/core/github/deploy"

let validatedToken: string | null = null

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    const token = getGithubToken()
    if (!token) {
      throw redirect({ to: "/login", search: { next: location.href } })
    }

    if (validatedToken !== token) {
      try {
        await validateTokenForRepo(token)
        validatedToken = token
      } catch {
        validatedToken = null
        throw redirect({ to: "/login", search: { next: location.href } })
      }
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [branchesSynced, setBranchesSynced] = React.useState<boolean>(true)
  const [deploying, setDeploying] = React.useState(false)

  // Check branch status on mount
  React.useEffect(() => {
    let cancelled = false

    async function loadBranchStatus() {
      try {
        const syncInfo = await checkBranchesSync("main", "develop")
        if (!cancelled) {
          setBranchesSynced(syncInfo.isSynced)
        }
      } catch {
        // Fail-safe: if we can't check, don't block deploy
        if (!cancelled) {
          setBranchesSynced(false)
        }
      }
    }

    loadBranchStatus()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleDeploy() {
    // If synced, do nothing (button should already be disabled, but this is extra safety)
    if (branchesSynced) return

    try {
      setDeploying(true)
      await deployDevelopToMain()

      // Re-check after deploy
      const syncInfo = await checkBranchesSync("main", "develop")
      setBranchesSynced(syncInfo.isSynced)
    } finally {
      setDeploying(false)
    }
  }

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <AdminTopbar
        onToggleSidebar={() => setMobileOpen((v) => !v)}
        title="Admin Dashboard"
        onDeploy={handleDeploy}
        deployDisabled={branchesSynced || deploying}
      />

      <div className="flex">
        <AdminSidebar variant="desktop" />

        {/* mobile drawer */}
        {mobileOpen ? (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 h-full">
              <AdminSidebar variant="mobile" onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : null}

        <main className="flex-1 min-w-0">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
