import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => { loadCategories() }, [])

  async function loadCategories() {
    try {
      const { data } = await api.get('/categories')
      setCategories(data)
    } catch {
      toast.error('Erro ao carregar categorias')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editingId) {
        await api.put(`/categories/${editingId}`, { name })
        toast.success('Categoria atualizada!')
        closeModal()
      } else {
        await api.post('/categories', { name })
        toast.success('Categoria criada!')
        setName('')
      }
      loadCategories()
    } catch {
      toast.error('Erro ao salvar categoria')
    }
  }

  function openNew() {
    setEditingId(null)
    setName('')
    setShowModal(true)
  }

  function startEdit(c) {
    setEditingId(c.id)
    setName(c.name)
    setShowModal(true)
  }

  function closeModal() {
    setEditingId(null)
    setName('')
    setShowModal(false)
  }

  async function confirmDelete() {
    try {
      await api.delete(`/categories/${deleteId}`)
      toast.success('Categoria removida!')
      setDeleteId(null)
      loadCategories()
    } catch {
      toast.error('Erro ao remover. Verifique se não há produtos vinculados.')
    }
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Categorias</h1>
        <button
          onClick={openNew}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <FiPlus size={18} /> Nova Categoria
        </button>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editingId ? 'Editar Categoria' : 'Nova Categoria'}>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nome da categoria</label>
          <input
            type="text" placeholder="Ex: Bolos, Doces, Salgados..." value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white" required autoFocus
          />
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

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Remover Categoria"
        message="Tem certeza que deseja remover esta categoria? Esta ação não pode ser desfeita."
        confirmText="Remover"
      />

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {categories.map((c) => (
          <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{c.name}</h3>
                <p className="text-base text-gray-500 dark:text-gray-400 mt-1">{c._count?.products || 0} produtos</p>
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
        {categories.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-6 py-8 text-center text-gray-400">Nenhuma categoria encontrada</div>
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produtos</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{c.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{c._count?.products || 0}</td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
                    >
                      <FiEdit2 size={15} /> Editar
                    </button>
                    <button
                      onClick={() => setDeleteId(c.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors text-sm"
                    >
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
