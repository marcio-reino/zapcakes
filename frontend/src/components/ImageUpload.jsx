import { useState, useCallback, useRef, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import { FiUpload, FiX, FiCheck, FiZoomIn, FiZoomOut, FiRotateCw, FiClipboard } from 'react-icons/fi'

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.setAttribute('crossOrigin', 'anonymous')
    img.src = url
  })
}

async function getCroppedImg(imageSrc, pixelCrop, rotation = 0, outputWidth = 600, outputHeight = 600) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  canvas.width = outputWidth
  canvas.height = outputHeight

  ctx.translate(outputWidth / 2, outputHeight / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-outputWidth / 2, -outputHeight / 2)

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight
  )

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.9)
  })
}

const DEFAULT_ASPECTS = [{ label: '1:1', value: 1, w: 600, h: 600 }]

export default function ImageUpload({ value, onChange, aspectOptions }) {
  const aspects = aspectOptions && aspectOptions.length > 0 ? aspectOptions : DEFAULT_ASPECTS
  const [selectedAspect, setSelectedAspect] = useState(0)
  const [imageSrc, setImageSrc] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [showCropper, setShowCropper] = useState(false)
  const fileInputRef = useRef(null)

  const containerRef = useRef(null)

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  function loadImageFile(file) {
    if (!file) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      alert('Tipo não permitido. Use JPEG, PNG, WebP ou GIF.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  function handleFileSelect(e) {
    loadImageFile(e.target.files?.[0])
    e.target.value = ''
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        loadImageFile(item.getAsFile())
        return
      }
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('image/')) {
      loadImageFile(file)
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('paste', handlePaste)
    return () => el.removeEventListener('paste', handlePaste)
  })

  async function handleCropConfirm() {
    if (!croppedAreaPixels || !imageSrc) return
    const a = aspects[selectedAspect]
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation, a.w, a.h)
    onChange(blob)
    setShowCropper(false)
    setImageSrc(null)
  }

  function handleCropCancel() {
    setShowCropper(false)
    setImageSrc(null)
  }

  function handleRemove() {
    onChange(null)
  }

  const previewUrl = value instanceof Blob ? URL.createObjectURL(value) : value

  return (
    <div ref={containerRef} tabIndex={-1} onDrop={handleDrop} onDragOver={handleDragOver} className="outline-none">
      {/* Cropper Modal */}
      {showCropper && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                Recortar Imagem ({aspects[selectedAspect].w}x{aspects[selectedAspect].h})
              </h3>
              <button onClick={handleCropCancel} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg">
                <FiX size={18} />
              </button>
            </div>

            {aspects.length > 1 && (
              <div className="flex items-center justify-center gap-2 px-5 py-2 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                {aspects.map((a, i) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => setSelectedAspect(i)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      selectedAspect === i
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                    }`}
                  >
                    {a.label} ({a.w}x{a.h})
                  </button>
                ))}
              </div>
            )}

            <div className="relative w-full" style={{ height: '360px' }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspects[selectedAspect].value}
                minZoom={0.3}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="rect"
                showGrid
                restrictPosition={false}
                style={{
                  containerStyle: { cursor: 'grab' },
                  cropAreaStyle: { border: '2px solid #22c55e' },
                }}
              />
            </div>

            <div className="px-5 py-3 space-y-3 border-t dark:border-gray-600">
              <div className="flex items-center gap-3">
                <FiZoomOut size={14} className="text-gray-400 shrink-0" />
                <input
                  type="range"
                  min={0.3}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full appearance-none cursor-pointer accent-green-600"
                />
                <FiZoomIn size={14} className="text-gray-400 shrink-0" />
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FiRotateCw size={13} /> Girar
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCropCancel}
                    className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCropConfirm}
                    className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5"
                  >
                    <FiCheck size={14} /> Aplicar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview ou Botão de Upload */}
      {previewUrl ? (
        <div className="relative group w-40 h-40 md:w-32 md:h-32">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-40 h-40 md:w-32 md:h-32 object-cover rounded-xl border-2 border-gray-200 dark:border-gray-600"
          />
          <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 md:gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 md:p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white"
              title="Trocar imagem"
            >
              <FiUpload className="w-5 h-5 md:w-4 md:h-4" />
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="p-2.5 md:p-1.5 bg-red-500/90 rounded-lg text-white hover:bg-red-600"
              title="Remover"
            >
              <FiX className="w-5 h-5 md:w-4 md:h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-40 h-40 md:w-32 md:h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center gap-2 md:gap-1.5 text-gray-400 hover:text-green-500 hover:border-green-500 dark:hover:border-green-500 transition-colors cursor-pointer focus:border-green-500 focus:text-green-500 focus:ring-2 focus:ring-green-500/30 outline-none"
        >
          <FiUpload className="w-6 h-6 md:w-5 md:h-5" />
          <span className="text-xs md:text-[10px]">Upload ou Ctrl+V</span>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
