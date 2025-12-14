import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  component: () => <div className="p-6">Admin (login coming soon)</div>,
});
