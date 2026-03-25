import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiCheck, FiX, FiKey, FiRefreshCw } from 'react-icons/fi'

export default function SuperadminAI() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data: res } = await api.get('/superadmin/ai/status')
      setData(res)
    } catch {
      toast.error('Erro ao carregar status da IA')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  const card = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm'

  // Calcula max para escala do gráfico
  const maxSpend = data?.dailySpend?.length > 0
    ? Math.max(...data.dailySpend.map(d => d.amount), 0.01)
    : 1

  // Dias do mês para o gráfico
  const daysInMonth = data?.period ? Math.ceil((new Date(data.period.monthEnd).getTime() - new Date(data.period.start).getTime()) / 86400000) + 1 : 30
  const spendMap = {}
  ;(data?.dailySpend || []).forEach(d => { spendMap[d.date] = d.amount })

  const chartDays = []
  if (data?.period) {
    const s = new Date(data.period.start)
    for (let i = 0; i < daysInMonth; i++) {
      const d = new Date(s)
      d.setDate(d.getDate() + i)
      const key = d.toISOString().split('T')[0]
      chartDays.push({ date: key, amount: spendMap[key] || 0, day: d.getDate() })
    }
  }

  // Budget progress
  const budgetLimit = data?.budget?.limit || 120
  const spendPercent = Math.min((data?.totalSpend || 0) / budgetLimit * 100, 100)

  // Dias restantes no mês
  const now = new Date()
  const monthEnd = data?.period?.monthEnd ? new Date(data.period.monthEnd) : new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysLeft = Math.max(0, Math.ceil((monthEnd.getTime() - now.getTime()) / 86400000))

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const currentMonth = monthNames[now.getMonth()]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Inteligência Artificial</h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {!data?.keyConfigured ? (
        <div className={`${card} p-6`}>
          <div className="flex items-center gap-3 text-red-500">
            <FiX size={24} />
            <div>
              <p className="font-semibold">API Key não configurada</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Defina a variável OPENAI_API_KEY no arquivo .env do backend.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* API Key Status */}
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${data.keyValid ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  {data.keyValid ? <FiCheck size={16} className="text-green-600 dark:text-green-400" /> : <FiX size={16} className="text-red-600 dark:text-red-400" />}
                </div>
                <span className={`text-sm font-medium ${data.keyValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  API Key {data.keyValid ? 'válida' : 'inválida'}
                </span>
                {data.keyPreview && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-500 dark:text-gray-400 font-mono">
                    <FiKey size={10} /> {data.keyPreview}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{data.modelsCount} modelos</span>
            </div>
          </div>

          {!data.adminKeyConfigured && (
            <div className={`${card} p-4 border border-amber-200 dark:border-amber-800`}>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Para ver custos, tokens e requests, adicione <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded font-mono text-xs">OPENAI_ADMIN_KEY</code> no .env do backend.
                Gere em: <span className="underline">platform.openai.com/settings/organization/admin-keys</span>
              </p>
            </div>
          )}

          {data.error ? (
            <div className={`${card} p-6 border border-red-200 dark:border-red-800`}>
              <p className="text-sm text-red-500">{data.error}</p>
            </div>
          ) : data.adminKeyConfigured ? (
            <>
              {/* Layout principal: Gráfico + Sidebar */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Gráfico de gastos */}
                <div className={`${card} p-6 lg:col-span-3`}>
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Spend</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {data.period?.start?.slice(5).replace('-', '/')} - {data.period?.end?.slice(5).replace('-', '/')}
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">${data.totalSpend?.toFixed(2)}</p>
                  <div className="text-xs text-green-500 mb-6">
                    ${data.totalSpend?.toFixed(2)}
                  </div>

                  {/* Barras */}
                  <div className="flex items-end gap-[2px] h-40">
                    {chartDays.map((d) => (
                      <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div
                          className="w-full bg-indigo-500 dark:bg-indigo-400 rounded-t-sm min-h-[2px] transition-all hover:bg-indigo-400 dark:hover:bg-indigo-300"
                          style={{ height: `${Math.max((d.amount / maxSpend) * 100, 1.5)}%` }}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            {d.date.slice(5).replace('-', '/')}: ${d.amount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Labels do eixo X */}
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-gray-400">1</span>
                    <span className="text-xs text-gray-400">{Math.floor(daysInMonth / 2)}</span>
                    <span className="text-xs text-gray-400">{daysInMonth}</span>
                  </div>
                </div>

                {/* Sidebar com métricas */}
                <div className="space-y-4">
                  {/* Budget do mês */}
                  <div className={`${card} p-5`}>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Budget de {currentMonth}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      ${data.totalSpend?.toFixed(2)} <span className="text-sm font-normal text-gray-400">/ ${budgetLimit}</span>
                    </p>
                    {/* Barra de progresso */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${spendPercent > 80 ? 'bg-red-500' : spendPercent > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${spendPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Renova em {daysLeft} dias</p>
                  </div>

                  {/* Total tokens */}
                  <div className={`${card} p-5`}>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total tokens</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {data.totalTokens?.toLocaleString('pt-BR') || '0'}
                    </p>
                  </div>

                  {/* Total requests */}
                  <div className={`${card} p-5`}>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total requests</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {data.totalRequests?.toLocaleString('pt-BR') || '0'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
