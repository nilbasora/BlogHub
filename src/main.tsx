import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./App.css";

const params = new URLSearchParams(window.location.search)
const p = params.get("p")
if (p) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "")
  const path = p.startsWith("/") ? p : `/${p}`
  window.history.replaceState(null, "", base + path)
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
