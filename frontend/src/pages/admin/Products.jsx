import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiFileText, FiImage, FiPaperclip, FiBookOpen } from 'react-icons/fi'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import ImageUpload from '../../components/ImageUpload.jsx'

const BRL = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtCode = (id) => String(id).padStart(5, '0')

function formatBRL(value) {
  const num = String(value).replace(/\D/g, '')
  const cents = (Number(num) / 100).toFixed(2)
  return Number(cents).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseBRL(formatted) {
  const num = String(formatted).replace(/\./g, '').replace(',', '.')
  return parseFloat(num) || 0
}

function parseUnitQty(unit) {
  if (!unit) return 1
  const match = unit.match(/^(\d+(?:[.,]\d+)?)/)
  return match ? parseFloat(match[1].replace(',', '.')) : 1
}

function calcRecipeCost(recipe) {
  if (!recipe) return null
  const materialCost = (recipe.items || []).reduce((sum, i) => {
    const baseQty = parseUnitQty(i.material?.unit)
    return sum + (Number(i.quantity) / baseQty) * Number(i.material?.basePrice || 0)
  }, 0)
  return materialCost
}

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', price: '', categoryId: '', image: null, minOrder: 1, maxOrder: 500, allowInspirationImages: false, inspirationInstruction: '', maxInspirationImages: 3, recipeId: '' })
  const [editingId, setEditingId] = useState(null)
  const [formTab, setFormTab] = useState('descricao')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [prodRes, catRes, recRes] = await Promise.all([api.get('/products'), api.get('/categories'), api.get('/recipes')])
      setProducts(prodRes.data)
      setCategories(catRes.data)
      setRecipes(recRes.data.filter((r) => r.active))
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditingId(null)
    setForm({ name: '', description: '', price: '', categoryId: '', image: null, minOrder: 1, maxOrder: 500, allowInspirationImages: false, inspirationInstruction: '', maxInspirationImages: 3, recipeId: '' })
    setFormTab('descricao')
    setShowModal(true)
  }

  function startEdit(product) {
    setForm({
      name: product.name,
      description: product.description || '',
      price: Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      categoryId: product.categoryId,
      image: product.imageUrl || null,
      minOrder: product.minOrder || 1,
      maxOrder: product.maxOrder || 500,
      allowInspirationImages: product.allowInspirationImages || false,
      inspirationInstruction: product.inspirationInstruction || '',
      maxInspirationImages: product.maxInspirationImages || 3,
      recipeId: product.recipeId ? String(product.recipeId) : '',
    })
    setEditingId(product.id)
    setShowModal(true)
  }

  function closeModal() {
    setEditingId(null)
    setForm({ name: '', description: '', price: '', categoryId: '', image: null, minOrder: 1, maxOrder: 500, allowInspirationImages: false, inspirationInstruction: '', maxInspirationImages: 3, recipeId: '' })
    setFormTab('descricao')
    setShowModal(false)
  }

  async function uploadImage(blob) {
    const formData = new FormData()
    formData.append('file', blob, 'product.webp')
    const res = await api.post('/uploads?folder=produtos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.url
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.categoryId) {
      return toast.error('Selecione uma categoria')
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
        price: parseBRL(form.price),
        categoryId: Number(form.categoryId),
        imageUrl,
        minOrder: Number(form.minOrder) || 1,
        maxOrder: Number(form.maxOrder) || 500,
        allowInspirationImages: form.allowInspirationImages,
        inspirationInstruction: form.inspirationInstruction || null,
        maxInspirationImages: Number(form.maxInspirationImages) || 3,
        recipeId: form.recipeId ? Number(form.recipeId) : null,
      }

      if (editingId) {
        await api.put(`/products/${editingId}`, payload)
        toast.success('Produto atualizado!')
        closeModal()
      } else {
        await api.post('/products', payload)
        toast.success('Produto criado!')
        setForm({ name: '', description: '', price: '', categoryId: '', image: null, minOrder: 1, maxOrder: 500, allowInspirationImages: false, inspirationInstruction: '', maxInspirationImages: 3, recipeId: '' })
        setFormTab('descricao')
      }
      loadData()
    } catch {
      toast.error('Erro ao salvar produto')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/products/${deleteId}`)
      toast.success('Produto removido!')
      setDeleteId(null)
      loadData()
    } catch {
      toast.error('Erro ao remover produto')
    }
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  const inputClass = 'w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white'
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Produtos</h1>
        <button
          onClick={openNew}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <FiPlus size={18} /> Novo Produto
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <FiSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome do produto..."
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-base md:text-sm text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-base md:text-sm text-gray-900 dark:text-white"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editingId ? 'Editar Produto' : 'Novo Produto'} maxWidth="max-w-lg">
        {/* Abas */}
        <div className="flex border-b border-gray-200 dark:border-gray-600 mb-5 -mt-2">
          {[
            { key: 'descricao', label: 'Descrição', icon: <FiFileText size={15} /> },
            { key: 'imagem', label: 'Imagem', icon: <FiImage size={15} /> },
            { key: 'anexos', label: 'Anexos', icon: <FiPaperclip size={15} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFormTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                formTab === tab.key
                  ? 'border-green-500 text-green-600 dark:text-green-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Aba Descrição */}
          {formTab === 'descricao' && (
            <>
              <div>
                <label className={labelClass}>Nome</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Nome do produto" required />
              </div>
              <div>
                <label className={labelClass}>Categoria</label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={inputClass} required>
                  <option value="">Selecione a categoria</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Preço</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">R$</span>
                    <input type="text" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: formatBRL(e.target.value) })} className={`${inputClass} pl-10`} placeholder="0,00" required />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Pedido mínimo</label>
                  <input type="number" min="1" max="10000" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: Math.min(10000, Math.max(1, Number(e.target.value) || 1)) })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Pedido máximo</label>
                  <input type="number" min="1" max="10000" value={form.maxOrder} onChange={(e) => setForm({ ...form, maxOrder: Math.min(10000, Math.max(1, Number(e.target.value) || 1)) })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Receita de Produção + Serviço</label>
                <select value={form.recipeId} onChange={(e) => setForm({ ...form, recipeId: e.target.value })} className={inputClass}>
                  <option value="">Nenhuma receita vinculada</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Vincule uma receita para calcular custo de produção e margem de lucro</p>
              </div>
              <div>
                <label className={labelClass}>Descrição</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} rows={3} placeholder="Descrição do produto" />
              </div>
            </>
          )}

          {/* Aba Imagem */}
          {formTab === 'imagem' && (
            <div>
              <label className={labelClass}>Imagem do Produto</label>
              <ImageUpload value={form.image} onChange={(img) => setForm({ ...form, image: img })} />
            </div>
          )}

          {/* Aba Anexos */}
          {formTab === 'anexos' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Imagens de inspiração</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Permitir que o cliente envie imagens de referência ao pedir este produto</p>
                </div>
                <div
                  onClick={() => setForm({ ...form, allowInspirationImages: !form.allowInspirationImages })}
                  className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${form.allowInspirationImages ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.allowInspirationImages ? 'translate-x-5' : ''}`} />
                </div>
              </div>

              {form.allowInspirationImages && (
                <>
                  <div>
                    <label className={labelClass}>Máximo de imagens</label>
                    <select value={form.maxInspirationImages} onChange={(e) => setForm({ ...form, maxInspirationImages: Number(e.target.value) })} className={inputClass}>
                      <option value={1}>1 imagem</option>
                      <option value={2}>2 imagens</option>
                      <option value={3}>3 imagens</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Instruções para o cliente</label>
                    <textarea
                      value={form.inspirationInstruction}
                      onChange={(e) => setForm({ ...form, inspirationInstruction: e.target.value })}
                      className={inputClass}
                      rows={3}
                      placeholder="Ex: Envie fotos do modelo de bolo desejado, decoração ou tema da festa..."
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Essa instrução será exibida ao cliente pelo agente IA durante o pedido</p>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={closeModal} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Salvando...' : editingId ? <><FiEdit2 size={16} /> Atualizar</> : <><FiPlus size={16} /> Criar</>}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Remover Produto"
        message="Tem certeza que deseja remover este produto? Esta ação não pode ser desfeita."
        confirmText="Remover"
      />

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {products.filter((p) => {
          if (search.trim() && !(p.name || '').toLowerCase().includes(search.toLowerCase())) return false
          if (filterCategory && p.categoryId !== Number(filterCategory)) return false
          return true
        }).map((p) => (
          <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
            <div className="flex items-start gap-3">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-sm shrink-0">Sem</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Cód. {fmtCode(p.id)}</p>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{p.name}</h3>
                    <p className="text-base text-gray-500 dark:text-gray-400">{p.category?.name}</p>
                  </div>
                  <span className={`shrink-0 ml-2 px-2 py-0.5 text-xs rounded-full ${p.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => startEdit(p)} className="p-3 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors">
                <FiEdit2 size={20} />
              </button>
              <button onClick={() => setDeleteId(p.id)} className="p-3 bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors">
                <FiTrash2 size={20} />
              </button>
            </div>
          </div>
        ))}
        {products.filter((p) => {
          if (search.trim() && !(p.name || '').toLowerCase().includes(search.toLowerCase())) return false
          if (filterCategory && p.categoryId !== Number(filterCategory)) return false
          return true
        }).length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-6 py-8 text-center text-gray-400">Nenhum produto encontrado</div>
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cód.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Imagem</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Categoria</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Preço</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lucro</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {products.filter((p) => {
              if (search.trim() && !(p.name || '').toLowerCase().includes(search.toLowerCase())) return false
              if (filterCategory && p.categoryId !== Number(filterCategory)) return false
              return true
            }).map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-4 text-sm text-gray-400 dark:text-gray-500">{fmtCode(p.id)}</td>
                <td className="px-6 py-4">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-xs">Sem</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{p.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{p.category?.name}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td className="px-6 py-4 text-sm text-right font-medium">
                  {(() => {
                    const cost = calcRecipeCost(p.recipe)
                    if (cost === null) return <span className="text-gray-400">-</span>
                    const profit = Number(p.price) - cost
                    return (
                      <span className={profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {BRL(profit)}
                      </span>
                    )
                  })()}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${p.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => startEdit(p)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm">
                      <FiEdit2 size={15} /> Editar
                    </button>
                    <button onClick={() => setDeleteId(p.id)} className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors">
                      <FiTrash2 size={15} />
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
