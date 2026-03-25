import { useState, useEffect, useRef } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiMenu } from 'react-icons/fi'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import ImageUpload from '../../components/ImageUpload.jsx'

function formatBRL(value) {
  const num = String(value).replace(/\D/g, '')
  const cents = (Number(num) / 100).toFixed(2)
  return Number(cents).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseBRL(formatted) {
  const num = String(formatted).replace(/\./g, '').replace(',', '.')
  return parseFloat(num) || 0
}

function toBRL(value) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function AdminCombos() {
  const [combos, setCombos] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', discount: '', image: null })
  const [selectedItems, setSelectedItems] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [search, setSearch] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [comboRes, prodRes] = await Promise.all([api.get('/combos'), api.get('/products')])
      setCombos(comboRes.data)
      setProducts(prodRes.data.filter((p) => p.active))
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditingId(null)
    setForm({ name: '', description: '', discount: '', image: null })
    setSelectedItems([])
    setShowModal(true)
  }

  function startEdit(combo) {
    setForm({
      name: combo.name,
      description: combo.description || '',
      discount: toBRL(combo.discount),
      image: combo.imageUrl || null,
    })
    setSelectedItems(combo.items.map((i) => ({ productId: i.productId, quantity: i.quantity })))
    setEditingId(combo.id)
    setShowModal(true)
  }

  function closeModal() {
    setEditingId(null)
    setForm({ name: '', description: '', discount: '', image: null })
    setSelectedItems([])
    setShowModal(false)
  }

  function addProduct(productId) {
    if (selectedItems.find((i) => i.productId === Number(productId))) return
    setSelectedItems([...selectedItems, { productId: Number(productId), quantity: 1 }])
    setShowProductPicker(false)
    setProductSearch('')
  }

  function removeProduct(productId) {
    setSelectedItems(selectedItems.filter((i) => i.productId !== productId))
  }

  function updateQuantity(productId, quantity) {
    setSelectedItems(selectedItems.map((i) => i.productId === productId ? { ...i, quantity: Math.max(1, Number(quantity)) } : i))
  }

  function getProduct(productId) {
    return products.find((p) => p.id === productId)
  }

  function handleDragStart(index) {
    dragItem.current = index
  }

  function handleDragEnter(index) {
    dragOverItem.current = index
  }

  function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) return
    const items = [...selectedItems]
    const draggedItem = items[dragItem.current]
    items.splice(dragItem.current, 1)
    items.splice(dragOverItem.current, 0, draggedItem)
    setSelectedItems(items)
    dragItem.current = null
    dragOverItem.current = null
  }

  const totalProducts = selectedItems.reduce((sum, i) => {
    const p = getProduct(i.productId)
    return sum + (p ? Number(p.price) * i.quantity : 0)
  }, 0)

  const discountValue = parseBRL(form.discount)
  const finalPrice = Math.max(0, totalProducts - discountValue)

  async function uploadImage(blob) {
    const formData = new FormData()
    formData.append('file', blob, 'combo.webp')
    const res = await api.post('/uploads?folder=combos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.url
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (selectedItems.length < 2) {
      toast.error('Adicione pelo menos 2 produtos ao combo')
      return
    }
    setSaving(true)
    try {
      let imageUrl = null
      if (form.image instanceof Blob) {
        imageUrl = await uploadImage(form.image)
      } else if (typeof form.image === 'string') {
        imageUrl = form.image
      }

      const payload = {
        name: form.name,
        description: form.description,
        discount: discountValue,
        imageUrl,
        items: selectedItems,
      }

      if (editingId) {
        await api.put(`/combos/${editingId}`, payload)
        toast.success('Combo atualizado!')
      } else {
        await api.post('/combos', payload)
        toast.success('Combo criado!')
      }
      closeModal()
      loadData()
    } catch {
      toast.error('Erro ao salvar combo')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/combos/${deleteId}`)
      toast.success('Combo removido!')
      setDeleteId(null)
      loadData()
    } catch {
      toast.error('Erro ao remover combo')
    }
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  const inputClass = 'w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white'
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  const availableProducts = products.filter((p) => !selectedItems.find((i) => i.productId === p.id))

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Combos</h1>
        <button onClick={openNew} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2">
          <FiPlus size={18} /> Novo Combo
        </button>
      </div>

      <div className="relative mb-6">
        <FiSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome do combo..."
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-base md:text-sm text-gray-900 dark:text-white placeholder-gray-400"
        />
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editingId ? 'Editar Combo' : 'Novo Combo'} maxWidth="max-w-2xl" maxHeight="600px" footer={
        <div className="flex justify-end gap-3">
          <button type="button" onClick={closeModal} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button type="submit" form="combo-form" disabled={saving} className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Salvando...' : editingId ? <><FiEdit2 size={16} /> Atualizar</> : <><FiPlus size={16} /> Criar</>}
          </button>
        </div>
      }>
        <form id="combo-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nome do Combo</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Ex: Kit Festa Completo" required />
          </div>

          <div>
            <label className={labelClass}>Imagem do Combo</label>
            <ImageUpload value={form.image} onChange={(img) => setForm({ ...form, image: img })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass + ' mb-0'}>Produtos do Combo</label>
              <button
                type="button"
                onClick={() => { setProductSearch(''); setShowProductPicker(true) }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FiPlus size={13} /> Adicionar Produto
              </button>
            </div>

            {selectedItems.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedItems.map((item, index) => {
                  const p = getProduct(item.productId)
                  if (!p) return null
                  return (
                    <div
                      key={item.productId}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-default select-none"
                    >
                      <div className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
                        <FiMenu size={15} />
                      </div>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-9 h-9 rounded-lg object-cover" draggable={false} />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-600" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">R$ {toBRL(p.price)} un.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 dark:text-gray-400">Qtd:</label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.productId, e.target.value)}
                          className="w-16 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white w-24 text-right">
                        R$ {toBRL(Number(p.price) * item.quantity)}
                      </p>
                      <button type="button" onClick={() => removeProduct(item.productId)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                        <FiX size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {selectedItems.length < 2 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Adicione pelo menos 2 produtos ao combo</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Desconto</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">R$</span>
                <input type="text" inputMode="numeric" value={form.discount} onChange={(e) => setForm({ ...form, discount: formatBRL(e.target.value) })} className={`${inputClass} pl-10`} placeholder="0,00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Preço Final</label>
              <div className="px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <span className="text-lg font-bold text-green-700 dark:text-green-400">R$ {toBRL(finalPrice)}</span>
                {discountValue > 0 && totalProducts > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 line-through">R$ {toBRL(totalProducts)}</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Descrição</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} rows={3} placeholder="Descrição do combo" />
          </div>

        </form>
      </Modal>

      {/* Modal de seleção de produtos */}
      {showProductPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowProductPicker(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col" style={{ maxHeight: '480px' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600 shrink-0">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Adicionar Produto</h3>
              <button onClick={() => setShowProductPicker(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg">
                <FiX size={18} />
              </button>
            </div>
            <div className="px-4 pt-4 pb-2 shrink-0">
              <div className="relative">
                <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Pesquisar produto..."
                  autoFocus
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white text-sm placeholder-gray-400"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-4 pb-4">
              {availableProducts
                .filter((p) => !productSearch.trim() || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors text-left"
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{p.category?.name}</p>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white shrink-0">R$ {toBRL(p.price)}</span>
                  </button>
                ))
              }
              {availableProducts.filter((p) => !productSearch.trim() || p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum produto encontrado</p>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Remover Combo"
        message="Tem certeza que deseja remover este combo? Esta ação não pode ser desfeita."
        confirmText="Remover"
      />

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {combos.filter((c) => {
          if (search.trim() && !(c.name || '').toLowerCase().includes(search.toLowerCase())) return false
          return true
        }).map((c) => (
          <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
            <div className="flex items-start gap-3">
              {c.imageUrl ? (
                <img src={c.imageUrl} alt={c.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-sm shrink-0">Sem</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{c.name}</h3>
                  <span className={`shrink-0 ml-2 px-2 py-0.5 text-xs rounded-full ${c.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                    {c.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.items.map((i) => (
                    <span key={i.id} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                      {i.quantity > 1 ? `${i.quantity}x ` : ''}{i.product.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="space-y-0.5">
                <p className="text-base text-gray-500 dark:text-gray-400">Total: R$ {toBRL(c.totalProducts)} <span className="text-red-500">-R$ {toBRL(c.discount)}</span></p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">R$ {toBRL(c.finalPrice)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(c)} className="p-3 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors">
                  <FiEdit2 size={20} />
                </button>
                <button onClick={() => setDeleteId(c.id)} className="p-3 bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors">
                  <FiTrash2 size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {combos.filter((c) => {
          if (search.trim() && !(c.name || '').toLowerCase().includes(search.toLowerCase())) return false
          return true
        }).length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-6 py-8 text-center text-gray-400">Nenhum combo encontrado</div>
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Imagem</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produtos</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Desconto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Preço Final</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {combos.filter((c) => {
              if (search.trim() && !(c.name || '').toLowerCase().includes(search.toLowerCase())) return false
              return true
            }).map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-4">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt={c.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-xs">Sem</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{c.name}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {c.items.map((i) => (
                      <span key={i.id} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                        {i.quantity > 1 ? `${i.quantity}x ` : ''}{i.product.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">R$ {toBRL(c.totalProducts)}</td>
                <td className="px-6 py-4 text-sm text-red-500">-R$ {toBRL(c.discount)}</td>
                <td className="px-6 py-4 text-sm font-medium text-green-600 dark:text-green-400">R$ {toBRL(c.finalPrice)}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${c.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                    {c.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => startEdit(c)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm">
                      <FiEdit2 size={15} /> Editar
                    </button>
                    <button onClick={() => setDeleteId(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors text-sm">
                      <FiTrash2 size={15} /> Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
