import type { ThemeModule } from "@/core/utils/types"
import { Home } from "./pages/Home"
import { Post } from "./pages/Post"

export const cleanTheme: ThemeModule = {
  id: "clean",
  schema: {
    title: "Clean",
    fields: [
      { key: "brandName", label: "Brand name", type: "string", default: "Clean Blog" },
      { key: "cardStyle", label: "Card style", type: "select", options: ["border", "shadow"], default: "shadow" },
    ],
  },
  defaults: {
    brandName: "Clean Blog",
    cardStyle: "shadow",
  },
  render: { Home, Post },
}
