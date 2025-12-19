import * as React from "react"

type Props = {
  open: boolean
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title = "Are you sure?",
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) setBusy(false)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onCancel} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-white border shadow">
          <div className="p-4 space-y-2">
            <div className="text-base font-semibold">{title}</div>
            {description ? <div className="text-sm opacity-80">{description}</div> : null}
          </div>

          <div className="p-4 pt-0 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm"
              disabled={busy}
              onClick={onCancel}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className={[
                "rounded-md px-3 py-2 text-sm border",
                destructive ? "bg-red-600 text-white border-red-600" : "bg-neutral-900 text-white border-neutral-900",
                busy ? "opacity-70" : "",
              ].join(" ")}
              disabled={busy}
              onClick={async () => {
                try {
                  setBusy(true)
                  await onConfirm()
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? "Working..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
