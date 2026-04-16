import { useState } from 'react'
import { FiExternalLink, FiShare2, FiCopy } from 'react-icons/fi'
import Modal from './Modal.jsx'
import toast from 'react-hot-toast'

// Extrai {lat, lng} de uma URL do Google Maps se possivel
export function parseMapsUrl(url) {
  if (!url) return null
  try {
    // Padroes comuns: ?q=lat,lng, @lat,lng, /place/.../@lat,lng
    const patterns = [
      /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /[?&]query=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
      /[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    ]
    for (const p of patterns) {
      const m = url.match(p)
      if (m) return { lat: m[1], lng: m[2] }
    }
  } catch { /* ignore */ }
  return null
}

export default function MapLocationModal({ isOpen, onClose, url, title = 'Localização' }) {
  if (!isOpen) return null

  const coords = parseMapsUrl(url)
  const embedSrc = coords
    ? `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=16&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed`

  async function handleShare() {
    const shareData = {
      title: 'Localização',
      text: `Localização de entrega: ${coords ? `${coords.lat}, ${coords.lng}` : ''}`,
      url,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        if (err.name !== 'AbortError') toast.error('Não foi possível compartilhar')
      }
    } else {
      // Fallback: copia para clipboard
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Link copiado!')
      } catch {
        toast.error('Não foi possível copiar')
      }
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado!')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-2xl">
      <div className="space-y-3">
        {coords && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Coordenadas: <span className="font-mono">{coords.lat}, {coords.lng}</span>
          </p>
        )}

        <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
          <iframe
            title="Mapa"
            src={embedSrc}
            width="100%"
            height="380"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
          >
            <FiExternalLink size={16} /> Abrir no Google Maps
          </a>
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium text-sm"
          >
            <FiShare2 size={16} /> Compartilhar
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium text-sm"
            title="Copiar link"
          >
            <FiCopy size={16} />
          </button>
        </div>
      </div>
    </Modal>
  )
}
