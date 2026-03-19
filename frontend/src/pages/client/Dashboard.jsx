import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import api from '../../services/api.js'
import { FiSmartphone, FiShoppingCart, FiMessageSquare } from 'react-icons/fi'

export default function ClientDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ instances: 0, orders: 0 })

  useEffect(() => {
    Promise.all([
      api.get('/instances').catch(() => ({ data: [] })),
      api.get('/orders').catch(() => ({ data: [] })),
    ]).then(([instances, orders]) => {
      setStats({
        instances: instances.data.length,
        orders: orders.data.length,
      })
    })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Bem-vindo, {user?.name}!</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">Gerencie seu WhatsApp e pedidos.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex items-center gap-4">
          <div className="bg-green-500 p-3 rounded-lg text-white">
            <FiSmartphone size={24} />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Instâncias WhatsApp</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.instances}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex items-center gap-4">
          <div className="bg-blue-500 p-3 rounded-lg text-white">
            <FiShoppingCart size={24} />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Pedidos</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.orders}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
