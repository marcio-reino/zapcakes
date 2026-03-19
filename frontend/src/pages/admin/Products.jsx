import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi'
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

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', price: '', categoryId: '', image: null })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [prodRes, catRes] = await Promise.all([api.get('/products'), api.get('/categories')])
      setProducts(prodRes.data)
      setCategories(catRes.data)
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditingId(null)
    setForm({ name: '', description: '', price: '', categoryId: '', image: null })
    setShowModal(true)
  }

  function startEdit(product) {
    setForm({
      name: product.name,
      description: product.description || '',
      price: Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      categoryId: product.categoryId,
      image: product.imageUrl || null,
    })
    setEditingId(product.id)
    setShowModal(true)
  }

  function closeModal() {
    setEditingId(null)
    setForm({ name: '', description: '', price: '', categoryId: '', image: null })
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
      }

      if (editingId) {
        await api.put(`/products/${editingId}`, payload)
        toast.success('Produto atualizado!')
      } else {
        await api.post('/products', payload)
        toast.success('Produto criado!')
      }
      closeModal()
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

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <FiSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome do produto..."
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm text-gray-900 dark:text-white"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editingId ? 'Editar Produto' : 'Novo Produto'} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nome</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Nome do produto" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Categoria</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={inputClass} required>
                <option value="">Selecione a categoria</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Preço</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">R$</span>
                <input type="text" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: formatBRL(e.target.value) })} className={`${inputClass} pl-10`} placeholder="0,00" required />
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Imagem do Produto</label>
            <ImageUpload value={form.image} onChange={(img) => setForm({ ...form, image: img })} />
          </div>
          <div>
            <label className={labelClass}>Descrição</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} rows={3} placeholder="Descrição do produto" />
          </div>
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

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Imagem</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Categoria</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Preço</th>
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
                <td className="px-6 py-4">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-xs">Sem</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{p.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{p.category?.name}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">R$ {Number(p.price).toFixed(2)}</td>
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
                    <button onClick={() => setDeleteId(p.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors text-sm">
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
