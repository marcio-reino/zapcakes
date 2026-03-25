import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import api from '../../services/api.js'
import { FiCalendar, FiShoppingBag, FiTrendingUp, FiDollarSign, FiAlertCircle, FiCheckCircle, FiClock, FiX, FiUpload, FiFile, FiImage } from 'react-icons/fi'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { QRCodeSVG } from 'qrcode.react'
import Modal from '../../components/Modal.jsx'
import toast from 'react-hot-toast'
import faviconImg from '../../assets/favicon.png'

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
  const [planInfo, setPlanInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState([])
  const [pendingPayment, setPendingPayment] = useState(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [paymentHistory, setPaymentHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api.get('/dashboard/chart').then(({ data }) => setChartData(data)).catch(() => {})
    api.get('/company/pending-payment').then(({ data }) => setPendingPayment(data)).catch(() => {})

    api.get('/company').then(({ data }) => {
      setPlanInfo({
        plan: data.plan,
        status: data.accountStatus,
        trialEndsAt: data.trialEndsAt,
        planStartedAt: data.planStartedAt,
        planExpiresAt: data.planExpiresAt,
      })
    }).catch(() => {})

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

  const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  function formatRefMonth(ref) {
    if (!ref) return '-'
    const [y, m] = ref.split('-')
    const date = new Date(Number(y), Number(m) - 1)
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }

  const paymentStatusLabels = { PENDING: 'Pendente', PAID: 'Pago', FAILED: 'Falhou', REFUNDED: 'Reembolsado', CANCELLED: 'Cancelado' }
  const paymentStatusColors = { PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', REFUNDED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }

  async function handleUploadProof(e) {
    const file = e.target.files?.[0]
    if (!file || !pendingPayment?.payment) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      toast.error('Envie uma imagem (JPG, PNG) ou PDF')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data: upload } = await api.post('/uploads?folder=payment-proofs', formData)

      await api.put(`/company/payments/${pendingPayment.payment.id}/proof`, { proofUrl: upload.url })

      setPendingPayment((prev) => ({
        ...prev,
        payment: { ...prev.payment, proofUrl: upload.url },
      }))
      toast.success('Comprovante enviado!')
    } catch {
      toast.error('Erro ao enviar comprovante')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function openHistory() {
    setShowHistory(true)
    setHistoryLoading(true)
    try {
      const { data } = await api.get('/company/payments')
      setPaymentHistory(data)
    } catch {
      setPaymentHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

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

          {/* Card do Plano */}
          {planInfo && (
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 hover:shadow-md transition-shadow shadow-sm mb-6">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <img src={faviconImg} alt="ZapCakes" className="w-12 h-12 rounded-xl" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Seu Plano</p>
                    <h3 className="text-xl md:text-lg font-bold text-gray-900 dark:text-white">
                      {planInfo.plan?.title || 'Sem plano'}
                    </h3>
                    {planInfo.plan?.price != null && (
                      <p className="text-sm text-green-600 dark:text-green-400 font-semibold">
                        {parseFloat(planInfo.plan.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                      </p>
                    )}
                  </div>

                  {/* Status inline ao lado do nome */}
                  <div className="ml-2">
                    {planInfo.status === 'TRIAL' && planInfo.trialEndsAt && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        Teste até {new Date(planInfo.trialEndsAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {planInfo.status === 'ACTIVE' && planInfo.planExpiresAt && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        <FiCheckCircle size={12} /> Ativo até {new Date(planInfo.planExpiresAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {planInfo.status === 'ACTIVE' && !planInfo.planExpiresAt && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        <FiCheckCircle size={12} /> Ativo
                      </span>
                    )}
                    {planInfo.status === 'SUSPENDED' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        <FiAlertCircle size={12} /> Suspenso
                      </span>
                    )}
                    {!planInfo.plan && planInfo.status !== 'TRIAL' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        Sem plano
                      </span>
                    )}
                  </div>
                </div>

                {/* Botão Pagar */}
                <div className="flex flex-col items-start md:items-end gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPayModal(true)}
                      className={`px-8 py-3 rounded-xl text-base font-bold transition-colors shadow-sm ${pendingPayment?.payment ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-default'}`}
                      disabled={!pendingPayment?.payment}
                    >
                      Pagar
                    </button>
                    <button
                      onClick={openHistory}
                      className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title="Histórico de pagamentos"
                    >
                      <FiClock size={20} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Features do plano */}
              {planInfo.plan?.features && (() => {
                try {
                  const features = JSON.parse(planInfo.plan.features)
                  if (Array.isArray(features) && features.length > 0) {
                    return (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {features.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                              <FiCheckCircle size={14} className="text-green-500 flex-shrink-0" />
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }
                } catch { /* features não é JSON válido */ }
                return null
              })()}
            </div>
          )}

          {/* Gráfico de Evolução — Ganhos × Gastos */}
          {chartData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 hover:shadow-md transition-shadow shadow-sm mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-500 p-3 rounded-xl text-white">
                  <FiTrendingUp size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Evolução Financeira</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ganhos e gastos dos últimos 12 meses</p>
                </div>
              </div>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradGanhos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} width={70} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 12, color: '#fff' }}
                      formatter={(value) => [Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), undefined]}
                      labelStyle={{ color: '#9ca3af', marginBottom: 4 }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                    <Area type="monotone" dataKey="ganhos" name="Ganhos" stroke="#22c55e" strokeWidth={2.5} fill="url(#gradGanhos)" />
                    <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#ef4444" strokeWidth={2.5} fill="url(#gradGastos)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

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

      {/* Modal: Pagamento */}
      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Pagamento" maxWidth="max-w-3xl">
        {pendingPayment?.payment ? (
          <div className="space-y-4">
            {/* Layout horizontal: QR Code à esquerda, Dados à direita */}
            <div className="flex flex-col md:flex-row gap-5">

              {/* Coluna esquerda: QR Code + Chave PIX */}
              {pendingPayment.pixKey && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex flex-col items-center gap-3 md:w-[240px] shrink-0">
                  <p className="text-sm font-bold text-green-800 dark:text-green-300">Chave PIX</p>
                  <div className="bg-white p-2.5 rounded-xl">
                    <QRCodeSVG value={pendingPayment.pixKey} size={160} />
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <p className="text-xs font-mono font-semibold text-green-700 dark:text-green-400 break-all flex-1 text-center">{pendingPayment.pixKey}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(pendingPayment.pixKey); toast.success('Chave PIX copiada!') }}
                    className="w-full px-3 py-3 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Copiar chave
                  </button>
                  {pendingPayment.pixName && (
                    <p className="text-xs text-green-600 dark:text-green-400 text-center">{pendingPayment.pixName}</p>
                  )}
                </div>
              )}

              {/* Coluna direita: Dados + Instruções + Comprovante */}
              <div className="flex-1 space-y-4">
                {/* Referência + Valor */}
                <div className="flex items-center gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 flex-1 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Valor</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{BRL(pendingPayment.payment.amount)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 flex-1 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Referência</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">{formatRefMonth(pendingPayment.payment.referenceMonth)}</p>
                  </div>
                </div>

                {/* Detalhes inline */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {pendingPayment.payment.code && (
                    <div className="flex gap-1.5">
                      <span className="text-gray-500 dark:text-gray-400">Código:</span>
                      <span className="font-bold text-gray-800 dark:text-white">{pendingPayment.payment.code}</span>
                    </div>
                  )}
                  {pendingPayment.payment.dueDate && (
                    <div className="flex gap-1.5">
                      <span className="text-gray-500 dark:text-gray-400">Vencimento:</span>
                      <span className="font-medium text-gray-800 dark:text-white">{new Date(pendingPayment.payment.dueDate).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <span className="text-gray-500 dark:text-gray-400">Método:</span>
                    <span className="font-medium text-gray-800 dark:text-white">{pendingPayment.payment.method || 'PIX'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 dark:text-gray-400">Status:</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${paymentStatusColors[pendingPayment.payment.status] || ''}`}>
                      {paymentStatusLabels[pendingPayment.payment.status] || pendingPayment.payment.status}
                    </span>
                  </div>
                  {pendingPayment.plan && (
                    <div className="flex gap-1.5">
                      <span className="text-gray-500 dark:text-gray-400">Plano:</span>
                      <span className="font-medium text-gray-800 dark:text-white">{pendingPayment.plan.title}</span>
                    </div>
                  )}
                </div>

                {/* Instruções */}
                {pendingPayment.paymentInstructions && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                    <p className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">Instruções</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 whitespace-pre-line">{pendingPayment.paymentInstructions}</p>
                  </div>
                )}

                {/* Comprovante */}
                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-3 space-y-2">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Comprovante</p>
                  {pendingPayment.payment.proofUrl ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <FiCheckCircle size={14} />
                        <span className="font-medium text-xs">Comprovante enviado</span>
                      </div>
                      {pendingPayment.payment.proofUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i) ? (
                        <img src={pendingPayment.payment.proofUrl} alt="Comprovante" className="max-h-32 object-contain rounded-lg border dark:border-gray-600" />
                      ) : (
                        <a href={pendingPayment.payment.proofUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                          <FiFile size={14} /> Visualizar comprovante (PDF)
                        </a>
                      )}
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                        <FiUpload size={12} /> Enviar outro
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleUploadProof} disabled={uploading} />
                      </label>
                    </div>
                  ) : (
                    <label className={`flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-300 dark:border-gray-500 rounded-xl cursor-pointer hover:border-green-400 hover:bg-green-50/50 dark:hover:border-green-600 dark:hover:bg-green-900/10 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      <FiUpload size={20} className="text-gray-400 dark:text-gray-500" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {uploading ? 'Enviando...' : 'Anexar comprovante'}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">(JPG, PNG, PDF)</span>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleUploadProof} disabled={uploading} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPayModal(false)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <FiCheckCircle size={32} className="text-green-500" />
            </div>
            <p className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Tudo em dia!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma cobrança pendente neste mês.</p>
            <button
              onClick={() => setShowPayModal(false)}
              className="mt-6 px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </Modal>

      {/* Modal: Histórico de pagamentos */}
      <Modal isOpen={showHistory} onClose={() => setShowHistory(false)} title="Histórico de Pagamentos" maxWidth="max-w-lg" maxHeight="80vh">
        {historyLoading ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : paymentHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Nenhum pagamento registrado</div>
        ) : (
          <div className="space-y-2">
            {paymentHistory.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{formatRefMonth(p.referenceMonth)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {p.dueDate ? `Venc: ${new Date(p.dueDate).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                    {p.paidAt && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Pago em {new Date(p.paidAt).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <span className="text-sm font-bold text-gray-800 dark:text-white">{BRL(p.amount)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${paymentStatusColors[p.status] || ''}`}>
                    {paymentStatusLabels[p.status] || p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
