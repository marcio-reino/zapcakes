import { useState, useEffect, useRef } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiSearch, FiDollarSign, FiCheck, FiX, FiFile, FiLoader, FiCalendar, FiChevronLeft, FiChevronRight, FiMaximize, FiRotateCcw, FiRefreshCw, FiBell, FiMail } from 'react-icons/fi'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'

const paymentStatusLabel = { PENDING: 'Pendente', PAID: 'Pago', CANCELLED: 'Cancelado' }
const paymentStatusColor = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function MonthPicker({ value, onChange, placeholder = 'Selecionar mês' }) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => {
    if (value) return Number(value.split('-')[0])
    return new Date().getFullYear()
  })
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectedYear = value ? Number(value.split('-')[0]) : null
  const selectedMonth = value ? Number(value.split('-')[1]) : null

  function select(month) {
    const m = String(month).padStart(2, '0')
    onChange(`${viewYear}-${m}`)
    setOpen(false)
  }

  const displayText = value
    ? `${MONTHS_FULL[selectedMonth - 1]} de ${selectedYear}`
    : placeholder

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500 hover:border-green-400 dark:hover:border-green-500 transition-colors min-w-[200px]"
      >
        <FiCalendar size={16} className="text-gray-400" />
        <span className={value ? '' : 'text-gray-400'}>{displayText}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl p-4 w-[280px] animate-slideDown">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setViewYear(viewYear - 1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <FiChevronLeft size={18} className="text-gray-600 dark:text-gray-300" />
            </button>
            <span className="text-sm font-semibold text-gray-800 dark:text-white">{viewYear}</span>
            <button onClick={() => setViewYear(viewYear + 1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <FiChevronRight size={18} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((m, i) => {
              const isSelected = selectedYear === viewYear && selectedMonth === i + 1
              return (
                <button
                  key={m}
                  onClick={() => select(i + 1)}
                  className={`py-2 px-1 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-green-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400'
                  }`}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function formatBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Financial() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [generating, setGenerating] = useState(false)
  const [generateMonth, setGenerateMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [proofModal, setProofModal] = useState(null)
  const [notifPayment, setNotifPayment] = useState(null) // payment selecionado para notificação
  const [notifView, setNotifView] = useState('menu') // menu | history | send
  const [notifHistory, setNotifHistory] = useState([])
  const [notifHistoryLoading, setNotifHistoryLoading] = useState(false)
  const [sendingNotif, setSendingNotif] = useState(null)
  const [confirmNotif, setConfirmNotif] = useState(null)

  useEffect(() => { loadPayments() }, [])

  async function loadPayments() {
    try {
      const params = {}
      if (filterMonth) params.month = filterMonth
      if (filterStatus !== 'ALL') params.status = filterStatus
      const { data } = await api.get('/superadmin/billings', { params })
      setPayments(data)
    } catch {
      toast.error('Erro ao carregar cobranças')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadPayments()
  }, [filterMonth, filterStatus])

  async function handleGenerate() {
    if (!generateMonth) return
    setGenerating(true)
    try {
      const { data } = await api.post('/superadmin/billings/generate', { month: generateMonth })
      toast.success(`${data.created} cobrança(s) gerada(s), ${data.skipped} já existente(s).`)
      loadPayments()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar cobranças')
    } finally {
      setGenerating(false)
    }
  }

  async function handleConfirmPayment(id) {
    try {
      await api.put(`/superadmin/billings/${id}/confirm`)
      toast.success('Pagamento confirmado')
      loadPayments()
    } catch {
      toast.error('Erro ao confirmar pagamento')
    }
  }

  async function handleCancelPayment(id) {
    try {
      await api.put(`/superadmin/billings/${id}/cancel`)
      toast.success('Cobrança cancelada')
      loadPayments()
    } catch {
      toast.error('Erro ao cancelar cobrança')
    }
  }

  async function handleRevertPayment(id) {
    try {
      await api.put(`/superadmin/billings/${id}/revert`)
      toast.success('Pagamento revertido para pendente')
      loadPayments()
    } catch {
      toast.error('Erro ao reverter pagamento')
    }
  }

  function openNotifModal(payment) {
    setNotifPayment(payment)
    setNotifView('menu')
    setNotifHistory([])
  }


  async function loadNotifHistory(userId) {
    setNotifHistoryLoading(true)
    try {
      const { data } = await api.get(`/superadmin/notifications?userId=${userId}`)
      setNotifHistory(data)
    } catch {
      toast.error('Erro ao carregar histórico')
    } finally {
      setNotifHistoryLoading(false)
    }
  }

  async function handleSendNotification(type) {
    if (!notifPayment) return
    const userId = notifPayment.account?.user?.id || notifPayment.account?.userId
    setSendingNotif(type)
    try {
      const { data } = await api.post('/superadmin/notifications/send', { userId, type, paymentId: notifPayment.id })
      const parts = []
      if (data.results?.email) parts.push('E-mail')
      if (data.results?.whatsapp) parts.push('WhatsApp')
      if (parts.length > 0) {
        toast.success(`Notificação enviada via ${parts.join(' e ')}!`)
      } else {
        toast('Notificação processada, mas nenhum canal conseguiu enviar.', { icon: '⚠️' })
      }
    } catch {
      toast.error('Erro ao enviar notificação')
    } finally {
      setSendingNotif(null)
    }
  }

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase()
    return !q || (p.code || '').toLowerCase().includes(q) || (p.account?.user?.name || '').toLowerCase().includes(q) || (p.account?.companyName || '').toLowerCase().includes(q)
  })

  if (loading && payments.length === 0) return <p className="dark:text-gray-300">Carregando...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Financeiro</h1>
        <button
          onClick={() => { setLoading(true); loadPayments() }}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          <FiRefreshCw size={16} /> Atualizar
        </button>
      </div>

      {/* Gerar Cobranças */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase mb-3">Gerar Cobranças</h2>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Mês de referência</label>
            <MonthPicker value={generateMonth} onChange={setGenerateMonth} />
          </div>
          <button
            onClick={() => setConfirmGenerate(true)}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
          >
            {generating ? <FiLoader className="animate-spin" size={16} /> : <FiDollarSign size={16} />}
            Gerar Cobranças
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <FiSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por código, nome ou empresa..."
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
        <MonthPicker value={filterMonth} onChange={setFilterMonth} placeholder="Filtrar por mês" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">Todos os status</option>
          <option value="PENDING">Pendente</option>
          <option value="PAID">Pago</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Código</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Empresa</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Mês Ref.</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">Vencimento</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3">
                    <span className="text-sm font-mono font-bold text-green-600 dark:text-green-400">{p.code || '-'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">{p.account?.user?.name || '-'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{p.account?.user?.email || ''}</div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{p.account?.companyName || '-'}</td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">{p.referenceMonth || '-'}</td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                    {p.dueDate ? new Date(p.dueDate).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-900 dark:text-white font-medium">{formatBRL(p.amount)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${paymentStatusColor[p.status] || paymentStatusColor.PENDING}`}>
                      {paymentStatusLabel[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openNotifModal(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
                        title="Notificações"
                      >
                        <FiBell size={15} />
                      </button>
                      {p.proofUrl && (
                        <button
                          onClick={() => setProofModal(p.proofUrl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
                          title="Ver comprovante"
                        >
                          <FiFile size={15} />
                        </button>
                      )}
                      {p.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => setConfirmAction({ type: 'confirm', id: p.id, name: p.account?.user?.name })}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 rounded-lg transition-colors text-sm"
                            title="Confirmar pagamento"
                          >
                            <FiCheck size={15} /> Confirmar
                          </button>
                          <button
                            onClick={() => setConfirmAction({ type: 'cancel', id: p.id, name: p.account?.user?.name })}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors text-sm"
                            title="Cancelar cobrança"
                          >
                            <FiX size={15} /> Cancelar
                          </button>
                        </>
                      )}
                      {p.status === 'PAID' && (
                        <button
                          onClick={() => setConfirmAction({ type: 'revert', id: p.id, name: p.account?.user?.name })}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 rounded-lg transition-colors text-sm"
                          title="Reverter para pendente"
                        >
                          <FiRotateCcw size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma cobrança encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal comprovante */}
      <Modal
        isOpen={!!proofModal}
        onClose={() => setProofModal(null)}
        title="Comprovante PIX"
        maxWidth="max-w-lg"
        headerExtra={
          proofModal && (
            <a
              href={proofModal}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors text-xs font-medium"
            >
              <FiMaximize size={14} /> Tela cheia
            </a>
          )
        }
      >
        {proofModal && (
          <>
            {proofModal.match(/\.pdf(\?|$)/i) ? (
              <iframe src={proofModal} title="Comprovante PIX" className="w-full rounded-lg border dark:border-gray-600" style={{ minHeight: '70vh' }} />
            ) : (
              <div>
                <img
                  src={proofModal}
                  alt="Comprovante PIX"
                  className="w-full rounded-lg"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                />
                <div className="hidden flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400 gap-3">
                  <FiFile size={40} />
                  <p className="text-sm">Não foi possível exibir o comprovante</p>
                  <a href={proofModal} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 dark:text-green-400 hover:underline font-medium">
                    Abrir em nova aba
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Modal confirmação gerar cobranças */}
      <ConfirmModal
        isOpen={confirmGenerate}
        onClose={() => setConfirmGenerate(false)}
        onConfirm={() => {
          setConfirmGenerate(false)
          handleGenerate()
        }}
        title="Gerar Cobranças"
        message={`Deseja gerar cobranças para todas as contas ativas no mês de ${generateMonth ? `${MONTHS_FULL[Number(generateMonth.split('-')[1]) - 1]} de ${generateMonth.split('-')[0]}` : ''}?\nContas que já possuem cobrança neste mês serão ignoradas.`}
        confirmText="Gerar Cobranças"
        confirmColor="bg-green-600 hover:bg-green-700"
      />

      {/* Modal confirmação pagamento */}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction?.type === 'confirm') handleConfirmPayment(confirmAction.id)
          else if (confirmAction?.type === 'revert') handleRevertPayment(confirmAction.id)
          else handleCancelPayment(confirmAction.id)
          setConfirmAction(null)
        }}
        title={
          confirmAction?.type === 'confirm' ? 'Confirmar Pagamento'
          : confirmAction?.type === 'revert' ? 'Reverter Pagamento'
          : 'Cancelar Cobrança'
        }
        message={
          confirmAction?.type === 'confirm'
            ? `Confirmar o pagamento de "${confirmAction?.name}"?`
            : confirmAction?.type === 'revert'
            ? `Reverter o pagamento de "${confirmAction?.name}" para pendente?`
            : `Cancelar a cobrança de "${confirmAction?.name}"?\nEssa ação não pode ser desfeita.`
        }
        confirmText={
          confirmAction?.type === 'confirm' ? 'Confirmar'
          : confirmAction?.type === 'revert' ? 'Reverter'
          : 'Cancelar Cobrança'
        }
        confirmColor={
          confirmAction?.type === 'confirm' ? 'bg-green-600 hover:bg-green-700'
          : confirmAction?.type === 'revert' ? 'bg-amber-600 hover:bg-amber-700'
          : 'bg-red-600 hover:bg-red-700'
        }
      />

      {/* Modal de Notificações do Pagamento */}
      <Modal
        isOpen={!!notifPayment}
        onClose={() => setNotifPayment(null)}
        title={notifView === 'menu' ? 'Notificações' : notifView === 'history' ? 'Histórico de Notificações' : 'Enviar Notificação'}
        maxWidth="max-w-md"
      >
        {notifPayment && (
          <div className="space-y-4">
            {/* Menu principal */}
            {notifView === 'menu' && (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Notificações de <strong className="text-gray-800 dark:text-white">{notifPayment.account?.user?.name || '-'}</strong>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setNotifView('history'); loadNotifHistory(notifPayment.account?.user?.id || notifPayment.userId) }}
                    className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full">
                      <FiSearch size={20} className="text-gray-600 dark:text-gray-300" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Histórico</span>
                  </button>
                  <button
                    onClick={() => setNotifView('send')}
                    className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full">
                      <FiMail size={20} className="text-gray-600 dark:text-gray-300" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enviar nova</span>
                  </button>
                </div>
              </>
            )}

            {/* Histórico */}
            {notifView === 'history' && (
              <>
                <button onClick={() => setNotifView('menu')} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">&larr; Voltar</button>
                {notifHistoryLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <FiSearch className="animate-pulse mr-2" size={16} /> Carregando...
                  </div>
                ) : notifHistory.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Nenhuma notificação enviada.</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {notifHistory.map((n) => {
                      const typeLabels = { 'deactivation-warning': 'Aviso de desativação', 'payment-pending': 'Cobrança pendente', 'payment-received': 'Confirmação de recebimento' }
                      return (
                        <div key={n.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{typeLabels[n.type] || n.type}</p>
                            <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className={`flex items-center gap-1 ${n.emailSent ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                              <FiMail size={12} /> E-mail {n.emailSent ? 'enviado' : 'falhou'}
                            </span>
                            <span className={`flex items-center gap-1 ${n.whatsappSent ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                              <FiBell size={12} /> WhatsApp {n.whatsappSent ? 'enviado' : 'falhou'}
                            </span>
                          </div>
                          {n.sender && <p className="text-xs text-gray-400 mt-1.5">Enviado por {n.sender.name}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* Enviar nova */}
            {notifView === 'send' && (
              <>
                <button onClick={() => setNotifView('menu')} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">&larr; Voltar</button>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enviar para <strong className="text-gray-800 dark:text-white">{notifPayment.account?.user?.name || '-'}</strong>
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => setConfirmNotif('payment-pending')}
                    disabled={!!sendingNotif}
                    className="w-full flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left disabled:opacity-50"
                  >
                    <span className="text-2xl mt-0.5">💰</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {sendingNotif === 'payment-pending' ? 'Enviando...' : 'Cobrança pendente'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Informa que há uma cobrança pendente com os dados do pagamento. Envia via e-mail e WhatsApp.
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => setConfirmNotif('deactivation-warning')}
                    disabled={!!sendingNotif}
                    className="w-full flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left disabled:opacity-50"
                  >
                    <span className="text-2xl mt-0.5">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {sendingNotif === 'deactivation-warning' ? 'Enviando...' : 'Aviso de desativação'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Informa que a conta será desativada em 10 dias por falta de pagamento.
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => setConfirmNotif('payment-received')}
                    disabled={!!sendingNotif}
                    className="w-full flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left disabled:opacity-50"
                  >
                    <span className="text-2xl mt-0.5">✅</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {sendingNotif === 'payment-received' ? 'Enviando...' : 'Confirmação de recebimento'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Confirma o recebimento do pagamento da cobrança. Envia via e-mail e WhatsApp.
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Modal confirmação envio de notificação */}
      <ConfirmModal
        isOpen={!!confirmNotif}
        onClose={() => setConfirmNotif(null)}
        onConfirm={() => { const type = confirmNotif; setConfirmNotif(null); handleSendNotification(type) }}
        title="Confirmar envio"
        message={`Deseja enviar a notificação para "${notifPayment?.account?.user?.name}"?\n\nSerá enviado via e-mail e WhatsApp.`}
        confirmText="Enviar"
        confirmColor="bg-green-600 hover:bg-green-700"
      />

    </div>
  )
}
