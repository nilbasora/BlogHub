import * as React from "react"
import { Link } from "@tanstack/react-router"

type Props = {
  onToggleSidebar?: () => void
  rightSlot?: React.ReactNode
  title?: string

  onDeploy?: () => Promise<void> | void
  deployDisabled?: boolean
}

export function AdminTopbar({ onToggleSidebar, rightSlot, title, onDeploy, deployDisabled }: Props) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-white">
      <div className="h-full px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="md:hidden rounded-md border px-2 py-1 text-sm"
            onClick={onToggleSidebar}
            aria-label="Toggle menu"
            type="button"
          >
            ☰
          </button>

          <div className="font-semibold truncate">{title ?? "Admin"}</div>
        </div>

        <div className="flex items-center gap-3">
          {onDeploy ? (
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm"
              disabled={deployDisabled}
              onClick={onDeploy}
              title={deployDisabled ? "Continuous deployment is enabled" : "Merge develop into main"}
            >
              Deploy
            </button>
          ) : null}

          <Link to="/" className="text-sm underline opacity-80 hover:opacity-100">
            View site
          </Link>

          {rightSlot ?? <div className="text-xs opacity-70">Not logged in</div>}
        </div>
      </div>
    </header>
  )
}
