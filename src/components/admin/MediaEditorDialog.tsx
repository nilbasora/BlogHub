import * as React from "react"
import Cropper from "react-cropper"
import "cropperjs/dist/cropper.css"

function mimeFromFilename(name: string) {
  if (/\.(jpe?g)$/i.test(name)) return "image/jpeg"
  if (/\.(webp)$/i.test(name)) return "image/webp"
  return "image/png"
}

export function MediaEditorDialog(props: {
  open: boolean
  src: string
  filename: string
  onClose: () => void
  onSave: (blob: Blob) => Promise<void> | void
}) {
  const { open, src, filename, onClose, onSave } = props

  // Don't rely on ReactCropperElement (not exported in your version)
  const cropperRef = React.useRef<any>(null)

  const [saving, setSaving] = React.useState(false)
  const [zoom, setZoom] = React.useState(1)
  const [rotation, setRotation] = React.useState(0)

  React.useEffect(() => {
    if (!open) return
    setSaving(false)
    setZoom(1)
    setRotation(0)

    const t = setTimeout(() => {
      const cropper = cropperRef.current?.cropper
      if (!cropper) return
      cropper.reset()
      cropper.clear()
      cropper.crop()
      cropper.rotateTo(0)
      cropper.zoomTo(1)
    }, 0)

    return () => clearTimeout(t)
  }, [open, src])

  function setZoomTo(v: number) {
    setZoom(v)
    cropperRef.current?.cropper?.zoomTo(v)
  }

  function setRotationTo(v: number) {
    setRotation(v)
    cropperRef.current?.cropper?.rotateTo(v)
  }

  async function handleSave() {
    const cropper = cropperRef.current?.cropper
    if (!cropper) return

    setSaving(true)
    try {
      const mimeType = mimeFromFilename(filename)
      const canvas: HTMLCanvasElement = cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
        // If exporting JPG and you want white background:
        // fillColor: "#fff",
      })

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to export image blob"))),
          mimeType,
          mimeType === "image/jpeg" || mimeType === "image/webp" ? 0.92 : undefined
        )
      })

      await onSave(blob)
      onClose()
    } catch (err) {
      console.error(err)
      alert(`Edit failed.\n\n${(err as any)?.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/50" onClick={saving ? undefined : onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-neutral-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <div className="text-sm font-semibold text-neutral-900">Edit: {filename}</div>
            <button
              className="text-sm rounded-xl border border-neutral-200 px-3 py-1.5 hover:bg-neutral-50 disabled:opacity-60"
              onClick={onClose}
              disabled={saving}
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4">
            <div className="lg:col-span-3">
              <div className="h-[70vh] bg-neutral-900">
                <Cropper
                  ref={cropperRef}
                  src={src}
                  style={{ height: "70vh", width: "100%" }}
                  viewMode={1}
                  dragMode="move"
                  guides
                  center
                  background={false}
                  responsive
                  autoCropArea={0.9}
                  checkOrientation={false}
                  cropBoxResizable
                  cropBoxMovable
                  zoomOnWheel
                />
              </div>
            </div>

            <div className="lg:col-span-1 p-4 space-y-4 border-t lg:border-t-0 lg:border-l border-neutral-100">
              <div className="text-xs text-neutral-600">
                Resize crop box from edges/corners. Drag image to pan. Use wheel or slider to zoom.
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-neutral-700">Zoom</div>
                <input
                  type="range"
                  min={0.2}
                  max={4}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoomTo(Number(e.target.value))}
                  className="w-full"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-neutral-700">Rotate</div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotationTo(Number(e.target.value))}
                  className="w-full"
                  disabled={saving}
                />
                <div className="flex gap-2">
                  <button
                    className="flex-1 text-xs rounded-xl border border-neutral-200 px-3 py-2 hover:bg-neutral-50 disabled:opacity-60"
                    onClick={() => setRotationTo(((rotation - 90) % 360 + 360) % 360)}
                    disabled={saving}
                  >
                    -90°
                  </button>
                  <button
                    className="flex-1 text-xs rounded-xl border border-neutral-200 px-3 py-2 hover:bg-neutral-50 disabled:opacity-60"
                    onClick={() => setRotationTo((rotation + 90) % 360)}
                    disabled={saving}
                  >
                    +90°
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  className="flex-1 text-xs rounded-xl border border-neutral-200 px-3 py-2 hover:bg-neutral-50 disabled:opacity-60"
                  onClick={() => cropperRef.current?.cropper?.reset()}
                  disabled={saving}
                >
                  Reset
                </button>
                <button
                  className="flex-1 text-xs rounded-xl border border-neutral-200 px-3 py-2 hover:bg-neutral-50 disabled:opacity-60"
                  onClick={() => cropperRef.current?.cropper?.clear()}
                  disabled={saving}
                >
                  Clear
                </button>
              </div>

              <button
                className="w-full rounded-xl bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-60"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
