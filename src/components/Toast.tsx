// src/components/Toast.tsx
import * as React from "react"

export type ToastKind = "success" | "warning" | "error"

type ToastProps = {
  message: string
  kind: ToastKind
  duration?: number // ms
  onClose?: () => void
}

const DEFAULT_DURATION = 3500

export function Toast({ message, kind, duration = DEFAULT_DURATION, onClose }: ToastProps) {
  React.useEffect(() => {
    if (duration <= 0) return
    const id = window.setTimeout(() => onClose?.(), duration)
    return () => window.clearTimeout(id)
  }, [duration, onClose])

  const styles =
    kind === "success"
      ? {
          wrap: "border-emerald-200 bg-white text-emerald-900",
          dot: "bg-emerald-500",
          label: "Success",
        }
      : kind === "warning"
      ? {
          wrap: "border-amber-200 bg-white text-amber-900",
          dot: "bg-amber-500",
          label: "Warning",
        }
      : {
          wrap: "border-rose-200 bg-white text-rose-900",
          dot: "bg-rose-500",
          label: "Error",
        }

  return (
    <div className={`rounded-2xl border shadow-lg ring-1 ring-black/5 ${styles.wrap}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${styles.dot}`} aria-hidden="true" />
        <div className="min-w-0">
          <div className="text-xs font-semibold opacity-80">{styles.label}</div>
          <div className="mt-0.5 text-sm break-words">{message}</div>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto shrink-0 rounded-xl border border-black/10 bg-white px-2 py-1 text-xs hover:bg-neutral-50 transition"
            aria-label="Close"
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  )
}
