import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FormField } from "@/admin/components/FormField"
import { ConfirmDialog } from "@/admin/components/ConfirmDialog" // use whichever path you actually have
import { loadMediaIndex } from "@/core/media/loadMediaIndex"
import { loadMediaUsage } from "@/core/media/loadMediaUsage"
import type { MediaRow, MediaType } from "@/core/media/types"
import {
  addDraftMedia,
  clearMediaDraft,
  getMediaDraftState,
  stageDeleteMedia,
} from "@/core/media/mediaDraftStore"

export const Route = createFileRoute("/admin/media")({
  loader: async () => {
    const [idx, usage] = await Promise.all([loadMediaIndex(), loadMediaUsage()])
    return { idx, usage }
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

function AdminMediaPage() {
  const { idx, usage } = Route.useLoaderData()

  const [query, setQuery] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<MediaType | "all">("all")

  const [confirm, setConfirm] = React.useState<{
    open: boolean
    path: string | null
    usedBy: string[]
  }>({ open: false, path: null, usedBy: [] })

  const [refreshKey, setRefreshKey] = React.useState(0)

  // merge repo index + local staged changes
  const rows: MediaRow[] = React.useMemo(() => {
    const draft = getMediaDraftState()

    const base = idx.items
      .filter((it) => !draft.deletedPaths.includes(it.path))
      .map((it) => ({
        ...it,
        usedBy: usage.usage[it.path] ?? [],
      }))

    const added = draft.added.map((it) => ({
      ...it,
      usedBy: usage.usage[it.path] ?? [],
    }))

    const all = [...added, ...base]

    const q = query.trim().toLowerCase()
    return all
      .filter((r) => (typeFilter === "all" ? true : r.type === typeFilter))
      .filter((r) => (q ? r.path.toLowerCase().includes(q) : true))
      .sort((a, b) => (a.path < b.path ? -1 : 1))
  }, [idx.items, usage.usage, query, typeFilter, refreshKey])

  function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return

    // For now: stage entries using /media/<filename>.
    // Later: we’ll upload the binaries to GitHub repo and commit.
    Array.from(files).forEach((f) => {
      const safeName = f.name.replace(/\s+/g, "-")
      const path = `/media/${safeName}`
      addDraftMedia({
        path,
        type: guessTypeByName(safeName),
        createdAt: new Date().toISOString().slice(0, 10),
      })
    })

    setRefreshKey((k) => k + 1)
    alert("Staged upload locally. (Next step: commit to GitHub repo.)")
  }

  function requestDelete(path: string, usedBy: string[]) {
    if (usedBy.length > 0) {
      setConfirm({ open: true, path, usedBy })
      return
    }
    stageDeleteMedia(path)
    setRefreshKey((k) => k + 1)
  }

  async function confirmDelete() {
    if (!confirm.path) return
    stageDeleteMedia(confirm.path)
    setConfirm({ open: false, path: null, usedBy: [] })
    setRefreshKey((k) => k + 1)
  }

  function copyMarkdown(path: string) {
    const md = `![](${path})`
    navigator.clipboard?.writeText(md)
    alert(`Copied: ${md}`)
  }

  return (
    <div className="max-w-6xl space-y-6">
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
              type="file"
              className="hidden"
              multiple
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>

          <button
            className="rounded-md border px-3 py-2 text-sm bg-white"
            onClick={() => {
              clearMediaDraft()
              setRefreshKey((k) => k + 1)
              alert("Local media draft cleared.")
            }}
          >
            Clear local draft
          </button>
        </div>
      </header>

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
          rows.map((m) => (
            <div
              key={m.path}
              className="grid grid-cols-12 gap-3 px-4 py-3 text-sm border-b last:border-b-0"
            >
              <div className="col-span-7 min-w-0">
                <div className="font-mono text-xs break-all">{m.path}</div>
                {m.createdAt ? (
                  <div className="text-xs opacity-60">Added: {m.createdAt}</div>
                ) : null}
              </div>

              <div className="col-span-2">
                <span className="rounded border px-2 py-0.5 text-xs">{m.type}</span>
              </div>

              <div className="col-span-2">
                {m.usedBy.length === 0 ? (
                  <span className="text-xs opacity-70">—</span>
                ) : (
                  <details className="text-xs">
                    <summary className="cursor-pointer underline">
                      {m.usedBy.length} post(s)
                    </summary>
                    <div className="mt-2 space-y-1">
                      {m.usedBy.map((pid) => (
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
                  className="text-xs underline"
                  onClick={() => copyMarkdown(m.path)}
                >
                  Copy
                </button>

                <button
                  className="text-xs underline text-red-700"
                  onClick={() => requestDelete(m.path, m.usedBy)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
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
