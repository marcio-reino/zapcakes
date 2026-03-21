import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import api from '../../services/api.js'
import { FiCalendar, FiShoppingBag, FiTrendingUp, FiDollarSign, FiAlertCircle } from 'react-icons/fi'

export default function ClientDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    ordersMonth: 0,
    ordersToday: 0,
    revenueToday: 0,
    revenueMonth: 0,
    pendingToday: 0,
    pendingPrevious: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/orders').then(({ data }) => {
      const now = new Date()
      const todayStr = now.toISOString().slice(0, 10)
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()

      const cancelledStatuses = ['CANCELLED']

      const activeOrders = data.filter(o => !cancelledStatuses.includes(o.status))

      const monthOrders = activeOrders.filter(o => {
        const d = new Date(o.createdAt)
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })

      const todayOrders = activeOrders.filter(o => {
        return o.createdAt?.slice(0, 10) === todayStr
      })

      const revenueToday = todayOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0)
      const revenueMonth = monthOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0)

      const pendingStatuses = ['PENDING', 'RESERVATION']
      const pendingAll = data.filter(o => pendingStatuses.includes(o.status))
      const pendingToday = pendingAll.filter(o => o.createdAt?.slice(0, 10) === todayStr).length
      const pendingPrevious = pendingAll.filter(o => o.createdAt?.slice(0, 10) < todayStr).length

      setStats({
        ordersMonth: monthOrders.length,
        ordersToday: todayOrders.length,
        revenueToday,
        revenueMonth,
        pendingToday,
        pendingPrevious,
      })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const formatCurrency = (value) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const cards = [
    {
      icon: <FiShoppingBag size={28} />,
      iconBg: 'bg-green-500',
      label: 'Pedidos Hoje',
      value: stats.ordersToday,
      sub: `${stats.ordersMonth} pedidos este mês`,
    },
    {
      icon: <FiDollarSign size={28} />,
      iconBg: 'bg-emerald-500',
      label: 'Faturamento Hoje',
      value: formatCurrency(stats.revenueToday),
      sub: `${formatCurrency(stats.revenueMonth)} este mês`,
    },
    {
      icon: <FiCalendar size={28} />,
      iconBg: 'bg-blue-500',
      label: 'Pedidos no Mês',
      value: stats.ordersMonth,
      sub: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    },
    {
      icon: <FiTrendingUp size={28} />,
      iconBg: 'bg-purple-500',
      label: 'Faturamento Mensal',
      value: formatCurrency(stats.revenueMonth),
      sub: 'Total acumulado',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Bem-vindo, {user?.name}!</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">Sistema de pedidos inteligente</p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            {cards.map((card, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`${card.iconBg} p-3 rounded-xl text-white`}>
                    {card.icon}
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{card.label}</p>
                <p className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">{card.value}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Card Pendentes de Confirmação */}
          {(stats.pendingToday > 0 || stats.pendingPrevious > 0) && (
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 hover:shadow-md transition-shadow shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-amber-500 p-3 rounded-xl text-white">
                  <FiAlertCircle size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Aguardando Confirmação</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Pedidos pendentes e reservas que precisam da sua atenção</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/70 dark:bg-gray-800/50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">{stats.pendingToday}</p>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Hoje</p>
                </div>
                <div className="bg-white/70 dark:bg-gray-800/50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-extrabold text-orange-600 dark:text-orange-400">{stats.pendingPrevious}</p>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Anteriores</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
