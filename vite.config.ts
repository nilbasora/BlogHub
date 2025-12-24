import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1]

export default defineConfig({
  // For GitHub Pages project sites, set VITE_BASE="/<repo-name>/"
  base: repoName ? `/${repoName}/` : "/",

  plugins: [
    // Must come before react()
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
