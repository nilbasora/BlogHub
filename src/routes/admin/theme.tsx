import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/theme')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/theme"!</div>
}
