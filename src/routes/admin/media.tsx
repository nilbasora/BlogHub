import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FormField } from "@/components/admin/FormField"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"

import type { MediaIndex, MediaIndexItem, MediaType } from "@/core/utils/types"

import { loadMediaIndexFromRepo } from "@/core/media/loadMediaIndexFromRepo"
import { commitMediaFile, deleteMediaFile } from "@/core/github/commit"
import { withBase } from "@/core/config/paths"

import { MediaEditorDialog } from "@/components/admin/MediaEditorDialog"

const BRANCH = "develop"

export const Route = createFileRoute("/admin/media")({
  loader: async () => {
    const idx = await loadMediaIndexFromRepo(BRANCH)
    return { idx }
  },
  component: AdminMediaPage,
})

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

function pill(active: boolean) {
  return cx(
    "inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs shadow-sm transition",
    active
      ? "border-neutral-900 bg-neutral-900 text-white"
      : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
  )
}

function typePillClass(t: MediaType) {
  if (t === "image") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (t === "gif") return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800"
  if (t === "video") return "border-sky-200 bg-sky-50 text-sky-800"
  return "border-neutral-200 bg-neutral-50 text-neutral-700"
}

function guessTypeByName(name: string): MediaType {
  const lower = name.toLowerCase()
  if (lower.endsWith(".gif")) return "gif"
  if (/\.(png|jpg|jpeg|webp|avif|svg)$/.test(lower)) return "image"
  if (/\.(mp4|webm|mov|m4v)$/.test(lower)) return "video"
  return "other"
}

function newMediaId(): string {
  return crypto.randomUUID()
}

function formatBytes(bytes?: number): string | null {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) return null
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function formatDimensions(w?: number, h?: number) {
  if (!w || !h) return null
  return `${w}×${h}`
}

function formatDate(v?: string) {
  if (!v) return null
  const d = new Date(v)
  if (!Number.isFinite(d.getTime())) return v
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(d)
  } catch {
    return v
  }
}

type SortKey = "path" | "type" | "size" | "createdAt" | "usedBy"
type SortDir = "asc" | "desc"

function safeDateValue(v?: string) {
  if (!v) return Number.NaN
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : Number.NaN
}

function fileNameFromPath(path: string) {
  return path.split("/").pop() ?? path
}

