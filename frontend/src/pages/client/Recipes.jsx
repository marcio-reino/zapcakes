import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiRefreshCw, FiClock, FiDollarSign, FiTrendingUp, FiTrendingDown, FiCheck, FiX, FiPackage, FiPrinter } from 'react-icons/fi'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import jsPDF from 'jspdf'

const BRL = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Extrai quantidade base da unidade do material. Ex: "500g" → 500, "1kg" → 1, "un" → 1
function parseUnitQty(unit) {
  if (!unit) return 1
  const match = unit.match(/^(\d+(?:[.,]\d+)?)/)
  return match ? parseFloat(match[1].replace(',', '.')) : 1
}

// Extrai apenas o tipo da unidade. Ex: "500g" → "g", "1kg" → "kg", "un" → "un"
function parseUnitType(unit) {
  if (!unit) return 'un'
  const match = unit.match(/^[\d.,]+\s*(.+)$/)
  return match ? match[1].trim() : unit
}

// Custo proporcional: se 500g custa R$6,50, então 100g custa (100/500)*6,50 = R$1,30
function materialItemCost(basePrice, quantity, unit) {
  const baseQty = parseUnitQty(unit)
  return (quantity / baseQty) * Number(basePrice)
}

const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const emptyForm = { name: '', description: '', prepTimeH: '0', prepTimeM: '0' }

