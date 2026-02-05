import * as React from "react"
import type { MediaIndexItem, MediaType } from "@/core/domain/types"
import { loadMediaIndexFromRepo } from "@/core/content/repo"
import { commitMediaFile, deleteMediaFile } from "@/core/api/github/commit"
import { withBase } from "@/core/config/paths"
import { Trash2 } from "lucide-react"

const BRANCH = "develop"

function guessMediaType(path: string): MediaType {
  const p = path.toLowerCase()
  if (/\.(png|jpg|jpeg|webp|avif|svg)$/.test(p)) return "image"
  if (/\.(gif)$/.test(p)) return "gif"
  if (/\.(mp4|webm|mov)$/.test(p)) return "video"
  return "other"
}

function safeFilename(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function fileNameFromPath(path: string) {
  return path.split("/").pop() ?? path
}

function splitNameExt(filename: string) {
  const i = filename.lastIndexOf(".")
  if (i <= 0) return { base: filename, ext: "" }
  return { base: filename.slice(0, i), ext: filename.slice(i) } // ext includes "."
}

function formatBytes(bytes?: number): string {
  if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes <= 0) return ""
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function formatDimensions(w?: number, h?: number): string {
  if (!w || !h) return ""
  return `${w}×${h}`
}

function uniquePublicPathForFilename(existingPaths: Set<string>, filename: string) {
  const clean = safeFilename(filename)
  const { base, ext } = splitNameExt(clean)

  let n = 2
  let candidate = `/media/${base}${ext}`
  while (existingPaths.has(candidate)) {
    candidate = `/media/${base}-${n}${ext}`
    n += 1
  }
  return candidate
}

function publicPathFromFileName(file: File) {
  const ext =
    file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : ""
  const baseRaw = file.name.replace(/\.[^/.]+$/, "")
  const base = safeFilename(baseRaw) || "media"
  const finalName = ext ? `${base}.${ext}` : base
  return `/media/${finalName}`
}

function newMediaId(): string {
  return crypto.randomUUID()
}

type Props = {
  open: boolean
  onClose: () => void
  onPick: (item: { path: string; type: MediaType }) => void
  currentPostId?: string
}

type ConflictState = {
  open: boolean
  file: File | null
  existingPath: string | null
  filename: string
}

export function MediaLibraryModal({
  open,
  onClose,
  onPick,
  currentPostId,
}: Props) {
  // ✅ hooks always run, regardless of open/closed
  const [items, setItems] = React.useState<MediaIndexItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [query, setQuery] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<MediaType | "all">("all")

  const [selectedPath, setSelectedPath] = React.useState<string | null>(null)
  const selected = React.useMemo(
    () => items.find((x) => x.path === selectedPath) ?? null,
    [items, selectedPath]
  )

  const [busyPaths, setBusyPaths] = React.useState<Record<string, boolean>>({})
  const [isUploading, setIsUploading] = React.useState(false)

  // Drag & drop
  const [isDragOver, setIsDragOver] = React.useState(false)
  const dragDepthRef = React.useRef(0)

  // Filename conflict modal
  const [conflict, setConflict] = React.useState<ConflictState>({
    open: false,
    file: null,
    existingPath: null,
    filename: "",
  })

  const existingPaths = React.useMemo(() => new Set(items.map((i) => i.path)), [items])

  function setBusy(path: string, v: boolean) {
    setBusyPaths((prev) => ({ ...prev, [path]: v }))
  }

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const idx = await loadMediaIndexFromRepo(BRANCH)
      const ui: MediaIndexItem[] = (idx.items ?? []).map((it) => ({
        ...it,
        type: it.type ?? guessMediaType(it.path),
        usedBy: it.usedBy ?? [],
      }))

      ui.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))

      setItems(ui)

      setSelectedPath((prev) => {
        if (!prev) return null
        return ui.some((x) => x.path === prev) ? prev : null
      })
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!open) return
    setQuery("")
    setTypeFilter("all")
    setSelectedPath(null)
    setConflict({ open: false, file: null, existingPath: null, filename: "" })
    refresh()
  }, [open, refresh])

  // ✅ safe to return null now (after hooks)
  if (!open) return null

  const q = query.trim().toLowerCase()
  const filtered = items.filter((it) => {
    if (typeFilter !== "all" && it.type !== typeFilter) return false
    if (!q) return true
    const filename = fileNameFromPath(it.path).toLowerCase()
    return (
      filename.includes(q) ||
      (it.usedBy ?? []).some((u) => u.toLowerCase().includes(q))
    )
  })

  const srcFor = (it: MediaIndexItem) => withBase(it.path)

  async function commitUploadAtPath(file: File, publicPath: string) {
    const optimistic: MediaIndexItem = {
      id: newMediaId(),
      path: publicPath,
      type: guessMediaType(publicPath),
      usedBy: [],
      size: file.size,
      createdAt: new Date().toISOString(),
    }

    setItems((prev) => {
      const without = prev.filter((it) => it.path !== publicPath)
      return [optimistic, ...without]
    })
    setSelectedPath(publicPath)

    setIsUploading(true)
    setBusy(publicPath, true)
    try {
      await commitMediaFile({
        publicPath,
        file,
        message: `chore: upload media ${publicPath}`,
      })
    } catch (e: any) {
      setItems((prev) => prev.filter((it) => it.path !== publicPath))
      setSelectedPath(null)
      alert(e?.message || String(e))
    } finally {
      setBusy(publicPath, false)
      setIsUploading(false)
    }
  }

  async function uploadNew(file: File) {
    const desiredPath = publicPathFromFileName(file)

    if (existingPaths.has(desiredPath)) {
      setConflict({
        open: true,
        file,
        existingPath: desiredPath,
        filename: fileNameFromPath(desiredPath),
      })
      return
    }

    await commitUploadAtPath(file, desiredPath)
  }

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.isArray(files) ? files : Array.from(files)
    if (arr.length === 0) return

    for (const f of arr) {
      if (conflict.open) break
      // eslint-disable-next-line no-await-in-loop
      await uploadNew(f)
    }
  }

  async function deleteByPath(path: string) {
    const ok = window.confirm(`Delete ${path}?`)
    if (!ok) return

    const prevItem = items.find((it) => it.path === path) || null

    setItems((prev) => prev.filter((it) => it.path !== path))
    setSelectedPath((prev) => (prev === path ? null : prev))

    setBusy(path, true)
    try {
      await deleteMediaFile(path)
    } catch (e: any) {
      if (prevItem) setItems((prev) => [prevItem, ...prev])
      setSelectedPath(path)
      alert(e?.message || String(e))
    } finally {
      setBusy(path, false)
    }
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

  const isSelectedBusy = selected ? !!busyPaths[selected.path] : false

  return (
    <div
      className="fixed inset-0 z-50"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          setSelectedPath(null)
          onClose()
        }}
      />

      {isDragOver ? (
        <div className="absolute inset-0 z-[60] pointer-events-none">
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/90 px-10 py-8 text-center shadow-2xl backdrop-blur">
              <div className="text-lg font-semibold text-neutral-900">
                Drop files to upload
              </div>
              <div className="text-sm text-neutral-600 mt-1">
                They will be committed to GitHub immediately.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="absolute left-1/2 top-1/2 w-[min(1200px,95vw)] h-[min(780px,90vh)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="font-semibold">Media Library</div>

          <button
            className="rounded-md border px-3 py-2 text-sm bg-white disabled:opacity-50"
            onClick={refresh}
            disabled={loading || isUploading}
            type="button"
          >
            Refresh
          </button>

          <div className="ml-auto flex items-center gap-2">
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="image">Images</option>
              <option value="gif">GIFs</option>
              <option value="video">Videos</option>
              <option value="other">Other</option>
            </select>

            <input
              className="w-[320px] max-w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Search (filename / usedBy)…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <button
              className="rounded-md border px-3 py-2 text-sm bg-white"
              onClick={() => {
                setSelectedPath(null)
                onClose()
              }}
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-4 border-b flex items-center gap-3">
          <label
            className={[
              "inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm shadow-sm",
              "hover:bg-neutral-50 active:translate-y-[1px] transition cursor-pointer",
              isUploading ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
            title="Upload"
          >
            Upload
            <input
              type="file"
              className="hidden"
              multiple
              accept="image/*,video/*"
              disabled={isUploading}
              onChange={(e) => {
                const files = e.target.files
                if (!files || files.length === 0) return
                setError(null)
                void uploadFiles(files)
                e.currentTarget.value = ""
              }}
            />
          </label>

          {isUploading ? (
            <div className="ml-auto text-xs opacity-70">Uploading/committing…</div>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-8 min-h-0 overflow-auto p-4">
            {loading && <div className="text-sm opacity-70">Loading…</div>}
            {error && (
              <div className="text-sm text-red-600 mb-3">Error: {error}</div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((it) => {
                const isSelected = selectedPath === it.path
                const isUsed = currentPostId
                  ? (it.usedBy ?? []).includes(currentPostId)
                  : false
                const busy = !!busyPaths[it.path]
                const filename = fileNameFromPath(it.path)
                const dims = formatDimensions(it.width, it.height)
                const size = formatBytes(it.size)

                return (
                  <button
                    key={it.id || it.path}
                    type="button"
                    className={`group rounded-lg border overflow-hidden text-left hover:shadow-sm disabled:opacity-60 ${
                      isSelected ? "ring-2 ring-neutral-900" : ""
                    }`}
                    onClick={() => setSelectedPath(it.path)}
                    disabled={busy}
                    title={busy ? "Working…" : it.path}
                  >
                    <div className="aspect-square bg-neutral-50 overflow-hidden flex items-center justify-center relative">
                      <button
                        type="button"
                        className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/90 border shadow-sm opacity-0 group-hover:opacity-100 transition"
                        title="Delete"
                        aria-label="Delete"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          void deleteByPath(it.path)
                        }}
                        disabled={busy}
                      >
                        <Trash2 size={16} />
                      </button>

                      {it.type === "video" ? (
                        <div className="text-xs opacity-70 px-2">Video</div>
                      ) : (
                        <img
                          src={srcFor(it)}
                          alt={filename}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition"
                          loading="lazy"
                        />
                      )}

                      <div className="absolute left-2 top-2 flex gap-1">
                        {isUsed && (
                          <span className="text-[10px] bg-white/90 border rounded px-1.5 py-0.5">
                            Used
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2">
                      <div className="text-xs truncate">{filename}</div>
                      <div className="text-[11px] opacity-60 flex gap-2 flex-wrap">
                        {size ? <span>{size}</span> : null}
                        {dims ? <span>{dims}</span> : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="md:col-span-4 border-l min-h-0 overflow-auto p-4 space-y-3">
            <div className="text-sm font-semibold">Details</div>

            {!selected ? (
              <div className="text-sm opacity-70">Select an item.</div>
            ) : (
              <>
                <div className="rounded-lg border bg-white overflow-hidden">
                  <div className="aspect-video bg-neutral-50 flex items-center justify-center">
                    {selected.type === "video" ? (
                      <div className="text-xs opacity-70 px-2">
                        Video preview not implemented
                      </div>
                    ) : (
                      <img
                        src={srcFor(selected)}
                        alt={fileNameFromPath(selected.path)}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    <div className="text-xs font-mono break-all">
                      {fileNameFromPath(selected.path)}
                    </div>

                    <div className="text-xs opacity-70 flex gap-2 flex-wrap">
                      {formatBytes(selected.size) ? (
                        <span>Size: {formatBytes(selected.size)}</span>
                      ) : null}
                      {formatDimensions(selected.width, selected.height) ? (
                        <span>
                          Dimensions: {formatDimensions(selected.width, selected.height)}
                        </span>
                      ) : null}
                    </div>

                    {selected.usedBy?.length ? (
                      <div className="text-xs">
                        Used by:{" "}
                        <span className="font-mono">{selected.usedBy.join(", ")}</span>
                      </div>
                    ) : (
                      <div className="text-xs opacity-70">Not used by any post.</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm bg-neutral-900 text-white border-neutral-900 disabled:opacity-50"
                    disabled={isSelectedBusy}
                    onClick={() => {
                      onPick({ path: selected.path, type: selected.type })
                      setSelectedPath(null)
                      onClose()
                    }}
                  >
                    Insert into post
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {conflict.open ? (
          <div className="absolute inset-0 z-[70]">
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute left-1/2 top-1/2 w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl border overflow-hidden">
              <div className="p-4 border-b">
                <div className="font-semibold">File already exists</div>
                <div className="text-sm opacity-70 mt-1">
                  <span className="font-mono">{conflict.filename}</span> already exists. What do you want to do?
                </div>
              </div>

              <div className="p-4 border-t flex gap-2 justify-end">
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm bg-white"
                  onClick={() =>
                    setConflict({ open: false, file: null, existingPath: null, filename: "" })
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm bg-white"
                  onClick={async () => {
                    const file = conflict.file
                    if (!file) return
                    const desiredName = fileNameFromPath(publicPathFromFileName(file))
                    const uniquePath = uniquePublicPathForFilename(existingPaths, desiredName)

                    setConflict({ open: false, file: null, existingPath: null, filename: "" })
                    await commitUploadAtPath(file, uniquePath)
                  }}
                >
                  Rename
                </button>

                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm bg-neutral-900 text-white border-neutral-900"
                  onClick={async () => {
                    const file = conflict.file
                    const path = conflict.existingPath
                    if (!file || !path) return

                    setConflict({ open: false, file: null, existingPath: null, filename: "" })
                    await commitUploadAtPath(file, path)
                  }}
                >
                  Replace
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}



