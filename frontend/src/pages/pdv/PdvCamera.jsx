import { useState, useEffect, useRef } from 'react'
import { FiX, FiCheckCircle, FiZap, FiCameraOff } from 'react-icons/fi'

// ---------------------------------------------------------------------------
// Leitura pela câmera (webcam no PC, câmera traseira no celular/tablet).
// Usa o ZXing, que roda no próprio navegador e funciona offline.
// ---------------------------------------------------------------------------
const CAMERA_KEY = 'pdv.cameraId'

function readSavedCamera() {
  try { return localStorage.getItem(CAMERA_KEY) || '' } catch { return '' }
}

function saveCamera(id) {
  try { localStorage.setItem(CAMERA_KEY, id) } catch { /* sem armazenamento */ }
}

// Bipe curto para confirmar a leitura (o mesmo retorno que o leitor USB dá)
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 1800
    gain.gain.value = 0.15
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    osc.onended = () => ctx.close()
  } catch { /* sem áudio */ }
  try { navigator.vibrate?.(80) } catch { /* sem vibração */ }
}

function cameraErrorMessage(err) {
  if (!window.isSecureContext) return 'A câmera só funciona em página segura (https ou localhost).'
  if (!navigator.mediaDevices?.getUserMedia) return 'Este navegador não dá acesso à câmera.'
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Permissão da câmera negada. Libere a câmera no cadeado da barra de endereço e tente de novo.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Nenhuma câmera encontrada. Conecte uma webcam e tente de novo.'
    case 'ReaderLoadError':
      return 'Não foi possível carregar o leitor de código. Recarregue a página e tente de novo.'
    case 'NotReadableError':
      return 'A câmera está em uso por outro programa. Feche-o e tente de novo.'
    default:
      return 'Não foi possível abrir a câmera.'
  }
}

const corner = 'absolute w-8 h-8 border-green-400'

// Decodificador zxing-cpp em WebAssembly. O .wasm vai junto com o app (nada de CDN), então funciona offline.
const READER_OPTIONS = {
  formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128', 'QRCode'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: false,
  maxNumberOfSymbols: 1,
}

let readerPromise = null
function loadReader() {
  if (!readerPromise) {
    readerPromise = Promise.all([import('zxing-wasm/reader'), import('zxing-wasm/reader/zxing_reader.wasm?url')])
      .then(([mod, wasm]) => {
        mod.prepareZXingModule({
          overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasm.default : prefix + path) },
        })
        return mod.readBarcodes
      })
      .catch((err) => { readerPromise = null; throw err })
  }
  return readerPromise
}

// Realce de nitidez na horizontal (máscara de nitidez em tons de cinza).
// Webcam perto do código fica desfocada e as barras finas somem; o realce devolve as bordas.
function sharpen(img, amount, radius) {
  const { width: w, height: h, data: d } = img
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
  const out = new ImageData(w, h)
  const o = out.data
  const n = 2 * radius + 1
  for (let y = 0; y < h; y++) {
    const row = y * w
    let sum = 0
    for (let x = -radius; x <= radius; x++) sum += gray[row + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      const v = gray[row + x]
      let val = v + amount * (v - sum / n)
      val = val < 0 ? 0 : val > 255 ? 255 : val
      const j = (row + x) * 4
      o[j] = o[j + 1] = o[j + 2] = val
      o[j + 3] = 255
      sum += gray[row + Math.min(w - 1, x + radius + 1)] - gray[row + Math.max(0, x - radius)]
    }
  }
  return out
}

// Cada tentativa usa uma variação da imagem; juntas cobrem imagem nítida, levemente e bem desfocada
const VARIANTS = [
  { sharpen: [3, 3], binarizer: 'LocalAverage' },
  { sharpen: null, binarizer: 'LocalAverage' },
  { sharpen: [6, 4], binarizer: 'LocalAverage' },
  { sharpen: [3, 3], binarizer: 'GlobalHistogram' },
]

// Códigos curtos (EAN-8/UPC-E) erram mais com webcam: pedem uma confirmação a mais
const confirmationsFor = (code) => (code.length >= 12 ? 2 : 3)

