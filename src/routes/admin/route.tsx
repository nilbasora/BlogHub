import * as React from "react"
import { Outlet, createFileRoute } from "@tanstack/react-router"
import { AdminTopbar } from "@/admin/components/AdminTopbar"
import { AdminSidebar } from "@/admin/components/AdminSidebar"

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
})

function AdminLayout() {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <AdminTopbar onToggleSidebar={() => setMobileOpen((v) => !v)} title="BlogHub Admin" />

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
