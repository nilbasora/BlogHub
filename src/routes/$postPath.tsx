import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$postPath')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/$postPath"!</div>
}