export function CameraOverlay({ onClose, onDetect }) {
  const videoRef = useRef(null)
  const trackRef = useRef(null)
  const doneRef = useRef(false)
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  const [status, setStatus] = useState('starting') // starting | scanning | error
  const [error, setError] = useState('')
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState(readSavedCamera)
  const [torch, setTorch] = useState(null) // null = sem lanterna; true/false = ligada/desligada
  const [detected, setDetected] = useState('')
  const [retry, setRetry] = useState(0)
  const [seen, setSeen] = useState(false) // código visto, mas ainda ilegível
  const [info, setInfo] = useState('') // resolução da câmera
  const [mirror, setMirror] = useState(false)
  const frameRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    let timer
    let stream
    setStatus('starting')
    setError('')
    setTorch(null)

    // Confirmação: o mesmo código precisa sair igual em leituras seguidas.
    // Evita os "números fantasmas" de uma leitura parcial (ex.: pedaço do EAN-13 lido como EAN-8).
    let hit = { code: '', count: 0, at: 0 }
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    function accept(code) {
      doneRef.current = true
      beep()
      setDetected(code)
      stream?.getTracks().forEach((t) => t.stop())
      timer = setTimeout(() => onDetectRef.current(code), 450)
    }

    let attempt = 0
    let lastSeen = 0

    // Recorte da imagem que aparece no quadro (o vídeo usa object-cover), com uma folga,
    // na resolução cheia da câmera: reduzir a imagem afina as barras e a webcam deixa de ler.
    function cropRect(video) {
      const vw = video.videoWidth
      const vh = video.videoHeight
      const frame = frameRef.current
      const frameAspect = frame ? frame.clientWidth / frame.clientHeight : 2
      let w = vw
      let h = vw / frameAspect
      if (h > vh) { h = vh; w = vh * frameAspect }
      w = Math.min(vw, w * 1.2)
      h = Math.min(vh, h * 1.3)
      return { sx: Math.round((vw - w) / 2), sy: Math.round((vh - h) / 2), w: Math.round(w), h: Math.round(h) }
    }

    async function scanLoop(readBarcodes) {
      if (cancelled || doneRef.current) return
      const video = videoRef.current
      if (video && video.readyState >= 2 && video.videoWidth) {
        const { sx, sy, w, h } = cropRect(video)
        const scale = Math.min(1, 1920 / w)
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        ctx.drawImage(video, sx, sy, w, h, 0, 0, canvas.width, canvas.height)
        const variant = VARIANTS[attempt++ % VARIANTS.length]
        try {
          let image = ctx.getImageData(0, 0, canvas.width, canvas.height)
          if (variant.sharpen) image = sharpen(image, ...variant.sharpen)
          const results = await readBarcodes(image, { ...READER_OPTIONS, binarizer: variant.binarizer, returnErrors: true })
          if (cancelled || doneRef.current) return
          const found = results.find((r) => r.isValid && r.text)
          const now = Date.now()
          if (found) {
            const code = found.text.trim()
            hit = code === hit.code && now - hit.at < 1500 ? { code, count: hit.count + 1, at: now } : { code, count: 1, at: now }
            if (hit.count >= confirmationsFor(code)) return accept(code)
          }
          // Código visto mas ainda ilegível: avisa para ajustar a distância
          if (results.length) lastSeen = now
          setSeen(now - lastSeen < 1200)
        } catch { /* quadro ruim: tenta o próximo */ }
      }
      timer = setTimeout(() => scanLoop(readBarcodes), 40)
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('sem câmera')
        const size = { width: { ideal: 1920 }, height: { ideal: 1080 } }
        const video = deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: { ideal: 'environment' }, ...size }
        const reader = loadReader()
        reader.catch(() => {}) // o erro é tratado no await abaixo
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: false })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        let readBarcodes
        try {
          readBarcodes = await reader
        } catch {
          stream.getTracks().forEach((t) => t.stop())
          throw Object.assign(new Error('leitor'), { name: 'ReaderLoadError' })
        }
        if (cancelled) return

        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        const caps = track?.getCapabilities?.() || {}
        // Foco automático contínuo quando a câmera permite (webcams com autofoco e celulares)
        if (caps.focusMode?.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
        if (caps.torch) setTorch(false)
        const settings = track?.getSettings?.() || {}
        setInfo(settings.width ? `${settings.width}×${settings.height}` : '')
        // Webcam (virada para a pessoa) aparece espelhada, como num espelho, para facilitar a mira.
        // A leitura usa a imagem original, sem espelhar.
        setMirror(settings.facingMode !== 'environment')

        const el = videoRef.current
        el.srcObject = stream
        await el.play().catch(() => {})
        if (cancelled) return
        setStatus('scanning')
        scanLoop(readBarcodes)

        // Os nomes das câmeras só aparecem depois da permissão
        const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
        if (!cancelled) setDevices(list)
      } catch (err) {
        if (cancelled) return
        // Câmera salva que sumiu (webcam desconectada): volta para a padrão
        if (deviceId && (err?.name === 'OverconstrainedError' || err?.name === 'NotFoundError')) {
          saveCamera('')
          setDeviceId('')
          return
        }
        setError(cameraErrorMessage(err))
        setStatus('error')
      }
    }

    start()
    return () => {
      cancelled = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
      trackRef.current = null
    }
  }, [deviceId, retry])

  function changeCamera(id) {
    saveCamera(id)
    setDeviceId(id)
  }

  async function toggleTorch() {
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ torch: !torch }] })
      setTorch(!torch)
    } catch { setTorch(null) }
  }

  const showVideo = status === 'scanning' || !!detected

  // Só o quadro de leitura flutuando sobre o PDV (sem tela cheia)
  return (
    <div role="dialog" aria-label="Ler código de barras" className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-fadeIn">
      <div ref={frameRef} className="relative w-72 h-44 md:w-[28rem] md:h-56 rounded-xl overflow-hidden bg-gray-900 shadow-2xl ring-1 ring-black/20">
        <video ref={videoRef} muted playsInline className={`absolute inset-0 w-full h-full object-cover ${mirror ? '-scale-x-100' : ''} ${showVideo ? '' : 'opacity-0'}`} />

        {status === 'scanning' && !detected && (
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 pb-2 text-[11px] text-white/80 pointer-events-none">
            <span className={`px-2 py-0.5 rounded-full ${seen ? 'bg-amber-500 text-white font-semibold' : 'bg-black/40'}`}>
              {seen ? 'Código à vista: segure parado e ajuste a distância' : 'Procurando código…'}
            </span>
            {info && <span className="px-1.5 py-0.5 rounded bg-black/40">{info}</span>}
          </div>
        )}

        <span className={`${corner} top-0 left-0 border-t-4 border-l-4 rounded-tl-xl`} />
        <span className={`${corner} top-0 right-0 border-t-4 border-r-4 rounded-tr-xl`} />
        <span className={`${corner} bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl`} />
        <span className={`${corner} bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl`} />

        {status === 'scanning' && !detected && (
          <span className="pdv-scan-line absolute left-3 right-3 h-0.5 bg-red-500 shadow-[0_0_12px_2px_rgba(239,68,68,0.7)]" />
        )}

        {status === 'starting' && !detected && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-300">Abrindo a câmera…</p>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
            <FiCameraOff size={28} className="text-red-400" />
            <p className="text-sm">{error}</p>
            <button onClick={() => setRetry((r) => r + 1)} className="px-4 py-1.5 rounded-full bg-white text-gray-900 text-sm font-medium">Tentar de novo</button>
          </div>
        )}

        {detected && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-600/30">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-600 text-white font-semibold text-lg shadow-lg">
              <FiCheckCircle /> {detected}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-end gap-2">
        {devices.length > 1 && !detected && (
          <select
            value={deviceId}
            onChange={(e) => changeCamera(e.target.value)}
            aria-label="Escolher câmera"
            className="min-w-0 max-w-[14rem] rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm px-2 py-2 border border-gray-300 dark:border-gray-600 shadow-lg focus:outline-none"
          >
            <option value="">Câmera padrão</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Câmera ${i + 1}`}</option>
            ))}
          </select>
        )}
        {torch !== null && !detected && (
          <button onClick={toggleTorch} aria-label="Lanterna" className={`p-2.5 rounded-lg shadow-lg ${torch ? 'bg-yellow-400 text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600'}`}>
            <FiZap />
          </button>
        )}
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm font-semibold border border-gray-300 dark:border-gray-600 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <FiX size={16} /> Fechar
        </button>
      </div>
    </div>
  )
}
