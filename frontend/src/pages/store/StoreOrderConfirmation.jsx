import { useState, useEffect } from 'react'
import { useParams, useOutletContext, Link } from 'react-router-dom'
import { FiCheckCircle, FiArrowLeft } from 'react-icons/fi'
import storeApi from '../../services/storeApi.js'

function fmtBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function StoreOrderConfirmation() {
  const { orderId } = useParams()
  const { slug } = useOutletContext()
  const [order, setOrder] = useState(null)

  useEffect(() => {
    storeApi.get(`/store/${slug}/customer/orders`)
      .then(({ data }) => {
        const found = data.find(o => o.id === Number(orderId))
        if (found) setOrder(found)
      })
      .catch(() => {})
  }, [slug, orderId])

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
