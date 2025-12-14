import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/posts')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/posts"!</div>
}
