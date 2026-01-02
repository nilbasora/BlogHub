import * as React from "react"
import type { MediaIndex, MediaIndexItem } from "@/core/utils/types"
import { loadMediaIndexFromRepo } from "@/core/media/loadMediaIndexFromRepo"
import { withBase } from "@/core/config/paths"

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

function inputBase(className?: string) {
  return cx(
    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm",
    "outline-none transition",
    "focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/10",
    className
  )
}

function toPreviewUrl(v: string) {
  const s = (v ?? "").trim()
  if (!s) return ""
  // If already absolute (http/https/data/blob), don't rewrite it
  if (/^(https?:|data:|blob:)/i.test(s)) return s
  return withBase(s)
}

export type MediaPickerProps = {
  value: string
  onChange: (next: string) => void
  branch: string
  label: string
  help?: string
  accept?: "image" | "any"
  compactPreview?: boolean
  disabled?: boolean
  clearLabel?: string
  chooseLabel?: string
}

export function MediaPicker({
  value,
  onChange,
  branch,
  label,
  help,
  accept = "image",
  compactPreview = false,
  disabled = false,
  clearLabel = "Clear",
  chooseLabel = "Choose from media…",
}: MediaPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [index, setIndex] = React.useState<MediaIndex | null>(null)
  const [q, setQ] = React.useState("")
  const [active, setActive] = React.useState<"images" | "all">("images")

  const previewSrc = toPreviewUrl(value ?? "")

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await loadMediaIndexFromRepo(branch)
      setIndex(res)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }, [branch])

  React.useEffect(() => {
    if (open && !index && !loading) load()
  }, [open, index, loading, load])

  const items = React.useMemo(() => {
    const raw = index?.items ?? []

    const isImageLike = (it: MediaIndexItem) =>
      (it.type ?? "other") === "image" || it.path.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i)

    const filteredByType = accept === "any" ? raw : raw.filter(isImageLike)
    const filteredByTab = active === "all" ? filteredByType : filteredByType.filter(isImageLike)

    const qq = q.trim().toLowerCase()
    if (!qq) return filteredByTab

    return filteredByTab.filter((it) => {
      const hay = `${it.id} ${it.path} ${(it.usedBy ?? []).join(" ")}`.toLowerCase()
      return hay.includes(qq)
    })
  }, [index, q, accept, active])

  const pick = (it: MediaIndexItem) => {
    onChange(it.path)
    setOpen(false)
  }

  return (
    <div className="space-y-3">
      <div className={cx("flex items-start gap-4", compactPreview && "items-center")}>
        <div
          className={cx(
            "rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden",
            compactPreview ? "h-12 w-12" : "h-16 w-16"
          )}
          title={previewSrc || "No selection"}
        >
          {previewSrc ? (
            <img src={previewSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-[10px] text-neutral-400">No file</div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cx(
                "inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm",
                "hover:bg-neutral-50 active:translate-y-[1px] transition",
                disabled && "opacity-50 pointer-events-none"
              )}
              onClick={() => setOpen(true)}
              disabled={disabled}
            >
              {chooseLabel}
            </button>

            <button
              type="button"
              className={cx(
                "inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm",
                "hover:bg-neutral-50 active:translate-y-[1px] transition",
                (disabled || !value) && "opacity-50 pointer-events-none"
              )}
              onClick={() => onChange("")}
              disabled={disabled || !value}
            >
              {clearLabel}
            </button>
          </div>

          {help ? <div className="text-xs text-neutral-500">{help}</div> : null}
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 top-1/2 w-[min(980px,95vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900">{label}</div>
                <div className="text-xs text-neutral-500">
                  Pick an asset from <span className="font-mono">{branch}</span> →{" "}
                  <span className="font-mono">public/generated/media-index.json</span>
                </div>
              </div>

              <button
                type="button"
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={cx(
                      "rounded-xl border px-3 py-2 text-sm shadow-sm transition",
                      active === "images"
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white hover:bg-neutral-50"
                    )}
                    onClick={() => setActive("images")}
                  >
                    Images
                  </button>
                  <button
                    type="button"
                    className={cx(
                      "rounded-xl border px-3 py-2 text-sm shadow-sm transition",
                      active === "all"
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white hover:bg-neutral-50"
                    )}
                    onClick={() => setActive("all")}
                  >
                    All
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    className={inputBase("w-full sm:w-[360px]")}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search by filename, id, usedBy…"
                  />
                  <button
                    type="button"
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
                    onClick={load}
                    disabled={loading}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-600">
                  Loading media index…
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                  Failed to load media index: <span className="font-mono">{error}</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {items.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => pick(it)}
                      className={cx(
                        "group rounded-2xl border border-neutral-200 bg-white p-2 text-left shadow-sm transition",
                        "hover:-translate-y-[1px] hover:shadow-md hover:border-neutral-300"
                      )}
                      title={it.path}
                    >
                      <div className="aspect-square w-full overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50">
                        <img
                          src={withBase(it.path)}
                          alt=""
                          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="truncate text-xs font-medium text-neutral-900">{it.id}</div>
                        <div className="truncate text-[11px] font-mono text-neutral-500">{it.path}</div>
                      </div>
                    </button>
                  ))}

                  {items.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-600">
                      No matching files.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
