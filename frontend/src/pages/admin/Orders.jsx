import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'

const statusLabels = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Preparando',
  READY: 'Pronto',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  PREPARING: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  READY: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  DELIVERED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

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

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Pedidos</h1>

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white">Pedido #{order.id}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{order.customerName} - {order.customerPhone}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(order.createdAt).toLocaleString('pt-BR')}</p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 text-xs rounded-full ${statusColors[order.status]}`}>
                  {statusLabels[order.status]}
                </span>
                <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">R$ {Number(order.total).toFixed(2)}</p>
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

            <div className="flex gap-2 flex-wrap">
              {['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'].map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(order.id, s)}
                  disabled={order.status === s}
                  className={`text-xs px-3 py-1 rounded-lg border dark:border-gray-600 dark:text-gray-300 ${
                    order.status === s ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          </div>
        ))}

        {orders.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhum pedido encontrado.</p>}
      </div>
    </div>
  )
}
