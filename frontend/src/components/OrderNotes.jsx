import { useState } from 'react'
import { FiMapPin } from 'react-icons/fi'
import MapLocationModal from './MapLocationModal.jsx'

// Reconhece URLs do Google Maps (vários formatos) dentro de um texto.
const MAPS_URL_REGEX = /https?:\/\/(?:(?:www\.|maps\.)?google\.com\/maps[^\s)]*|maps\.app\.goo\.gl\/[^\s)]+|goo\.gl\/maps\/[^\s)]+)/gi

// Reconhece URLs genericas (para manter como links normais)
const GENERIC_URL_REGEX = /https?:\/\/\S+/g

// Renderiza o texto das observacoes detectando URLs do Google Maps e
// substituindo por um botao que abre um modal com o mapa + compartilhar.
// URLs nao-maps sao renderizadas como link comum.
export default function OrderNotes({ text, className = '' }) {
  const [mapUrl, setMapUrl] = useState(null)

  if (!text) return null

  // Primeiro encontra todas as ocorrencias de maps e nao-maps, na ordem
  const parts = []
  let lastIdx = 0
  const matches = []

  // Coleta maps
  const reMaps = new RegExp(MAPS_URL_REGEX)
  let m
  while ((m = reMaps.exec(text)) !== null) {
    matches.push({ type: 'map', start: m.index, end: m.index + m[0].length, value: m[0] })
  }
  // Coleta outras URLs que nao colidem com maps
  const reUrl = new RegExp(GENERIC_URL_REGEX)
  while ((m = reUrl.exec(text)) !== null) {
    const start = m.index
    const end = start + m[0].length
    const overlaps = matches.some((x) => (start < x.end && end > x.start))
    if (!overlaps) matches.push({ type: 'url', start, end, value: m[0] })
  }
  matches.sort((a, b) => a.start - b.start)

  let key = 0
  for (const mt of matches) {
    if (mt.start > lastIdx) {
      parts.push(<span key={key++}>{text.slice(lastIdx, mt.start)}</span>)
    }
    if (mt.type === 'map') {
      parts.push(
        <button
          key={key++}
          type="button"
          onClick={() => setMapUrl(mt.value)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md text-xs font-medium border border-blue-200 dark:border-blue-800 transition-colors align-middle"
        >
          <FiMapPin size={12} /> Ver localização
        </button>
      )
    } else {
      parts.push(
        <a
          key={key++}
          href={mt.value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline break-all"
        >
          {mt.value}
        </a>
      )
    }
    lastIdx = mt.end
  }
  if (lastIdx < text.length) parts.push(<span key={key++}>{text.slice(lastIdx)}</span>)

  return (
    <>
      <span className={`whitespace-pre-wrap break-words ${className}`}>{parts}</span>
      <MapLocationModal
        isOpen={!!mapUrl}
        onClose={() => setMapUrl(null)}
        url={mapUrl || ''}
        title="Localização do pedido"
      />
    </>
  )
}
