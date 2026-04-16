import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiSearch, FiRefreshCw, FiChevronDown, FiChevronUp, FiMessageSquare, FiCalendar, FiExternalLink, FiUser } from 'react-icons/fi'
import DatePicker from '../../components/DatePicker.jsx'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const padId = (id) => String(id).padStart(5, '0')

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

export default function SuperadminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [expanded, setExpanded] = useState(new Set())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/superadmin/orders')
      setOrders(data)
    } catch {
      toast.error('Erro ao carregar pedidos')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const accountsList = [...new Set(orders.map((o) => o.user?.account?.companyName || o.user?.name).filter(Boolean))].sort()

  const filtered = orders.filter((o) => {
    if (filterStatus && o.status !== filterStatus) return false
    if (filterAccount) {
      const acc = o.user?.account?.companyName || o.user?.name || ''
      if (acc !== filterAccount) return false
    }
    if (filterDate) {
      const created = new Date(o.createdAt).toISOString().slice(0, 10)
      if (created !== filterDate) return false
    }
    const term = appliedSearch.trim().toLowerCase()
    if (term) {
      const hay = [
        o.customerName,
        o.customerPhone,
        String(o.orderNumber),
        o.user?.account?.companyName,
        o.user?.name,
      ].join(' ').toLowerCase()
      if (!hay.includes(term)) return false
    }
    return true
  })

  const stats = filtered.reduce(
    (acc, o) => {
      acc.count += 1
      acc.total += Number(o.total || 0)
      return acc
    },
    { count: 0, total: 0 },
  )

  if (loading) return <p className="text-gray-500 dark:text-gray-400">Carregando...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Pedidos da plataforma</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Todos os pedidos de todas as contas (últimos 500). Visão read-only.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm text-sm"
        >
          <FiRefreshCw size={15} /> Atualizar
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">Pedidos filtrados</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.count}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">Soma do valor total</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{BRL(stats.total)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-4 flex flex-col md:flex-row gap-3">
        <form
          onSubmit={(e) => { e.preventDefault(); setAppliedSearch(search) }}
          className="relative flex-1"
        >
          <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, loja, nº pedido..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
          />
        </form>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm outline-none"
        >
          <option value="">Todos os status</option>
          {Object.entries(statusLabels).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm outline-none"
        >
          <option value="">Todas as lojas</option>
          {accountsList.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <div className="min-w-[180px]">
          <DatePicker
            value={filterDate}
            onChange={(v) => setFilterDate(v || '')}
            placeholder="Filtrar por data"
          />
        </div>
        {(filterStatus || filterAccount || filterDate || appliedSearch) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterAccount(''); setFilterDate(''); setSearch(''); setAppliedSearch('') }}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Lista */}
      {filtered.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-10 text-center text-gray-400">
          Nenhum pedido encontrado
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((o) => {
          const isOpen = expanded.has(o.id)
          const storeName = o.user?.account?.companyName || o.user?.name || '?'
          const storeSlug = o.user?.account?.slug
          return (
            <div key={o.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-800 dark:text-white">Pedido #{padId(o.orderNumber)}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium text-xs">
                      🏪 {storeName}
                    </span>
                    {storeSlug && (
                      <a
                        href={`/loja/${storeSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-500 hover:text-indigo-700 inline-flex items-center"
                        title="Abrir loja"
                      >
                        <FiExternalLink size={12} />
                      </a>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[o.status] || ''}`}>
                      {statusLabels[o.status] || o.status}
                    </span>
                    {o.deliveryType && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {o.deliveryType === 'ENTREGA' ? '🚗 Entrega' : '📍 Retirada'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <FiUser size={12} /> {o.customerName}
                    </span>
                    {o.customerPhone && <span>· {o.customerPhone}</span>}
                    <span className="inline-flex items-center gap-1">
                      <FiCalendar size={12} /> {new Date(o.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{BRL(o.total)}</p>
                  {o.reservation && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Reserva: {BRL(o.reservation)}</p>
                  )}
                </div>
                <button
                  onClick={() => toggle(o.id)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm flex items-center gap-1"
                >
                  {isOpen ? <><FiChevronUp size={14} /> Recolher</> : <><FiChevronDown size={14} /> Ver</>}
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-3 bg-gray-50 dark:bg-gray-900/30">
                  {/* Itens */}
                  <div>
                    {o.items?.map((item) => {
                      const addonTotal = (item.additionals || []).reduce((s, a) => s + Number(a.price) * (a.quantity || 1), 0)
                      const lineTotal = (Number(item.price) + addonTotal) * item.quantity
                      return (
                        <div key={item.id} className="py-1">
                          <div className="flex justify-between text-sm text-gray-700 dark:text-gray-200">
                            <span>{item.quantity}x {item.product?.name}</span>
                            <span className="font-medium">{BRL(lineTotal)}</span>
                          </div>
                          {item.additionals?.length > 0 && (
                            <div className="mt-1 pl-3 border-l-2 border-green-200 dark:border-green-800 space-y-0.5">
                              {item.additionals.map((a) => (
                                <div key={a.id} className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                  <span>+ {a.description}{a.quantity > 1 ? ` (${a.quantity}x)` : ''}</span>
                                  <span className="text-green-600 dark:text-green-400">{BRL(Number(a.price) * (a.quantity || 1))}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {item.attachments?.length > 0 && (
                            <div className="mt-1 flex gap-1.5 flex-wrap">
                              {item.attachments.map((att) => (
                                <a key={att.id} href={att.imageUrl} target="_blank" rel="noopener noreferrer">
                                  <img src={att.imageUrl} alt="" className="w-10 h-10 rounded object-cover border border-gray-200 dark:border-gray-700" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Totais/entrega */}
                  <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                    {o.deliveryFee && (
                      <div className="text-gray-600 dark:text-gray-300">Taxa: {BRL(o.deliveryFee)}</div>
                    )}
                    {o.estimatedDeliveryDate && (
                      <div className="text-gray-600 dark:text-gray-300">Prev.: {o.estimatedDeliveryDate}</div>
                    )}
                    {o.deliveryAddress && (
                      <div className="col-span-2 text-gray-600 dark:text-gray-300 text-xs">
                        📍 {o.deliveryAddress}
                      </div>
                    )}
                  </div>

                  {o.notes && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                        <FiMessageSquare size={12} /> Observações do cliente
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded px-3 py-2 whitespace-pre-wrap">{o.notes}</p>
                    </div>
                  )}

                  {o.paymentProof && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Comprovante</p>
                      <a
                        href={o.paymentProof}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs px-3 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                      >
                        Ver comprovante
                      </a>
                      {o.proofVerified && (
                        <span className="ml-2 text-xs text-green-600 dark:text-green-400">✓ Verificado</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
