import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export const router = createRouter({
  routeTree,
  // Vite's base ("/" locally, "/BlogHub/" on GitHub Pages if your vite base is set)
  basepath: import.meta.env.BASE_URL.replace(/\/$/, ""),
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
