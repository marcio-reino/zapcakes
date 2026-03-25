import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight, FiCheck, FiX, FiStar } from 'react-icons/fi'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'

function parseFeatures(raw) {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function formatBRL(value) {
  const num = String(value).replace(/\D/g, '')
  const cents = Number(num) / 100
  return cents.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseBRL(value) {
  const num = String(value).replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(num) || 0
}

export default function SuperadminPlans() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [togglePlan, setTogglePlan] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', price: '', features: [''], trialDays: 15, popular: false })
  const [modalTab, setModalTab] = useState('plano')

  useEffect(() => { loadPlans() }, [])

  async function loadPlans() {
    try {
      const { data } = await api.get('/superadmin/plans')
      setPlans(data)
    } catch {
      toast.error('Erro ao carregar planos')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setForm({ title: '', description: '', price: 'R$ 0,00', features: [''], trialDays: 15, popular: false })
    setModalTab('plano')
    setEditingId(null)
    setShowModal(true)
  }

  function openEdit(plan) {
    setForm({
      title: plan.title,
      description: plan.description || '',
      price: Number(plan.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      features: parseFeatures(plan.features).length > 0 ? parseFeatures(plan.features) : [''],
      trialDays: plan.trialDays ?? 15,
      popular: plan.popular ?? false,
    })
    setModalTab('plano')
    setEditingId(plan.id)
    setShowModal(true)
  }

  function updateFeature(index, value) {
    const updated = [...form.features]
    updated[index] = value
    setForm({ ...form, features: updated })
  }

  function removeFeature(index) {
    const updated = form.features.filter((_, i) => i !== index)
    setForm({ ...form, features: updated.length > 0 ? updated : [''] })
  }

  function addFeature() {
    setForm({ ...form, features: [...form.features, ''] })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const features = form.features.map((f) => f.trim()).filter(Boolean)
      const data = {
        title: form.title,
        description: form.description || null,
        price: parseBRL(form.price),
        features: features.length > 0 ? features : null,
        trialDays: Number(form.trialDays) || 15,
        popular: form.popular,
      }
      if (editingId) {
        await api.put(`/superadmin/plans/${editingId}`, data)
        toast.success('Plano atualizado!')
      } else {
        await api.post('/superadmin/plans', data)
        toast.success('Plano criado!')
      }
      setShowModal(false)
      loadPlans()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar plano')
    }
  }

  async function confirmToggle() {
    if (!togglePlan) return
    try {
      await api.put(`/superadmin/plans/${togglePlan.id}`, { active: !togglePlan.active })
      toast.success(togglePlan.active ? 'Plano desativado' : 'Plano ativado')
      setTogglePlan(null)
      loadPlans()
    } catch {
      toast.error('Erro ao atualizar plano')
    }
  }

  async function confirmDelete() {
    try {
      await api.delete(`/superadmin/plans/${deleteId}`)
      toast.success('Plano removido!')
      setDeleteId(null)
      loadPlans()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao remover plano')
    }
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  const inputClass = 'w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white'
  const labelClass = 'block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1'

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Planos</h1>
        <button
          onClick={openNew}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <FiPlus size={18} /> Novo Plano
        </button>
      </div>

      {/* Modal criar/editar */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Editar Plano' : 'Novo Plano'} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit}>
          {/* Abas */}
          <div className="flex gap-1 mb-5 border-b dark:border-gray-700">
            <button
              type="button"
              onClick={() => setModalTab('plano')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                modalTab === 'plano'
                  ? 'bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Plano
            </button>
            <button
              type="button"
              onClick={() => setModalTab('topicos')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                modalTab === 'topicos'
                  ? 'bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Tópicos
              {form.features.filter((f) => f.trim()).length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                  {form.features.filter((f) => f.trim()).length}
                </span>
              )}
            </button>
          </div>

          {/* Aba Plano */}
          {modalTab === 'plano' && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Nome do Plano</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: ZapCakes Pro"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Preço (R$ /mês)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: formatBRL(e.target.value) })}
                  className={inputClass}
                  placeholder="R$ 189,00"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Texto descritivo</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={inputClass}
                  placeholder="Tudo que você precisa para automatizar sua confeitaria"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Dias de teste grátis</label>
                  <input
                    type="number"
                    min="0"
                    value={form.trialDays}
                    onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Destaque</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, popular: !form.popular })}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                      form.popular
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-green-400'
                    }`}
                  >
                    <FiStar size={16} className={form.popular ? 'fill-green-500' : ''} />
                    {form.popular ? 'Mais Popular' : 'Normal'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Aba Tópicos */}
          {modalTab === 'topicos' && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Adicione os recursos que serão exibidos no card do plano.</p>
              <div className="space-y-2">
                {form.features.map((feat, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex items-center justify-center w-8 h-10 text-green-500">
                      <FiCheck size={16} />
                    </div>
                    <input
                      type="text"
                      value={feat}
                      onChange={(e) => updateFeature(i, e.target.value)}
                      className={`${inputClass} flex-1`}
                      placeholder={`Tópico ${i + 1}`}
                    />
                    {form.features.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFeature(i)}
                        className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <FiX size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addFeature}
                className="mt-3 text-sm text-green-600 dark:text-green-400 hover:text-green-700 flex items-center gap-1"
              >
                <FiPlus size={14} /> Adicionar tópico
              </button>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              {editingId ? <><FiEdit2 size={16} /> Salvar</> : <><FiPlus size={16} /> Criar</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmação delete */}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Excluir Plano"
        message={`Tem certeza que deseja excluir o plano "${plans.find((p) => p.id === deleteId)?.title || ''}"?\nEsta ação não pode ser desfeita.`}
        confirmText="Excluir"
      />

      {/* Modal confirmação ativar/desativar */}
      <ConfirmModal
        isOpen={!!togglePlan}
        onClose={() => setTogglePlan(null)}
        onConfirm={confirmToggle}
        title={togglePlan?.active ? 'Desativar Plano' : 'Ativar Plano'}
        message={togglePlan?.active
          ? `Deseja desativar o plano "${togglePlan?.title}"?\nEle ficará invisível para novos clientes.`
          : `Deseja ativar o plano "${togglePlan?.title}"?\nEle ficará disponível para novos clientes.`
        }
        confirmText={togglePlan?.active ? 'Desativar' : 'Ativar'}
      />

      {/* Cards de planos - estilo site */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const features = parseFeatures(plan.features)
          const isPopular = plan.popular
          return (
            <div
              key={plan.id}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 md:p-8 border-2 transition-all ${
                !plan.active ? 'opacity-50 border-gray-200 dark:border-gray-700' :
                isPopular ? 'border-green-500 shadow-lg shadow-green-500/10' :
                'border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Badge popular */}
              {isPopular && plan.active && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-white bg-green-600 rounded-full whitespace-nowrap">
                  Mais popular
                </div>
              )}

              {/* Status badge */}
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2 py-0.5 text-xs rounded-full ${plan.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                  {plan.active ? 'Ativo' : 'Inativo'}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {plan._count?.accounts || 0} conta(s)
                </span>
              </div>

              {/* Nome */}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-4">{plan.title}</h3>

              {/* Preço */}
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-xl font-bold text-gray-500 dark:text-gray-400">R$</span>
                <span className="text-5xl font-black text-gray-900 dark:text-white leading-none">
                  {Math.floor(Number(plan.price))}
                </span>
                <span className="text-lg text-gray-400 dark:text-gray-500 font-medium">/mês</span>
              </div>

              {/* Descrição */}
              {plan.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-5">{plan.description}</p>
              )}

              {/* Tópicos */}
              {features.length > 0 && (
                <ul className="space-y-2.5 mb-5">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                      <FiCheck size={16} className="text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}

              {/* Trial */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl py-3 px-4 text-center mb-4">
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                  Começar {plan.trialDays || 15} dias grátis
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Sem cartão de crédito. Cancele a qualquer momento.</p>
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => openEdit(plan)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
                >
                  <FiEdit2 size={15} /> Editar
                </button>
                <button
                  onClick={() => setTogglePlan(plan)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-colors text-sm ${
                    plan.active
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-yellow-100 hover:text-yellow-600'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-100 hover:text-green-600'
                  }`}
                >
                  {plan.active ? <FiToggleRight size={15} /> : <FiToggleLeft size={15} />}
                </button>
                <button
                  onClick={() => setDeleteId(plan.id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors text-sm"
                >
                  <FiTrash2 size={15} />
                </button>
              </div>
            </div>
          )
        })}

        {plans.length === 0 && (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">Nenhum plano criado ainda.</p>
            <button onClick={openNew} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 inline-flex items-center gap-2">
              <FiPlus size={18} /> Criar Primeiro Plano
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
