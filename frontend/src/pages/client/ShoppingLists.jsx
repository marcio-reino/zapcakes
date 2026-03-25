import { useState, useEffect, useRef } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiCopy, FiCheck, FiX, FiShoppingCart, FiArrowLeft, FiLock, FiUnlock, FiFileText, FiSearch, FiPackage, FiDollarSign, FiRefreshCw, FiClock } from 'react-icons/fi'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import DatePicker from '../../components/DatePicker.jsx'
import jsPDF from 'jspdf'

const BRL = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function ShoppingLists() {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeList, setActiveList] = useState(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [materials, setMaterials] = useState([])
  const [materialSearch, setMaterialSearch] = useState('')
  const [selectedMaterials, setSelectedMaterials] = useState([])
  const [listSearch, setListSearch] = useState('')
  const [appliedListSearch, setAppliedListSearch] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [duplicateId, setDuplicateId] = useState(null)
  const [renameList, setRenameList] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [checkItem, setCheckItem] = useState(null)
  const [checkPrice, setCheckPrice] = useState('')
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [showStockConfirm, setShowStockConfirm] = useState(false)
  const [savingStock, setSavingStock] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [discountValue, setDiscountValue] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)
  const [showReopening, setShowReopening] = useState(false)
  const priceRefs = useRef({})

  useEffect(() => { loadLists() }, [])

  async function loadLists() {
    try {
      const { data } = await api.get('/shopping-lists')
      setLists(data)
    } catch {
      toast.error('Erro ao carregar listas')
    } finally {
      setLoading(false)
    }
  }

  async function loadList(id) {
    try {
      const { data } = await api.get(`/shopping-lists/${id}`)
      setActiveList(data)
    } catch {
      toast.error('Erro ao carregar lista')
    }
  }

  async function loadMaterials() {
    try {
      const { data } = await api.get('/materials')
      setMaterials(data.filter((m) => m.active))
    } catch {
      toast.error('Erro ao carregar materiais')
    }
  }

  async function handleCreateList(e) {
    e.preventDefault()
    try {
      const { data } = await api.post('/shopping-lists', { name: newName || undefined })
      toast.success('Lista criada!')
      setShowNewModal(false)
      setNewName('')
      loadLists()
      setActiveList(data)
    } catch {
      toast.error('Erro ao criar lista')
    }
  }

  async function handleDeleteList() {
    try {
      await api.delete(`/shopping-lists/${deleteId}`)
      toast.success('Lista removida!')
      setDeleteId(null)
      if (activeList?.id === deleteId) setActiveList(null)
      loadLists()
    } catch {
      toast.error('Erro ao remover lista')
    }
  }

  async function handleRenameList(e) {
    e.preventDefault()
    if (!renameName.trim()) return
    try {
      await api.put(`/shopping-lists/${renameList}`, { name: renameName })
      toast.success('Lista renomeada!')
      setRenameList(null)
      setRenameName('')
      loadLists()
    } catch {
      toast.error('Erro ao renomear lista')
    }
  }

  async function confirmDuplicate() {
    try {
      const { data } = await api.post(`/shopping-lists/${duplicateId}/duplicate`)
      toast.success('Lista duplicada!')
      setDuplicateId(null)
      loadLists()
      setActiveList(data)
    } catch {
      toast.error('Erro ao duplicar lista')
    }
  }

  async function toggleStatus() {
    if (!activeList) return
    if (activeList.status === 'OPEN') {
      try {
        const { data } = await api.put(`/shopping-lists/${activeList.id}`, { status: 'CLOSED' })
        setActiveList(data)
        loadLists()
        toast.success('Lista fechada! Preços base atualizados.')
      } catch {
        toast.error('Erro ao alterar status')
      }
    } else {
      setShowReopenConfirm(true)
    }
  }

  async function handleReopen() {
    if (!activeList) return
    setShowReopenConfirm(false)
    setShowReopening(true)
    try {
      await api.post('/materials/stock-revert-list', { shoppingListId: activeList.id })
      const { data } = await api.get(`/shopping-lists/${activeList.id}`)
      setActiveList(data)
      loadLists()
      setTimeout(() => setShowReopening(false), 1000)
    } catch {
      setShowReopening(false)
      toast.error('Erro ao reabrir lista')
    }
  }

  async function handleUpdateName() {
    if (!editName.trim()) return
    try {
      const { data } = await api.put(`/shopping-lists/${activeList.id}`, { name: editName })
      setActiveList(data)
      setEditingName(false)
      loadLists()
    } catch {
      toast.error('Erro ao renomear')
    }
  }

  // --- Itens ---

  function openAddMaterial() {
    loadMaterials()
    setSelectedMaterials([])
    setMaterialSearch('')
    setShowAddMaterial(true)
  }

  async function handleAddMaterials() {
    if (selectedMaterials.length === 0) return
    try {
      const { data } = await api.post(`/shopping-lists/${activeList.id}/items/batch`, {
        items: selectedMaterials.map((id) => ({ materialId: id, quantity: 1 })),
      })
      setActiveList(data)
      setShowAddMaterial(false)
      toast.success('Materiais adicionados!')
    } catch {
      toast.error('Erro ao adicionar materiais')
    }
  }

  async function handleUpdateItem(itemId, field, value) {
    try {
      await api.put(`/shopping-lists/${activeList.id}/items/${itemId}`, { [field]: value })
      loadList(activeList.id)
    } catch {
      toast.error('Erro ao atualizar item')
    }
  }

  async function handleRemoveItem(itemId) {
    try {
      await api.delete(`/shopping-lists/${activeList.id}/items/${itemId}`)
      loadList(activeList.id)
      toast.success('Item removido!')
    } catch {
      toast.error('Erro ao remover item')
    }
  }

  function handlePriceBlur(itemId, value) {
    const parsed = parseFloat(value)
    if (!isNaN(parsed) && parsed >= 0) {
      handleUpdateItem(itemId, 'actualPrice', parsed)
    } else if (value === '') {
      handleUpdateItem(itemId, 'actualPrice', null)
    }
  }

  function handlePriceKeyDown(e, itemId, index) {
    if (e.key === 'Enter') {
      e.target.blur()
      // Foca no próximo campo de preço
      const nextIndex = index + 1
      const nextRef = priceRefs.current[nextIndex]
      if (nextRef) {
        setTimeout(() => nextRef.focus(), 100)
      }
    }
  }

  // --- Totais ---

  function calcTotals(items) {
    let baseTotal = 0
    let actualTotal = 0
    let hasActual = false
    for (const item of items || []) {
      const qty = Number(item.quantity)
      baseTotal += Number(item.material.basePrice) * qty
      if (item.actualPrice != null) {
        actualTotal += Number(item.actualPrice) * qty
        hasActual = true
      }
    }
    const diff = hasActual ? actualTotal - baseTotal : 0
    return { baseTotal, actualTotal, diff, hasActual }
  }

  // --- PDF ---

  async function handleAddToStock() {
    if (!activeList) return
    setSavingStock(true)
    try {
      await api.post('/materials/stock-from-list', { shoppingListId: activeList.id })
      setShowStockConfirm(false)
      setShowSuccess(true)
      loadList(activeList.id)
      loadLists()
    } catch {
      toast.error('Erro ao inserir no estoque')
    } finally {
      setSavingStock(false)
    }
  }

  function buildPDF() {
    if (!activeList) return null
    const doc = new jsPDF()
    const items = activeList.items || []
    const { baseTotal, actualTotal, diff, hasActual } = calcTotals(items)

    doc.setFontSize(16)
    doc.text(activeList.name, 14, 20)
    doc.setFontSize(10)
    doc.text(`Status: ${activeList.status === 'OPEN' ? 'Aberta' : 'Fechada'}`, 14, 28)
    doc.text(`Data: ${new Date(activeList.createdAt).toLocaleDateString('pt-BR')}`, 14, 34)

    // Cabeçalho tabela
    let y = 44
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text('Cód.', 14, y)
    doc.text('Material', 30, y)
    doc.text('Unid.', 82, y)
    doc.text('Marca', 100, y)
    doc.text('Qtd', 130, y)
    doc.text('P. Base', 148, y)
    doc.text('P. Atual', 174, y)
    doc.line(14, y + 2, 196, y + 2)
    y += 8

    doc.setFont(undefined, 'normal')
    for (const item of items) {
      if (y > 270) {
        doc.addPage()
        y = 20
      }
      doc.text(String(item.material.id).padStart(5, '0'), 14, y)
      doc.text(item.material.name.substring(0, 25), 30, y)
      doc.text(item.material.unit || '-', 82, y)
      doc.text(item.material.brand || '-', 100, y)
      doc.text(String(Number(item.quantity)), 130, y)
      doc.text(BRL(item.material.basePrice), 148, y)
      doc.text(item.actualPrice != null ? BRL(item.actualPrice) : '___________', 174, y)
      y += 7
    }

    // Totais
    y += 5
    doc.line(14, y, 196, y)
    y += 7
    doc.setFont(undefined, 'bold')
    doc.text(`Total Base: ${BRL(baseTotal)}`, 14, y)
    if (hasActual) {
      doc.text(`Total Atual: ${BRL(actualTotal)}`, 100, y)
      y += 7
      const diffText = diff >= 0 ? `+${BRL(diff)}` : `-${BRL(Math.abs(diff))}`
      doc.text(`Diferença: ${diffText}`, 14, y)
    }

    return doc
  }

  function generatePDF() {
    const doc = buildPDF()
    if (!doc) return

    const isDesktop = window.innerWidth >= 768
    if (isDesktop) {
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      setPdfBlobUrl(url)
    } else {
      doc.save(`${activeList.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
      toast.success('PDF gerado!')
    }
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

  // --- Render ---

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  // Vista de detalhe da lista
  if (activeList) {
    const items = activeList.items || []
    const { baseTotal, actualTotal, diff, hasActual } = calcTotals(items)
    const isClosed = activeList.status === 'CLOSED'

    return (
      <div>
        {/* Header */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { setActiveList(null); loadLists() }} className="p-2.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
              <FiArrowLeft size={20} />
            </button>
            {editingName ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-lg"
                  autoFocus onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
                />
                <button onClick={handleUpdateName} className="p-2 text-green-600"><FiCheck size={20} /></button>
                <button onClick={() => setEditingName(false)} className="p-2 text-gray-400"><FiX size={20} /></button>
              </div>
            ) : (
              <h1
                className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white flex-1 cursor-pointer"
                onClick={() => { setEditName(activeList.name); setEditingName(true) }}
              >
                {activeList.name}
              </h1>
            )}
          </div>

          {/* Botões */}
          <div className="flex flex-wrap gap-2 justify-end">
            {!isClosed && (
              <button onClick={openAddMaterial} className="flex items-center gap-2 px-4 py-2.5 md:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-base md:text-sm">
                <FiPlus size={16} /> Adicionar
              </button>
            )}
            <button onClick={toggleStatus} className={`flex items-center gap-2 px-4 py-2.5 md:py-2 rounded-lg text-base md:text-sm ${isClosed ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
              {isClosed ? <><FiUnlock size={16} /> Reabrir</> : <><FiLock size={16} /> Fechar Lista</>}
            </button>
            <button onClick={generatePDF} className="flex items-center gap-2 px-4 py-2.5 md:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-base md:text-sm">
              <FiFileText size={16} /> PDF
            </button>
            <button onClick={() => loadList(activeList.id)} className="flex items-center gap-2 px-4 py-2.5 md:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-base md:text-sm">
              <FiRefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Resumo de economia */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 md:p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Itens</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{items.filter((i) => i.checked).length} de {items.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 md:p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Base</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{BRL(baseTotal)}</p>
          </div>
          {hasActual && (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 md:p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Atual</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{BRL(actualTotal)}</p>
              </div>
              <div className={`rounded-xl shadow-sm p-3 md:p-4 ${diff <= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400">{diff <= 0 ? 'Economia' : 'Gasto Extra'}</p>
                <p className={`text-xl font-bold ${diff <= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {BRL(Math.abs(diff))}
                </p>
              </div>
            </>
          )}
          {Number(activeList.discount) > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl shadow-sm p-3 md:p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Desconto no Caixa</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{BRL(activeList.discount)}</p>
            </div>
          )}
        </div>

        {/* Pesquisa de itens */}
        {items.length > 0 && (
          <div className="mb-3">
            <input
              type="text"
              placeholder="Pesquisar por código, referência ou nome..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="w-full px-4 py-3 md:py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-base md:text-sm"
            />
          </div>
        )}

        {/* Itens */}
        <div className="space-y-2">
          {items.filter((item) => {
            if (!itemSearch.trim()) return true
            const q = normalize(itemSearch.trim())
            const code = String(item.material.id).padStart(5, '0')
            return (
              code.includes(q) ||
              normalize(item.material.name).includes(q) ||
              (item.material.refCode && normalize(item.material.refCode).includes(q))
            )
          }).map((item, index) => {
            const base = Number(item.material.basePrice)
            const actual = item.actualPrice != null ? Number(item.actualPrice) : null
            const priceDiff = actual != null ? actual - base : null
            const diffColor = priceDiff == null ? '' : priceDiff < 0 ? 'border-l-green-500' : priceDiff > 0 ? 'border-l-red-500' : 'border-l-gray-400'

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 md:p-4 border-l-4 ${diffColor} ${item.checked ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap gap-x-2 text-xs text-gray-400 dark:text-gray-500">
                          <span>{String(item.material.id).padStart(5, '0')}</span>
                          {item.material.refCode && <span>• Ref: {item.material.refCode}</span>}
                        </div>
                        <h4 className={`text-base md:text-sm font-medium text-gray-900 dark:text-white ${item.checked ? 'line-through' : ''}`}>
                          {item.material.name}
                        </h4>
                        <div className="flex flex-wrap gap-x-2 text-sm text-gray-500 dark:text-gray-400">
                          {item.material.unit && <span>{item.material.unit}</span>}
                          {item.material.brand && <span>• {item.material.brand}</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs">
                          <span className="text-gray-400">Base: {BRL(base)}</span>
                          {actual != null && <span className="text-gray-400">• Atual: <span className="font-semibold text-gray-600 dark:text-gray-300">{BRL(actual)}</span></span>}
                          {priceDiff != null && priceDiff !== 0 && (
                            <span className={`font-semibold px-1.5 py-0.5 rounded ${priceDiff < 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {priceDiff > 0 ? '+' : '-'}{BRL(Math.abs(priceDiff))}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {/* Botão carrinho */}
                        {isClosed && (
                          <button
                            disabled={activeList.stockInserted}
                            onClick={() => {
                              if (activeList.stockInserted) return
                              if (item.checked) {
                                handleUpdateItem(item.id, 'checked', false)
                              } else {
                                setCheckItem(item)
                                setCheckPrice(item.actualPrice != null ? Number(item.actualPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
                              }
                            }}
                            className={`px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors text-sm font-medium ${
                              activeList.stockInserted
                                ? 'bg-gray-300 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                : item.checked
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            <FiShoppingCart size={16} /> Check
                          </button>
                        )}
                        {!isClosed && (
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-2.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quantidade */}
                    <div className="flex justify-end items-center gap-1.5 mt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Qtd:</span>
                        {isClosed || item.checked ? (
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{Number(item.quantity)}</span>
                        ) : (
                          <input
                            type="number" min="1" step="1"
                            defaultValue={Number(item.quantity)}
                            onBlur={(e) => { const v = parseFloat(e.target.value); if (v >= 1) handleUpdateItem(item.id, 'quantity', v); else e.target.value = Number(item.quantity) }}
                            className="w-20 px-2 py-2 text-lg font-semibold border border-gray-200 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-center"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {items.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-6 py-8 text-center text-gray-400">
              Nenhum material na lista. Clique em "Adicionar" para começar.
            </div>
          )}
        </div>

        {/* Botões finais */}
        {items.length > 0 && isClosed && (
          <div className="mt-4 space-y-3">
            <button
              onClick={() => {
                setDiscountValue(activeList.discount ? Number(activeList.discount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
                setShowDiscount(true)
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors text-lg font-bold"
            >
              <FiDollarSign size={20} /> Desconto no Caixa
            </button>
          </div>
        )}

        {!isClosed && items.some((i) => i.checked) && (
          <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center flex-shrink-0">
              <FiLock className="text-blue-700 dark:text-blue-300" size={20} />
            </div>
            <p className="text-blue-700 dark:text-blue-400 font-medium">Feche a lista para inserir os itens no estoque</p>
          </div>
        )}

        {isClosed && !activeList.stockInserted && items.some((i) => i.checked) && (
          <div className="mt-4">
            <button
              onClick={() => setShowStockConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-lg font-bold"
            >
              <FiPackage size={20} /> Inserir no Estoque
            </button>
          </div>
        )}

        {activeList.stockInserted && (
          <div className="mt-4 bg-green-50 dark:bg-green-900/20 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center flex-shrink-0">
              <FiCheck className="text-green-700 dark:text-green-300" size={22} />
            </div>
            <p className="text-green-700 dark:text-green-400 font-medium">Os itens dessa lista foram inseridos no estoque</p>
          </div>
        )}

        <div style={{ height: 100 }} />

        <ConfirmModal
          isOpen={showStockConfirm}
          onClose={() => setShowStockConfirm(false)}
          onConfirm={handleAddToStock}
          title="Inserir no Estoque"
          message={`Deseja adicionar ao estoque as quantidades dos ${items.filter((i) => i.checked).length} itens marcados como comprados?\n\nEssa ação não poderá ser desfeita.`}
          confirmText={savingStock ? 'Inserindo...' : 'Confirmar'}
          confirmColor="bg-green-600 hover:bg-green-700"
        />

        <ConfirmModal
          isOpen={showReopenConfirm}
          onClose={() => setShowReopenConfirm(false)}
          onConfirm={handleReopen}
          title="Reabrir Lista"
          message={`Ao reabrir esta lista, todos os itens lançados no estoque serão removidos.\n\nEssa ação não poderá ser desfeita.`}
          confirmText="Reabrir"
          confirmColor="bg-orange-500 hover:bg-orange-600"
        />

        {/* Modal: Reativando */}
        <Modal isOpen={showReopening} onClose={() => {}} title="Reativando Lista">
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center animate-pulse">
              <FiClock className="text-orange-600 dark:text-orange-400" size={32} />
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">Reativando lista, aguarde um momento...</p>
          </div>
        </Modal>

        {/* Modal: Sucesso */}
        <Modal isOpen={showSuccess} onClose={() => setShowSuccess(false)} title="Compra Concluída">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <FiCheck className="text-green-600 dark:text-green-400" size={32} />
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">Parabéns! Sua compra foi concluída com sucesso!</p>
            {hasActual && diff < 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-6 py-5 w-full">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Você economizou</p>
                <p className="text-4xl font-extrabold text-green-600 dark:text-green-400">{BRL(Math.abs(diff) + Number(activeList.discount || 0))}</p>
              </div>
            )}
            <button
              onClick={() => { setShowSuccess(false); loadList(activeList.id) }}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-lg"
            >
              Fechar
            </button>
          </div>
        </Modal>

        {/* Modal: Adicionar Materiais */}
        <Modal isOpen={showAddMaterial} onClose={() => setShowAddMaterial(false)} title="Adicionar Materiais" alignTopMobile>
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
                .filter((m) => !(activeList.items || []).some((i) => i.material.id === m.id))
                .map((m) => {
                  const selected = selectedMaterials.includes(m.id)
                  return (
                    <button
                      key={m.id}
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
              <button onClick={() => setShowAddMaterial(false)} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={handleAddMaterials}
                disabled={selectedMaterials.length === 0}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FiPlus size={16} /> Adicionar ({selectedMaterials.length})
              </button>
            </div>
          </div>
        </Modal>

        {/* Modal: Desconto no Caixa */}
        <Modal isOpen={showDiscount} onClose={() => setShowDiscount(false)} title="Desconto no Caixa" alignTop>
          <form onSubmit={async (e) => {
            e.preventDefault()
            const value = parseFloat(discountValue.replace(/\./g, '').replace(',', '.'))
            try {
              const { data } = await api.put(`/shopping-lists/${activeList.id}`, {
                discount: !isNaN(value) && value >= 0 ? value : 0,
              })
              setActiveList(data)
              setShowDiscount(false)
              toast.success('Desconto salvo!')
            } catch {
              toast.error('Erro ao salvar desconto')
            }
          }} className="space-y-4">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{activeList?.name}</p>
            <div>
              <label className="block text-base md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor do Desconto</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-bold text-2xl">R$</span>
                <input
                  type="text" inputMode="numeric" placeholder="0,00"
                  value={discountValue}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '')
                    if (!digits) { setDiscountValue(''); return }
                    const cents = parseInt(digits, 10)
                    const formatted = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    setDiscountValue(formatted)
                  }}
                  className="w-full pl-16 pr-4 py-5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-3xl font-bold text-right"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowDiscount(false)} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2">
                <FiCheck size={16} /> Confirmar
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Confirmar Check com Preço */}
        <Modal isOpen={!!checkItem} onClose={() => setCheckItem(null)} title="Confirmar Compra" alignTop>
          {checkItem && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              const price = parseFloat(checkPrice.replace(/\./g, '').replace(',', '.'))
              try {
                await api.put(`/shopping-lists/${activeList.id}/items/${checkItem.id}`, {
                  checked: true,
                  actualPrice: !isNaN(price) && price >= 0 ? price : null,
                })
                loadList(activeList.id)
                setCheckItem(null)
                setCheckPrice('')
              } catch {
                toast.error('Erro ao atualizar item')
              }
            }} className="space-y-4">
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{checkItem.material.name}</p>
              <div>
                <label className="block text-base md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Atual</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-bold text-2xl">R$</span>
                  <input
                    type="text" inputMode="numeric" placeholder="0,00"
                    value={checkPrice}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      if (!digits) { setCheckPrice(''); return }
                      const cents = parseInt(digits, 10)
                      const formatted = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      setCheckPrice(formatted)
                    }}
                    className="w-full pl-16 pr-4 py-5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-3xl font-bold text-right"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setCheckItem(null)} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
                  <FiCheck size={16} /> Confirmar
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* Modal PDF Preview (desktop) */}
        <Modal isOpen={!!pdfBlobUrl} onClose={closePdfModal} title="Visualizar PDF" maxWidth="max-w-4xl">
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: '70vh' }}>
              <iframe src={pdfBlobUrl} width="100%" height="100%" title="PDF Preview" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closePdfModal} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Fechar
              </button>
              <button type="button" onClick={handlePrintPdf} className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
                <FiFileText size={16} /> Imprimir
              </button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // --- Lista de Listas ---
  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Listas de Compras</h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="bg-green-600 text-white px-4 py-2.5 md:py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-base md:text-sm"
        >
          <FiPlus size={18} /> Nova Lista
        </button>
      </div>

      {/* Modal Nova Lista */}
      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="Nova Lista de Compras">
        <form onSubmit={handleCreateList} className="space-y-4">
          <div>
            <label className="block text-base md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome (opcional)</label>
            <input
              type="text" placeholder={`Compras ${new Date().toLocaleDateString('pt-BR')}`}
              value={newName} onChange={(e) => setNewName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-base md:text-sm"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowNewModal(false)} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg">
              Cancelar
            </button>
            <button type="submit" className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
              <FiPlus size={16} /> Criar
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteList}
        title="Remover Lista"
        message="Tem certeza que deseja remover esta lista? Esta ação não pode ser desfeita."
        confirmText="Remover"
      />

      <Modal isOpen={!!renameList} onClose={() => setRenameList(null)} title="Renomear Lista">
        <form onSubmit={handleRenameList}>
          <label className="block text-base md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nome da lista</label>
          <input
            type="text" value={renameName} onChange={(e) => setRenameName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-base md:text-sm"
            required autoFocus
          />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setRenameList(null)} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
              <FiEdit2 size={16} /> Renomear
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!duplicateId}
        onClose={() => setDuplicateId(null)}
        onConfirm={confirmDuplicate}
        title="Duplicar Lista"
        message="Deseja criar uma cópia desta lista de compras?"
        confirmText="Duplicar"
        confirmColor="bg-green-600 hover:bg-green-700"
      />

      {/* Busca */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setAppliedListSearch(listSearch)}
          className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-base md:text-sm"
        />
        <DatePicker value={filterDate} onChange={setFilterDate} placeholder="Filtrar por data" />
        <button
          onClick={() => setAppliedListSearch(listSearch)}
          className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-base md:text-sm"
        >
          <FiSearch size={18} /> <span className="md:hidden">Pesquisar</span>
        </button>
      </div>

      {/* Cards de listas */}
      <div className="space-y-3">
        {lists.filter((l) => {
          if (appliedListSearch && !normalize(l.name).includes(normalize(appliedListSearch))) return false
          if (filterDate) {
            const listDate = new Date(l.createdAt).toISOString().slice(0, 10)
            if (listDate !== filterDate) return false
          }
          return true
        }).map((list) => (
          <div key={list.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadList(list.id)}>
                <div className="flex items-center gap-2">
                  <FiShoppingCart className="text-green-600 dark:text-green-400 flex-shrink-0" size={18} />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{list.name}</h3>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-base md:text-sm text-gray-500 dark:text-gray-400">
                  <span>{list._count?.items || 0} itens</span>
                  <span>• {new Date(list.createdAt).toLocaleDateString('pt-BR')}</span>
                  <span className={`font-medium ${list.status === 'OPEN' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    • {list.status === 'OPEN' ? 'Aberta' : 'Fechada'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 ml-2">
                <button onClick={() => { setRenameList(list.id); setRenameName(list.name) }} className="p-3 md:p-2 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors" title="Editar nome">
                  <FiEdit2 size={18} />
                </button>
                <button onClick={() => setDuplicateId(list.id)} className="p-3 md:p-2 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors" title="Duplicar">
                  <FiCopy size={18} />
                </button>
                <button onClick={() => setDeleteId(list.id)} className="p-3 md:p-2 bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors" title="Remover">
                  <FiTrash2 size={18} />
                </button>
              </div>
            </div>
            <button onClick={() => loadList(list.id)} className="md:hidden w-full mt-3 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-semibold text-lg flex items-center justify-center gap-2">
              <FiShoppingCart size={16} /> Abrir
            </button>
          </div>
        ))}
        {lists.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-6 py-8 text-center text-gray-400">
            Nenhuma lista de compras. Crie uma para começar!
          </div>
        )}
      </div>
    </div>
  )
}
