import * as React from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { loadPostsIndex } from "@/core/content/loadPostsIndex"

export const Route = createFileRoute("/admin/posts/")({
  loader: async () => {
    const index = await loadPostsIndex()
    // newest first
    const posts = [...index.posts].sort((a, b) => (a.date < b.date ? 1 : -1))
    return { posts }
  },
  component: AdminPostsPage,
})

function AdminPostsPage() {
  const { posts } = Route.useLoaderData()

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Blog posts</h1>
          <p className="text-sm opacity-80">
            Create, edit and publish posts.
          </p>
        </div>

        <Link
          to="/admin/posts/$postId"
          params={{ postId: "new" }}
          className="rounded-md border px-3 py-2 text-sm bg-white hover:bg-neutral-50"
        >
          + New post
        </Link>
      </header>

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
            {posts.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-12 gap-3 px-4 py-3 text-sm border-b last:border-b-0"
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
                <div className="col-span-2 text-right">
                  <Link
                    to="/admin/posts/$postId"
                    params={{ postId: p.id }}
                    className="text-sm underline"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
