import { useState, useEffect, useRef } from 'react'
import { useParams, useOutletContext, Link } from 'react-router-dom'
import { FiCheckCircle, FiArrowLeft, FiUpload } from 'react-icons/fi'
import storeApi from '../../services/storeApi.js'
import toast from 'react-hot-toast'

function fmtBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function StoreOrderConfirmation() {
  const { orderId } = useParams()
  const { slug, store } = useOutletContext()
  const [order, setOrder] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [proofSent, setProofSent] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    storeApi.get(`/store/${slug}/customer/orders`)
      .then(({ data }) => {
        const found = data.find(o => o.id === Number(orderId))
        if (found) setOrder(found)
      })
      .catch(() => {})
  }, [slug, orderId])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Máximo 10MB.')
      return
    }

    setPreview(URL.createObjectURL(file))
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const { data } = await storeApi.post(
        `/store/${slug}/orders/${order.id}/payment-proof`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      setProofSent(true)
      if (data.valueDivergent) {
        toast(data.aiMessage, { icon: '⚠️', duration: 8000 })
      } else {
        toast.success(data.aiMessage || 'Comprovante enviado!')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar comprovante')
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const reservationValue = order && store?.useReservation && store.reservationPercent > 0
    ? Number(order.total) * store.reservationPercent / 100
    : null

  return (
    <div className="max-w-lg mx-auto px-4 py-8 text-center">
      <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FiCheckCircle className="text-green-600" size={32} />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Pedido realizado!</h1>
        <p className="text-gray-500 text-sm mb-1">Seu pedido foi enviado com sucesso.</p>
        <p className="text-gray-400 text-xs mb-6">Pedido #{order ? String(order.orderNumber).padStart(5, '0') : '...'}</p>

        {order && (
          <div className="text-left bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
            {order.items?.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.quantity}x {item.product?.name}</span>
                <span className="text-gray-800 font-medium">{fmtBRL(Number(item.price) * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold text-gray-800">
              <span>Total</span>
              <span>{fmtBRL(order.total)}</span>
            </div>
          </div>
        )}

        {/* Comprovante PIX */}
        {order && !order.paymentProof && !proofSent && (reservationValue || store?.pixKey) && (
          <div className="text-left p-4 bg-indigo-50 border border-indigo-200 rounded-xl mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <FiUpload size={16} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-indigo-700">Comprovante PIX</p>
                <p className="text-xs text-indigo-500">
                  {reservationValue
                    ? `Envie o comprovante do valor de reserva: ${fmtBRL(reservationValue)}`
                    : `Envie o comprovante de pagamento: ${fmtBRL(order.total)}`}
                </p>
              </div>
            </div>

            {store?.pixKey && (
              <div className="mb-3 px-4 py-4 bg-white rounded-xl border-2 border-indigo-200 text-center">
                <p className="text-xs text-indigo-500 uppercase tracking-wider font-semibold mb-2">Chave PIX</p>
                <p className="text-lg font-bold font-mono text-indigo-900 break-all leading-relaxed mb-3">{store.pixKey}</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(store.pixKey)
                    toast.success('Chave PIX copiada!')
                  }}
                  className="px-4 py-2 text-sm font-semibold bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  Copiar chave PIX
                </button>
              </div>
            )}

            {preview && (
              <div className="flex items-center gap-3 mb-3">
                <img src={preview} alt="Preview" className="w-14 h-14 rounded-lg object-cover border-2 border-indigo-200" />
                {uploading && <span className="text-xs text-indigo-500 animate-pulse">Enviando...</span>}
              </div>
            )}

            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              <FiUpload size={16} />
              {uploading ? 'Enviando...' : 'Anexar comprovante'}
            </button>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
          </div>
        )}

        {/* Comprovante enviado com sucesso */}
        {proofSent && (
          <div className="text-left p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <FiCheckCircle size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-700">Comprovante enviado!</p>
                <p className="text-xs text-green-600">Aguardando verificação da loja</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link
            to={`/loja/${slug}/meus-pedidos`}
            className="py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors block"
          >
            Ver meus pedidos
          </Link>
          <Link
            to={`/loja/${slug}`}
            className="py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <FiArrowLeft size={16} />
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    </div>
  )
}
