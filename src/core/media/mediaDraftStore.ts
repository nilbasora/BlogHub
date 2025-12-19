import type { MediaIndexItem } from "./types"

type DraftState = {
  added: MediaIndexItem[]          // new items staged
  deletedPaths: string[]           // paths staged for deletion
}

const KEY = "bloghub.mediaDraft.v1"

function readState(): DraftState {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as DraftState) : { added: [], deletedPaths: [] }
  } catch {
    return { added: [], deletedPaths: [] }
  }
}

function writeState(next: DraftState) {
  localStorage.setItem(KEY, JSON.stringify(next))
}

export function getMediaDraftState(): DraftState {
  return readState()
}

export function addDraftMedia(item: MediaIndexItem) {
  const st = readState()
  st.added = [item, ...st.added.filter((x) => x.path !== item.path)]
  // If it was "deleted", undo delete
  st.deletedPaths = st.deletedPaths.filter((p) => p !== item.path)
  writeState(st)
}

export function stageDeleteMedia(path: string) {
  const st = readState()
  st.deletedPaths = Array.from(new Set([path, ...st.deletedPaths]))
  // If it was newly added, remove it instead
  st.added = st.added.filter((x) => x.path !== path)
  writeState(st)
}

export function clearMediaDraft() {
  localStorage.removeItem(KEY)
}
