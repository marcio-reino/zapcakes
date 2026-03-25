import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiRefreshCw, FiPackage, FiClock, FiPrinter } from 'react-icons/fi'
import { jsPDF } from 'jspdf'
import Modal from '../../components/Modal.jsx'
import DatePicker from '../../components/DatePicker.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'

function formatBRL(value) {
  const num = String(value).replace(/\D/g, '')
  const cents = (Number(num) / 100).toFixed(2)
  return Number(cents).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseBRL(formatted) {
  const num = String(formatted).replace(/\./g, '').replace(',', '.')
  return parseFloat(num) || 0
}

const fmtCode = (id) => String(id).padStart(5, '0')
const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function parseUnitType(unit) {
  if (!unit) return 'un'
  const match = unit.match(/^[\d.,]+\s*(.+)$/)
  return match ? match[1].trim() : unit
}

function parseUnitQty(unit) {
  if (!unit) return 1
  const match = unit.match(/^([\d.,]+)/)
  return match ? parseFloat(match[1].replace(',', '.')) || 1 : 1
}

const unitOptions = [
  { value: 'g', label: 'Gramas' },
  { value: 'kg', label: 'Quilos' },
  { value: 'L', label: 'Litros' },
  { value: 'ml', label: 'Mililitros' },
  { value: 'un', label: 'Unidade' },
]
const emptyForm = { name: '', unitQty: '', unitType: 'g', brand: '', category: '', basePrice: '', refCode: '' }

export default function Materials() {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [search, setSearch] = useState('')
  const [searchCode, setSearchCode] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedCode, setAppliedCode] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  // Histórico de movimentações
  const [historyMaterial, setHistoryMaterial] = useState(null)
  const [historyData, setHistoryData] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [historyAppliedFrom, setHistoryAppliedFrom] = useState('')
  const [historyAppliedTo, setHistoryAppliedTo] = useState('')
  const [historyPdfUrl, setHistoryPdfUrl] = useState(null)

  // Estoque
  const [stockMaterial, setStockMaterial] = useState(null)
  const [stockValue, setStockValue] = useState('')
  const [savingStock, setSavingStock] = useState(false)

  useEffect(() => { loadMaterials() }, [])

  async function loadMaterials() {
    try {
      const { data } = await api.get('/materials')
      setMaterials(data)
    } catch {
      toast.error('Erro ao carregar materiais')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const payload = {
        name: form.name,
        unit: form.unitQty ? `${form.unitQty}${form.unitType}` : form.unitType,
        brand: form.brand,
        category: form.category,
        basePrice: parseBRL(form.basePrice),
        refCode: form.refCode || null,
      }
      if (editingId) {
        await api.put(`/materials/${editingId}`, payload)
        toast.success('Material atualizado!')
        closeModal()
      } else {
        await api.post('/materials', payload)
        toast.success('Material cadastrado!')
        setForm(emptyForm)
      }
      loadMaterials()
    } catch {
      toast.error('Erro ao salvar material')
    }
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function startEdit(m) {
    setEditingId(m.id)
    let unitQty = ''
    let unitType = 'g'
    if (m.unit) {
      const match = m.unit.match(/^(\d+(?:[.,]\d+)?)\s*(.+)$/)
      if (match) {
        unitQty = match[1]
        unitType = match[2].trim()
      } else if (unitOptions.some((u) => u.value === m.unit)) {
        unitType = m.unit
      } else {
        unitQty = m.unit
      }
    }
    setForm({
      name: m.name,
      unitQty,
      unitType,
      brand: m.brand || '',
      category: m.category || '',
      basePrice: m.basePrice ? formatBRL(String(Number(m.basePrice) * 100).replace('.', '')) : '',
      refCode: m.refCode || '',
    })
    setShowModal(true)
  }

  function closeModal() {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(false)
  }

  async function confirmDelete() {
    try {
      await api.delete(`/materials/${deleteId}`)
      toast.success('Material removido!')
      setDeleteId(null)
      loadMaterials()
    } catch {
      toast.error('Erro ao remover material')
    }
  }

  // Estoque
  function openStock(m) {
    setStockMaterial(m)
    const baseQty = parseUnitQty(m.unit)
    const units = Math.round((Number(m.stock) || 0) / baseQty)
    setStockValue(String(units))
  }

  function closeStock() {
    setStockMaterial(null)
    setStockValue('')
  }

  async function handleSaveStock() {
    if (!stockMaterial) return
    setSavingStock(true)
    try {
      const baseQty = parseUnitQty(stockMaterial.unit)
      const totalStock = (parseFloat(stockValue) || 0) * baseQty
      await api.put(`/materials/${stockMaterial.id}/stock`, { stock: totalStock })
      toast.success('Estoque atualizado!')
      closeStock()
      loadMaterials()
    } catch {
      toast.error('Erro ao atualizar estoque')
    } finally {
      setSavingStock(false)
    }
  }

  async function openHistory(m) {
    setHistoryMaterial(m)
    setHistoryDateFrom('')
    setHistoryDateTo('')
    setHistoryAppliedFrom('')
    setHistoryAppliedTo('')
    setHistoryLoading(true)
    try {
      const { data } = await api.get(`/materials/${m.id}/stock-history`)
      setHistoryData(data)
    } catch {
      toast.error('Erro ao carregar histórico')
    } finally {
      setHistoryLoading(false)
    }
  }

  function getFilteredHistory() {
    if (!historyAppliedFrom && !historyAppliedTo) return historyData
    return historyData.filter((mov) => {
      const d = new Date(mov.createdAt).toISOString().slice(0, 10)
      if (historyAppliedFrom && d < historyAppliedFrom) return false
      if (historyAppliedTo && d > historyAppliedTo) return false
      return true
    })
  }

  function applyHistoryFilter() {
    setHistoryAppliedFrom(historyDateFrom)
    setHistoryAppliedTo(historyDateTo)
  }

  function printHistory() {
    const filtered = getFilteredHistory()
    const material = historyMaterial
    if (!material || filtered.length === 0) return

    const dateRange = historyAppliedFrom || historyAppliedTo
      ? `Período: ${historyAppliedFrom ? new Date(historyAppliedFrom + 'T12:00:00').toLocaleDateString('pt-BR') : '...'} a ${historyAppliedTo ? new Date(historyAppliedTo + 'T12:00:00').toLocaleDateString('pt-BR') : '...'}`
      : 'Todas as movimentações'

    const totalIn = filtered.filter(m => Number(m.quantity) > 0).reduce((s, m) => s + Number(m.quantity), 0)
    const totalOut = filtered.filter(m => Number(m.quantity) < 0).reduce((s, m) => s + Math.abs(Number(m.quantity)), 0)

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text('Histórico de Movimentações', 14, 20)
    doc.setFontSize(12)
    doc.text(material.name, 14, 28)
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(dateRange, 14, 34)
    doc.text(`Estoque atual: ${Number(material.stock || 0)} ${parseUnitType(material.unit)}`, 14, 40)
    doc.setTextColor(0)

    // Totais
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(22, 163, 74)
    doc.text(`Entrada: +${totalIn}`, 14, 48)
    doc.setTextColor(220, 38, 38)
    doc.text(`Saída: -${totalOut}`, 80, 48)
    doc.setTextColor(0)

    // Cabeçalho tabela
    let y = 58
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text('Data', 14, y)
    doc.text('Hora', 40, y)
    doc.text('Descrição', 60, y)
    doc.text('Qtd', 190, y, { align: 'right' })
    doc.line(14, y + 2, 196, y + 2)
    y += 8

    doc.setFont(undefined, 'normal')
    for (const mov of filtered) {
      if (y > 275) {
        doc.addPage()
        y = 20
      }
      const qty = Number(mov.quantity)
      const date = new Date(mov.createdAt)
      doc.text(date.toLocaleDateString('pt-BR'), 14, y)
      doc.text(date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 40, y)
      doc.text((mov.description || mov.type).substring(0, 50), 60, y)
      doc.setTextColor(qty > 0 ? 22 : 220, qty > 0 ? 163 : 38, qty > 0 ? 74 : 38)
      doc.setFont(undefined, 'bold')
      doc.text(`${qty > 0 ? '+' : ''}${qty}`, 190, y, { align: 'right' })
      doc.setFont(undefined, 'normal')
      doc.setTextColor(0)
      y += 7
    }

    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    setHistoryPdfUrl(url)
  }

  function handlePrintHistoryPdf() {
    if (!historyPdfUrl) return
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = historyPdfUrl
    document.body.appendChild(iframe)
    iframe.onload = () => {
      iframe.contentWindow.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }
  }

  function closeHistoryPdf() {
    if (historyPdfUrl) URL.revokeObjectURL(historyPdfUrl)
    setHistoryPdfUrl(null)
  }

  function applySearch() {
    setAppliedSearch(search)
    setAppliedCode(searchCode)
  }

  const filtered = materials.filter((m) => {
    if (filterCategory && m.category !== filterCategory) return false
    if (appliedCode && !fmtCode(m.id).includes(appliedCode.trim()) && String(m.id) !== appliedCode.trim()) return false
    if (!appliedSearch) return true
    const q = normalize(appliedSearch)
    return (
      normalize(m.name).includes(q) ||
      (m.brand && normalize(m.brand).includes(q))
    )
  })

  const materialCategories = [
    'Laticínios',
    'Farinhas e Amidos',
    'Açúcares e Adoçantes',
    'Chocolates e Cacau',
    'Frutas e Polpas',
    'Ovos e Gorduras',
    'Essências e Corantes',
    'Confeitos e Decorações',
    'Fermentos e Aditivos',
    'Embalagens e Descartáveis',
  ]

  const inputClass = 'w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-base md:text-sm'
  const labelClass = 'block text-base md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Materiais</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setLoading(true); loadMaterials() }}
            className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2.5 md:py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2 text-base md:text-sm"
          >
            <FiRefreshCw size={16} />
          </button>
          <button
            onClick={openNew}
            className="bg-green-600 text-white px-4 py-2.5 md:py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-base md:text-sm"
          >
            <FiPlus size={18} /> Novo Material
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Código"
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applySearch()}
          className="w-full md:w-24 px-4 py-3 md:py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-base md:text-sm"
        />
        <input
          type="text"
          placeholder="Buscar por nome ou marca..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applySearch()}
          className="flex-1 px-4 py-3 md:py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-base md:text-sm"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-3 md:py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-base md:text-sm"
        >
          <option value="">Todas categorias</option>
          {materialCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={applySearch}
          className="px-4 py-3 md:py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-base md:text-sm"
        >
          <FiSearch size={18} /> <span className="md:hidden">Pesquisar</span>
        </button>
      </div>

      {/* Modal Criar/Editar */}
      <Modal isOpen={showModal} onClose={closeModal} title={editingId ? 'Editar Material' : 'Novo Material'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nome *</label>
            <input
              type="text" placeholder="Ex: Manteiga, Farinha de trigo..."
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass} required autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Unidade</label>
              <div className="flex">
                <input
                  type="text" inputMode="numeric" placeholder="500"
                  value={form.unitQty} onChange={(e) => setForm({ ...form, unitQty: e.target.value })}
                  className={`${inputClass} flex-1 rounded-r-none border-r-0`}
                />
                <div className="relative">
                  <select
                    value={form.unitType} onChange={(e) => setForm({ ...form, unitType: e.target.value })}
                    className="appearance-none pl-2 pr-6 py-3 border border-gray-300 dark:border-gray-600 rounded-r-lg bg-gray-50 dark:bg-gray-600 dark:text-white text-sm font-medium outline-none cursor-pointer"
                    style={{ color: 'transparent' }}
                  >
                    {unitOptions.map((u) => <option key={u.value} value={u.value} style={{ color: 'initial' }}>{u.value} - {u.label}</option>)}
                  </select>
                  <span className="absolute inset-0 flex items-center pl-2 pr-6 text-sm font-medium text-gray-700 dark:text-white pointer-events-none">
                    {form.unitType}
                  </span>
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▾</span>
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass}>Marca</label>
              <input
                type="text" placeholder="Ex: Parmalat"
                value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Categoria</label>
              <select
                value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                {materialCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Preço Base (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-base md:text-sm">R$</span>
                <input
                  type="text" inputMode="numeric" placeholder="0,00"
                  value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: formatBRL(e.target.value) })}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Código de Referência Externa</label>
            <input
              type="text" placeholder="Ex: SKU, código do fornecedor..."
              value={form.refCode} onChange={(e) => setForm({ ...form, refCode: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={closeModal} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
              {editingId ? <><FiEdit2 size={16} /> Atualizar</> : <><FiPlus size={16} /> Cadastrar</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Estoque */}
      <Modal isOpen={!!stockMaterial} onClose={closeStock} title="Estoque">
        <div className="space-y-5">
          <p className="text-center text-lg font-semibold text-gray-800 dark:text-white">{stockMaterial?.name}</p>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Estoque Atual</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {stockMaterial ? Math.round(Number(stockMaterial.stock || 0) / parseUnitQty(stockMaterial.unit)) : 0} <span className="text-base font-normal text-gray-400">{stockMaterial?.unit || 'un'}</span>
            </p>
          </div>

          <div>
            <label className={labelClass}>Quantidade ({stockMaterial?.unit || 'un'})</label>
            <div className="flex gap-2">
              <input
                type="number" step="1" min="0"
                value={stockValue}
                onChange={(e) => setStockValue(e.target.value)}
                className={`${inputClass} flex-1`}
                placeholder="0"
              />
              <span className="flex items-center text-sm text-gray-500 dark:text-gray-400 px-2">
                {stockMaterial?.unit || 'un'}
              </span>
              <button
                type="button"
                onClick={handleSaveStock}
                disabled={savingStock}
                className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                Salvar
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={closeStock} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Fechar
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Remover Material"
        message="Tem certeza que deseja remover este material? Esta ação não pode ser desfeita."
        confirmText="Remover"
      />

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((m) => (
          <div key={m.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 dark:text-gray-500">Cód. {fmtCode(m.id)}</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{m.name}</h3>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-base text-gray-500 dark:text-gray-400">
                  {m.unit && <span>{m.unit}</span>}
                  {m.brand && <span>• {m.brand}</span>}
                  {m.category && <span className="text-green-600 dark:text-green-400">• {m.category}</span>}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">
                    {Number(m.basePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <span className="text-base font-medium text-gray-500 dark:text-gray-400">
                    Estoque: {Number(m.stock || 0)} {parseUnitType(m.unit)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 ml-2">
                <button onClick={() => openStock(m)} className="p-3 bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 rounded-lg transition-colors">
                  <FiPackage size={20} />
                </button>
                <button onClick={() => openHistory(m)} className="p-3 bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 rounded-lg transition-colors">
                  <FiClock size={20} />
                </button>
                <button onClick={() => startEdit(m)} className="p-3 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors">
                  <FiEdit2 size={20} />
                </button>
                <button onClick={() => setDeleteId(m.id)} className="p-3 bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors">
                  <FiTrash2 size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-6 py-8 text-center text-gray-400">
            {search ? 'Nenhum material encontrado' : 'Nenhum material cadastrado'}
          </div>
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cód.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unidade</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Marca</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Categoria</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Preço Base</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estoque</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((m) => (
              <tr key={m.id}>
                <td className="px-6 py-4 text-sm text-gray-400 dark:text-gray-500">{fmtCode(m.id)}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{m.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{m.unit || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{m.brand || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{m.category || '-'}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white font-medium">{Number(m.basePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400">
                  {Number(m.stock || 0)} {parseUnitType(m.unit)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openStock(m)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 rounded-lg transition-colors text-sm"
                    >
                      <FiPackage size={15} /> Estoque
                    </button>
                    <button
                      onClick={() => openHistory(m)}
                      className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 rounded-lg transition-colors"
                      title="Histórico"
                    >
                      <FiClock size={15} />
                    </button>
                    <button
                      onClick={() => startEdit(m)}
                      className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <FiEdit2 size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteId(m.id)}
                      className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors"
                      title="Remover"
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-400">
            {search ? 'Nenhum material encontrado' : 'Nenhum material cadastrado'}
          </div>
        )}
      </div>

      {/* Modal: Histórico de movimentações */}
      <Modal isOpen={!!historyMaterial} onClose={() => setHistoryMaterial(null)} title="Histórico de Movimentações" maxWidth="max-w-lg" maxHeight="85vh">
        {historyMaterial && (
          <div className="mb-4 pb-3 border-b dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{historyMaterial.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Estoque atual: {Number(historyMaterial.stock || 0)} {parseUnitType(historyMaterial.unit)}</p>
              </div>
              <button
                onClick={printHistory}
                disabled={getFilteredHistory().length === 0}
                className="p-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 rounded-lg transition-colors disabled:opacity-30"
                title="Imprimir relatório"
              >
                <FiPrinter size={20} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <DatePicker value={historyDateFrom} onChange={setHistoryDateFrom} placeholder="De" />
              <DatePicker value={historyDateTo} onChange={setHistoryDateTo} placeholder="Até" />
              <button
                onClick={applyHistoryFilter}
                className="p-2.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors shrink-0"
                title="Pesquisar"
              >
                <FiSearch size={18} />
              </button>
            </div>
          </div>
        )}
        {historyLoading ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : (() => { const filtered = getFilteredHistory(); return filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Nenhuma movimentação registrada</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((mov) => {
              const qty = Number(mov.quantity)
              const isPositive = qty > 0
              return (
                <div key={mov.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{mov.description || mov.type}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(mov.createdAt).toLocaleDateString('pt-BR')} às {new Date(mov.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ml-3 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isPositive ? '+' : ''}{qty}
                  </span>
                </div>
              )
            })}
          </div>
        ) })()}
      </Modal>

      {/* Modal: PDF do histórico */}
      <Modal isOpen={!!historyPdfUrl} onClose={closeHistoryPdf} title="Relatório de Movimentações" maxWidth="max-w-4xl">
        <div className="space-y-4">
          <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: '70vh' }}>
            <iframe src={historyPdfUrl} width="100%" height="100%" title="PDF Preview" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeHistoryPdf} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Fechar
            </button>
            <button type="button" onClick={handlePrintHistoryPdf} className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
              <FiPrinter size={16} /> Imprimir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
