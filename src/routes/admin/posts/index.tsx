import * as React from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { loadPostsIndexFromRepo } from "@/core/content/loadPostsIndexFromRepo"
import { deletePostMd } from "@/core/github/commit"

export const Route = createFileRoute("/admin/posts/")({
  loader: async () => {
    // Always read from repo develop branch (not the built Vite asset)
    const index = await loadPostsIndexFromRepo("develop")

    // newest first
    const posts = [...index.posts].sort((a, b) => (a.date < b.date ? 1 : -1))
    return { posts }
  },
  component: AdminPostsPage,
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

function pillBase(active: boolean) {
  return cx(
    "inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs shadow-sm transition",
    active
      ? "border-neutral-900 bg-neutral-900 text-white"
      : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
  )
}

function formatDateMaybe(v: any) {
  const s = String(v ?? "")
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return s
  try {
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(d)
  } catch {
    return s
  }
}

function statusLabel(v: any) {
  const s = String(v ?? "draft").toLowerCase()
  if (s === "published" || s === "live" || s === "public") return "Published"
  if (s === "scheduled") return "Scheduled"
  return "Draft"
}

function statusPillClass(v: any) {
  const s = String(v ?? "draft").toLowerCase()
  if (s === "published" || s === "live" || s === "public") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (s === "scheduled") return "border-amber-200 bg-amber-50 text-amber-800"
  return "border-neutral-200 bg-neutral-50 text-neutral-700"
}

type SortKey = "date" | "title" | "status"
type SortDir = "desc" | "asc"

function AdminPostsPage() {
  const { posts: initialPosts } = Route.useLoaderData()

  const [posts, setPosts] = React.useState(initialPosts)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  // UI state
  const [q, setQ] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | "draft" | "published" | "scheduled">("all")
  const [sortKey, setSortKey] = React.useState<SortKey>("date")
  const [sortDir, setSortDir] = React.useState<SortDir>("desc")

  async function onDelete(p: (typeof posts)[number]) {
    const ok = window.confirm(`Delete "${p.title}"?\n\nThis will remove the post from the repo.`)
    if (!ok) return

    setErr(null)
    setBusyId(p.id)

    try {
      await deletePostMd(`public/posts/${p.id}.md`)
      setPosts((prev) => prev.filter((x) => x.id !== p.id))
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setBusyId(null)
    }
  }

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase()

    const passQuery = (p: any) => {
      if (!qq) return true
      const hay = `${p.title ?? ""} ${p.id ?? ""} ${p.url ?? ""} ${p.status ?? ""}`.toLowerCase()
      return hay.includes(qq)
    }

    const passStatus = (p: any) => {
      if (statusFilter === "all") return true
      const s = String(p.status ?? "draft").toLowerCase()
      if (statusFilter === "draft") return s === "draft" || !s
      if (statusFilter === "published") return s === "published" || s === "live" || s === "public"
      if (statusFilter === "scheduled") return s === "scheduled"
      return true
    }

    return posts.filter((p: any) => passQuery(p) && passStatus(p))
  }, [posts, q, statusFilter])

  const sorted = React.useMemo(() => {
    const arr = [...filtered]

    const cmpStr = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" })
    const cmpDate = (a: any, b: any) => {
      const da = new Date(String(a ?? "")).getTime()
      const db = new Date(String(b ?? "")).getTime()
      if (!Number.isFinite(da) || !Number.isFinite(db)) return cmpStr(String(a ?? ""), String(b ?? ""))
      return da - db
    }

    arr.sort((A: any, B: any) => {
      let v = 0
      if (sortKey === "date") v = cmpDate(A.date, B.date)
      else if (sortKey === "title") v = cmpStr(String(A.title ?? ""), String(B.title ?? ""))
      else if (sortKey === "status") v = cmpStr(String(statusLabel(A.status)), String(statusLabel(B.status)))
      return sortDir === "asc" ? v : -v
    })

    return arr
  }, [filtered, sortKey, sortDir])

  const total = posts.length
  const visible = sorted.length

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Blog posts</h1>
            <p className="text-sm text-neutral-600">Create, edit and publish posts.</p>
          </div>

          <Link
            to="/admin/posts/$postId"
            params={{ postId: "new" }}
            className={cx(
              "inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm shadow-sm",
              "hover:bg-neutral-50 active:translate-y-[1px] transition"
            )}
          >
            + New post
          </Link>
        </header>

        {/* Controls */}
        <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <div className="min-w-[240px] sm:min-w-[320px]">
                <input
                  className={inputBase()}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search title, id, url, status…"
                />
              </div>

              <div className="flex items-center gap-2">
                <button type="button" className={pillBase(statusFilter === "all")} onClick={() => setStatusFilter("all")}>
                  All
                </button>
                <button
                  type="button"
                  className={pillBase(statusFilter === "draft")}
                  onClick={() => setStatusFilter("draft")}
                >
                  Draft
                </button>
                <button
                  type="button"
                  className={pillBase(statusFilter === "published")}
                  onClick={() => setStatusFilter("published")}
                >
                  Published
                </button>
                <button
                  type="button"
                  className={pillBase(statusFilter === "scheduled")}
                  onClick={() => setStatusFilter("scheduled")}
                >
                  Scheduled
                </button>
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
                  <option value="date">Date</option>
                  <option value="title">Title</option>
                  <option value="status">Status</option>
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
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {/* Table / list */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {/* Header row */}
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold text-neutral-600 border-b border-neutral-100 bg-neutral-50/60">
            <div className="col-span-6">Post</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {sorted.length === 0 ? (
            <div className="p-5 text-sm text-neutral-600">
              No posts match your filters.
              {q.trim() || statusFilter !== "all" ? (
                <button
                  type="button"
                  className="ml-2 underline text-neutral-900"
                  onClick={() => {
                    setQ("")
                    setStatusFilter("all")
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {sorted.map((p: any) => {
                const busy = busyId === p.id

                return (
                  <div key={p.id} className="px-5 py-4">
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-12 items-center gap-3">
                      <Link
                        to="/admin/posts/$postId"
                        params={{ postId: p.id }}
                        className={cx(
                          "col-span-6 min-w-0 rounded-xl px-2 py-1 -ml-2 -my-1",
                          "hover:bg-neutral-50 transition",
                          "focus:outline-none focus:ring-4 focus:ring-neutral-900/10"
                        )}
                      >
                        <div className="font-semibold text-neutral-900 truncate">{p.title}</div>
                        <div className="mt-1 text-xs text-neutral-500 truncate">{p.url}</div>
                      </Link>

                      <div className="col-span-2">
                        <span className={cx("inline-flex rounded-full border px-2 py-1 text-xs", statusPillClass(p.status))}>
                          {statusLabel(p.status)}
                        </span>
                      </div>

                      <div className="col-span-2 text-xs text-neutral-600">{formatDateMaybe(p.date)}</div>

                      <div className="col-span-2 flex justify-end items-center gap-3">
                        <Link
                          to="/admin/posts/$postId"
                          params={{ postId: p.id }}
                          className="inline-flex items-center rounded-lg px-2 py-1 text-sm text-neutral-900 hover:bg-neutral-50"
                        >
                          Edit
                        </Link>

                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg px-2 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                          disabled={busy}
                          onClick={() => onDelete(p)}
                          title="Delete post"
                        >
                          {busy ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          to="/admin/posts/$postId"
                          params={{ postId: p.id }}
                          className={cx(
                            "min-w-0 flex-1 rounded-xl px-2 py-1 -ml-2 -my-1",
                            "hover:bg-neutral-50 transition",
                            "focus:outline-none focus:ring-4 focus:ring-neutral-900/10"
                          )}
                        >
                          <div className="font-semibold text-neutral-900 truncate">{p.title}</div>
                          <div className="mt-1 text-xs text-neutral-500 truncate">{p.url}</div>
                        </Link>

                        <span className={cx("shrink-0 rounded-full border px-2 py-1 text-[11px]", statusPillClass(p.status))}>
                          {statusLabel(p.status)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-neutral-600">
                        <div>{formatDateMaybe(p.date)}</div>
                        <div className="font-mono text-[11px] text-neutral-500">{p.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to="/admin/posts/$postId"
                          params={{ postId: p.id }}
                          className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
                        >
                          Edit
                        </Link>

                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-60"
                          disabled={busy}
                          onClick={() => onDelete(p)}
                        >
                          {busy ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
