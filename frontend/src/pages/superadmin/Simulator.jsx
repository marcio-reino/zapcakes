import { useState, useEffect, useRef } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiSend, FiRefreshCw, FiUser, FiCpu, FiMessageSquare } from 'react-icons/fi'

function genSessionId() {
  return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`
}

export default function SuperadminSimulator() {
  const [accounts, setAccounts] = useState([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [sessionId, setSessionId] = useState(() => genSessionId())
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    api.get('/superadmin/simulator/accounts')
      .then(({ data }) => setAccounts(data))
      .catch(() => toast.error('Erro ao carregar contas'))
      .finally(() => setLoadingAccounts(false))
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  function handleAccountChange(value) {
    setSelectedUserId(value)
    setSessionId(genSessionId())
    setMessages([])
  }

  async function handleReset() {
    if (!selectedUserId) return
    try {
      await api.post('/superadmin/simulator/reset', {
        userId: Number(selectedUserId),
        sessionId,
      })
      setSessionId(genSessionId())
      setMessages([])
      toast.success('Conversa reiniciada')
    } catch {
      toast.error('Erro ao reiniciar')
    }
  }

  async function handleSend(e) {
    e?.preventDefault()
    if (!selectedUserId) return toast.error('Selecione uma conta primeiro')
    if (!input.trim() || sending) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage, ts: Date.now() }])
    setSending(true)

    try {
      const { data } = await api.post('/superadmin/simulator/send', {
        userId: Number(selectedUserId),
        sessionId,
        message: userMessage,
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, ts: Date.now() }])
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Erro ao enviar mensagem'
      setMessages((prev) => [...prev, { role: 'error', content: errMsg, ts: Date.now() }])
    } finally {
      setSending(false)
    }
  }

  const selectedAccount = accounts.find((a) => a.userId === Number(selectedUserId))

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Agente Teste</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Converse com o agente de uma conta como se fosse um cliente via WhatsApp — sem enviar mensagens reais.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm flex flex-col h-[calc(100vh-200px)]">
        {/* Top bar: seleção de conta */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Conta</label>
            <select
              value={selectedUserId}
              onChange={(e) => handleAccountChange(e.target.value)}
              disabled={loadingAccounts}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">
                {loadingAccounts ? 'Carregando...' : accounts.length === 0 ? 'Nenhuma conta com agente configurado' : 'Selecione uma conta'}
              </option>
              {accounts.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.companyName || a.name} — {a.instructions} instruções
                </option>
              ))}
            </select>
          </div>
          {selectedAccount && (
            <button
              onClick={handleReset}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm disabled:opacity-50"
              title="Reiniciar conversa"
            >
              <FiRefreshCw size={15} /> Nova conversa
            </button>
          )}
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50">
          {!selectedAccount && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center gap-3">
              <FiMessageSquare size={40} className="opacity-50" />
              <p>Selecione uma conta para começar a simular.</p>
            </div>
          )}
          {selectedAccount && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center gap-3">
              <FiCpu size={40} className="opacity-50" />
              <p>Envie a primeira mensagem como se fosse um cliente.</p>
              <p className="text-xs">Ex: "oi", "quero fazer um pedido", "tem bolo de chocolate?"</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role !== 'user' && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  m.role === 'error' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  <FiCpu size={16} />
                </div>
              )}
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                m.role === 'user'
                  ? 'bg-green-600 text-white rounded-br-none'
                  : m.role === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-none dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700'
              }`}>
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 flex items-center justify-center flex-shrink-0">
                  <FiUser size={16} />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex gap-2 justify-start">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 flex items-center justify-center">
                <FiCpu size={16} />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!selectedUserId || sending}
            placeholder={selectedUserId ? 'Digite como se fosse o cliente...' : 'Selecione uma conta primeiro'}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!selectedUserId || sending || !input.trim()}
            className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSend size={16} />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      </div>
    </div>
  )
}
