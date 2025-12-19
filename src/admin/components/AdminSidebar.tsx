import { Link, useRouterState } from "@tanstack/react-router"

export type AdminNavItem = {
  to: string
  label: string
}

const NAV: AdminNavItem[] = [
  { to: "/admin/", label: "Dashboard" },
  { to: "/admin/settings", label: "Site settings" },
  { to: "/admin/posts", label: "Blog posts" },
  { to: "/admin/media", label: "Media" },
  { to: "/admin/theme", label: "Theme" },
]

function isActive(pathname: string, to: string) {
  if (to.endsWith("/")) return pathname === to
  return pathname === to || pathname.startsWith(to + "/")
}

type Props = {
  variant?: "desktop" | "mobile"
  onNavigate?: () => void
}

export function AdminSidebar({ variant = "desktop", onNavigate }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <aside
      className={[
        "bg-white",
        variant === "desktop"
          ? "hidden md:block w-64 border-r min-h-[calc(100dvh-56px)]"
          : "w-72 h-full border-r",
      ].join(" ")}
    >
      <nav className="p-3 space-y-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => onNavigate?.()}
              className={[
                "block rounded-md px-3 py-2 text-sm",
                active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100",
              ].join(" ")}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
