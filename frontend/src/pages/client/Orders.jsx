import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import Modal from '../../components/Modal.jsx'
import DatePicker from '../../components/DatePicker.jsx'
import AgendaModal from '../../components/AgendaModal.jsx'
import OrderNotes from '../../components/OrderNotes.jsx'
import { FiCheckCircle, FiImage, FiFile, FiX, FiXCircle, FiTruck, FiDollarSign, FiSearch, FiRefreshCw, FiCalendar, FiAlertTriangle, FiPrinter, FiSettings, FiEdit2, FiSave, FiMessageSquare, FiPackage, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { jsPDF } from 'jspdf'

const BRL = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function formatBRLInput(value) {
  const num = String(value).replace(/\D/g, '')
  if (!num) return ''
  const cents = (Number(num) / 100).toFixed(2)
  return Number(cents).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseBRLInput(formatted) {
  if (!formatted) return 0
  const num = String(formatted).replace(/\./g, '').replace(',', '.')
  return parseFloat(num) || 0
}
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

export default function ClientOrders() {
  const { orderCode } = useParams()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [proofModal, setProofModal] = useState(null)
  const [cancelConfirm, setCancelConfirm] = useState(null)
  const [statusConfirm, setStatusConfirm] = useState(null)
  const [notifyReady, setNotifyReady] = useState(true)
  const [search, setSearch] = useState(orderCode || '')
  const [appliedSearch, setAppliedSearch] = useState(orderCode || '')
  const [filterStatus, setFilterStatus] = useState('')
  const [depositModal, setDepositModal] = useState(null)
  const [manualDeposit, setManualDeposit] = useState('')
  const [hasDivergence, setHasDivergence] = useState(false)
  const [finalPaymentModal, setFinalPaymentModal] = useState(null)
  const [finalPaymentValue, setFinalPaymentValue] = useState('')
  const [finalHasDivergence, setFinalHasDivergence] = useState(false)
  const [notifyCancel, setNotifyCancel] = useState(true)
  const [printOrder, setPrintOrder] = useState(null)
  const [filterDate, setFilterDate] = useState('')
  const [dateType, setDateType] = useState('scheduled') // 'scheduled' = Data de entrega, 'created' = Data do pedido
  const [agendaOpen, setAgendaOpen] = useState(false)
  const [editingNotes, setEditingNotes] = useState(null) // { orderId, text }
  const [stockModal, setStockModal] = useState(null) // { orderId } — modal pós-entrega para dar baixa
  const [stockDeducting, setStockDeducting] = useState(false)
  const [stockResult, setStockResult] = useState(null) // resultado da baixa
  const [revertConfirm, setRevertConfirm] = useState(null) // { orderId }
  const [stockReverting, setStockReverting] = useState(false)
  const [insufficientModal, setInsufficientModal] = useState(null) // lista de materiais insuficientes
  const [expandedOrders, setExpandedOrders] = useState(new Set())

  const toggleOrder = (id) => setExpandedOrders(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [printerType, setPrinterType] = useState(() => localStorage.getItem('zapcakes_printer') || 'thermal')
  const [showCompanyHeader, setShowCompanyHeader] = useState(() => localStorage.getItem('zapcakes_company_header') !== 'false')
  const [companyData, setCompanyData] = useState(null)

  useEffect(() => {
    loadOrders()
    api.get('/company').then(({ data }) => setCompanyData(data)).catch(() => {})
  }, [])

  async function loadOrders() {
    try {
      const { data } = await api.get('/orders')
      setOrders(data)
    } catch {
      toast.error('Erro ao carregar pedidos')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id, status) {
    try {
      const payload = { status }
      if (status === 'READY') payload.notifyCustomer = notifyReady
      await api.put(`/orders/${id}/status`, payload)
      toast.success('Status atualizado!')
      setStatusConfirm(null)
      loadOrders()
      // Após marcar como entregue, oferece dar baixa no estoque
      if (status === 'DELIVERED') {
        setStockModal({ orderId: id })
      }
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  async function verifyProof(id, depositData = {}) {
    try {
      await api.put(`/orders/${id}/verify-proof`, depositData)
      toast.success('Comprovante verificado! Pedido confirmado.')
      setProofModal(null)
      setDepositModal(null)
      setManualDeposit('')
      setHasDivergence(false)
      loadOrders()
    } catch {
      toast.error('Erro ao verificar comprovante')
    }
  }

  async function confirmPayment(id, paymentData = {}) {
    try {
      await api.put(`/orders/${id}/confirm-payment`, paymentData)
      toast.success('Pagamento integral confirmado!')
      setFinalPaymentModal(null)
      setFinalPaymentValue('')
      setFinalHasDivergence(false)
      loadOrders()
    } catch {
      toast.error('Erro ao confirmar pagamento')
    }
  }

  function openFinalPaymentModal(order) {
    const depositPaid = order.depositAmount ? Number(order.depositAmount) : 0
    const expectedFinal = Number(order.total) - depositPaid
    setFinalPaymentModal({ ...order, expectedFinal })
    setFinalPaymentValue(
      expectedFinal > 0
        ? expectedFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''
    )
    setFinalHasDivergence(false)
  }

  async function cancelOrder(id, notify = true) {
    try {
      await api.put(`/orders/${id}/cancel`, { notify })
      toast.success(notify ? 'Pedido cancelado. Cliente notificado.' : 'Pedido cancelado.')
      setCancelConfirm(null)
      setNotifyCancel(true)
      loadOrders()
    } catch {
      toast.error('Erro ao cancelar pedido')
    }
  }

  async function deductStock(orderId) {
    setStockDeducting(true)
    try {
      const { data } = await api.post(`/orders/${orderId}/deduct-stock`)
      setStockModal(null)
      setStockResult(data)
      loadOrders()
    } catch (err) {
      const resp = err.response?.data
      if (resp?.insufficient) {
        setStockModal(null)
        setInsufficientModal(resp.insufficient)
      } else {
        toast.error(resp?.error || 'Erro ao dar baixa no estoque')
      }
    } finally {
      setStockDeducting(false)
    }
  }

  async function revertOrderStock(orderId) {
    setStockReverting(true)
    try {
      await api.post(`/orders/${orderId}/revert-stock`)
      toast.success('Estoque revertido com sucesso!')
      setRevertConfirm(null)
      loadOrders()
    } catch {
      toast.error('Erro ao reverter estoque')
    } finally {
      setStockReverting(false)
    }
  }

  function isPdf(url) {
    return url?.toLowerCase().match(/\.pdf(\?|$)/)
  }

  async function saveInternalNotes(orderId) {
    try {
      await api.put(`/orders/${orderId}/internal-notes`, { internalNotes: editingNotes?.text || '' })
      toast.success('Observação interna salva!')
      setEditingNotes(null)
      loadOrders()
    } catch {
      toast.error('Erro ao salvar observação')
    }
  }

  function savePrinterType(type) {
    setPrinterType(type)
    localStorage.setItem('zapcakes_printer', type)
  }

  function toggleCompanyHeader(val) {
    setShowCompanyHeader(val)
    localStorage.setItem('zapcakes_company_header', val ? 'true' : 'false')
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/jpeg', 0.95))
      }
      img.onerror = reject
      img.src = url
    })
  }

  function handlePrint(order) {
    if (printerType === 'a4') {
      handlePrintA4(order)
    } else {
      handlePrintThermal(order)
    }
  }

  async function handlePrintThermal(order) {
    const deliveryFee = Number(order.deliveryFee || 0)
    const total = Number(order.total)
    const reservation = order.reservation ? Number(order.reservation) : null
    const depositAmount = order.depositAmount ? Number(order.depositAmount) : null
    const actualDeposit = depositAmount || reservation
    const balanceToReceive = actualDeposit ? total - actualDeposit : null

    let estH = 8 + 5 + 4 + 5
    if (showCompanyHeader && companyData) estH += 30
    estH += 4.5 * 2
    if (order.deliveryType) estH += 5
    if (order.deliveryAddress) estH += Math.ceil((order.deliveryAddress.length || 1) / 30) * 4 + 1
    if (order.estimatedDeliveryDate) estH += 4.5
    estH += 1 + 5
    estH += 5.5
    for (const item of (order.items || [])) {
      const name = `${item.quantity}x ${item.product?.name || 'Produto'}`
      estH += Math.ceil(name.length / 25) * 3.8 + 1.5
      for (const a of item.additionals || []) {
        const addLine = `+ ${a.description}${a.quantity > 1 ? ` (${a.quantity}x)` : ''}`
        estH += Math.ceil(addLine.length / 28) * 3.2 + 0.8
      }
    }
    estH += 1 + 5
    if (deliveryFee > 0) estH += 4.5
    if (reservation) estH += 4.5
    if (depositAmount && depositAmount !== reservation) estH += 4.5
    estH += 5.5
    if (balanceToReceive !== null && balanceToReceive > 0) estH += 5
    if (order.notes) estH += 1 + 4 + Math.ceil((order.notes.length || 1) / 30) * 3.5 + 5
    if (order.internalNotes) estH += 1 + 4 + Math.ceil((order.internalNotes.length || 1) / 30) * 3.5 + 5
    estH += 3 + 4 + 5
    estH += 15

    const doc = new jsPDF({ unit: 'mm', format: [80, estH] })
    const w = 80
    const mx = 5
    const pw = w - mx * 2
    let y = 8

    const line = (y1) => { doc.setDrawColor(200); doc.line(mx, y1, w - mx, y1) }
    const textRight = (text, y1) => doc.text(text, w - mx, y1, { align: 'right' })

    // Cabeçalho da empresa (térmica: sem logo, centralizado)
    if (showCompanyHeader && companyData) {
      if (companyData.companyName) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(companyData.companyName, w / 2, y, { align: 'center' })
        y += 4
      }
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100)
      if (companyData.phone) {
        doc.text(companyData.phone, w / 2, y, { align: 'center' })
        y += 3
      }
      if (companyData.email) {
        doc.text(companyData.email, w / 2, y, { align: 'center' })
        y += 3
      }
      if (companyData.documentType === 'CNPJ' && companyData.document) {
        doc.text(`CNPJ: ${companyData.document}`, w / 2, y, { align: 'center' })
        y += 3
      }
      const addrParts = []
      if (companyData.street) {
        let addr = companyData.street
        if (companyData.number) addr += `, ${companyData.number}`
        addrParts.push(addr)
      }
      if (companyData.neighborhood) addrParts.push(companyData.neighborhood)
      if (companyData.city) addrParts.push(`${companyData.city}${companyData.state ? '/' + companyData.state : ''}`)
      if (addrParts.length > 0) {
        const addrText = addrParts.join(' - ')
        const addrLines = doc.splitTextToSize(addrText, pw)
        addrLines.forEach(l => { doc.text(l, w / 2, y, { align: 'center' }); y += 3 })
      }
      doc.setTextColor(0)
      y += 1
      line(y); y += 4
    }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`Pedido #${padId(order.orderNumber)}`, w / 2, y, { align: 'center' })
    y += 5
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120)
    doc.text(`${new Date(order.createdAt).toLocaleString('pt-BR')}  •  ${statusLabels[order.status] || order.status}`, w / 2, y, { align: 'center' })
    y += 4
    doc.setTextColor(0)
    line(y); y += 5

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Cliente:', mx, y)
    doc.setFont('helvetica', 'normal')
    doc.text(order.customerName || '', mx + 18, y)
    y += 4.5

    doc.setFont('helvetica', 'bold')
    doc.text('Celular:', mx, y)
    doc.setFont('helvetica', 'normal')
    doc.text(order.customerPhone || '', mx + 18, y)
    y += 4.5

    if (order.deliveryType) {
      doc.setFont('helvetica', 'bold')
      doc.text(order.deliveryType === 'ENTREGA' ? 'Entrega:' : 'Retirada:', mx, y)
      doc.setFont('helvetica', 'normal')
      const addr = order.deliveryAddress || '-'
      const addrLines = doc.splitTextToSize(addr, pw - 20)
      doc.text(addrLines, mx + 20, y)
      y += addrLines.length * 4
      y += 1
    }

    if (order.estimatedDeliveryDate) {
      doc.setFont('helvetica', 'bold')
      doc.text('Previsão:', mx, y)
      doc.setFont('helvetica', 'normal')
      doc.text(order.estimatedDeliveryDate, mx + 20, y)
      y += 4.5
    }

    y += 1
    line(y); y += 5

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Item', mx, y)
    textRight('Valor', y)
    y += 1.5
    line(y); y += 4

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    for (const item of (order.items || [])) {
      const addonTotal = (item.additionals || []).reduce((s, a) => s + Number(a.price) * (a.quantity || 1), 0)
      const name = `${item.quantity}x ${item.product?.name || 'Produto'}`
      const val = BRL((Number(item.price) + addonTotal) * item.quantity)
      const nameLines = doc.splitTextToSize(name, pw - 25)
      doc.text(nameLines, mx, y)
      textRight(val, y)
      y += nameLines.length * 3.8 + 1.5
      for (const a of item.additionals || []) {
        doc.setFontSize(7.5)
        const addLabel = `+ ${a.description}${a.quantity > 1 ? ` (${a.quantity}x)` : ''}`
        const addLines = doc.splitTextToSize(addLabel, pw - 20)
        doc.text(addLines, mx + 3, y)
        textRight(BRL(Number(a.price) * (a.quantity || 1)), y)
        y += addLines.length * 3.2 + 0.8
        doc.setFontSize(8.5)
      }
    }

    y += 1
    line(y); y += 5

    doc.setFontSize(8.5)
    if (deliveryFee > 0) {
      doc.text('Taxa de entrega', mx, y)
      textRight(BRL(deliveryFee), y)
      y += 4.5
    }
    if (reservation) {
      doc.text('Reserva', mx, y)
      textRight(BRL(reservation), y)
      y += 4.5
    }
    if (depositAmount && depositAmount !== reservation) {
      doc.text('Depósito real', mx, y)
      textRight(BRL(depositAmount), y)
      y += 4.5
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Total', mx, y)
    textRight(BRL(total), y)
    y += 5.5

    if (balanceToReceive !== null && balanceToReceive > 0) {
      doc.setFontSize(9.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(234, 88, 12)
      doc.text('Receber na entrega', mx, y)
      textRight(BRL(balanceToReceive), y)
      doc.setTextColor(0)
      y += 5
    }

    if (order.notes) {
      y += 1
      line(y); y += 4
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Observações do Cliente:', mx, y)
      doc.setFont('helvetica', 'normal')
      const notesLines = doc.splitTextToSize(order.notes, pw)
      doc.text(notesLines, mx, y + 4)
      y += notesLines.length * 3.5 + 5
    }

    if (order.internalNotes) {
      y += 1
      line(y); y += 4
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Obs. interna:', mx, y)
      doc.setFont('helvetica', 'normal')
      const intLines = doc.splitTextToSize(order.internalNotes, pw)
      doc.text(intLines, mx, y + 4)
      y += intLines.length * 3.5 + 5
    }

    y += 3
    line(y); y += 4
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, w / 2, y, { align: 'center' })

    const blob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(blob)
    setPrintOrder({ order, pdfUrl })
  }

  async function handlePrintA4(order) {
    const deliveryFee = Number(order.deliveryFee || 0)
    const total = Number(order.total)
    const reservation = order.reservation ? Number(order.reservation) : null
    const depositAmount = order.depositAmount ? Number(order.depositAmount) : null
    const actualDeposit = depositAmount || reservation
    const balanceToReceive = actualDeposit ? total - actualDeposit : null

    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const w = 210
    const mx = 20
    const pw = w - mx * 2
    let y = 25

    const line = (y1) => { doc.setDrawColor(200); doc.line(mx, y1, w - mx, y1) }
    const textRight = (text, y1) => doc.text(text, w - mx, y1, { align: 'right' })

    // Cabeçalho da empresa
    if (showCompanyHeader && companyData) {
      const logoSize = 22
      const textX = mx + logoSize + 5
      const startY = y

      if (companyData.logoUrl) {
        try {
          const img = await loadImage(companyData.logoUrl)
          doc.addImage(img, 'JPEG', mx, y - 3, logoSize, logoSize)
        } catch { /* logo não carregou */ }
      }

      let ty = startY
      if (companyData.companyName) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(companyData.companyName, textX, ty)
        ty += 6
      }
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100)
      if (companyData.phone) {
        doc.text(companyData.phone, textX, ty)
        ty += 5
      }
      if (companyData.email) {
        doc.text(companyData.email, textX, ty)
        ty += 5
      }
      if (companyData.documentType === 'CNPJ' && companyData.document) {
        doc.text(`CNPJ: ${companyData.document}`, textX, ty)
        ty += 5
      }
      const addrParts = []
      if (companyData.street) {
        let addr = companyData.street
        if (companyData.number) addr += `, ${companyData.number}`
        addrParts.push(addr)
      }
      if (companyData.neighborhood) addrParts.push(companyData.neighborhood)
      if (companyData.city) addrParts.push(`${companyData.city}${companyData.state ? '/' + companyData.state : ''}`)
      if (addrParts.length > 0) {
        const maxW = pw - logoSize - 5
        const addrLines = doc.splitTextToSize(addrParts.join(' - '), maxW)
        doc.text(addrLines, textX, ty)
        ty += addrLines.length * 4
      }
      doc.setTextColor(0)
      y = Math.max(startY + logoSize, ty) + 3
      line(y); y += 8
    }

    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text(`Pedido #${padId(order.orderNumber)}`, w / 2, y, { align: 'center' })
    y += 8
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120)
    doc.text(`${new Date(order.createdAt).toLocaleString('pt-BR')}  •  ${statusLabels[order.status] || order.status}`, w / 2, y, { align: 'center' })
    y += 6
    doc.setTextColor(0)
    line(y); y += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Cliente:', mx, y)
    doc.setFont('helvetica', 'normal')
    doc.text(order.customerName || '', mx + 25, y)
    y += 7

    doc.setFont('helvetica', 'bold')
    doc.text('Celular:', mx, y)
    doc.setFont('helvetica', 'normal')
    doc.text(order.customerPhone || '', mx + 25, y)
    y += 7

    if (order.deliveryType) {
      doc.setFont('helvetica', 'bold')
      doc.text(order.deliveryType === 'ENTREGA' ? 'Entrega:' : 'Retirada:', mx, y)
      doc.setFont('helvetica', 'normal')
      const addr = order.deliveryAddress || '-'
      const addrLines = doc.splitTextToSize(addr, pw - 30)
      doc.text(addrLines, mx + 25, y)
      y += addrLines.length * 6 + 2
    }

    if (order.estimatedDeliveryDate) {
      doc.setFont('helvetica', 'bold')
      doc.text('Previsão:', mx, y)
      doc.setFont('helvetica', 'normal')
      doc.text(order.estimatedDeliveryDate, mx + 25, y)
      y += 7
    }

    y += 3
    line(y); y += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Item', mx, y)
    textRight('Valor', y)
    y += 3
    line(y); y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    for (const item of (order.items || [])) {
      const addonTotal = (item.additionals || []).reduce((s, a) => s + Number(a.price) * (a.quantity || 1), 0)
      const name = `${item.quantity}x ${item.product?.name || 'Produto'}`
      const val = BRL((Number(item.price) + addonTotal) * item.quantity)
      const nameLines = doc.splitTextToSize(name, pw - 40)
      doc.text(nameLines, mx, y)
      textRight(val, y)
      y += nameLines.length * 6 + 3
      for (const a of item.additionals || []) {
        doc.setFontSize(9.5)
        const addLabel = `+ ${a.description}${a.quantity > 1 ? ` (${a.quantity}x)` : ''}`
        const addLines = doc.splitTextToSize(addLabel, pw - 30)
        doc.text(addLines, mx + 4, y)
        textRight(BRL(Number(a.price) * (a.quantity || 1)), y)
        y += addLines.length * 5 + 1.5
        doc.setFontSize(11)
      }
    }

    y += 3
    line(y); y += 8

    doc.setFontSize(11)
    if (deliveryFee > 0) {
      doc.text('Taxa de entrega', mx, y)
      textRight(BRL(deliveryFee), y)
      y += 7
    }
    if (reservation) {
      doc.text('Reserva', mx, y)
      textRight(BRL(reservation), y)
      y += 7
    }
    if (depositAmount && depositAmount !== reservation) {
      doc.text('Depósito real', mx, y)
      textRight(BRL(depositAmount), y)
      y += 7
    }

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Total', mx, y)
    textRight(BRL(total), y)
    y += 9

    if (balanceToReceive !== null && balanceToReceive > 0) {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(234, 88, 12)
      doc.text('Receber na entrega', mx, y)
      textRight(BRL(balanceToReceive), y)
      doc.setTextColor(0)
      y += 8
    }

    if (order.notes) {
      y += 3
      line(y); y += 7
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Observações do Cliente:', mx, y)
      doc.setFont('helvetica', 'normal')
      const notesLines = doc.splitTextToSize(order.notes, pw)
      doc.text(notesLines, mx, y + 6)
      y += notesLines.length * 5 + 8
    }

    if (order.internalNotes) {
      y += 3
      line(y); y += 7
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Obs. interna:', mx, y)
      doc.setFont('helvetica', 'normal')
      const intLines = doc.splitTextToSize(order.internalNotes, pw)
      doc.text(intLines, mx, y + 6)
      y += intLines.length * 5 + 8
    }

    y += 5
    line(y); y += 7
    doc.setFontSize(9)
    doc.setTextColor(150)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, w / 2, y, { align: 'center' })

    const blob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(blob)
    setPrintOrder({ order, pdfUrl })
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 md:mb-0">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Meus Pedidos</h1>
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              title="Configurações de impressão"
            >
              <FiSettings size={14} /> Ajustes
            </button>
            <button
              onClick={() => setAgendaOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
            >
              <FiCalendar size={14} /> Agenda
            </button>
            <button
              onClick={() => { setLoading(true); loadOrders() }}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <FiRefreshCw size={14} /> Atualizar
            </button>
          </div>
        </div>
        {/* Mobile buttons */}
        <div className="flex md:hidden gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-base bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <FiSettings size={16} /> Ajustes
          </button>
          <button
            onClick={() => setAgendaOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-base bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
          >
            <FiCalendar size={16} /> Agenda
          </button>
          <button
            onClick={() => { setLoading(true); loadOrders() }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-base bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <FiRefreshCw size={16} /> Atualizar
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nº, nome ou celular..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setAppliedSearch(e.target.value) }}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base md:text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 md:flex-none px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base md:text-sm text-gray-800 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
          >
            <option value="">Todos os status</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <DatePicker value={filterDate} onChange={setFilterDate} placeholder="Filtrar por data" />
        </div>
        <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
          <button
            onClick={() => setDateType('scheduled')}
            className={`flex-1 md:flex-none px-3 py-2.5 transition-colors text-base md:text-sm ${
              dateType === 'scheduled'
                ? 'bg-pink-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Data de entrega
          </button>
          <button
            onClick={() => setDateType('created')}
            className={`flex-1 md:flex-none px-3 py-2.5 transition-colors text-base md:text-sm ${
              dateType === 'created'
                ? 'bg-pink-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Data do pedido
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {orders.filter((order) => {
          if (filterStatus && order.status !== filterStatus) return false
          if (filterDate) {
            if (dateType === 'scheduled') {
              if (!order.estimatedDeliveryDate) return false
              const normalized = order.estimatedDeliveryDate.replace(/\//g, '-')
              const parts = normalized.split('-')
              let orderDateStr = ''
              if (parts[0].length === 4) {
                orderDateStr = normalized.slice(0, 10)
              } else {
                orderDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
              }
              if (orderDateStr !== filterDate) return false
            } else {
              const orderDate = new Date(order.createdAt).toISOString().slice(0, 10)
              if (orderDate !== filterDate) return false
            }
          }
          if (!appliedSearch.trim()) return true
          const q = appliedSearch.toLowerCase().trim()
          return (
            padId(order.orderNumber).includes(q) || String(order.orderNumber).includes(q) ||
            order.customerName?.toLowerCase().includes(q) ||
            order.customerPhone?.includes(q)
          )
        }).map((order) => {
          const deliveryFee = Number(order.deliveryFee || 0)
          const total = Number(order.total)
          const reservation = order.reservation ? Number(order.reservation) : null
          const depositAmount = order.depositAmount ? Number(order.depositAmount) : null
          const actualDeposit = depositAmount || reservation
          const balanceToReceive = actualDeposit ? total - actualDeposit : null
          const canCancel = order.status !== 'CANCELLED' && order.status !== 'DELIVERED'

          return (
            <div key={order.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg md:text-base text-gray-800 dark:text-white">Pedido #{padId(order.orderNumber)}</h3>
                    <span className={`px-3 py-1 text-xs rounded-full ${statusColors[order.status]}`}>
                      {statusLabels[order.status]}
                    </span>
                  </div>
                  <p className="text-base md:text-sm text-gray-500 dark:text-gray-400">{order.customerName} - {order.customerPhone}</p>
                  <p className="text-sm md:text-xs text-gray-400 dark:text-gray-500">{(() => {
                    const d = new Date(order.createdAt)
                    const now = new Date()
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                    const orderDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
                    const diff = today - orderDay
                    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    if (diff === 0) return `Hoje, ${time}`
                    if (diff === 86400000) return `Ontem, ${time}`
                    return d.toLocaleString('pt-BR')
                  })()}</p>
                  {order.deliveryType && (
                    <p className="text-sm md:text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                      <FiTruck size={12} />
                      {order.deliveryType === 'ENTREGA' ? 'Entrega' : 'Retirada'}
                      {order.deliveryAddress && ` - ${order.deliveryAddress}`}
                    </p>
                  )}
                  {order.estimatedDeliveryDate && (
                    <p className="text-sm md:text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                      <FiCalendar size={12} />
                      Previsão: {order.estimatedDeliveryDate}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between md:justify-end gap-2">
                    <p className="text-2xl md:text-lg font-bold text-green-600 dark:text-green-400">{BRL(total)}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePrint(order)}
                        className="flex items-center gap-1.5 text-sm md:text-xs px-4 py-2.5 md:px-3 md:py-1.5 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                        title="Imprimir pedido"
                      >
                        <FiPrinter size={18} className="md:w-3.5 md:h-3.5" />
                      </button>
                      {canCancel && (
                        <button
                          onClick={() => setCancelConfirm(order)}
                          className="flex items-center gap-1.5 text-sm md:text-xs px-4 py-2.5 md:px-3 md:py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                        >
                          <FiXCircle size={18} className="md:w-3 md:h-3" /> Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    {deliveryFee > 0 && (
                      <p className="text-sm md:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <FiTruck size={10} /> Taxa: {BRL(deliveryFee)}
                      </p>
                    )}
                    {reservation && (
                      <p className="text-sm md:text-xs text-gray-500 dark:text-gray-400">Reserva: {BRL(reservation)}</p>
                    )}
                    {order.depositDivergence && (
                      <p className="text-sm md:text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                        <FiAlertTriangle size={10} /> Divergência de valor
                      </p>
                    )}
                    {depositAmount && depositAmount !== reservation && (
                      <p className="text-sm md:text-xs text-blue-600 dark:text-blue-400">Depósito real: {BRL(depositAmount)}</p>
                    )}
                    {balanceToReceive !== null && balanceToReceive > 0 && order.status !== 'CANCELLED' && (
                      <p className="text-sm md:text-xs font-semibold text-orange-600 dark:text-orange-400">Receber na entrega: {BRL(balanceToReceive)}</p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => toggleOrder(order.id)}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {expandedOrders.has(order.id) ? <><FiChevronUp size={16} /> Recolher</> : <><FiChevronDown size={16} /> Ver detalhes</>}
              </button>

              {expandedOrders.has(order.id) && <>
              <div className="border-t dark:border-gray-700 pt-3 mb-3 mt-3">
                {order.items?.map((item) => {
                  const addonTotal = (item.additionals || []).reduce((s, a) => s + Number(a.price) * (a.quantity || 1), 0)
                  const lineTotal = (Number(item.price) + addonTotal) * item.quantity
                  return (
                  <div key={item.id} className="py-1">
                    <div className="flex justify-between text-base md:text-sm dark:text-gray-300">
                      <span>{item.quantity}x {item.product?.name}</span>
                      <span>{BRL(lineTotal)}</span>
                    </div>
                    {item.additionals?.length > 0 && (
                      <div className="mt-1 pl-3 border-l-2 border-green-200 dark:border-green-800 space-y-0.5">
                        {item.additionals.map((a) => (
                          <div key={a.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                            <span>+ {a.description}{a.quantity > 1 ? ` (${a.quantity}x)` : ''}</span>
                            <span className="text-green-600 dark:text-green-400">{BRL(Number(a.price) * (a.quantity || 1))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {item.attachments?.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">📸 Fotos de inspiração</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {item.attachments.map((att) => (
                            <a key={att.id} href={att.imageUrl} target="_blank" rel="noopener noreferrer">
                              <img src={att.imageUrl} alt="Inspiração" className="w-14 h-14 rounded-lg object-cover border-2 border-purple-200 dark:border-purple-700 hover:opacity-80 hover:scale-105 transition-all shadow-sm" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>

              {/* Observações do cliente */}
              {order.notes && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <FiMessageSquare size={12} /> Observações do Cliente
                  </p>
                  <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                    <OrderNotes text={order.notes} />
                  </div>
                </div>
              )}

              {/* Observações internas (operador) */}
              <div className="mb-3">
                {editingNotes?.orderId === order.id ? (
                  <div>
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                      <FiEdit2 size={12} /> Obs. interna
                    </p>
                    <div className="flex gap-2">
                      <textarea
                        value={editingNotes.text}
                        onChange={(e) => setEditingNotes({ ...editingNotes, text: e.target.value })}
                        placeholder="Anotações internas sobre o pedido..."
                        rows={2}
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none resize-none"
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => saveInternalNotes(order.id)}
                          className="px-2 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          title="Salvar"
                        >
                          <FiSave size={14} />
                        </button>
                        <button
                          onClick={() => setEditingNotes(null)}
                          className="px-2 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                          title="Cancelar"
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <FiEdit2 size={14} /> Obs. interna
                      </p>
                      <button
                        onClick={() => setEditingNotes({ orderId: order.id, text: order.internalNotes || '' })}
                        className="text-sm px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors flex items-center gap-1.5"
                      >
                        <FiEdit2 size={13} /> {order.internalNotes ? 'Editar' : 'Adicionar'}
                      </button>
                    </div>
                    {order.internalNotes && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">{order.internalNotes}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Comprovante de pagamento */}
              {order.paymentProof && (
                <div className="border-t dark:border-gray-700 pt-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isPdf(order.paymentProof) ? (
                        <FiFile size={16} className="text-red-500" />
                      ) : (
                        <FiImage size={16} className="text-blue-500" />
                      )}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Comprovante</span>
                      {order.proofVerified && (
                        <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                          <FiCheckCircle size={12} /> Verificado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setProofModal(order)}
                        className="text-sm px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                      >
                        Visualizar
                      </button>
                      {!order.proofVerified && (order.status === 'RESERVATION' || order.status === 'PENDING') && (
                        <button
                          onClick={() => { setDepositModal(order); setManualDeposit(order.depositAmount ? Number(order.depositAmount).toFixed(2) : ''); setHasDivergence(!!order.depositDivergence) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                        >
                          <FiCheckCircle size={14} /> Verificar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Pagamento integral */}
              {order.paymentConfirmed && (
                <div className="border-t dark:border-gray-700 pt-3 mb-3">
                  <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                    <FiDollarSign size={16} /> Pagamento integral confirmado
                  </span>
                </div>
              )}

              {/* Ações do pedido */}
              <div className="border-t dark:border-gray-700 pt-3 flex gap-2 flex-wrap items-center">
                {['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusConfirm({ orderId: order.id, status: s })}
                    disabled={order.status === s || order.status === 'CANCELLED'}
                    className={`text-sm md:text-xs px-4 md:px-3 py-2 md:py-1 rounded-lg border dark:border-gray-600 dark:text-gray-300 ${
                      order.status === s || order.status === 'CANCELLED'
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {statusLabels[s]}
                  </button>
                ))}

                {order.proofVerified && !order.paymentConfirmed && order.status !== 'CANCELLED' && (
                  <button
                    onClick={() => openFinalPaymentModal(order)}
                    className="flex items-center gap-1.5 text-sm md:text-xs px-4 md:px-3 py-3 md:py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    <FiDollarSign size={12} /> Confirmar Pagamento Total
                  </button>
                )}
              </div>

              {/* Ações de estoque */}
              {order.status === 'DELIVERED' && (
                <div className="border-t dark:border-gray-700 pt-3 mt-3 flex gap-2 flex-wrap items-center">
                  {!order.stockDeducted ? (
                    <button
                      onClick={() => setStockModal({ orderId: order.id })}
                      className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors font-medium"
                    >
                      <FiPackage size={16} /> Dar baixa no estoque
                    </button>
                  ) : (
                    <>
                      <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
                        <FiCheckCircle size={16} /> Estoque baixado
                      </span>
                      <button
                        onClick={() => setRevertConfirm({ orderId: order.id })}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <FiRefreshCw size={12} /> Reverter estoque
                      </button>
                    </>
                  )}
                </div>
              )}
              </>}
            </div>
          )
        })}

        {orders.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhum pedido encontrado.</p>}
      </div>

      {/* Modal de visualização do comprovante */}
      {proofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setProofModal(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-slideDown">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Comprovante - Pedido #{padId(proofModal.orderNumber)}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{proofModal.customerName} - {BRL(proofModal.reservation || proofModal.total)}</p>
              </div>
              <button onClick={() => setProofModal(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center">
              {isPdf(proofModal.paymentProof) ? (
                <div className="w-full">
                  <div className="flex items-center justify-center gap-3 py-8 bg-gray-50 dark:bg-gray-700 rounded-xl mb-4">
                    <FiFile size={40} className="text-red-500" />
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white">Comprovante em PDF</p>
                      <a href={proofModal.paymentProof} target="_blank" rel="noopener noreferrer" className="text-sm px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                        Abrir em nova aba
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={proofModal.paymentProof}
                  alt="Comprovante de pagamento"
                  className="max-h-[60vh] rounded-xl object-contain"
                />
              )}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-700 dark:border-gray-600 flex justify-between items-center">
              <div>
                {proofModal.proofVerified ? (
                  <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                    <FiCheckCircle size={16} /> Comprovante verificado
                  </span>
                ) : (
                  <span className="text-sm text-yellow-600 dark:text-yellow-400">Aguardando verificação</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setProofModal(null)}
                  className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  Fechar
                </button>
                {!proofModal.proofVerified && (proofModal.status === 'RESERVATION' || proofModal.status === 'PENDING') && (
                  <button
                    onClick={() => { setDepositModal(proofModal); setManualDeposit(proofModal.depositAmount ? Number(proofModal.depositAmount).toFixed(2) : ''); setHasDivergence(!!proofModal.depositDivergence); setProofModal(null) }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <FiCheckCircle size={16} /> Verificar Comprovante
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de verificação de depósito */}
      {depositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setDepositModal(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-slideDown">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Verificar Depósito - Pedido #{padId(depositModal.orderNumber)}</h2>
              <button onClick={() => setDepositModal(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400">Total do pedido</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">{BRL(depositModal.total)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400">Reserva esperada</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">{BRL(depositModal.reservation || depositModal.total)}</p>
                </div>
              </div>

              {depositModal.depositAmount && (
                <div className={`p-3 rounded-lg border ${depositModal.depositDivergence ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600' : 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-600'}`}>
                  <p className="text-sm flex items-center gap-1.5">
                    {depositModal.depositDivergence ? <FiAlertTriangle size={14} className="text-yellow-600" /> : <FiCheckCircle size={14} className="text-green-600" />}
                    <span className={depositModal.depositDivergence ? 'text-yellow-700 dark:text-yellow-300' : 'text-green-700 dark:text-green-300'}>
                      Valor identificado pela IA: {BRL(depositModal.depositAmount)}
                      {depositModal.depositDivergence && ' (divergente)'}
                    </span>
                  </p>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={hasDivergence}
                    onChange={(e) => setHasDivergence(e.target.checked)}
                    className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Divergência de valor no depósito</span>
                </label>

                {hasDivergence && (
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Valor correto do depósito (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 33.00"
                      value={manualDeposit}
                      onChange={(e) => setManualDeposit(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                    />
                  </div>
                )}
              </div>

              {(() => {
                const dep = hasDivergence && manualDeposit ? Number(manualDeposit) : (depositModal.depositAmount ? Number(depositModal.depositAmount) : Number(depositModal.reservation || 0))
                const bal = Number(depositModal.total) - dep
                return bal > 0 ? (
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-600 p-3 rounded-lg">
                    <p className="text-sm text-orange-700 dark:text-orange-300 font-semibold">
                      Receber na entrega: {BRL(bal)}
                    </p>
                  </div>
                ) : null
              })()}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-700 dark:border-gray-600 flex justify-end gap-3">
              <button
                onClick={() => setDepositModal(null)}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const data = {}
                  if (hasDivergence && manualDeposit) {
                    data.depositAmount = Number(manualDeposit)
                    data.depositDivergence = true
                  } else if (depositModal.depositAmount) {
                    data.depositAmount = Number(depositModal.depositAmount)
                    data.depositDivergence = false
                  }
                  verifyProof(depositModal.id, data)
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FiCheckCircle size={16} /> Confirmar e Verificar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de pagamento integral */}
      {finalPaymentModal && (() => {
        const depositPaid = finalPaymentModal.depositAmount ? Number(finalPaymentModal.depositAmount) : 0
        const expectedFinal = finalPaymentModal.expectedFinal
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setFinalPaymentModal(null)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-slideDown">
              <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Confirmar Pagamento Total - Pedido #{padId(finalPaymentModal.orderNumber)}</h2>
                <button onClick={() => setFinalPaymentModal(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                  <FiX size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-gray-500 dark:text-gray-400">Total do pedido</p>
                    <p className="text-lg font-bold text-gray-800 dark:text-white">{BRL(finalPaymentModal.total)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-gray-500 dark:text-gray-400">Reserva já paga</p>
                    <p className="text-lg font-bold text-gray-800 dark:text-white">{BRL(depositPaid)}</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Saldo esperado (valor a receber agora):
                  </p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{BRL(expectedFinal)}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Divergência no valor recebido</span>
                    <div
                      onClick={() => setFinalHasDivergence(!finalHasDivergence)}
                      className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${finalHasDivergence ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${finalHasDivergence ? 'translate-x-5' : ''}`} />
                    </div>
                  </div>

                  {finalHasDivergence && (
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Valor real recebido</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm pointer-events-none">R$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          value={finalPaymentValue}
                          onChange={(e) => setFinalPaymentValue(formatBRLInput(e.target.value))}
                          className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        />
                      </div>
                      {finalPaymentValue && (() => {
                        const recv = parseBRLInput(finalPaymentValue)
                        const diff = expectedFinal - recv
                        if (Math.abs(diff) < 0.005) return null
                        return (
                          <p className={`text-xs mt-2 ${diff > 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {diff > 0
                              ? `Cliente pagou ${BRL(diff)} a menos`
                              : `Cliente pagou ${BRL(Math.abs(diff))} a mais`}
                          </p>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-700 dark:border-gray-600 flex justify-end gap-3">
                <button
                  onClick={() => setFinalPaymentModal(null)}
                  className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const data = {}
                    if (finalHasDivergence && finalPaymentValue) {
                      data.paymentAmount = parseBRLInput(finalPaymentValue)
                      data.paymentDivergence = true
                    }
                    confirmPayment(finalPaymentModal.id, data)
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <FiCheckCircle size={16} /> Confirmar Pagamento
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de confirmação de status */}
      {statusConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setStatusConfirm(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Alterar Status</h2>
              <button onClick={() => setStatusConfirm(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <FiX size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Alterar status do pedido para "{statusLabels[statusConfirm.status]}"?
            </p>

            {statusConfirm.status === 'READY' && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-green-800 dark:text-green-300">Enviar notificação ao cliente</label>
                  <button
                    type="button"
                    onClick={() => setNotifyReady(!notifyReady)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${notifyReady ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifyReady ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                {notifyReady && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1.5">
                    Uma mensagem será enviada via WhatsApp informando que o pedido está pronto.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStatusConfirm(null)}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => statusConfirm && updateStatus(statusConfirm.orderId, statusConfirm.status)}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de cancelamento */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => { setCancelConfirm(null); setNotifyCancel(true) }} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-slideDown">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Cancelar Pedido</h2>
              <button onClick={() => { setCancelConfirm(null); setNotifyCancel(true) }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center text-center space-y-4">
              <p className="text-gray-600 dark:text-gray-300">
                Tem certeza que deseja cancelar o Pedido #{padId(cancelConfirm.orderNumber)}?
              </p>
              <label className="flex items-center gap-3 w-full justify-between bg-gray-50 dark:bg-gray-700 px-4 py-3 rounded-lg cursor-pointer">
                <span className="text-sm text-gray-700 dark:text-gray-300">Notificar cliente via WhatsApp</span>
                <div
                  onClick={() => setNotifyCancel(!notifyCancel)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${notifyCancel ? 'bg-pink-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifyCancel ? 'translate-x-5' : ''}`} />
                </div>
              </label>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => { setCancelConfirm(null); setNotifyCancel(true) }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => cancelOrder(cancelConfirm.id, notifyCancel)}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Cancelar Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de impressão do PDF */}
      {printOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => { if (printOrder?.pdfUrl) URL.revokeObjectURL(printOrder.pdfUrl); setPrintOrder(null) }} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-slideDown flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Pedido #{padId(printOrder.order.orderNumber)}</h2>
              <button onClick={() => { if (printOrder?.pdfUrl) URL.revokeObjectURL(printOrder.pdfUrl); setPrintOrder(null) }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex justify-center bg-gray-100 dark:bg-gray-900">
              <iframe
                src={printOrder.pdfUrl}
                title="PDF do pedido"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600"
                style={{ minHeight: '60vh' }}
              />
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-700 dark:border-gray-600 flex justify-end gap-3">
              <button
                onClick={() => { if (printOrder?.pdfUrl) URL.revokeObjectURL(printOrder.pdfUrl); setPrintOrder(null) }}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  const iframe = document.querySelector('iframe[title="PDF do pedido"]')
                  if (iframe) iframe.contentWindow.print()
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
              >
                <FiPrinter size={16} /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de configurações de impressão */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setSettingsOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-slideDown">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Configurações</h2>
              <button onClick={() => setSettingsOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Tipo de Impressora</label>
                <div className="space-y-2">
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      printerType === 'thermal'
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="printerType"
                      value="thermal"
                      checked={printerType === 'thermal'}
                      onChange={() => savePrinterType('thermal')}
                      className="text-pink-500 focus:ring-pink-500"
                    />
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white">Impressora Térmica</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Cupom 80mm - formato compacto</p>
                    </div>
                  </label>
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      printerType === 'a4'
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="printerType"
                      value="a4"
                      checked={printerType === 'a4'}
                      onChange={() => savePrinterType('a4')}
                      className="text-pink-500 focus:ring-pink-500"
                    />
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white">Folha A4</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Formato padrão para impressora comum</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-t dark:border-gray-600 pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Cabeçalho da Empresa</label>
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    showCompanyHeader
                      ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div
                    onClick={() => toggleCompanyHeader(!showCompanyHeader)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${showCompanyHeader ? 'bg-pink-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${showCompanyHeader ? 'translate-x-5' : ''}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">Exibir dados da empresa</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Inclui logomarca, nome, telefone e endereço no topo do pedido impresso</p>
                  </div>
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-700 dark:border-gray-600 flex justify-end">
              <button
                onClick={() => setSettingsOpen(false)}
                className="px-5 py-2.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <AgendaModal isOpen={agendaOpen} onClose={() => setAgendaOpen(false)} />

      {/* Modal: Dar baixa no estoque */}
      <Modal isOpen={!!stockModal} onClose={() => setStockModal(null)} title="Baixa no Estoque" maxWidth="max-w-sm">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <FiPackage size={32} className="text-orange-500" />
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Deseja dar baixa no estoque dos materiais usados neste pedido?
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Os materiais serão descontados com base nas receitas dos produtos.
          </p>
          <div className="flex gap-3 w-full pt-2">
            <button
              onClick={() => setStockModal(null)}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Agora não
            </button>
            <button
              onClick={() => deductStock(stockModal.orderId)}
              disabled={stockDeducting}
              className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50"
            >
              {stockDeducting ? 'Processando...' : 'Dar baixa'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Resultado da baixa */}
      <Modal isOpen={!!stockResult} onClose={() => setStockResult(null)} title="Estoque Atualizado" maxWidth="max-w-sm">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <FiCheckCircle size={32} className="text-green-500" />
          </div>
          <p className="text-green-700 dark:text-green-400 font-semibold text-lg">Baixa realizada com sucesso!</p>
          {stockResult?.deducted?.length > 0 && (
            <div className="w-full text-left bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Materiais descontados:</p>
              {stockResult.deducted.map((d, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{d.material}</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">-{d.quantity}</span>
                </div>
              ))}
            </div>
          )}
          {stockResult?.noRecipe?.length > 0 && (
            <div className="w-full text-left bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
              <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">Produtos sem receita (não descontados):</p>
              {stockResult.noRecipe.map((name, i) => (
                <p key={i} className="text-sm text-yellow-700 dark:text-yellow-300">• {name}</p>
              ))}
            </div>
          )}
          <button
            onClick={() => setStockResult(null)}
            className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Fechar
          </button>
        </div>
      </Modal>

      {/* Modal: Estoque insuficiente */}
      <Modal isOpen={!!insufficientModal} onClose={() => setInsufficientModal(null)} title="Estoque Insuficiente" maxWidth="max-w-sm">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <FiAlertTriangle size={32} className="text-red-500" />
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Não é possível dar baixa. Os seguintes materiais não possuem estoque suficiente:
          </p>
          {insufficientModal && (
            <div className="w-full text-left bg-red-50 dark:bg-red-900/20 rounded-lg p-3 space-y-2">
              {insufficientModal.map((item, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{item.material}</span>
                  <div className="flex gap-3 text-xs mt-0.5">
                    <span className="text-red-600 dark:text-red-400">Necessário: {item.required}</span>
                    <span className="text-gray-500">Disponível: {item.available}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setInsufficientModal(null)}
            className="w-full px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Entendi
          </button>
        </div>
      </Modal>

      {/* Modal: Confirmar reversão de estoque */}
      <ConfirmModal
        isOpen={!!revertConfirm}
        onClose={() => setRevertConfirm(null)}
        title="Reverter Estoque"
        message={"Todos os materiais descontados deste pedido serão devolvidos ao estoque.\n\nDeseja continuar?"}
        confirmText={stockReverting ? 'Revertendo...' : 'Reverter'}
        confirmColor="bg-red-600 hover:bg-red-700"
        onConfirm={() => revertConfirm && revertOrderStock(revertConfirm.orderId)}
      />
    </div>
  )
}
