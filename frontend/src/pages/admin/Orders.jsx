import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { FiCheckCircle, FiImage, FiFile, FiX, FiXCircle, FiTruck, FiDollarSign } from 'react-icons/fi'

const statusLabels = {
  PENDING: 'Pendente',
  RESERVATION: 'Reserva',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Preparando',
  READY: 'Pronto',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  RESERVATION: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  PREPARING: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  READY: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  DELIVERED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [proofModal, setProofModal] = useState(null)
  const [cancelConfirm, setCancelConfirm] = useState(null)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    try {
      const { data } = await api.get('/orders')
      setOrders(data)
    } catch {
      toast.error('Erro ao carregar pedidos')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id, status) {
    try {
      await api.put(`/orders/${id}/status`, { status })
      toast.success('Status atualizado!')
      loadOrders()
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  async function verifyProof(id) {
    try {
      await api.put(`/orders/${id}/verify-proof`)
      toast.success('Comprovante verificado! Pedido confirmado.')
      setProofModal(null)
      loadOrders()
    } catch {
      toast.error('Erro ao verificar comprovante')
    }
  }

  async function confirmPayment(id) {
    try {
      await api.put(`/orders/${id}/confirm-payment`)
      toast.success('Pagamento confirmado! Pedido confirmado.')
      loadOrders()
    } catch {
      toast.error('Erro ao confirmar pagamento')
    }
  }

  async function cancelOrder(id) {
    try {
      await api.put(`/orders/${id}/cancel`)
      toast.success('Pedido cancelado. Cliente notificado.')
      setCancelConfirm(null)
      loadOrders()
    } catch {
      toast.error('Erro ao cancelar pedido')
    }
  }

  function isPdf(url) {
    return url?.toLowerCase().match(/\.pdf(\?|$)/)
  }

  function calcSubtotal(order) {
    return order.items?.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) || 0
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Pedidos</h1>

      <div className="space-y-4">
        {orders.map((order) => {
          const subtotal = calcSubtotal(order)
          const deliveryFee = Number(order.deliveryFee || 0)
          const total = Number(order.total)
          const reservation = order.reservation ? Number(order.reservation) : null
          const canCancel = order.status !== 'CANCELLED' && order.status !== 'DELIVERED'

          return (
            <div key={order.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white">Pedido #{order.id}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{order.customerName} - {order.customerPhone}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(order.createdAt).toLocaleString('pt-BR')}</p>
                  {order.deliveryType && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                      <FiTruck size={12} />
                      {order.deliveryType === 'ENTREGA' ? 'Entrega' : 'Retirada'}
                      {order.deliveryAddress && ` - ${order.deliveryAddress}`}
                    </p>
                  )}
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-xs rounded-full ${statusColors[order.status]}`}>
                      {statusLabels[order.status]}
                    </span>
                    {canCancel && (
                      <button
                        onClick={() => setCancelConfirm(order)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        <FiXCircle size={12} /> Cancelar
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {deliveryFee > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Subtotal: R$ {subtotal.toFixed(2)}</p>
                    )}
                    {deliveryFee > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end gap-1">
                        <FiTruck size={10} /> Taxa: R$ {deliveryFee.toFixed(2)}
                      </p>
                    )}
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">R$ {total.toFixed(2)}</p>
                    {reservation && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Reserva: R$ {reservation.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t dark:border-gray-700 pt-3 mb-3">
                {order.items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm py-1 dark:text-gray-300">
                    <span>{item.quantity}x {item.product?.name}</span>
                    <span>R$ {(Number(item.price) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {order.notes && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Obs: {order.notes}</p>}

              {/* Comprovante de pagamento */}
              {order.paymentProof && (
                <div className="border-t dark:border-gray-700 pt-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isPdf(order.paymentProof) ? (
                        <FiFile size={16} className="text-red-500" />
                      ) : (
                        <FiImage size={16} className="text-blue-500" />
                      )}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Comprovante de Pagamento</span>
                      {order.proofVerified && (
                        <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                          <FiCheckCircle size={12} /> Verificado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setProofModal(order)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Visualizar
                      </button>
                      {!order.proofVerified && order.status === 'RESERVATION' && (
                        <button
                          onClick={() => verifyProof(order.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                        >
                          <FiCheckCircle size={14} /> Verificar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Pagamento integral */}
              {order.paymentConfirmed && (
                <div className="border-t dark:border-gray-700 pt-3 mb-3">
                  <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                    <FiDollarSign size={16} /> Pagamento integral confirmado
                  </span>
                </div>
              )}

              {/* Ações do pedido */}
              <div className="border-t dark:border-gray-700 pt-3 flex gap-2 flex-wrap items-center">
                {['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(order.id, s)}
                    disabled={order.status === s || order.status === 'CANCELLED'}
                    className={`text-xs px-3 py-1 rounded-lg border dark:border-gray-600 dark:text-gray-300 ${
                      order.status === s || order.status === 'CANCELLED'
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {statusLabels[s]}
                  </button>
                ))}

                {/* Confirmar pagamento integral (quando tem reserva verificada mas pagamento total ainda não confirmado) */}
                {order.proofVerified && !order.paymentConfirmed && order.status !== 'CANCELLED' && (
                  <button
                    onClick={() => confirmPayment(order.id)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    <FiDollarSign size={12} /> Confirmar Pagamento Total
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {orders.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhum pedido encontrado.</p>}
      </div>

      {/* Modal de visualização do comprovante */}
      {proofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setProofModal(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-slideDown">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Comprovante - Pedido #{proofModal.id}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{proofModal.customerName} - R$ {Number(proofModal.reservation || proofModal.total).toFixed(2)}</p>
              </div>
              <button onClick={() => setProofModal(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center">
              {isPdf(proofModal.paymentProof) ? (
                <div className="w-full">
                  <div className="flex items-center justify-center gap-3 py-8 bg-gray-50 dark:bg-gray-700 rounded-xl mb-4">
                    <FiFile size={40} className="text-red-500" />
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white">Comprovante em PDF</p>
                      <a href={proofModal.paymentProof} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        Abrir em nova aba
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={proofModal.paymentProof}
                  alt="Comprovante de pagamento"
                  className="max-h-[60vh] rounded-xl object-contain"
                />
              )}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-700 dark:border-gray-600 flex justify-between items-center">
              <div>
                {proofModal.proofVerified ? (
                  <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                    <FiCheckCircle size={16} /> Comprovante verificado
                  </span>
                ) : (
                  <span className="text-sm text-yellow-600 dark:text-yellow-400">Aguardando verificação</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setProofModal(null)}
                  className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  Fechar
                </button>
                {!proofModal.proofVerified && proofModal.status === 'RESERVATION' && (
                  <button
                    onClick={() => verifyProof(proofModal.id)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <FiCheckCircle size={16} /> Verificar Comprovante
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de cancelamento */}
      <ConfirmModal
        isOpen={!!cancelConfirm}
        onClose={() => setCancelConfirm(null)}
        title="Cancelar Pedido"
        message={cancelConfirm ? `Tem certeza que deseja cancelar o Pedido #${cancelConfirm.id}? O cliente será notificado via WhatsApp.` : ''}
        confirmText="Cancelar Pedido"
        onConfirm={() => cancelConfirm && cancelOrder(cancelConfirm.id)}
      />
    </div>
  )
}
