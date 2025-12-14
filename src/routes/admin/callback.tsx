import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/callback')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/callback"!</div>
}
