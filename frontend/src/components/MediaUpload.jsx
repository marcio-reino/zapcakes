import { useState, useRef } from 'react'
import { FiUpload, FiX, FiFile, FiMusic, FiImage } from 'react-icons/fi'
import ImageUpload from './ImageUpload.jsx'

const ACCEPT_ALL = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,audio/mpeg,audio/mp3'

function getFileInfo(value) {
  if (!value) return null

  if (value instanceof Blob || value instanceof File) {
    const type = value.type || ''
    if (type.startsWith('image/')) return { kind: 'image', name: value.name || 'imagem' }
    if (type === 'application/pdf') return { kind: 'pdf', name: value.name || 'documento.pdf' }
    if (type.startsWith('audio/')) return { kind: 'audio', name: value.name || 'audio.mp3' }
    return { kind: 'unknown', name: value.name || 'arquivo' }
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/)) return { kind: 'image', name: 'imagem' }
    if (lower.match(/\.pdf(\?|$)/)) return { kind: 'pdf', name: 'documento.pdf' }
    if (lower.match(/\.(mp3|mpeg)(\?|$)/)) return { kind: 'audio', name: 'audio.mp3' }
    return { kind: 'image', name: 'arquivo' }
  }

  return null
}

export default function MediaUpload({ value, onChange }) {
  const [mode, setMode] = useState(null) // null | 'image' | 'file'
  const fileInputRef = useRef(null)

  const info = getFileInfo(value)

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'audio/mpeg', 'audio/mp3',
    ]
    if (!allowed.includes(file.type)) {
      alert('Tipo não permitido. Use JPEG, PNG, WebP, GIF, PDF ou MP3.')
      return
    }

    if (file.type.startsWith('image/')) {
      // Para imagens, delega ao ImageUpload (crop)
      setMode('image')
      return
    }

    // PDF ou MP3 - envia direto
    onChange(file)
  }

  function handleRemove() {
    onChange(null)
    setMode(null)
  }

  // Se já tem um valor e é imagem, ou está no modo imagem, usa o ImageUpload
  if (mode === 'image' || (info?.kind === 'image')) {
    return (
      <div>
        <ImageUpload value={value} onChange={(img) => { onChange(img); if (!img) setMode(null) }} />
        {!value && (
          <button
            type="button"
            onClick={() => setMode(null)}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Voltar para seleção
          </button>
        )}
      </div>
    )
  }

  // Se tem um PDF ou áudio anexado, mostra preview
  if (value && info && (info.kind === 'pdf' || info.kind === 'audio')) {
    const Icon = info.kind === 'pdf' ? FiFile : FiMusic
    const color = info.kind === 'pdf' ? 'text-red-500' : 'text-blue-500'
    const bg = info.kind === 'pdf' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    const label = info.kind === 'pdf' ? 'PDF' : 'MP3'

    const fileName = value instanceof File ? value.name : (typeof value === 'string' ? value.split('/').pop()?.split('?')[0] : info.name)

    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bg}`}>
        <Icon size={24} className={color} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{fileName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label} anexado</p>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
          title="Remover"
        >
          <FiX size={16} />
        </button>
      </div>
    )
  }

  // Estado vazio - mostra botões de seleção
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('image')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 hover:text-green-500 hover:border-green-500 dark:hover:text-green-400 dark:hover:border-green-400 transition-colors text-sm"
        >
          <FiImage size={18} />
          Imagem
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 hover:text-red-500 hover:border-red-500 dark:hover:text-red-400 dark:hover:border-red-400 transition-colors text-sm"
          data-type="pdf"
        >
          <FiFile size={18} />
          PDF
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:border-blue-500 dark:hover:text-blue-400 dark:hover:border-blue-400 transition-colors text-sm"
          data-type="audio"
        >
          <FiMusic size={18} />
          Áudio
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ALL}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
