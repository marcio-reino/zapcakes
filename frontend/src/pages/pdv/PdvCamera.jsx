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
    case 'NotReadableError':
      return 'A câmera está em uso por outro programa. Feche-o e tente de novo.'
    default:
      return 'Não foi possível abrir a câmera.'
  }
}

const corner = 'absolute w-8 h-8 border-green-400'

export function CameraOverlay({ onClose, onDetect }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
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

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    let timer
    setStatus('starting')
    setError('')
    setTorch(null)

    async function start() {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        if (cancelled) return

        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })

        const size = { width: { ideal: 1280 }, height: { ideal: 720 } }
        const video = deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: { ideal: 'environment' }, ...size }

        const controls = await reader.decodeFromConstraints({ video, audio: false }, videoRef.current, (result) => {
          if (!result || doneRef.current || cancelled) return
          doneRef.current = true
          const code = result.getText().trim()
          beep()
          setDetected(code)
          controlsRef.current?.stop()
          timer = setTimeout(() => onDetectRef.current(code), 450)
        })
        if (cancelled) { controls.stop(); return }
        controlsRef.current = controls
        setStatus('scanning')
        if (controls.switchTorch) setTorch(false)

        // Os nomes das câmeras só aparecem depois da permissão
        const list = await BrowserMultiFormatReader.listVideoInputDevices()
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
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [deviceId, retry])

  function changeCamera(id) {
    saveCamera(id)
    setDeviceId(id)
  }

  async function toggleTorch() {
    try {
      await controlsRef.current?.switchTorch?.(!torch)
      setTorch(!torch)
    } catch { setTorch(null) }
  }

  const showVideo = status === 'scanning' || !!detected

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fadeIn">
      <div className="flex items-center justify-between gap-3 px-4 py-4 text-white">
        <span className="font-semibold">Ler código de barras</span>
        <div className="flex items-center gap-2">
          {devices.length > 1 && (
            <select
              value={deviceId}
              onChange={(e) => changeCamera(e.target.value)}
              aria-label="Escolher câmera"
              className="max-w-[16rem] rounded-lg bg-white/10 text-white text-sm px-3 py-2 border border-white/20 focus:outline-none"
            >
              <option value="" className="text-gray-900">Câmera padrão</option>
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId} className="text-gray-900">{d.label || `Câmera ${i + 1}`}</option>
              ))}
            </select>
          )}
          <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20" aria-label="Fechar câmera"><FiX size={22} /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative flex items-center justify-center bg-gray-900 overflow-hidden">
        <video ref={videoRef} muted playsInline className={`absolute inset-0 w-full h-full object-contain ${showVideo ? '' : 'opacity-0'}`} />

        {status === 'starting' && !detected && <p className="relative text-gray-300">Abrindo a câmera…</p>}

        {status === 'error' && (
          <div className="relative max-w-md mx-4 text-center text-white space-y-4">
            <FiCameraOff size={40} className="mx-auto text-red-400" />
            <p>{error}</p>
            <button onClick={() => setRetry((r) => r + 1)} className="px-5 py-2.5 rounded-full bg-white text-gray-900 font-medium">Tentar de novo</button>
          </div>
        )}

        {showVideo && (
          <div className="relative w-72 h-44 md:w-[28rem] md:h-56 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            <span className={`${corner} top-0 left-0 border-t-4 border-l-4 rounded-tl-xl`} />
            <span className={`${corner} top-0 right-0 border-t-4 border-r-4 rounded-tr-xl`} />
            <span className={`${corner} bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl`} />
            <span className={`${corner} bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl`} />
            {detected ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-green-600/30">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-600 text-white font-semibold text-lg shadow-lg">
                  <FiCheckCircle /> {detected}
                </span>
              </div>
            ) : (
              <span className="pdv-scan-line absolute left-3 right-3 h-0.5 bg-red-500 shadow-[0_0_12px_2px_rgba(239,68,68,0.7)]" />
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-6 text-center text-white space-y-4">
        <p className="text-gray-300">
          {detected
            ? 'Código lido. Levando para o campo de código…'
            : 'Aproxime o código de barras ou a etiqueta da balança, bem iluminado e sem tremer'}
        </p>
        {torch !== null && !detected && (
          <button onClick={toggleTorch} className={`inline-flex items-center gap-2 px-5 py-3 rounded-full ${torch ? 'bg-yellow-400 text-gray-900' : 'bg-white/10 text-white'}`}>
            <FiZap /> Lanterna
          </button>
        )}
      </div>
    </div>
  )
}
