import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import { FiUsers, FiShoppingCart, FiPackage, FiDollarSign } from 'react-icons/fi'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ clients: 0, orders: 0, products: 0 })

  useEffect(() => {
    Promise.all([
      api.get('/users').catch(() => ({ data: [] })),
      api.get('/orders').catch(() => ({ data: [] })),
      api.get('/products').catch(() => ({ data: [] })),
    ]).then(([users, orders, products]) => {
      setStats({
        clients: users.data.filter((u) => u.role === 'CLIENT').length,
        orders: orders.data.length,
        products: products.data.length,
      })
    })
  }, [])

  const cards = [
    { label: 'Clientes', value: stats.clients, icon: FiUsers, color: 'bg-blue-500' },
    { label: 'Pedidos', value: stats.orders, icon: FiShoppingCart, color: 'bg-green-500' },
    { label: 'Produtos', value: stats.products, icon: FiPackage, color: 'bg-purple-500' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex items-center gap-4">
              <div className={`${card.color} p-3 rounded-lg text-white`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{card.label}</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">{card.value}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
