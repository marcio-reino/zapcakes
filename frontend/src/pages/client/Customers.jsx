import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiToggleLeft, FiToggleRight, FiEye } from 'react-icons/fi'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [activeTab, setActiveTab] = useState('dados')
  const [loadingCep, setLoadingCep] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', email: '', notes: '',
    street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', reference: '',
  })

  useEffect(() => { loadCustomers() }, [])

  async function loadCustomers() {
    try {
      const { data } = await api.get('/customers')
      setCustomers(data)
    } catch {
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditingId(null)
    setForm({ name: '', phone: '', email: '', notes: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', reference: '' })
    setActiveTab('dados')
    setShowModal(true)
  }

  function startEdit(customer) {
    setEditingId(customer.id)
    setForm({
      name: customer.name || '', phone: customer.phone || '', email: customer.email || '', notes: customer.notes || '',
      street: customer.street || '', number: customer.number || '', complement: customer.complement || '',
      neighborhood: customer.neighborhood || '', city: customer.city || '', state: customer.state || '',
      zipCode: customer.zipCode || '', reference: customer.reference || '',
    })
    setActiveTab('dados')
    setShowModal(true)
  }

  function closeModal() {
    setEditingId(null)
    setShowModal(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form)
        toast.success('Cliente atualizado!')
      } else {
        await api.post('/customers', form)
        toast.success('Cliente cadastrado!')
      }
      closeModal()
      loadCustomers()
    } catch {
      toast.error('Erro ao salvar cliente')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    try {
      await api.delete(`/customers/${deleteId}`)
      toast.success('Cliente removido!')
      setDeleteId(null)
      loadCustomers()
    } catch {
      toast.error('Erro ao remover cliente')
    }
  }

  async function toggleActive(customer) {
    try {
      await api.put(`/customers/${customer.id}`, { active: !customer.active })
      toast.success(customer.active ? 'Cliente desativado' : 'Cliente ativado')
      loadCustomers()
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  async function searchCep() {
    const cep = form.zipCode.replace(/\D/g, '')
    if (cep.length !== 8) {
      toast.error('CEP deve ter 8 dígitos')
      return
    }
    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (data.erro) {
        toast.error('CEP não encontrado')
        return
      }
      setForm((prev) => ({
        ...prev,
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
        complement: data.complemento || prev.complement,
      }))
      toast.success('Endereço encontrado!')
    } catch {
      toast.error('Erro ao buscar CEP')
    } finally {
      setLoadingCep(false)
    }
  }

  function formatPhone(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits.length ? `(${digits}` : ''
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
  })

  const inputClass = 'w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
  const tabClass = (tab) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
      activeTab === tab
        ? 'bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
    }`

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Clientes</h1>
        <button onClick={openNew} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg transition-colors">
          <FiPlus size={18} /> Novo Cliente
        </button>
      </div>

      <div className="relative mb-6">
        <FiSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome, telefone ou e-mail..."
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Celular</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cidade/UF</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((customer) => (
              <tr key={customer.id}>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{customer.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{customer.phone || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{customer.email || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {customer.city && customer.state ? `${customer.city}/${customer.state}` : '-'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    customer.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  }`}>
                    {customer.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => startEdit(customer)} className="p-2 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors">
                      <FiEdit2 size={16} />
                    </button>
                    <button onClick={() => toggleActive(customer)} className="p-2 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors">
                      {customer.active ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                    </button>
                    <button onClick={() => setDeleteId(customer.id)} className="p-2 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors">
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-400">Nenhum cliente encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal criar/editar */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingId ? 'Editar Cliente' : 'Novo Cliente'}
        maxWidth="max-w-lg"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={closeModal} className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" form="customer-form" disabled={saving} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}
            </button>
          </div>
        }
      >
        <div className="flex gap-1 mb-4 border-b dark:border-gray-700">
          <button onClick={() => setActiveTab('dados')} className={tabClass('dados')}>Dados</button>
          <button onClick={() => setActiveTab('endereco')} className={tabClass('endereco')}>Endereço</button>
        </div>

        <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'dados' && (
            <>
              <div>
                <label className={labelClass}>Nome *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Nome do cliente" required />
              </div>
              <div>
                <label className={labelClass}>Celular</label>
                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} className={inputClass} placeholder="(00) 00000-0000" maxLength={15} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="email@exemplo.com" />
              </div>
              <div>
                <label className={labelClass}>Observações</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${inputClass} resize-none`} rows={3} placeholder="Anotações sobre o cliente..." />
              </div>
            </>
          )}

          {activeTab === 'endereco' && (
            <>
              <div>
                <label className={labelClass}>CEP</label>
                <div className="flex gap-2">
                  <input type="text" value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} className={inputClass} placeholder="00000-000" maxLength={9} />
                  <button type="button" onClick={searchCep} disabled={loadingCep} className="px-4 py-2.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50">
                    <FiSearch size={16} /> {loadingCep ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>Rua</label>
                <input type="text" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Número</label>
                  <input type="text" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Complemento</label>
                  <input type="text" value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Bairro</label>
                <input type="text" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Cidade</label>
                  <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Estado</label>
                  <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={inputClass}>
                    <option value="">Selecione</option>
                    {STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Ponto de Referência</label>
                <input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputClass} placeholder="Ex: Próximo ao mercado" maxLength={200} />
                <p className="text-xs text-gray-400 mt-1">{form.reference.length}/200 caracteres</p>
              </div>
            </>
          )}
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Remover cliente"
        message="Tem certeza que deseja remover este cliente?"
        confirmText="Remover"
      />
    </div>
  )
}
