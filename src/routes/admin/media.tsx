import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FormField } from "@/components/admin/FormField"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"

import type { MediaIndex, MediaIndexItem, MediaType } from "@/core/utils/types"

import { loadMediaIndexFromRepo } from "@/core/media/loadMediaIndexFromRepo"
import { commitMediaFile, deleteMediaFile } from "@/core/github/commit"

const BRANCH = "develop"

export const Route = createFileRoute("/admin/media")({
  loader: async () => {
    const idx = await loadMediaIndexFromRepo(BRANCH)
    return { idx }
  },
  component: AdminMediaPage,
})

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

function AdminMediaPage() {
  const { idx } = Route.useLoaderData() as { idx: MediaIndex }

  const [query, setQuery] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<MediaType | "all">("all")

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

  function setBusy(path: string, v: boolean) {
    setBusyPaths((prev) => ({ ...prev, [path]: v }))
  }

  const rows: MediaIndexItem[] = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? [])
      .filter((r) => (typeFilter === "all" ? true : r.type === typeFilter))
      .filter((r) => (q ? r.path.toLowerCase().includes(q) : true))
      .sort((a, b) => (a.path < b.path ? -1 : 1))
  }, [items, query, typeFilter])

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

      alert(
        "Upload committed to GitHub ✅\nNote: media-index.json updates after your generator runs."
      )
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
    // Needed so drop works
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
      alert(
        `Deleted & committed ✅\n${path}\n\nNote: media-index.json updates after your generator runs.`
      )
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
    const md = `![](${path})`
    navigator.clipboard?.writeText(md)
    alert(`Copied: ${md}`)
  }

  return (
    <div
      className="max-w-6xl space-y-6"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Media</h1>
          <p className="text-sm opacity-80">
            Upload and manage media. Deleting in-use items will warn you.
          </p>
        </div>

        <div className="flex gap-2">
          <label className="rounded-md border px-3 py-2 text-sm bg-white hover:bg-neutral-50 cursor-pointer">
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
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-none rounded-2xl border border-dashed bg-white/90 px-10 py-8 text-center shadow-lg">
              <div className="text-lg font-semibold">Drop files to upload</div>
              <div className="text-sm opacity-70 mt-1">
                They will be committed to GitHub immediately.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-7">
            <FormField label="Search" hint="Filter by path/filename.">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="hello.png"
              />
            </FormField>
          </div>

          <div className="md:col-span-5">
            <FormField label="Type">
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="image">Images</option>
                <option value="gif">GIFs</option>
                <option value="video">Videos</option>
                <option value="other">Other</option>
              </select>
            </FormField>
          </div>
        </div>

        {isUploading ? (
          <div className="text-xs opacity-70">
            Uploading/committing… (you can keep browsing)
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border bg-white overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-semibold opacity-70 border-b">
          <div className="col-span-7">Path</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Used by</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {rows.length === 0 ? (
          <div className="p-4 text-sm opacity-70">No media found.</div>
        ) : (
          rows.map((m) => {
            const usedBy = m.usedBy ?? []
            const busy = !!busyPaths[m.path]
            const sizeLabel = formatBytes(m.size)

            return (
              <div
                key={m.id || m.path}
                className="grid grid-cols-12 gap-3 px-4 py-3 text-sm border-b last:border-b-0"
              >
                <div className="col-span-7 min-w-0">
                  <div className="font-mono text-xs break-all">{m.path}</div>
                  <div className="text-xs opacity-60 flex flex-wrap gap-x-3 gap-y-1">
                    {m.createdAt ? <span>Added: {m.createdAt}</span> : null}
                    {sizeLabel ? <span>Size: {sizeLabel}</span> : null}
                    {busy ? <span className="opacity-80">Working…</span> : null}
                  </div>
                </div>

                <div className="col-span-2">
                  <span className="rounded border px-2 py-0.5 text-xs">{m.type}</span>
                </div>

                <div className="col-span-2">
                  {usedBy.length === 0 ? (
                    <span className="text-xs opacity-70">—</span>
                  ) : (
                    <details className="text-xs">
                      <summary className="cursor-pointer underline">
                        {usedBy.length} post(s)
                      </summary>
                      <div className="mt-2 space-y-1">
                        {usedBy.map((pid) => (
                          <div key={pid} className="font-mono opacity-80">
                            {pid}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>

                <div className="col-span-1 flex justify-end gap-2">
                  <button
                    className="text-xs underline disabled:opacity-50"
                    onClick={() => copyMarkdown(m.path)}
                    disabled={busy}
                  >
                    Copy
                  </button>

                  <button
                    className="text-xs underline text-red-700 disabled:opacity-50"
                    onClick={() => requestDelete(m.path, usedBy)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })
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
  )
}
