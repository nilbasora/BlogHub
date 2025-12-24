import type { ThemeModule } from "@/core/utils/types"
import { Home } from "./pages/Home"
import { Post } from "./pages/Post"

export const minimalTheme: ThemeModule = {
  id: "minimal",
  schema: {
    title: "Minimal",
    fields: [
      { key: "brandName", label: "Brand name", type: "string", default: "BlogHub" },
      { key: "showTagline", label: "Show tagline", type: "boolean", default: true },
      { key: "layout", label: "Layout", type: "select", options: ["centered", "wide"], default: "centered" },
    ],
  },
  defaults: {
    brandName: "BlogHub",
    showTagline: true,
    layout: "centered",
  },
  render: { Home, Post },
}
