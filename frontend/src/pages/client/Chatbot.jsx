import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'

export default function ClientChatbot() {
  const [instances, setInstances] = useState([])
  const [selectedInstance, setSelectedInstance] = useState(null)
  const [chatbot, setChatbot] = useState(null)
  const [form, setForm] = useState({
    welcomeMsg: '',
    menuMsg: '',
    closingMsg: '',
    businessHoursStart: '08:00',
    businessHoursEnd: '18:00',
    active: true,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/instances').then(({ data }) => {
      setInstances(data)
      setLoading(false)
    })
  }, [])

  async function loadChatbot(instanceId) {
    setSelectedInstance(instanceId)
    try {
      const { data } = await api.get(`/chatbots/instance/${instanceId}`)
      setChatbot(data)
      setForm({
        welcomeMsg: data.welcomeMsg || '',
        menuMsg: data.menuMsg || '',
        closingMsg: data.closingMsg || '',
        businessHoursStart: data.businessHoursStart || '08:00',
        businessHoursEnd: data.businessHoursEnd || '18:00',
        active: data.active,
      })
    } catch {
      setChatbot(null)
      setForm({ welcomeMsg: '', menuMsg: '', closingMsg: '', businessHoursStart: '08:00', businessHoursEnd: '18:00', active: true })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (chatbot) {
        await api.put(`/chatbots/${chatbot.id}`, form)
        toast.success('Chatbot atualizado!')
      } else {
        await api.post('/chatbots', { ...form, instanceId: Number(selectedInstance) })
        toast.success('Chatbot configurado!')
      }
      loadChatbot(selectedInstance)
    } catch {
      toast.error('Erro ao salvar configuração')
    }
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Configuração do Chatbot</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selecione a instância</label>
        <select
          value={selectedInstance || ''}
          onChange={(e) => loadChatbot(e.target.value)}
          className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
        >
          <option value="">Selecione...</option>
          {instances.map((i) => (
            <option key={i.id} value={i.id}>{i.instanceName} ({i.status})</option>
          ))}
        </select>
      </div>

      {selectedInstance && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem de Boas-vindas</label>
            <textarea
              value={form.welcomeMsg}
              onChange={(e) => setForm({ ...form, welcomeMsg: e.target.value })}
              className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Olá! Bem-vindo à nossa loja. Como posso ajudar?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem do Menu</label>
            <textarea
              value={form.menuMsg}
              onChange={(e) => setForm({ ...form, menuMsg: e.target.value })}
              className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              rows={4}
              placeholder="Escolha uma opção:&#10;1 - Ver cardápio&#10;2 - Fazer pedido&#10;3 - Status do pedido&#10;4 - Falar com atendente"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem de Encerramento</label>
            <textarea
              value={form.closingMsg}
              onChange={(e) => setForm({ ...form, closingMsg: e.target.value })}
              className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              rows={2}
              placeholder="Obrigado pelo contato! Volte sempre."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Horário de Início</label>
              <input
                type="time" value={form.businessHoursStart}
                onChange={(e) => setForm({ ...form, businessHoursStart: e.target.value })}
                className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Horário de Fim</label>
              <input
                type="time" value={form.businessHoursEnd}
                onChange={(e) => setForm({ ...form, businessHoursEnd: e.target.value })}
                className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox" checked={form.active} id="chatbotActive"
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="chatbotActive" className="text-sm text-gray-700 dark:text-gray-300">Chatbot ativo</label>
          </div>

          <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700">
            {chatbot ? 'Atualizar Configuração' : 'Salvar Configuração'}
          </button>
        </form>
      )}
    </div>
  )
}