export default function Recipes() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [formItems, setFormItems] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  const [materials, setMaterials] = useState([])
  const [hourlyRate, setHourlyRate] = useState(0)

  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [materialSearch, setMaterialSearch] = useState('')
  const [selectedMaterials, setSelectedMaterials] = useState([])
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const [recipesRes, materialsRes, companyRes] = await Promise.all([
        api.get('/recipes'),
        api.get('/materials'),
        api.get('/company'),
      ])
      setRecipes(recipesRes.data)
      setMaterials(materialsRes.data.filter((m) => m.active))
      setHourlyRate(Number(companyRes.data.hourlyRate) || 0)
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  // Cálculos
  function calcRecipe(recipe) {
    const materialCost = (recipe.items || []).reduce((sum, i) => sum + materialItemCost(i.material.basePrice, Number(i.quantity), i.material.unit), 0)
    const laborCost = (Number(recipe.prepTime) / 60) * hourlyRate
    const totalCost = materialCost + laborCost
    return { materialCost, laborCost, totalCost }
  }

  function calcFormItems() {
    const materialCost = formItems.reduce((sum, i) => {
      const mat = materials.find((m) => m.id === i.materialId)
      return sum + (mat ? materialItemCost(mat.basePrice, Number(i.quantity), mat.unit) : 0)
    }, 0)
    const minutes = (parseInt(form.prepTimeH) || 0) * 60 + (parseInt(form.prepTimeM) || 0)
    const laborCost = (minutes / 60) * hourlyRate
    const totalCost = materialCost + laborCost
    return { materialCost, laborCost, totalCost }
  }

  // CRUD
  async function handleSubmit(e) {
    e.preventDefault()
    const prepTime = (parseInt(form.prepTimeH) || 0) * 60 + (parseInt(form.prepTimeM) || 0)
    const payload = {
      name: form.name,
      description: form.description,
      prepTime,
      items: formItems.map((i) => ({ materialId: i.materialId, quantity: i.quantity })),
    }

    try {
      if (editingId) {
        await api.put(`/recipes/${editingId}`, payload)
        toast.success('Receita atualizada!')
      } else {
        await api.post('/recipes', payload)
        toast.success('Receita criada!')
      }
      closeModal()
      loadAll()
    } catch {
      toast.error('Erro ao salvar receita')
    }
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setFormItems([])
    setShowModal(true)
  }

  function startEdit(r) {
    setEditingId(r.id)
    const h = Math.floor(r.prepTime / 60)
    const m = r.prepTime % 60
    setForm({
      name: r.name,
      description: r.description || '',
      prepTimeH: String(h),
      prepTimeM: String(m),
    })
    setFormItems((r.items || []).map((i) => ({ materialId: i.materialId, quantity: Number(i.quantity) })))
    setShowModal(true)
  }

  function closeModal() {
    setEditingId(null)
    setForm(emptyForm)
    setFormItems([])
    setShowModal(false)
  }

  async function confirmDelete() {
    try {
      await api.delete(`/recipes/${deleteId}`)
      toast.success('Receita removida!')
      setDeleteId(null)
      loadAll()
    } catch {
      toast.error('Erro ao remover receita')
    }
  }

  // Itens do form
  function openAddMaterial() {
    setSelectedMaterials([])
    setMaterialSearch('')
    setShowAddMaterial(true)
  }

  function handleAddMaterials() {
    const newItems = selectedMaterials
      .filter((id) => !formItems.some((i) => i.materialId === id))
      .map((id) => ({ materialId: id, quantity: 1 }))
    setFormItems([...formItems, ...newItems])
    setShowAddMaterial(false)
  }

  function updateItemQty(materialId, qty) {
    setFormItems(formItems.map((i) => i.materialId === materialId ? { ...i, quantity: qty } : i))
  }

  function removeItem(materialId) {
    setFormItems(formItems.filter((i) => i.materialId !== materialId))
  }

  function applySearch() {
    setAppliedSearch(search)
  }

  const filtered = recipes.filter((r) => {
    if (!appliedSearch) return true
    const q = normalize(appliedSearch)
    return normalize(r.name).includes(q)
  })

  function printRecipe(r) {
    const calc = calcRecipe(r)
    const timeStr = `${Math.floor(r.prepTime / 60)}h${r.prepTime % 60 > 0 ? `${r.prepTime % 60}min` : ''}`
    const items = r.items || []
    const doc = new jsPDF()

    // Título
    doc.setFontSize(20)
    doc.setFont(undefined, 'bold')
    doc.text('Receita', 14, 18)
    doc.setFont(undefined, 'normal')
    doc.setFontSize(16)
    doc.text(r.name, 14, 28)

    // Meta
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Tempo de preparo: ${timeStr}  |  ${items.length} materiais`, 14, 34)
    doc.setTextColor(0)

    // Descrição
    let y = 42
    if (r.description) {
      doc.setFontSize(10)
      const lines = doc.splitTextToSize(r.description, 180)
      doc.text(lines, 14, y)
      y += lines.length * 5 + 6
    }

    // Cabeçalho tabela
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text('Cód.', 14, y)
    doc.text('Material', 32, y)
    doc.text('Marca', 90, y)
    doc.text('Qtd', 120, y)
    doc.text('Unid.', 140, y)
    doc.text('Custo', 165, y)
    doc.line(14, y + 2, 196, y + 2)
    y += 8

    // Itens
    doc.setFont(undefined, 'normal')
    for (const i of items) {
      if (y > 270) { doc.addPage(); y = 20 }
      const unitType = parseUnitType(i.material.unit)
      const cost = materialItemCost(i.material.basePrice, Number(i.quantity), i.material.unit)
      doc.text(String(i.material.id).padStart(5, '0'), 14, y)
      doc.text(i.material.name.substring(0, 25), 32, y)
      doc.text(i.material.brand || '-', 90, y)
      doc.text(String(Number(i.quantity)), 120, y)
      doc.text(unitType, 140, y)
      doc.text(BRL(cost), 165, y)
      y += 7
    }

    // Totais
    y += 5
    doc.line(14, y, 196, y)
    y += 7
    doc.setFontSize(10)
    doc.text(`Custo Materiais: ${BRL(calc.materialCost)}`, 14, y)
    y += 6
    doc.text(`Custo Mão de Obra: ${BRL(calc.laborCost)}`, 14, y)
    y += 6
    doc.setFont(undefined, 'bold')
    doc.text(`Custo Total: ${BRL(calc.totalCost)}`, 14, y)

    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    setPdfBlobUrl(url)
  }

  function handlePrintPdf() {
    if (!pdfBlobUrl) return
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = pdfBlobUrl
    document.body.appendChild(iframe)
    iframe.onload = () => {
      iframe.contentWindow.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }
  }

  function closePdfModal() {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    setPdfBlobUrl(null)
  }

  const inputClass = 'w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-base md:text-sm'
  const labelClass = 'block text-base md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  const formCalc = showModal ? calcFormItems() : null

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Receitas</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setLoading(true); loadAll() }}
            className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2.5 md:py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2 text-base md:text-sm"
          >
            <FiRefreshCw size={16} />
          </button>
          <button
            onClick={openNew}
            className="bg-green-600 text-white px-4 py-2.5 md:py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-base md:text-sm"
          >
            <FiPlus size={18} /> Nova Receita
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applySearch()}
          className="flex-1 px-4 py-3 md:py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-base md:text-sm"
        />
        <button
          onClick={applySearch}
          className="px-4 py-3 md:py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-base md:text-sm"
        >
          <FiSearch size={18} /> <span className="md:hidden">Pesquisar</span>
        </button>
      </div>

      {hourlyRate === 0 && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
          ⚠ Configure o "Valor da Hora de Trabalho" na página <strong>Empresa</strong> para calcular o custo de mão de obra.
        </div>
      )}

      {/* Modal Criar/Editar */}
      <Modal isOpen={showModal} onClose={closeModal} title={editingId ? 'Editar Receita' : 'Nova Receita'} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nome da Receita *</label>
            <input
              type="text" placeholder="Ex: Bolo de Chocolate 2kg"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass} required autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>Descrição</label>
            <textarea
              placeholder="Modo de preparo, observações..."
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass} rows={2}
            />
          </div>

          <div>
            <label className={labelClass}>Tempo de Preparo</label>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number" min="0" value={form.prepTimeH}
                  onChange={(e) => setForm({ ...form, prepTimeH: e.target.value })}
                  className={`${inputClass} text-center`}
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">h</span>
              </div>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number" min="0" max="59" value={form.prepTimeM}
                  onChange={(e) => setForm({ ...form, prepTimeM: e.target.value })}
                  className={`${inputClass} text-center`}
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">min</span>
              </div>
            </div>
          </div>

          {/* Materiais */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>Materiais</label>
              <button
                type="button" onClick={openAddMaterial}
                className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
              >
                <FiPlus size={14} /> Adicionar
              </button>
            </div>

            {formItems.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                Nenhum material adicionado
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {formItems.map((item) => {
                  const mat = materials.find((m) => m.id === item.materialId)
                  if (!mat) return null
                  const unitType = parseUnitType(mat.unit)
                  return (
                    <div key={item.materialId} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{mat.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {mat.brand ? `${mat.brand} • ` : ''}{BRL(mat.basePrice)}/{mat.unit || 'un'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0.01" step="0.01" value={item.quantity}
                          onChange={(e) => updateItemQty(item.materialId, parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1.5 text-sm text-center border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-8">{unitType}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right">
                        {BRL(materialItemCost(mat.basePrice, item.quantity, mat.unit))}
                      </span>
                      <button type="button" onClick={() => removeItem(item.materialId)} className="p-1 text-gray-400 hover:text-red-500">
                        <FiX size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Resumo de custos */}
          {formCalc && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Custo Materiais:</span>
                <span className="font-medium text-gray-800 dark:text-white">{BRL(formCalc.materialCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Custo Mão de Obra ({hourlyRate > 0 ? `${BRL(hourlyRate)}/h` : 'não configurado'}):</span>
                <span className="font-medium text-gray-800 dark:text-white">{BRL(formCalc.laborCost)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-gray-200 dark:border-gray-600 pt-2">
                <span className="text-gray-700 dark:text-gray-300">Custo Total:</span>
                <span className="text-gray-900 dark:text-white">{BRL(formCalc.totalCost)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={closeModal} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
              {editingId ? <><FiEdit2 size={16} /> Atualizar</> : <><FiPlus size={16} /> Criar</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Adicionar Materiais */}
      <Modal isOpen={showAddMaterial} onClose={() => setShowAddMaterial(false)} title="Adicionar Materiais">
        <div className="space-y-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text" placeholder="Buscar material..."
              value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-base md:text-sm"
              autoFocus
            />
          </div>

          {selectedMaterials.length > 0 && (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">{selectedMaterials.length} selecionado(s)</p>
          )}

          <div className="max-h-64 overflow-y-auto space-y-1">
            {materials
              .filter((m) => {
                const q = normalize(materialSearch)
                return normalize(m.name).includes(q) || (m.brand && normalize(m.brand).includes(q))
              })
              .filter((m) => !formItems.some((i) => i.materialId === m.id))
              .map((m) => {
                const selected = selectedMaterials.includes(m.id)
                return (
                  <button
                    key={m.id} type="button"
                    onClick={() => setSelectedMaterials(selected ? selectedMaterials.filter((id) => id !== m.id) : [...selectedMaterials, m.id])}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selected ? 'bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'
                    }`}
                  >
                    <div>
                      <p className="text-base md:text-sm font-medium text-gray-900 dark:text-white">{m.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {[m.unit, m.brand, BRL(m.basePrice)].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                    {selected && <FiCheck className="text-green-600" size={18} />}
                  </button>
                )
              })}
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowAddMaterial(false)} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg">
              Cancelar
            </button>
            <button
              type="button" onClick={handleAddMaterials}
              disabled={selectedMaterials.length === 0}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FiPlus size={16} /> Adicionar ({selectedMaterials.length})
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Remover Receita"
        message="Tem certeza que deseja remover esta receita? Esta ação não pode ser desfeita."
        confirmText="Remover"
      />

      {/* Modal PDF Preview */}
      <Modal isOpen={!!pdfBlobUrl} onClose={closePdfModal} title="Receita" maxWidth="max-w-4xl">
        <div className="space-y-4">
          <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: '70vh' }}>
            <iframe src={pdfBlobUrl} width="100%" height="100%" title="PDF Receita" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closePdfModal} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Fechar
            </button>
            <button type="button" onClick={handlePrintPdf} className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
              <FiPrinter size={16} /> Imprimir
            </button>
          </div>
        </div>
      </Modal>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((r) => {
          const calc = calcRecipe(r)
          return (
            <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{r.name}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1"><FiClock size={13} /> {Math.floor(r.prepTime / 60)}h{r.prepTime % 60 > 0 ? `${r.prepTime % 60}min` : ''}</span>
                    <span>{(r.items || []).length} materiais</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-2">
                  <button onClick={() => printRecipe(r)} className="p-3 bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 rounded-lg transition-colors">
                    <FiPrinter size={20} />
                  </button>
                  <button onClick={() => startEdit(r)} className="p-3 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    <FiEdit2 size={20} />
                  </button>
                  <button onClick={() => setDeleteId(r.id)} className="p-3 bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors">
                    <FiTrash2 size={20} />
                  </button>
                </div>
              </div>

              {/* Custo */}
              <div className="mt-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400">Custo Total</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white">{BRL(calc.totalCost)}</p>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-6 py-8 text-center text-gray-400">
            {appliedSearch ? 'Nenhuma receita encontrada' : 'Nenhuma receita cadastrada'}
          </div>
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Receita</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tempo</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Custo</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((r) => {
              const calc = calcRecipe(r)
              return (
                <tr key={r.id}>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{r.name}</td>
                  <td className="px-6 py-4 text-sm text-center text-gray-500 dark:text-gray-400">
                    {Math.floor(r.prepTime / 60)}h{r.prepTime % 60 > 0 ? `${r.prepTime % 60}min` : ''}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white font-medium">{BRL(calc.totalCost)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => printRecipe(r)}
                        className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 rounded-lg transition-colors"
                        title="Imprimir"
                      >
                        <FiPrinter size={15} />
                      </button>
                      <button
                        onClick={() => startEdit(r)}
                        className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <FiEdit2 size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteId(r.id)}
                        className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors"
                        title="Remover"
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-400">
            {appliedSearch ? 'Nenhuma receita encontrada' : 'Nenhuma receita cadastrada'}
          </div>
        )}
      </div>
    </div>
  )
}
