import * as React from "react"
import type { SiteSettings } from "@/core/utils/types"
import {
  isPreviewMode,
  readPreviewSettings,
  previewSettingsStorageKey,
} from "./previewSettings"

type PreviewCtx = {
  enabled: boolean
  settings: SiteSettings | null
}

const Ctx = React.createContext<PreviewCtx>({ enabled: false, settings: null })

export function PreviewSettingsProvider({ children }: { children: React.ReactNode }) {
  const enabled = isPreviewMode()

  const [settings, setSettings] = React.useState<SiteSettings | null>(() =>
    enabled ? readPreviewSettings() : null
  )

  React.useEffect(() => {
    if (!enabled) return

    // Initial load
    setSettings(readPreviewSettings())

    // Update when admin tab writes localStorage
    const onStorage = (e: StorageEvent) => {
      if (e.key === previewSettingsStorageKey()) {
        setSettings(readPreviewSettings())
      }
    }
    window.addEventListener("storage", onStorage)

    return () => window.removeEventListener("storage", onStorage)
  }, [enabled])

  return <Ctx.Provider value={{ enabled, settings }}>{children}</Ctx.Provider>
}

export function usePreviewSettings() {
  return React.useContext(Ctx)
}
