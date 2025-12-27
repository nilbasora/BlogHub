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

function AdminPostsPage() {
  const { posts: initialPosts } = Route.useLoaderData()

  const [posts, setPosts] = React.useState(initialPosts)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  async function onDelete(p: (typeof posts)[number]) {
    const ok = window.confirm(
      `Delete "${p.title}"?\n\nThis will remove the post from the repo.`
    )
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

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Blog posts</h1>
          <p className="text-sm opacity-80">Create, edit and publish posts.</p>
        </div>

        <Link
          to="/admin/posts/$postId"
          params={{ postId: "new" }}
          className="rounded-md border px-3 py-2 text-sm bg-white hover:bg-neutral-50"
        >
          + New post
        </Link>
      </header>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-semibold opacity-70 border-b">
          <div className="col-span-6">Title</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {posts.length === 0 ? (
          <div className="p-4 text-sm opacity-70">No posts yet.</div>
        ) : (
          <div>
            {posts.map((p) => {
              const busy = busyId === p.id

              return (
                  <div
                    key={p.id}
                    className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm border-b last:border-b-0"
                  >
                  <div className="col-span-6 min-w-0">
                    <div className="font-medium truncate">{p.title}</div>
                    <div className="text-xs opacity-60 truncate">{p.url}</div>
                  </div>

                  <div className="col-span-2">
                    <span className="rounded border px-2 py-0.5 text-xs">
                      {p.status ?? "draft"}
                    </span>
                  </div>

                  <div className="col-span-2 text-xs opacity-80">{p.date}</div>

                  <div className="col-span-2 flex justify-end items-center gap-3">
                    <Link
                      to="/admin/posts/$postId"
                      params={{ postId: p.id }}
                      className="inline-flex items-center text-sm underline"
                    >
                      Edit
                    </Link>

                    <button
                      type="button"
                      className="inline-flex items-center text-sm underline text-red-700 disabled:opacity-60"
                      disabled={busy}
                      onClick={() => onDelete(p)}
                      title="Delete post"
                    >
                      {busy ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