function AdminMediaPage() {
  const { idx } = Route.useLoaderData() as { idx: MediaIndex }

  const [query, setQuery] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<MediaType | "all">("all")

  const [sortKey, setSortKey] = React.useState<SortKey>("path")
  const [sortDir, setSortDir] = React.useState<SortDir>("asc")

  const [confirm, setConfirm] = React.useState<{
    open: boolean
    path: string | null
    usedBy: string[]
  }>({ open: false, path: null, usedBy: [] })

  // Local mirror so uploads/deletes show instantly
  const [items, setItems] = React.useState<MediaIndexItem[]>(() =>
    (idx.items ?? []).map((it) => ({ ...it, usedBy: it.usedBy ?? [] }))
  )

  React.useEffect(() => {
    setItems((idx.items ?? []).map((it) => ({ ...it, usedBy: it.usedBy ?? [] })))
  }, [idx])

  const [busyPaths, setBusyPaths] = React.useState<Record<string, boolean>>({})
  const [isUploading, setIsUploading] = React.useState(false)

  // Drag & drop UI state
  const [isDragOver, setIsDragOver] = React.useState(false)
  const dragDepthRef = React.useRef(0)

  // Hover preview state (desktop)
  const [preview, setPreview] = React.useState<{
    open: boolean
    src: string
    name: string
    x: number
    y: number
  }>({ open: false, src: "", name: "", x: 0, y: 0 })

  // Editor state
  const [editor, setEditor] = React.useState<{
    open: boolean
    path: string | null
    src: string
    filename: string
  }>({ open: false, path: null, src: "", filename: "" })

  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
  }

  function showPreview(e: React.MouseEvent, src: string, name: string) {
    const padding = 16
    const w = 520
    const h = 360

    const x = clamp(e.clientX + 18, padding, window.innerWidth - w - padding)
    const y = clamp(e.clientY + 18, padding, window.innerHeight - h - padding)

    setPreview({ open: true, src, name, x, y })
  }

  function movePreview(e: React.MouseEvent) {
    setPreview((p) => {
      if (!p.open) return p
      const padding = 16
      const w = 520
      const h = 360

      const x = clamp(e.clientX + 18, padding, window.innerWidth - w - padding)
      const y = clamp(e.clientY + 18, padding, window.innerHeight - h - padding)

      return { ...p, x, y }
    })
  }

  function hidePreview() {
    setPreview((p) => (p.open ? { ...p, open: false } : p))
  }

  function setBusy(path: string, v: boolean) {
    setBusyPaths((prev) => ({ ...prev, [path]: v }))
  }

  const rows: MediaIndexItem[] = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = (items ?? [])
      .filter((r) => (typeFilter === "all" ? true : r.type === typeFilter))
      .filter((r) => (q ? r.path.toLowerCase().includes(q) : true))

    const cmpStr = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" })

    filtered.sort((a, b) => {
      let v = 0
      if (sortKey === "path") v = cmpStr(a.path, b.path)
      else if (sortKey === "type") v = cmpStr(String(a.type ?? ""), String(b.type ?? ""))
      else if (sortKey === "size") v = (a.size ?? -1) - (b.size ?? -1)
      else if (sortKey === "createdAt") v = (safeDateValue(a.createdAt) || 0) - (safeDateValue(b.createdAt) || 0)
      else if (sortKey === "usedBy") v = (a.usedBy?.length ?? 0) - (b.usedBy?.length ?? 0)

      return sortDir === "asc" ? v : -v
    })

    return filtered
  }, [items, query, typeFilter, sortKey, sortDir])

  const total = items.length
  const visible = rows.length

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.isArray(fileList) ? fileList : Array.from(fileList)
    if (files.length === 0) return

    setIsUploading(true)
    try {
      for (const f of files) {
        const safeName = f.name.replace(/\s+/g, "-")
        const path = `/media/${safeName}`

        const optimistic: MediaIndexItem = {
          id: newMediaId(),
          path,
          type: guessTypeByName(safeName),
          usedBy: [],
          size: f.size,
          createdAt: new Date().toISOString().slice(0, 10),
        }

        // optimistic add/replace
        setItems((prev) => {
          const without = prev.filter((it) => it.path !== path)
          return [optimistic, ...without].sort((a, b) => (a.path < b.path ? -1 : 1))
        })

        setBusy(path, true)
        try {
          await commitMediaFile({
            publicPath: path,
            file: f,
            message: `chore: upload media ${path}`,
          })
        } catch (err) {
          // revert
          setItems((prev) => prev.filter((it) => it.path !== path))
          throw err
        } finally {
          setBusy(path, false)
        }
      }

      alert("Upload committed to GitHub ✅\nNote: media-index.json updates after your generator runs.")
    } catch (err: any) {
      console.error(err)
      alert(`Upload failed.\n\n${err?.message || err}`)
    } finally {
      setIsUploading(false)
      const input = document.getElementById("media-upload-input") as HTMLInputElement | null
      if (input) input.value = ""
    }
  }

  function handleFileInput(files: FileList | null) {
    if (!files || files.length === 0) return
    void uploadFiles(files)
  }

  // Drag & drop handlers
  function onDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current += 1
    setIsDragOver(true)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "copy"
    setIsDragOver(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current -= 1
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0
      setIsDragOver(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = 0
    setIsDragOver(false)

    if (isUploading) return
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return
    void uploadFiles(files)
  }

  function requestDelete(path: string, usedBy: string[]) {
    if ((usedBy ?? []).length > 0) {
      setConfirm({ open: true, path, usedBy })
      return
    }
    void doDelete(path)
  }

  async function doDelete(path: string) {
    if (!path) return

    const prevItem = items.find((it) => it.path === path) || null
    setItems((prev) => prev.filter((it) => it.path !== path))

    setBusy(path, true)
    try {
      await deleteMediaFile(path)
      alert(`Deleted & committed ✅\n${path}\n\nNote: media-index.json updates after your generator runs.`)
    } catch (err: any) {
      console.error(err)
      if (prevItem) {
        setItems((prev) => {
          const next = [prevItem, ...prev]
          return next.sort((a, b) => (a.path < b.path ? -1 : 1))
        })
      }
      alert(`Delete failed.\n\n${err?.message || err}`)
    } finally {
      setBusy(path, false)
    }
  }

  async function confirmDelete() {
    if (!confirm.path) return
    const path = confirm.path
    setConfirm({ open: false, path: null, usedBy: [] })
    await doDelete(path)
  }

  function copyMarkdown(path: string) {
    const md = `![](${withBase(path)})`
    navigator.clipboard?.writeText(md)
    alert(`Copied: ${md}`)
  }

  function openEditorFor(path: string) {
    const filename = fileNameFromPath(path)
    setEditor({
      open: true,
      path,
      src: withBase(path),
      filename,
    })
  }

  return (
    <div
      className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-neutral-50 to-white"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Media</h1>
            <p className="text-sm text-neutral-600">Upload and manage media.</p>
          </div>

          <div className="flex items-center gap-2">
            <label
              className={cx(
                "inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm shadow-sm",
                "hover:bg-neutral-50 active:translate-y-[1px] transition cursor-pointer",
                isUploading && "opacity-60 cursor-not-allowed"
              )}
            >
              Upload
              <input
                id="media-upload-input"
                type="file"
                className="hidden"
                multiple
                onChange={(e) => handleFileInput(e.target.files)}
                disabled={isUploading}
              />
            </label>
          </div>
        </header>

        {/* Drag overlay */}
        {isDragOver ? (
          <div className="fixed inset-0 z-50 pointer-events-none">
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-none rounded-2xl border border-dashed border-neutral-300 bg-white/90 px-10 py-8 text-center shadow-2xl backdrop-blur">
                <div className="text-lg font-semibold text-neutral-900">Drop files to upload</div>
                <div className="text-sm text-neutral-600 mt-1">They will be committed to GitHub immediately.</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Filters / sorting */}
        <section className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
              <div className="sm:col-span-7">
                <FormField label="Search">
                  <input
                    className={inputBase()}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="hello.png"
                  />
                </FormField>
              </div>

              <div className="sm:col-span-5">
                {/* hint=" " keeps Search + Type aligned (same FormField height) */}
                <FormField label="Type" hint=" ">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={pill(typeFilter === "all")} onClick={() => setTypeFilter("all")}>
                      All
                    </button>
                    <button type="button" className={pill(typeFilter === "image")} onClick={() => setTypeFilter("image")}>
                      Images
                    </button>
                    <button type="button" className={pill(typeFilter === "gif")} onClick={() => setTypeFilter("gif")}>
                      GIFs
                    </button>
                    <button type="button" className={pill(typeFilter === "video")} onClick={() => setTypeFilter("video")}>
                      Videos
                    </button>
                    <button type="button" className={pill(typeFilter === "other")} onClick={() => setTypeFilter("other")}>
                      Other
                    </button>
                  </div>
                </FormField>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="text-xs text-neutral-600">
                Showing <span className="font-medium text-neutral-900">{visible}</span> of{" "}
                <span className="font-medium text-neutral-900">{total}</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-600">Sort</label>
                <select
                  className={cx(
                    "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm",
                    "outline-none focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/10"
                  )}
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                >
                  <option value="path">Path</option>
                  <option value="type">Type</option>
                  <option value="size">Size</option>
                  <option value="createdAt">Created</option>
                  <option value="usedBy">Used by</option>
                </select>

                <button
                  type="button"
                  className={cx(
                    "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm",
                    "hover:bg-neutral-50 active:translate-y-[1px] transition"
                  )}
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  title="Toggle sort direction"
                >
                  {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
                </button>
              </div>
            </div>
          </div>

          {isUploading ? <div className="mt-2 text-xs text-neutral-600">Uploading/committing…</div> : null}
        </section>

        {/* List */}
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold text-neutral-600 border-b border-neutral-100 bg-neutral-50/60">
            <div className="col-span-7">File</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Used by</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {rows.length === 0 ? (
            <div className="p-5 text-sm text-neutral-600">
              No media found.
              {query.trim() || typeFilter !== "all" ? (
                <button
                  type="button"
                  className="ml-2 underline text-neutral-900"
                  onClick={() => {
                    setQuery("")
                    setTypeFilter("all")
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {rows.map((m) => {
                const usedBy = m.usedBy ?? []
                const busy = !!busyPaths[m.path]
                const sizeLabel = formatBytes(m.size)
                const dims = formatDimensions(m.width, m.height)
                const created = formatDate(m.createdAt)

                const isImageLike =
                  m.type === "image" || m.type === "gif" || m.path.match(/\.(png|jpg|jpeg|webp|svg|gif|avif)$/i)

                return (
                  <div key={m.id || m.path} className="px-5 py-4">
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-12 items-center gap-3">
                      <div className="col-span-7 min-w-0 flex items-center gap-3">
                        <div
                          className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
                          onMouseEnter={(e) => {
                            if (!isImageLike) return
                            showPreview(e, withBase(m.path), fileNameFromPath(m.path))
                          }}
                          onMouseMove={(e) => {
                            if (!isImageLike) return
                            movePreview(e)
                          }}
                          onMouseLeave={hidePreview}
                        >
                          {isImageLike ? (
                            <img src={withBase(m.path)} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[10px] text-neutral-400">
                              {String(m.type ?? "file").toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="font-mono text-xs text-neutral-900 break-all">{fileNameFromPath(m.path)}</div>

                          <div className="mt-1 text-xs text-neutral-500 flex flex-wrap gap-x-3 gap-y-1">
                            {created ? <span>Added: {created}</span> : null}
                            {sizeLabel ? <span>Size: {sizeLabel}</span> : null}
                            {dims ? <span>Dimensions: {dims}</span> : null}
                            {busy ? <span className="text-neutral-700">Working…</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2">
                        <span className={cx("inline-flex rounded-full border px-2 py-1 text-xs", typePillClass(m.type))}>
                          {m.type}
                        </span>
                      </div>

                      <div className="col-span-2">
                        {usedBy.length === 0 ? (
                          <span className="text-xs text-neutral-600">—</span>
                        ) : (
                          <details className="text-xs">
                            <summary className="cursor-pointer underline text-neutral-800">{usedBy.length} post(s)</summary>
                            <div className="mt-2 space-y-1">
                              {usedBy.map((pid) => (
                                <div key={pid} className="font-mono text-[11px] text-neutral-600">
                                  {pid}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>

                      <div className="col-span-1 flex justify-end gap-2">
                        {isImageLike ? (
                          <button
                            type="button"
                            className="text-xs rounded-lg px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
                            onClick={() => openEditorFor(m.path)}
                            disabled={busy}
                            title="Edit image"
                          >
                            Edit
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="text-xs rounded-lg px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
                          onClick={() => copyMarkdown(m.path)}
                          disabled={busy}
                          title="Copy markdown"
                        >
                          Copy
                        </button>

                        <button
                          type="button"
                          className="text-xs rounded-lg px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          onClick={() => requestDelete(m.path, usedBy)}
                          disabled={busy}
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                          {isImageLike ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={withBase(m.path)} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[10px] text-neutral-400">
                              {String(m.type ?? "file").toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs text-neutral-900 break-all">{m.path}</div>

                          <div className="mt-1 text-xs text-neutral-500 flex flex-wrap gap-x-3 gap-y-1">
                            {created ? <span>Added: {created}</span> : null}
                            {sizeLabel ? <span>Size: {sizeLabel}</span> : null}
                            {dims ? <span>Dimensions: {dims}</span> : null}
                            <span
                              className={cx("inline-flex rounded-full border px-2 py-0.5 text-[11px]", typePillClass(m.type))}
                            >
                              {m.type}
                            </span>
                            {busy ? <span className="text-neutral-700">Working…</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-neutral-600">
                        <div>
                          Used by: <span className="font-medium text-neutral-900">{usedBy.length ? usedBy.length : "—"}</span>
                        </div>
                      </div>

                      {usedBy.length ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer underline text-neutral-800">Show post references</summary>
                          <div className="mt-2 space-y-1">
                            {usedBy.map((pid) => (
                              <div key={pid} className="font-mono text-[11px] text-neutral-600">
                                {pid}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}

                      <div className="flex items-center gap-2">
                        {isImageLike ? (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50 disabled:opacity-60"
                            onClick={() => openEditorFor(m.path)}
                            disabled={busy}
                          >
                            Edit
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50 disabled:opacity-60"
                          onClick={() => copyMarkdown(m.path)}
                          disabled={busy}
                        >
                          Copy
                        </button>

                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-60"
                          onClick={() => requestDelete(m.path, usedBy)}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <ConfirmDialog
          open={confirm.open}
          title="This media is in use"
          description={
            confirm.usedBy.length
              ? `This file is referenced by: ${confirm.usedBy.join(", ")}. Delete anyway?`
              : "Delete this file?"
          }
          confirmText="Delete"
          cancelText="Cancel"
          destructive
          onCancel={() => setConfirm({ open: false, path: null, usedBy: [] })}
          onConfirm={confirmDelete}
        />
      </div>

      {/* Hover preview overlay */}
      {preview.open ? (
        <div className="fixed z-[9999] pointer-events-none" style={{ left: preview.x, top: preview.y, width: 520 }}>
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-3 py-2 text-xs text-neutral-700 border-b border-neutral-100">
              <span className="font-mono">{preview.name}</span>
            </div>

            <div className="bg-neutral-50">
              <img
                src={preview.src}
                alt=""
                className="block w-full"
                style={{ maxHeight: 340, objectFit: "contain" }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Image editor modal */}
      <MediaEditorDialog
        open={editor.open}
        src={editor.src}
        filename={editor.filename}
        onClose={() => setEditor({ open: false, path: null, src: "", filename: "" })}
        onSave={async (blob) => {
          if (!editor.path) return

          // Overwrite same path by default
          const name = fileNameFromPath(editor.path)
          const file = new File([blob], name, { type: blob.type || "image/png" })

          setBusy(editor.path, true)
          try {
            await commitMediaFile({
              publicPath: editor.path,
              file,
              message: `chore: edit media ${editor.path}`,
            })

            alert("Edited image committed to GitHub ✅\nNote: media-index.json updates after your generator runs.")
          } catch (err: any) {
            console.error(err)
            alert(`Save failed.\n\n${err?.message || err}`)
          } finally {
            setBusy(editor.path, false)
          }
        }}
      />
    </div>
  )
}
