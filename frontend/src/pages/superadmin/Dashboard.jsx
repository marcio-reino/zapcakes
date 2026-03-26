import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import { FiUsers, FiUserCheck, FiUserX, FiCreditCard, FiDollarSign, FiTrendingUp, FiGlobe, FiMousePointer, FiMapPin } from 'react-icons/fi'

export default function SuperadminDashboard() {
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/superadmin/stats').then(r => r.data).catch(() => null),
      api.get('/superadmin/site-analytics').then(r => r.data).catch(() => null),
    ]).then(([s, a]) => {
      setStats(s)
      setAnalytics(a)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  const cards = [
    { label: 'Total de Clientes', value: stats?.totalClients || 0, icon: FiUsers, color: 'bg-blue-500' },
    { label: 'Clientes Ativos', value: stats?.activeClients || 0, icon: FiUserCheck, color: 'bg-green-500' },
    { label: 'Clientes Inativos', value: stats?.inactiveClients || 0, icon: FiUserX, color: 'bg-red-500' },
    { label: 'Planos Ativos', value: stats?.totalPlans || 0, icon: FiCreditCard, color: 'bg-purple-500' },
    { label: 'Pagamentos Recebidos', value: stats?.totalPaidPayments || 0, icon: FiTrendingUp, color: 'bg-orange-500' },
    { label: 'Receita Total', value: `R$ ${Number(stats?.totalRevenue || 0).toFixed(2).replace('.', ',')}`, icon: FiDollarSign, color: 'bg-emerald-500' },
  ]

  const siteCards = [
    { label: 'Visitas Hoje', value: analytics?.todayVisits || 0, icon: FiGlobe, color: 'bg-cyan-500' },
    { label: 'Visitas no Mes', value: analytics?.monthVisits || 0, icon: FiGlobe, color: 'bg-sky-500' },
    { label: 'Cliques Cadastro Hoje', value: analytics?.todayRegister || 0, icon: FiMousePointer, color: 'bg-amber-500' },
    { label: 'Cliques Cadastro no Mes', value: analytics?.monthRegister || 0, icon: FiMousePointer, color: 'bg-yellow-500' },
  ]

  const statusLabel = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', SUSPENDED: 'Suspenso', TRIAL: 'Trial' }
  const statusColor = {
    ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    TRIAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    INACTIVE: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Dashboard do Sistema</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 flex items-center gap-4">
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

      {/* Analytics do Site */}
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Analytics do Site</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {siteCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 flex items-center gap-4">
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

      {/* Top Cidades + Acessos Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Cidades */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <FiMapPin size={18} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Top Cidades (Mes)</h2>
          </div>
          <div className="p-5">
            {analytics?.topCities?.length > 0 ? (
              <div className="space-y-3">
                {analytics.topCities.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">{i + 1}</span>
                      <span className="text-sm text-gray-800 dark:text-white">{c.city}{c.region ? ` / ${c.region}` : ''}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{c.count} visitas</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum dado disponivel</p>
            )}
          </div>
        </div>

        {/* Acessos Recentes (Hoje) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Acessos Recentes (Hoje)</h2>
          </div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hora</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pagina</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Local</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {(analytics?.recentVisits || []).map((v, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(v.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        v.page === 'register'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {v.page === 'home' ? 'Site' : 'Cadastro'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {v.city ? `${v.city}${v.region ? ` / ${v.region}` : ''}` : '-'}
                    </td>
                  </tr>
                ))}
                {(!analytics?.recentVisits || analytics.recentVisits.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">Nenhum acesso hoje</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Clientes Recentes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Clientes Recentes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Empresa</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Plano</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(stats?.recentClients || []).map((client) => (
                <tr key={client.id}>
                  <td className="px-5 py-3 text-sm text-gray-900 dark:text-white">{client.name}</td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{client.account?.companyName || '-'}</td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">{client.account?.plan?.title || 'Sem plano'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColor[client.account?.status] || statusColor.INACTIVE}`}>
                      {statusLabel[client.account?.status] || 'Sem conta'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
