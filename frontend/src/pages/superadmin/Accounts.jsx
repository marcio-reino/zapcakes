import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiSearch, FiEye, FiEdit2, FiToggleLeft, FiToggleRight, FiX, FiWifi, FiWifiOff, FiMoreVertical, FiUser, FiPower, FiMail, FiBell, FiBarChart2, FiPrinter, FiLoader, FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi'
import { jsPDF } from 'jspdf'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import ImageUpload from '../../components/ImageUpload.jsx'
import DatePicker from '../../components/DatePicker.jsx'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function formatBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const statusLabel = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', SUSPENDED: 'Suspenso', TRIAL: 'Trial' }
const statusColor = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  TRIAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  INACTIVE: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export default function SuperadminAccounts() {
  const [accounts, setAccounts] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [activeTab, setActiveTab] = useState('dados')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [logoFile, setLogoFile] = useState(null)
  const [toggleTarget, setToggleTarget] = useState(null) // { id, active, name }
  const [disconnecting, setDisconnecting] = useState(null)
  const [actionsTarget, setActionsTarget] = useState(null) // conta selecionada para modal de ações
  const [notifTarget, setNotifTarget] = useState(null) // conta selecionada para notificações
  const [notifView, setNotifView] = useState('menu') // menu | history | send
  const [notifHistory, setNotifHistory] = useState([])
  const [notifHistoryLoading, setNotifHistoryLoading] = useState(false)
  const [sendingNotif, setSendingNotif] = useState(null) // tipo da notificação sendo enviada
  const [confirmNotif, setConfirmNotif] = useState(null) // tipo pendente de confirmação
  const [reportModal, setReportModal] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportUserId, setReportUserId] = useState(null)
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [acc, pl] = await Promise.all([
        api.get('/superadmin/accounts'),
        api.get('/superadmin/plans'),
      ])
      setAccounts(acc.data)
      setPlans(pl.data)
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  async function openView(id) {
    try {
      const { data } = await api.get(`/superadmin/accounts/${id}`)
      setSelected(data)
      setForm({
        name: data.name, email: data.email, phone: data.phone || '',
        active: data.active,
        planId: data.account?.plan?.id || '',
        status: data.account?.status || 'ACTIVE',
        billingDay: data.account?.billingDay || '',
        notes: data.account?.notes || '',
      })
      setEditing(false)
      setActiveTab('dados')
      setLogoFile(null)
      setShowModal(true)
    } catch {
      toast.error('Erro ao carregar conta')
    }
  }

  async function handleSave() {
    try {
      let logoUrl
      if (logoFile === 'REMOVE') {
        logoUrl = ''
      } else if (logoFile && logoFile instanceof Blob) {
        const fd = new FormData()
        fd.append('file', logoFile, 'logo.webp')
        const { data: upload } = await api.post('/uploads?folder=perfil', fd)
        logoUrl = upload.url
      }

      await api.put(`/superadmin/accounts/${selected.id}`, {
        ...form,
        planId: form.planId ? Number(form.planId) : null,
        billingDay: form.billingDay ? Number(form.billingDay) : null,
        ...(logoUrl !== undefined ? { logoUrl } : {}),
      })
      toast.success('Conta atualizada!')
      setEditing(false)
      setLogoFile(null)
      loadData()
      // Recarrega detalhes
      const { data } = await api.get(`/superadmin/accounts/${selected.id}`)
      setSelected(data)
    } catch {
      toast.error('Erro ao atualizar conta')
    }
  }

  async function confirmToggleActive() {
    if (!toggleTarget) return
    try {
      await api.put(`/superadmin/accounts/${toggleTarget.id}`, { active: !toggleTarget.active })
      toast.success(toggleTarget.active ? 'Conta desativada' : 'Conta ativada')
      setToggleTarget(null)
      loadData()
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  async function handleDisconnectInstance(instanceId) {
    setDisconnecting(instanceId)
    try {
      await api.post(`/superadmin/instances/${instanceId}/disconnect`)
      toast.success('WhatsApp desconectado com sucesso!')
      const { data } = await api.get(`/superadmin/accounts/${selected.id}`)
      setSelected(data)
    } catch {
      toast.error('Erro ao desconectar WhatsApp')
    } finally {
      setDisconnecting(null)
    }
  }

  function openNotifModal(account) {
    setActionsTarget(null)
    setNotifTarget(account)
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
    if (!notifTarget) return
    setSendingNotif(type)
    try {
      const { data } = await api.post('/superadmin/notifications/send', { userId: notifTarget.id, type })
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

  function openReportModal(account) {
    setActionsTarget(null)
    setReportUserId(account.id)
    setReportModal(true)
    setReportData(null)
    setReportStartDate('')
    setReportEndDate('')
    loadReport(account.id)
  }

  async function loadReport(userId, startDate, endDate) {
    setReportLoading(true)
    setReportData(null)
    try {
      const params = {}
      if (startDate && endDate) { params.startDate = startDate; params.endDate = endDate }
      const { data } = await api.get(`/superadmin/accounts/${userId}/report`, { params })
      setReportData(data)
    } catch {
      toast.error('Erro ao carregar relatório')
    } finally {
      setReportLoading(false)
    }
  }

  function generatePDF(data) {
    const d = data
    const months = d.orders?.months || []
    const maxOrders = Math.max(...months.map(m => m.orders), 1)
    const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const doc = new jsPDF('p', 'mm', 'a4')
    const pw = doc.internal.pageSize.getWidth()
    const margin = 15
    const cw = pw - margin * 2
    let y = margin

    const roundRect = (x, ry, w, h, r, fill, stroke) => {
      doc.setFillColor(...fill)
      if (stroke) doc.setDrawColor(...stroke)
      doc.roundedRect(x, ry, w, h, r, r, stroke ? 'FD' : 'F')
    }

    // HEADER
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text('Relatorio de Desempenho', margin, y + 6)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(`Gerado em: ${now}`, pw - margin, y + 2, { align: 'right' })
    doc.text(`Periodo: ${d.period || 'Ultimos 6 meses'}`, pw - margin, y + 6, { align: 'right' })
    y += 10
    doc.setFontSize(10)
    doc.setTextColor(75, 85, 99)
    const subtitle = [d.user?.companyName, d.user?.name].filter(Boolean).join(' - ')
    if (subtitle) { doc.text(subtitle, margin, y); y += 4 }
    if (d.plan) { doc.text(`Plano: ${d.plan.title} - ${brl(d.plan.price)}/mes`, margin, y); y += 4 }
    y += 2
    doc.setDrawColor(34, 197, 94)
    doc.setLineWidth(0.8)
    doc.line(margin, y, pw - margin, y)
    y += 8

    // CARDS
    const cardW = (cw - 8) / 3
    const cardH = 22
    const cards = [
      { label: 'TOTAL DE PEDIDOS', value: String(d.orders?.totalOrders ?? 0), color: [17, 24, 39] },
      { label: 'RECEITA TOTAL', value: brl(d.orders?.totalRevenue), color: [22, 163, 74] },
      { label: 'TICKET MEDIO', value: brl(d.orders?.avgTicket), color: [79, 70, 229] },
    ]
    cards.forEach((c, i) => {
      const cx = margin + i * (cardW + 4)
      roundRect(cx, y, cardW, cardH, 3, [249, 250, 251], [229, 231, 235])
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(107, 114, 128)
      doc.text(c.label, cx + cardW / 2, y + 8, { align: 'center' })
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...c.color)
      doc.text(c.value, cx + cardW / 2, y + 17, { align: 'center' })
    })
    y += cardH + 8

    // TENDENCIA
    let trend = 'Estavel'
    let trendColor = [107, 114, 128]
    if (months.length >= 2) {
      const last = months[months.length - 1].orders
      const prev = months[months.length - 2].orders
      const diff = prev > 0 ? ((last - prev) / prev * 100).toFixed(0) : 0
      if (last > prev) { trend = `Crescimento +${diff}%`; trendColor = [22, 163, 74] }
      else if (last < prev) { trend = `Queda ${diff}%`; trendColor = [220, 38, 38] }
    }

    roundRect(margin, y, cw, 8, 2, [249, 250, 251])
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(55, 65, 81)
    doc.text('DESEMPENHO MENSAL', margin + 4, y + 5.5)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...trendColor)
    doc.text(trend, pw - margin - 4, y + 5.5, { align: 'right' })
    y += 10

    if (months.length > 0) {
      const chartH = 35
      const barGap = 4
      const barW = (cw - barGap * (months.length - 1)) / months.length
      months.forEach((m, i) => {
        const bx = margin + i * (barW + barGap)
        const h = Math.max((m.orders / maxOrders) * chartH, 2)
        const by = y + chartH - h
        doc.setFillColor(34, 197, 94)
        doc.roundedRect(bx, by, barW, h, 1.5, 1.5, 'F')
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(55, 65, 81)
        doc.text(String(m.orders), bx + barW / 2, by - 2, { align: 'center' })
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(107, 114, 128)
        doc.text(MONTHS[Number(m.month.split('-')[1]) - 1], bx + barW / 2, y + chartH + 4, { align: 'center' })
      })
      y += chartH + 8

      // TABELA
      y += 2
      const colWidths = [35, 35, 50, 35, 25]
      const headers = ['Mes', 'Pedidos', 'Receita', 'Ticket Medio', 'Variacao']
      doc.setFillColor(243, 244, 246)
      doc.rect(margin, y, cw, 7, 'F')
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(107, 114, 128)
      let cx = margin + 3
      headers.forEach((h) => { doc.text(h.toUpperCase(), cx, y + 4.5); cx += colWidths[headers.indexOf(h)] })
      y += 8

      months.forEach((m, i) => {
        const label = MONTHS_FULL[Number(m.month.split('-')[1]) - 1] + '/' + m.month.split('-')[0].slice(2)
        let variacao = '-'
        let varColor = [107, 114, 128]
        if (i > 0) {
          const prev = months[i - 1].orders
          if (prev > 0) {
            const pct = ((m.orders - prev) / prev * 100).toFixed(0)
            variacao = m.orders > prev ? `+${pct}%` : `${pct}%`
            varColor = m.orders > prev ? [22, 163, 74] : m.orders < prev ? [220, 38, 38] : [107, 114, 128]
          }
        }
        if (i % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(margin, y - 1, cw, 6, 'F') }
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        let tx = margin + 3
        doc.setTextColor(55, 65, 81); doc.text(label, tx, y + 3); tx += colWidths[0]
        doc.setFont('helvetica', 'bold'); doc.text(String(m.orders), tx, y + 3); tx += colWidths[1]
        doc.setTextColor(22, 163, 74); doc.text(brl(m.revenue), tx, y + 3); tx += colWidths[2]
        doc.setTextColor(79, 70, 229); doc.text(brl(m.avgTicket), tx, y + 3); tx += colWidths[3]
        doc.setTextColor(...varColor); doc.text(variacao, tx, y + 3)
        y += 6
      })
    } else {
      doc.setFontSize(9)
      doc.setTextColor(156, 163, 175)
      doc.text('Sem dados de pedidos no periodo.', pw / 2, y + 10, { align: 'center' })
      y += 20
    }

    y += 8

    // USO DE IA
    roundRect(margin, y, cw, 8, 2, [249, 250, 251])
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(55, 65, 81)
    doc.text('USO DE IA (OPENAI - GPT-4O)', margin + 4, y + 5.5)
    y += 12

    const aiItems = [
      ['Mensagens com IA', (d.ai?.totalMessages || 0).toLocaleString('pt-BR')],
      ['Total de Tokens', (d.ai?.totalTokens || 0).toLocaleString('pt-BR')],
      ['Tokens de Entrada', (d.ai?.promptTokens || 0).toLocaleString('pt-BR')],
      ['Tokens de Saida', (d.ai?.completionTokens || 0).toLocaleString('pt-BR')],
    ]
    const aiColW = cw / 2
    aiItems.forEach((item, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const ax = margin + col * aiColW
      const ay = y + row * 10
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(107, 114, 128)
      doc.text(item[0], ax, ay)
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(17, 24, 39)
      doc.text(item[1], ax, ay + 5)
    })
    y += 24
    doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.3); doc.line(margin, y, pw - margin, y)
    y += 5
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(107, 114, 128)
    doc.text('Custo Estimado (USD)', margin, y)
    doc.text('Custo Estimado (BRL)', margin + aiColW, y)
    y += 5
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(217, 119, 6)
    doc.text(`$${(d.ai?.costUSD || 0).toFixed(4)}`, margin, y)
    doc.text(brl(d.ai?.costBRL), margin + aiColW, y)
    if (d.ai?.estimated) {
      y += 6; doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(156, 163, 175)
      doc.text('* Valores estimados (sem tracking de tokens disponivel)', margin, y)
    }

    // FOOTER
    y = doc.internal.pageSize.getHeight() - 10
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(156, 163, 175)
    doc.text('ZapCakes - Relatorio gerado automaticamente', pw / 2, y, { align: 'center' })

    const pdfBlob = doc.output('blob')
    const url = URL.createObjectURL(pdfBlob)
    window.open(url, '_blank')
  }

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase()
    const matchSearch = !q || (a.name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q) || (a.account?.companyName || '').toLowerCase().includes(q)
    const matchStatus = filterStatus === 'ALL' || a.account?.status === filterStatus
    return matchSearch && matchStatus
  })

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  const labelClass = 'block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1'
  const valueClass = 'text-sm text-gray-900 dark:text-white'
  const inputClass = 'w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white'
  const tabClass = (tab) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
      activeTab === tab
        ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
    }`

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Contas de Clientes</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <FiSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, e-mail ou empresa..."
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">Todos os status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="TRIAL">Trial</option>
          <option value="INACTIVE">Inativo</option>
          <option value="SUSPENDED">Suspenso</option>
        </select>
      </div>

      {/* Modal detalhes */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Conta' : 'Detalhes da Conta'} maxWidth="max-w-2xl">
        {selected && (
          <div>
            <div className="flex gap-1 mb-5 border-b dark:border-gray-700">
              <button onClick={() => setActiveTab('dados')} className={tabClass('dados')}>Dados</button>
              <button onClick={() => setActiveTab('empresa')} className={tabClass('empresa')}>Empresa</button>
              <button onClick={() => setActiveTab('plano')} className={tabClass('plano')}>Plano</button>
              <button onClick={() => setActiveTab('pagamentos')} className={tabClass('pagamentos')}>Pagamentos</button>
              <button onClick={() => setActiveTab('stats')} className={tabClass('stats')}>Estatísticas</button>
              <button onClick={() => setActiveTab('servicos')} className={tabClass('servicos')}>Serviços</button>
              <button onClick={() => setActiveTab('obs')} className={tabClass('obs')}>Obs</button>
            </div>

            {/* Aba Dados */}
            {activeTab === 'dados' && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Nome</label>
                  {editing ? (
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
                  ) : (
                    <p className={valueClass}>{selected.name}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  {editing ? (
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
                  ) : (
                    <p className={valueClass}>{selected.email}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Telefone</label>
                  {editing ? (
                    <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
                  ) : (
                    <p className={valueClass}>{selected.phone || '-'}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Status da Conta</label>
                    <span className={`px-2 py-1 text-xs rounded-full ${selected.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                      {selected.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div>
                    <label className={labelClass}>Cadastro</label>
                    <p className={valueClass}>{new Date(selected.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                {selected.city && (
                  <div>
                    <label className={labelClass}>Localização</label>
                    <p className={valueClass}>
                      {[selected.street, selected.number, selected.neighborhood, selected.city, selected.state].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Aba Empresa */}
            {activeTab === 'empresa' && (
              <div className="space-y-4">
                {selected.account ? (
                  <>
                    <div>
                      <label className={labelClass}>Nome da Empresa</label>
                      <p className={valueClass}>{selected.account.companyName || '-'}</p>
                    </div>
                    <div>
                      <label className={labelClass}>Razão Social</label>
                      <p className={valueClass}>{selected.account.legalName || '-'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Documento</label>
                        <p className={valueClass}>{selected.account.document || '-'}</p>
                      </div>
                      <div>
                        <label className={labelClass}>Tipo</label>
                        <p className={valueClass}>{selected.account.documentType || '-'}</p>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Responsável</label>
                      <p className={valueClass}>{selected.account.responsible || '-'}</p>
                    </div>
                    <div>
                      <label className={labelClass}>Logo</label>
                      {editing ? (
                        <ImageUpload
                          value={logoFile || selected.account.logoUrl || null}
                          onChange={(img) => {
                            if (!img) {
                              setLogoFile('REMOVE')
                            } else {
                              setLogoFile(img)
                            }
                          }}
                        />
                      ) : (
                        selected.account.logoUrl ? (
                          <img src={selected.account.logoUrl} alt="Logo" className="w-20 h-20 object-cover rounded-lg" />
                        ) : (
                          <p className={valueClass}>Sem logo</p>
                        )
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Conta empresarial não configurada.</p>
                )}
              </div>
            )}

            {/* Aba Plano */}
            {activeTab === 'plano' && (
              <div className="space-y-4">
                {editing ? (
                  <>
                    <div>
                      <label className={labelClass}>Plano</label>
                      <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} className={inputClass}>
                        <option value="">Sem plano</option>
                        {plans.filter((p) => p.active).map((p) => (
                          <option key={p.id} value={p.id}>{p.title} — R$ {Number(p.price).toFixed(2).replace('.', ',')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Status da Assinatura</label>
                        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
                          <option value="ACTIVE">Ativo</option>
                          <option value="INACTIVE">Inativo</option>
                          <option value="SUSPENDED">Suspenso</option>
                          <option value="TRIAL">Trial</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Dia do Vencimento</label>
                        <select value={form.billingDay} onChange={(e) => setForm({ ...form, billingDay: e.target.value })} className={inputClass}>
                          <option value="">Selecione</option>
                          <option value="5">Dia 5</option>
                          <option value="10">Dia 10</option>
                          <option value="15">Dia 15</option>
                          <option value="25">Dia 25</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className={labelClass}>Plano Atual</label>
                      <p className={valueClass}>{selected.account?.plan?.title || 'Sem plano'}</p>
                    </div>
                    {selected.account?.plan && (
                      <div>
                        <label className={labelClass}>Valor</label>
                        <p className={valueClass}>R$ {Number(selected.account.plan.price).toFixed(2).replace('.', ',')}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Status da Assinatura</label>
                        <span className={`px-2 py-1 text-xs rounded-full ${statusColor[selected.account?.status] || statusColor.INACTIVE}`}>
                          {statusLabel[selected.account?.status] || 'Sem conta'}
                        </span>
                      </div>
                      <div>
                        <label className={labelClass}>Dia do Vencimento</label>
                        <p className={valueClass}>{selected.account?.billingDay ? `Dia ${selected.account.billingDay}` : '-'}</p>
                      </div>
                    </div>
                    {selected.account?.planStartedAt && (
                      <div>
                        <label className={labelClass}>Início do Plano</label>
                        <p className={valueClass}>{new Date(selected.account.planStartedAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                    )}
                    {selected.account?.planExpiresAt && (
                      <div>
                        <label className={labelClass}>Vencimento</label>
                        <p className={valueClass}>{new Date(selected.account.planExpiresAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                    )}
                    {selected.account?.trialEndsAt && (
                      <div>
                        <label className={labelClass}>Fim do Trial</label>
                        <p className={valueClass}>{new Date(selected.account.trialEndsAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Aba Pagamentos */}
            {activeTab === 'pagamentos' && (
              <div>
                {selected.account?.payments?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mês Ref.</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Método</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {selected.account.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="px-4 py-2 text-gray-900 dark:text-white">{p.referenceMonth || '-'}</td>
                            <td className="px-4 py-2 text-gray-900 dark:text-white">R$ {Number(p.amount).toFixed(2).replace('.', ',')}</td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{p.method || '-'}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                p.status === 'PAID' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                p.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              }`}>
                                {p.status === 'PAID' ? 'Pago' : p.status === 'PENDING' ? 'Pendente' : p.status}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                              {p.paidAt ? new Date(p.paidAt).toLocaleDateString('pt-BR') : new Date(p.createdAt).toLocaleDateString('pt-BR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Nenhum pagamento registrado.</p>
                )}
              </div>
            )}

            {/* Aba Estatísticas */}
            {activeTab === 'stats' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{selected._count?.orders || 0}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Pedidos</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{selected._count?.products || 0}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Produtos</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{selected._count?.customers || 0}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Clientes</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{selected._count?.instances || 0}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Instâncias WhatsApp</p>
                </div>
              </div>
            )}

            {/* Aba Serviços */}
            {activeTab === 'servicos' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Instâncias WhatsApp</h3>
                {selected.instances?.length > 0 ? (
                  <div className="space-y-3">
                    {selected.instances.map((inst) => (
                      <div key={inst.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          {inst.status === 'CONNECTED' ? (
                            <FiWifi size={18} className="text-green-500" />
                          ) : (
                            <FiWifiOff size={18} className="text-gray-400" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{inst.instanceName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {inst.phone || 'Sem número'}{inst.profileName ? ` — ${inst.profileName}` : ''}
                            </p>
                            <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                              inst.status === 'CONNECTED'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                            }`}>
                              {inst.status === 'CONNECTED' ? 'Conectado' : 'Desconectado'}
                            </span>
                          </div>
                        </div>
                        {inst.status === 'CONNECTED' && (
                          <button
                            disabled={disconnecting === inst.id}
                            onClick={() => {
                              if (confirm(`Deseja desconectar o WhatsApp "${inst.instanceName}"?\nO cliente precisará escanear o QR Code novamente.`)) {
                                handleDisconnectInstance(inst.id)
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors text-sm disabled:opacity-50"
                          >
                            <FiWifiOff size={14} /> {disconnecting === inst.id ? 'Desconectando...' : 'Desparear'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Nenhuma instância WhatsApp configurada.</p>
                )}
              </div>
            )}

            {/* Aba Obs */}
            {activeTab === 'obs' && (
              <div>
                {editing ? (
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className={`${inputClass} resize-none`}
                    rows={6}
                    placeholder="Observações sobre esta conta..."
                  />
                ) : (
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {selected.account?.notes || 'Nenhuma observação registrada.'}
                  </p>
                )}
              </div>
            )}

            {/* Botões */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t dark:border-gray-700">
              {editing ? (
                <>
                  <button onClick={() => setEditing(false)} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleSave} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                    <FiEdit2 size={16} /> Salvar
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    Fechar
                  </button>
                  <button onClick={() => setEditing(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                    <FiEdit2 size={16} /> Editar
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal confirmação ativar/desativar */}
      <ConfirmModal
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={confirmToggleActive}
        title={toggleTarget?.active ? 'Desativar Conta' : 'Ativar Conta'}
        message={toggleTarget?.active
          ? `Deseja desativar a conta de "${toggleTarget?.name}"?\nO cliente perderá o acesso ao sistema.`
          : `Deseja ativar a conta de "${toggleTarget?.name}"?\nO cliente terá acesso ao sistema novamente.`}
        confirmText={toggleTarget?.active ? 'Desativar' : 'Ativar'}
        confirmColor={toggleTarget?.active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
      />

      {/* Modal de Ações Rápidas */}
      <Modal isOpen={!!actionsTarget} onClose={() => setActionsTarget(null)} title="" maxWidth="max-w-sm">
        {actionsTarget && (
          <div>
            <div className="mb-4 -mt-2">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white leading-tight">{actionsTarget.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{actionsTarget.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setActionsTarget(null); openView(actionsTarget.id) }}
                className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full">
                  <FiUser size={20} className="text-gray-600 dark:text-gray-300" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ver Dados</span>
              </button>

              <button
                onClick={() => { setActionsTarget(null); setEditing(true); openView(actionsTarget.id) }}
                className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full">
                  <FiEdit2 size={20} className="text-gray-600 dark:text-gray-300" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Editar</span>
              </button>

              <button
                onClick={() => { const t = actionsTarget; setActionsTarget(null); setToggleTarget({ id: t.id, active: t.active, name: t.name }) }}
                className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full">
                  <FiPower size={20} className="text-gray-600 dark:text-gray-300" />
                </div>
                <span className={`text-sm font-medium ${actionsTarget.active ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {actionsTarget.active ? 'Desativar' : 'Ativar'}
                </span>
              </button>

              <button
                onClick={() => openNotifModal(actionsTarget)}
                className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full">
                  <FiBell size={20} className="text-gray-600 dark:text-gray-300" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Notificações</span>
              </button>

              <button
                onClick={() => openReportModal(actionsTarget)}
                className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full">
                  <FiBarChart2 size={20} className="text-gray-600 dark:text-gray-300" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Relatório</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Notificações */}
      <Modal
        isOpen={!!notifTarget}
        onClose={() => setNotifTarget(null)}
        title={notifView === 'menu' ? 'Notificações' : notifView === 'history' ? 'Histórico de Notificações' : 'Enviar Notificação'}
        maxWidth="max-w-md"
      >
        {notifTarget && (
          <div className="space-y-4">
            {/* Menu principal */}
            {notifView === 'menu' && (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Notificações de <strong className="text-gray-800 dark:text-white">{notifTarget.name}</strong>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setNotifView('history'); loadNotifHistory(notifTarget.id) }}
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
                  Enviar para <strong className="text-gray-800 dark:text-white">{notifTarget.name}</strong>
                </p>
                <div className="space-y-3">
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
                        Informa que a conta será desativada em 10 dias por falta de pagamento. Envia via e-mail e WhatsApp.
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
        message={`Deseja enviar o aviso de desativação para "${notifTarget?.name}"?\n\nSerá enviado via e-mail e WhatsApp.`}
        confirmText="Enviar"
        confirmColor="bg-green-600 hover:bg-green-700"
      />

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Empresa</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Plano</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">Cadastro</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-3">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">{a.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{a.email}</div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{a.account?.companyName || '-'}</td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">{a.account?.plan?.title || 'Sem plano'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColor[a.account?.status] || statusColor.INACTIVE}`}>
                      {statusLabel[a.account?.status] || 'Sem conta'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                    {new Date(a.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => setActionsTarget(a)}
                        className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        <FiMoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma conta encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Relatório do Cliente */}
      <Modal
        isOpen={reportModal}
        onClose={() => setReportModal(false)}
        title="Relatório do Cliente"
        maxWidth="max-w-2xl"
        maxHeight="85vh"
        headerExtra={
          reportData && !reportLoading && (
            <button
              onClick={() => generatePDF(reportData)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors text-xs font-medium"
              title="Gerar PDF"
            >
              <FiPrinter size={14} /> PDF
            </button>
          )
        }
      >
        {/* Filtro de datas */}
        <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">Data Inicial</label>
            <DatePicker value={reportStartDate} onChange={setReportStartDate} placeholder="Início" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">Data Final</label>
            <DatePicker value={reportEndDate} onChange={setReportEndDate} placeholder="Fim" />
          </div>
          <button
            onClick={() => loadReport(reportUserId, reportStartDate, reportEndDate)}
            disabled={reportLoading || (!reportStartDate && !reportEndDate)}
            className="px-4 py-2.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Filtrar
          </button>
          {(reportStartDate || reportEndDate) && (
            <button
              onClick={() => { setReportStartDate(''); setReportEndDate(''); loadReport(reportUserId) }}
              className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Limpar
            </button>
          )}
          {reportData?.period && (
            <span className="text-xs text-gray-400 ml-auto">{reportData.period}</span>
          )}
        </div>

        {reportLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <FiLoader className="animate-spin mr-2" size={20} /> Carregando relatório...
          </div>
        ) : reportData ? (
          <div className="space-y-3">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-medium mb-0.5">Pedidos</p>
                <p className="text-xl font-bold text-gray-800 dark:text-white">{reportData.orders?.totalOrders ?? 0}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-medium mb-0.5">Receita Total</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatBRL(reportData.orders?.totalRevenue ?? 0)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-medium mb-0.5">Ticket Médio</p>
                <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{formatBRL(reportData.orders?.avgTicket ?? 0)}</p>
              </div>
            </div>

            {/* Gráfico de pedidos */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Pedidos por Mês</h3>
                {reportData.orders?.months?.length >= 2 && (() => {
                  const vals = reportData.orders.months.map(m => m.orders)
                  const last = vals[vals.length - 1]
                  const prev = vals[vals.length - 2]
                  const diff = prev > 0 ? ((last - prev) / prev * 100).toFixed(0) : 0
                  if (last > prev) return <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"><FiTrendingUp size={14} /> +{diff}%</span>
                  if (last < prev) return <span className="flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400"><FiTrendingDown size={14} /> {diff}%</span>
                  return <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400"><FiMinus size={14} /> Estável</span>
                })()}
              </div>
              {reportData.orders?.months?.length > 0 ? (() => {
                const maxOrders = Math.max(...reportData.orders.months.map(m => m.orders), 1)
                return (
                  <div className="flex items-end gap-2 h-28">
                    {reportData.orders.months.map((m, i) => {
                      const height = Math.max((m.orders / maxOrders) * 100, 4)
                      const monthLabel = MONTHS[Number(m.month.split('-')[1]) - 1]
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{m.orders}</span>
                          <div className="w-full bg-green-500 dark:bg-green-400 rounded-t-md" style={{ height: `${height}%` }} />
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">{monthLabel}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })() : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Sem dados de pedidos.</p>
              )}
            </div>

            {/* Receita por mês */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Receita por Mês</h3>
              {reportData.orders?.months?.length > 0 ? (
                <div className="space-y-1.5">
                  {reportData.orders.months.map((m, i) => {
                    const maxRevenue = Math.max(...reportData.orders.months.map(mo => mo.revenue), 1)
                    const width = Math.max((m.revenue / maxRevenue) * 100, 2)
                    const monthLabel = MONTHS[Number(m.month.split('-')[1]) - 1] + '/' + m.month.split('-')[0].slice(2)
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 w-12 text-right">{monthLabel}</span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-indigo-500 dark:bg-indigo-400 h-full rounded-full flex items-center justify-end pr-1.5"
                            style={{ width: `${width}%`, minWidth: m.revenue > 0 ? '50px' : '0' }}
                          >
                            {m.revenue > 0 && <span className="text-[9px] font-medium text-white whitespace-nowrap">{formatBRL(m.revenue)}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-3">Sem dados.</p>
              )}
            </div>

            {/* Uso de IA */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Uso de IA (OpenAI)</h3>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Msg IA</p>
                  <p className="text-sm font-bold text-gray-800 dark:text-white">{(reportData.ai?.totalMessages || 0).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Tokens</p>
                  <p className="text-sm font-bold text-gray-800 dark:text-white">{(reportData.ai?.totalTokens || 0).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Entrada</p>
                  <p className="text-sm font-bold text-gray-800 dark:text-white">{(reportData.ai?.promptTokens || 0).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Saída</p>
                  <p className="text-sm font-bold text-gray-800 dark:text-white">{(reportData.ai?.completionTokens || 0).toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 flex items-center gap-6">
                <div>
                  <p className="text-[10px] text-gray-400">Custo USD</p>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">${(reportData.ai?.costUSD || 0).toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Custo BRL</p>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatBRL(reportData.ai?.costBRL || 0)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
