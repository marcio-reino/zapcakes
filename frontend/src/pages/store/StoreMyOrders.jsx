import { useState, useEffect, useRef } from 'react'
import { useOutletContext, Link, useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiChevronDown, FiChevronUp, FiUpload, FiCheck, FiClock, FiX, FiImage, FiAlertTriangle } from 'react-icons/fi'
import storeApi from '../../services/storeApi.js'
import { useStoreAuth } from '../../contexts/StoreAuthContext.jsx'
import toast from 'react-hot-toast'

function fmtBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_MAP = {
  PENDING: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
  RESERVATION: { label: 'Reserva', color: 'bg-indigo-100 text-indigo-700' },
  CONFIRMED: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700' },
  PREPARING: { label: 'Preparando', color: 'bg-orange-100 text-orange-700' },
  READY: { label: 'Pronto', color: 'bg-green-100 text-green-700' },
  DELIVERED: { label: 'Entregue', color: 'bg-gray-100 text-gray-600' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
}

function PaymentProofSection({ order, slug, onUpdate }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)

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

      onUpdate(order.id, data)
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

  // Já verificado
  if (order.proofVerified) {
    return (
      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <FiCheck size={16} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-700">Pagamento verificado</p>
            <p className="text-xs text-green-600">Comprovante aprovado pela loja</p>
          </div>
        </div>
        {order.paymentProof && (
          <a href={order.paymentProof} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-600 hover:underline">
            <FiImage size={12} /> Ver comprovante
          </a>
        )}
      </div>
    )
  }

  // Já enviou mas aguarda verificação
  if (order.paymentProof && !order.proofVerified) {
    return (
      <div className={`mt-3 p-3 rounded-xl ${order.depositDivergence ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${order.depositDivergence ? 'bg-red-100' : 'bg-amber-100'}`}>
            {order.depositDivergence
              ? <FiAlertTriangle size={16} className="text-red-600" />
              : <FiClock size={16} className="text-amber-600" />
            }
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${order.depositDivergence ? 'text-red-700' : 'text-amber-700'}`}>
              {order.depositDivergence ? 'Valor divergente identificado' : 'Comprovante enviado'}
            </p>
            <p className={`text-xs ${order.depositDivergence ? 'text-red-600' : 'text-amber-600'}`}>
              {order.depositDivergence
                ? 'O valor do comprovante parece diferente do esperado. Nossa equipe irá verificar e responder.'
                : 'Aguardando verificação da loja'}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <a href={order.paymentProof} target="_blank" rel="noopener noreferrer">
            <img src={preview || order.paymentProof} alt="Comprovante" className={`w-14 h-14 rounded-lg object-cover border-2 ${order.depositDivergence ? 'border-red-200' : 'border-amber-200'}`} />
          </a>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={`text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 ${order.depositDivergence ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'} transition-colors`}
          >
            {uploading ? 'Enviando...' : 'Reenviar comprovante'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
      </div>
    )
  }

  // Sem comprovante — exibir botão de upload
  return (
    <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
          <FiUpload size={16} className="text-indigo-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-indigo-700">Comprovante PIX</p>
          <p className="text-xs text-indigo-500">
            {order.depositAmount
              ? `Envie o comprovante do valor de reserva: ${fmtBRL(order.depositAmount)}`
              : 'Envie o comprovante de pagamento PIX'}
          </p>
        </div>
      </div>

      {preview ? (
        <div className="flex items-center gap-3 mb-2">
          <img src={preview} alt="Preview" className="w-14 h-14 rounded-lg object-cover border-2 border-indigo-200" />
          {uploading && <span className="text-xs text-indigo-500 animate-pulse">Enviando...</span>}
        </div>
      ) : null}

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
  )
}

function OrderCard({ order, slug, onProofUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const status = STATUS_MAP[order.status] || STATUS_MAP.PENDING

  const showPaymentProof = order.status === 'RESERVATION' || order.status === 'PENDING'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-800">Pedido #{String(order.orderNumber).padStart(5, '0')}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${status.color}`}>
              {status.label}
            </span>
            <span className="text-base font-bold text-gray-800">{fmtBRL(order.total)}</span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {expanded ? <><FiChevronUp size={16} /> Recolher</> : <><FiChevronDown size={16} /> Ver detalhes</>}
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {order.items?.map(item => (
            <div key={item.id}>
              <div className="flex items-center gap-3">
                {item.product?.imageUrl ? (
                  <img src={item.product.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-base">🧁</div>
                )}
                <div className="flex-1">
                  <p className="text-base text-gray-700">{item.product?.name}</p>
                </div>
                <span className="text-base text-gray-500">{item.quantity}x</span>
                <span className="text-base font-medium text-gray-800">{fmtBRL(Number(item.price) * item.quantity)}</span>
              </div>
              {item.attachments?.length > 0 && (
                <div className="ml-[60px] mt-1.5 mb-1">
                  <p className="text-sm font-semibold text-purple-600 mb-1">📸 Fotos de inspiração</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {item.attachments.map((att) => (
                      <a key={att.id} href={att.imageUrl} target="_blank" rel="noopener noreferrer">
                        <img src={att.imageUrl} alt="Inspiração" className="w-12 h-12 rounded-lg object-cover border-2 border-purple-200 hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {order.notes && (
            <p className="text-sm text-gray-500 mt-2 italic">Obs: {order.notes}</p>
          )}

          {/* Valor de reserva */}
          {order.depositAmount > 0 && (
            <div className="mt-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-base font-medium text-amber-800">Valor de reserva</span>
                <span className="text-base font-bold text-amber-800">{fmtBRL(order.depositAmount)}</span>
              </div>
              <p className="text-sm text-amber-600">
                Restante a pagar na entrega/retirada: {fmtBRL(Number(order.total) - Number(order.depositAmount))}
              </p>
            </div>
          )}

          {/* Comprovante de pagamento PIX */}
          {showPaymentProof && (
            <PaymentProofSection order={order} slug={slug} onUpdate={onProofUpdate} />
          )}
        </div>
      )}
    </div>
  )
}

export default function StoreMyOrders() {
  const { slug } = useOutletContext()
  const { customer } = useStoreAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customer) {
      navigate(`/loja/${slug}/login`)
      return
    }
    storeApi.get(`/store/${slug}/customer/orders`)
      .then(({ data }) => setOrders(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug, customer])

  function handleProofUpdate(orderId, data) {
    setOrders(prev => prev.map(o =>
      o.id === orderId ? {
        ...o,
        paymentProof: data.paymentProof,
        proofVerified: data.proofVerified,
        depositAmount: data.depositAmount ?? o.depositAmount,
        depositDivergence: data.depositDivergence ?? o.depositDivergence,
        status: data.status ?? o.status,
      } : o
    ))
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-xl h-20 animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <Link to={`/loja/${slug}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-green-600 mb-4">
        <FiArrowLeft size={16} />
        Voltar ao catálogo
      </Link>

      <h1 className="text-xl font-bold text-gray-800 mb-4">Meus pedidos</h1>

      {orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p>Nenhum pedido ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => <OrderCard key={o.id} order={o} slug={slug} onProofUpdate={handleProofUpdate} />)}
        </div>
      )}
    </div>
  )
}
