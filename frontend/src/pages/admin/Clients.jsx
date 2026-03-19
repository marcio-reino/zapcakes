import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiEye, FiToggleLeft, FiToggleRight, FiEdit2, FiSearch, FiPlus } from 'react-icons/fi'
import Modal from '../../components/Modal.jsx'

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function AdminClients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [editing, setEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('dados')
  const [form, setForm] = useState({ name: '', email: '', phone: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', reference: '' })
  const [loadingCep, setLoadingCep] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', phone: '' })

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    try {
      const { data } = await api.get('/users')
      setClients(data)
    } catch {
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  function openView(client) {
    setSelectedClient(client)
    setForm({
      name: client.name || '', email: client.email || '', phone: client.phone || '',
      street: client.street || '', number: client.number || '', complement: client.complement || '',
      neighborhood: client.neighborhood || '', city: client.city || '', state: client.state || '', zipCode: client.zipCode || '', reference: client.reference || '',
    })
    setEditing(false)
    setActiveTab('dados')
    setShowModal(true)
  }

  function closeModal() {
    setSelectedClient(null)
    setEditing(false)
    setShowModal(false)
  }

  function enableEdit() {
    setEditing(true)
  }

  async function handleSubmit() {
    try {
      await api.put(`/users/${selectedClient.id}`, form)
      toast.success('Cliente atualizado!')
      setEditing(false)
      loadClients()
      const { data } = await api.get(`/users/${selectedClient.id}`)
      setSelectedClient(data)
    } catch {
      toast.error('Erro ao atualizar cliente')
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

  function openCreate() {
    setCreateForm({ name: '', email: '', password: '', phone: '' })
    setShowCreateModal(true)
  }

  async function handleCreate(e) {
    e.preventDefault()
    try {
      await api.post('/users', createForm)
      toast.success('Cliente criado!')
      setShowCreateModal(false)
      setCreateForm({ name: '', email: '', password: '', phone: '' })
      loadClients()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar cliente')
    }
  }

  async function toggleActive(id, active) {
    try {
      await api.put(`/users/${id}`, { active: !active })
      toast.success(active ? 'Cliente desativado' : 'Cliente ativado')
      loadClients()
    } catch {
      toast.error('Erro ao atualizar cliente')
    }
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  const tabClass = (tab) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
      activeTab === tab
        ? 'bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
    }`

  const labelClass = 'block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1'
  const valueClass = 'text-sm text-gray-900 dark:text-white'
  const inputClass = 'w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white'

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Clientes</h1>
        <button
          onClick={openCreate}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <FiPlus size={18} /> Novo Cliente
        </button>
      </div>

      <div className="relative mb-6">
        <FiSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome, e-mail ou telefone..."
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
        />
      </div>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Novo Cliente">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className={labelClass}>Nome</label>
            <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className={inputClass} placeholder="Nome do cliente" required />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className={inputClass} placeholder="email@exemplo.com" required />
          </div>
          <div>
            <label className={labelClass}>Telefone</label>
            <input type="text" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} className={inputClass} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label className={labelClass}>Senha</label>
            <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className={inputClass} placeholder="Mínimo 6 caracteres" minLength={6} required />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
              <FiPlus size={16} /> Criar
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar Cliente' : 'Detalhes do Cliente'} maxWidth="max-w-lg">
        {selectedClient && (
          <div>
            {/* Abas */}
            <div className="flex gap-1 mb-5 border-b dark:border-gray-700">
              <button onClick={() => setActiveTab('dados')} className={tabClass('dados')}>Dados</button>
              <button onClick={() => setActiveTab('endereco')} className={tabClass('endereco')}>Endereço</button>
            </div>

            <div>
              {/* Aba Dados */}
              {activeTab === 'dados' && (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Nome</label>
                    {editing ? (
                      <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} required />
                    ) : (
                      <p className={valueClass}>{selectedClient.name}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    {editing ? (
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} required />
                    ) : (
                      <p className={valueClass}>{selectedClient.email}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Telefone</label>
                    {editing ? (
                      <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="(00) 00000-0000" />
                    ) : (
                      <p className={valueClass}>{selectedClient.phone || '-'}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Tipo</label>
                      <p className={valueClass}>{selectedClient.role}</p>
                    </div>
                    <div>
                      <label className={labelClass}>Status</label>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        selectedClient.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {selectedClient.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Aba Endereço */}
              {activeTab === 'endereco' && (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>CEP</label>
                    {editing ? (
                      <div className="flex gap-2">
                        <input type="text" value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} className={inputClass} placeholder="00000-000" maxLength={9} />
                        <button type="button" onClick={searchCep} disabled={loadingCep} className="px-4 py-2.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50">
                          <FiSearch size={16} /> {loadingCep ? 'Buscando...' : 'Buscar'}
                        </button>
                      </div>
                    ) : (
                      <p className={valueClass}>{selectedClient.zipCode || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Rua</label>
                    {editing ? (
                      <input type="text" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} className={inputClass} />
                    ) : (
                      <p className={valueClass}>{selectedClient.street || '-'}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Número</label>
                      {editing ? (
                        <input type="text" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className={inputClass} />
                      ) : (
                        <p className={valueClass}>{selectedClient.number || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Complemento</label>
                      {editing ? (
                        <input type="text" value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} className={inputClass} />
                      ) : (
                        <p className={valueClass}>{selectedClient.complement || '-'}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Bairro</label>
                    {editing ? (
                      <input type="text" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} className={inputClass} />
                    ) : (
                      <p className={valueClass}>{selectedClient.neighborhood || '-'}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Cidade</label>
                      {editing ? (
                        <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} />
                      ) : (
                        <p className={valueClass}>{selectedClient.city || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Estado</label>
                      {editing ? (
                        <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={inputClass}>
                          <option value="">Selecione</option>
                          {STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                      ) : (
                        <p className={valueClass}>{selectedClient.state || '-'}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Ponto de Referência</label>
                    {editing ? (
                      <input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputClass} placeholder="Ex: Próximo ao mercado" maxLength={200} />
                    ) : (
                      <p className={valueClass}>{selectedClient.reference || '-'}</p>
                    )}
                    {editing && <p className="text-xs text-gray-400 mt-1">{form.reference.length}/200 caracteres</p>}
                  </div>
                </div>
              )}

              {/* Botões */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t dark:border-gray-700">
                {editing ? (
                  <>
                    <button type="button" onClick={() => setEditing(false)} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      Cancelar
                    </button>
                    <button type="button" onClick={handleSubmit} className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
                      <FiEdit2 size={16} /> Salvar
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={closeModal} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      Fechar
                    </button>
                    <button type="button" onClick={enableEdit} className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
                      <FiEdit2 size={16} /> Editar Cliente
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Telefone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cidade/UF</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {clients.filter((c) => {
              if (!search.trim()) return true
              const q = search.toLowerCase()
              return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)
            }).map((client) => (
              <tr key={client.id}>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{client.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{client.email}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{client.phone || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {client.city && client.state ? `${client.city}/${client.state}` : '-'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    client.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  }`}>
                    {client.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openView(client)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
                    >
                      <FiEye size={15} /> Visualizar
                    </button>
                    <button
                      onClick={() => toggleActive(client.id, client.active)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                        client.active
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400'
                      }`}
                    >
                      {client.active ? <><FiToggleRight size={15} /> Desativar</> : <><FiToggleLeft size={15} /> Ativar</>}
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
