import { useState, useEffect } from 'react'
import api from '../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiPackage } from 'react-icons/fi'
import Modal from './Modal.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import ImageUpload from './ImageUpload.jsx'

function formatBRL(value) {
  const num = String(value).replace(/\D/g, '')
  const cents = (Number(num) / 100).toFixed(2)
  return Number(cents).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseBRL(formatted) {
  const num = String(formatted).replace(/\./g, '').replace(',', '.')
  return parseFloat(num) || 0
}

export default function AdditionalsModal({ isOpen, onClose, onChange }) {
  const [additionals, setAdditionals] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ description: '', price: '', image: null })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/additionals')
      setAdditionals(res.data)
    } catch {
      toast.error('Erro ao carregar adicionais')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditingId(null)
    setForm({ description: '', price: '', image: null })
    setShowForm(true)
  }

  function startEdit(a) {
    setEditingId(a.id)
    setForm({
      description: a.description,
      price: Number(a.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      image: a.imageUrl || null,
    })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ description: '', price: '', image: null })
  }

  async function uploadImage(blob) {
    const formData = new FormData()
    formData.append('file', blob, 'additional.webp')
    const res = await api.post('/uploads?folder=adicionais', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.url
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.description.trim()) return toast.error('Descrição é obrigatória')
    if (form.description.length > 120) return toast.error('Descrição deve ter no máximo 120 caracteres')

    setSaving(true)
    try {
      let imageUrl = null
      if (form.image instanceof Blob) {
        imageUrl = await uploadImage(form.image)
      } else if (typeof form.image === 'string') {
        imageUrl = form.image
      }

      const payload = {
        description: form.description.trim(),
        price: parseBRL(form.price),
        imageUrl,
      }

      if (editingId) {
        await api.put(`/additionals/${editingId}`, payload)
        toast.success('Adicional atualizado!')
      } else {
        await api.post('/additionals', payload)
        toast.success('Adicional criado!')
      }
      cancelForm()
      await load()
      onChange?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/additionals/${deleteId}`)
      toast.success('Adicional desativado!')
      setDeleteId(null)
      await load()
      onChange?.()
    } catch {
      toast.error('Erro ao desativar')
    }
  }

  const inputClass = 'w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white'
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Adicionais" maxWidth="max-w-2xl">
        {!showForm && (
          <>
            <div className="flex justify-end mb-4">
              <button
                onClick={openNew}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <FiPlus size={18} /> Novo Adicional
              </button>
            </div>

            {loading && <p className="text-center text-gray-400 py-8">Carregando...</p>}

            {!loading && additionals.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                <FiPackage size={32} className="mx-auto mb-2 opacity-50" />
                <p>Nenhum adicional cadastrado</p>
                <p className="text-xs mt-1">Crie adicionais e atrele-os aos produtos na aba Anexos</p>
              </div>
            )}

            {!loading && additionals.length > 0 && (
              <div className="space-y-2">
                {additionals.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${a.active ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' : 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 opacity-60'}`}
                  >
                    {a.imageUrl ? (
                      <img src={a.imageUrl} alt={a.description} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 shrink-0">
                        <FiPackage size={20} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.description}</p>
                      <p className="text-sm text-green-600 dark:text-green-400">{Number(a.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    {!a.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Inativo</span>
                    )}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(a)}
                        className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                        title="Editar"
                      >
                        <FiEdit2 size={15} />
                      </button>
                      {a.active && (
                        <button
                          onClick={() => setDeleteId(a.id)}
                          className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg"
                          title="Desativar"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Descrição</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputClass}
                placeholder="Ex: Cobertura extra de chocolate"
                maxLength={120}
                required
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{form.description.length}/120</p>
            </div>
            <div>
              <label className={labelClass}>Valor</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: formatBRL(e.target.value) })}
                  className={`${inputClass} pl-10`}
                  placeholder="0,00"
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Foto de exemplo (opcional)</label>
              <ImageUpload value={form.image} onChange={(img) => setForm({ ...form, image: img })} />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={cancelForm}
                className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editingId ? <><FiEdit2 size={16} /> Atualizar</> : <><FiPlus size={16} /> Criar</>}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Desativar Adicional"
        message="Desativar este adicional? Ele deixará de aparecer nos produtos e no site, mas será mantido no histórico de pedidos existentes."
        confirmText="Desativar"
      />
    </>
  )
}
