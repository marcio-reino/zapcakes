import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiMessageSquare, FiBriefcase, FiShoppingCart, FiPackage, FiHelpCircle, FiCheckCircle, FiImage, FiSmartphone, FiRefreshCw, FiWifi, FiWifiOff, FiFile, FiMusic, FiPlay, FiPause } from 'react-icons/fi'

import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import MediaUpload from '../../components/MediaUpload.jsx'

const CATEGORIES = [
  { value: 'GREETING', label: 'Saudação', icon: FiMessageSquare, color: 'bg-blue-500', lightBg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
  { value: 'COMPANY', label: 'Empresa', icon: FiBriefcase, color: 'bg-purple-500', lightBg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
  { value: 'ORDERS', label: 'Pedidos', icon: FiShoppingCart, color: 'bg-orange-500', lightBg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
  { value: 'PRODUCTS', label: 'Produtos', icon: FiPackage, color: 'bg-green-500', lightBg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
  { value: 'QUESTIONS', label: 'Dúvidas', icon: FiHelpCircle, color: 'bg-yellow-500', lightBg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
  { value: 'CLOSING', label: 'Encerramento', icon: FiCheckCircle, color: 'bg-red-500', lightBg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
]

export default function AdminAgent() {
  const [instructions, setInstructions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ category: 'GREETING', title: '', content: '', image: null })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [whatsappStatus, setWhatsappStatus] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [playingAudio, setPlayingAudio] = useState(null) // instruction id
  const audioRef = useRef(null)

  function toggleAudio(instructionId, url) {
    if (playingAudio === instructionId) {
      audioRef.current?.pause()
      setPlayingAudio(null)
      return
    }
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const audio = new Audio(url)
    audio.onended = () => setPlayingAudio(null)
    audio.play()
    audioRef.current = audio
    setPlayingAudio(instructionId)
  }

  const loadAgentStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/evo-agent/status')
      setWhatsappStatus(data.whatsapp?.status || null)
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => { loadInstructions(); loadAgentStatus() }, [])

  async function loadInstructions() {
    try {
      const { data } = await api.get('/agent-instructions')
      setInstructions(data)
    } catch {
      toast.error('Erro ao carregar instruções')
    } finally {
      setLoading(false)
    }
  }

  function openNew(category) {
    setEditingId(null)
    setForm({ category: category || 'GREETING', title: '', content: '', image: null })
    setShowModal(true)
  }

  function startEdit(instruction) {
    setEditingId(instruction.id)
    setForm({ category: instruction.category, title: instruction.title, content: instruction.content, image: instruction.imageUrl || null })
    setShowModal(true)
  }

  function closeModal() {
    setEditingId(null)
    setForm({ category: 'GREETING', title: '', content: '', image: null })
    setShowModal(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let imageUrl = form.image
      if (form.image && (form.image instanceof Blob || form.image instanceof File)) {
        const fd = new FormData()
        let fileName = 'instruction.webp'
        if (form.image instanceof File && form.image.name) {
          fileName = form.image.name
        } else if (form.image.type === 'application/pdf') {
          fileName = 'instruction.pdf'
        } else if (form.image.type?.startsWith('audio/')) {
          fileName = 'instruction.mp3'
        }
        fd.append('file', form.image, fileName)
        const { data: upload } = await api.post('/uploads?folder=agente', fd)
        imageUrl = upload.url
      }
      const payload = { category: form.category, title: form.title, content: form.content, imageUrl: imageUrl || null }
      if (editingId) {
        await api.put(`/agent-instructions/${editingId}`, payload)
        toast.success('Instrução atualizada!')
      } else {
        await api.post('/agent-instructions', payload)
        toast.success('Instrução criada!')
      }
      closeModal()
      loadInstructions()
    } catch {
      toast.error('Erro ao salvar instrução')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    try {
      await api.delete(`/agent-instructions/${deleteId}`)
      toast.success('Instrução removida!')
      setDeleteId(null)
      loadInstructions()
    } catch {
      toast.error('Erro ao remover instrução')
    }
  }

  async function toggleActive(instruction) {
    try {
      await api.put(`/agent-instructions/${instruction.id}`, { active: !instruction.active })
      loadInstructions()
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  async function handleConnectWhatsApp() {
    setConnecting(true)
    setShowQrModal(true)
    setQrCode(null)
    try {
      const { data } = await api.post('/evo-agent/whatsapp/connect')
      setQrCode(data.qrcode)
    } catch (err) {
      toast.error('Erro ao gerar QR code')
      setShowQrModal(false)
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnectWhatsApp() {
    try {
      await api.post('/evo-agent/whatsapp/disconnect')
      toast.success('WhatsApp desconectado')
      setWhatsappStatus('DISCONNECTED')
      loadAgentStatus()
    } catch {
      toast.error('Erro ao desconectar')
    }
  }

  async function refreshQrCode() {
    setConnecting(true)
    try {
      const { data } = await api.post('/evo-agent/whatsapp/connect')
      setQrCode(data.qrcode)
    } catch {
      toast.error('Erro ao atualizar QR code')
    } finally {
      setConnecting(false)
    }
  }

  function getByCategory(category) {
    return instructions.filter((i) => i.category === category)
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  return (
    <div className="h-full flex flex-col -m-4 -mt-4 md:-m-8">
      <div className="px-4 md:px-8 py-4 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0 z-10">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Agente de Atendimento</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Configure as instruções do agente por categoria</p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            {whatsappStatus === 'CONNECTED' ? (
              <button
                onClick={handleDisconnectWhatsApp}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 md:py-2.5 rounded-lg transition-colors text-lg md:text-sm"
              >
                <FiWifi size={18} />
                Conectado
              </button>
            ) : (
              <button
                onClick={handleConnectWhatsApp}
                disabled={connecting}
                className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 md:py-2.5 rounded-lg transition-colors disabled:opacity-50 text-lg md:text-sm"
              >
                <FiSmartphone size={18} />
                {connecting ? 'Conectando...' : 'Conectar WhatsApp'}
              </button>
            )}
            <button
              onClick={() => openNew()}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-3 md:py-2.5 rounded-lg transition-colors text-lg md:text-sm"
            >
              <FiPlus size={18} />
              Nova Instrução
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {CATEGORIES.map((cat) => {
          const items = getByCategory(cat.value)
          const Icon = cat.icon
          return (
            <div key={cat.value} className={`rounded-xl border ${cat.border} ${cat.lightBg} overflow-hidden`}>
              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 ${cat.color} rounded-lg flex items-center justify-center text-white`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-800 dark:text-white">{cat.label}</h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{items.length} {items.length === 1 ? 'instrução' : 'instruções'}</span>
                  </div>
                </div>
                <button
                  onClick={() => openNew(cat.value)}
                  className="flex items-center gap-1.5 transition-colors bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-2 rounded-lg text-base md:bg-transparent md:dark:bg-transparent md:text-gray-600 md:dark:text-gray-300 md:hover:text-green-600 md:dark:hover:text-green-400 md:hover:bg-transparent md:dark:hover:bg-transparent md:px-0 md:py-0 md:rounded-none md:text-sm"
                >
                  <FiPlus className="w-5 h-5 md:w-4 md:h-4" />
                  Adicionar
                </button>
              </div>

              {items.length > 0 && (
                <div className="border-t border-inherit">
                  {items.map((instruction, idx) => (
                    <div
                      key={instruction.id}
                      className={`px-5 py-3.5 ${idx > 0 ? 'border-t border-inherit' : ''} bg-white/60 dark:bg-gray-800/60`}
                    >
                      <div className="flex items-start gap-4">
                        {instruction.imageUrl && (() => {
                          const url = instruction.imageUrl.toLowerCase()
                          if (url.match(/\.pdf(\?|$)/)) {
                            return <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-center shrink-0"><FiFile size={20} className="text-red-500" /></div>
                          }
                          if (url.match(/\.(mp3|mpeg|ogg)(\?|$)/)) {
                            const isPlaying = playingAudio === instruction.id
                            return (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleAudio(instruction.id, instruction.imageUrl) }}
                                className={`w-12 h-12 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                                  isPlaying
                                    ? 'bg-blue-500 border-blue-500 shadow-md shadow-blue-500/30'
                                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                                }`}
                              >
                                {isPlaying
                                  ? <FiPause size={18} className="text-white" />
                                  : <FiPlay size={18} className="text-blue-500 ml-0.5" />
                                }
                              </button>
                            )
                          }
                          return <img src={instruction.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                        })()}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-medium ${instruction.active ? 'text-gray-800 dark:text-white' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                              {instruction.title}
                            </h3>
                            {instruction.imageUrl && !instruction.imageUrl.startsWith('blob:') && (() => {
                              const url = instruction.imageUrl.toLowerCase()
                              if (url.match(/\.pdf(\?|$)/)) return <FiFile size={14} className="text-red-400" />
                              if (url.match(/\.(mp3|mpeg|ogg)(\?|$)/)) return <FiMusic size={14} className="text-blue-400" />
                              return <FiImage size={14} className="text-gray-400" />
                            })()}
                            {!instruction.active && (
                              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">Inativa</span>
                            )}
                          </div>
                          <p className={`text-sm mt-1 line-clamp-2 ${instruction.active ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>
                            {instruction.content}
                          </p>
                        </div>
                        {/* Desktop: botões ao lado */}
                        <div className="hidden md:flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleActive(instruction)}
                            className={`p-2 rounded-lg transition-colors ${instruction.active ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600' : 'bg-gray-100 text-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-600 dark:hover:bg-gray-600'}`}
                            title={instruction.active ? 'Desativar' : 'Ativar'}
                          >
                            <FiCheckCircle size={17} />
                          </button>
                          <button
                            onClick={() => startEdit(instruction)}
                            className="p-2 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            <FiEdit2 size={17} />
                          </button>
                          <button
                            onClick={() => setDeleteId(instruction.id)}
                            className="p-2 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            <FiTrash2 size={17} />
                          </button>
                        </div>
                      </div>
                      {/* Mobile: botões abaixo */}
                      <div className="flex md:hidden items-center gap-2 mt-3 justify-end">
                        <button
                          onClick={() => toggleActive(instruction)}
                          className={`p-3 rounded-lg transition-colors ${instruction.active ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600' : 'bg-gray-100 text-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-600 dark:hover:bg-gray-600'}`}
                          title={instruction.active ? 'Desativar' : 'Ativar'}
                        >
                          <FiCheckCircle size={20} />
                        </button>
                        <button
                          onClick={() => startEdit(instruction)}
                          className="p-3 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <FiEdit2 size={20} />
                        </button>
                        <button
                          onClick={() => setDeleteId(instruction.id)}
                          className="p-3 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <FiTrash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal de Instrução */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingId ? 'Editar Instrução' : 'Nova Instrução'}
        maxWidth="max-w-lg"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={closeModal}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="instruction-form"
              disabled={saving}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        }
      >
        <form id="instruction-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Categoria</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Título</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Boas-vindas inicial"
              required
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Anexo (imagem, PDF ou áudio)</label>
            <MediaUpload
              value={form.image}
              onChange={(file) => setForm({ ...form, image: file })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Instruções</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Descreva como o agente deve agir nesta situação..."
              required
              rows={6}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>
        </form>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Remover instrução"
        message="Tem certeza que deseja remover esta instrução do agente?"
        confirmText="Remover"
      />

      {/* Modal QR Code WhatsApp */}
      <Modal
        isOpen={showQrModal}
        onClose={() => { setShowQrModal(false); loadAgentStatus() }}
        title="Conectar WhatsApp"
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col items-center text-center">
          {connecting && !qrCode ? (
            <div className="py-12">
              <FiRefreshCw size={32} className="animate-spin text-green-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Gerando QR Code...</p>
            </div>
          ) : qrCode?.base64 ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Abra o WhatsApp no celular e escaneie o QR Code abaixo
              </p>
              <div className="bg-white p-3 rounded-xl shadow-inner">
                <img
                  src={qrCode.base64.startsWith('data:') ? qrCode.base64 : `data:image/png;base64,${qrCode.base64}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
              <button
                onClick={refreshQrCode}
                disabled={connecting}
                className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors disabled:opacity-50"
              >
                <FiRefreshCw size={14} className={connecting ? 'animate-spin' : ''} />
                Atualizar QR Code
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                O QR Code expira em alguns segundos. Clique em atualizar se necessário.
              </p>
            </>
          ) : qrCode?.pairingCode ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Use o código de pareamento abaixo no WhatsApp
              </p>
              <div className="bg-gray-100 dark:bg-gray-700 px-6 py-4 rounded-xl">
                <span className="text-2xl font-mono font-bold text-gray-800 dark:text-white tracking-widest">
                  {qrCode.pairingCode}
                </span>
              </div>
              <button
                onClick={refreshQrCode}
                disabled={connecting}
                className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors disabled:opacity-50"
              >
                <FiRefreshCw size={14} className={connecting ? 'animate-spin' : ''} />
                Atualizar código
              </button>
            </>
          ) : (
            <div className="py-8">
              <FiWifiOff size={32} className="text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Não foi possível gerar o QR Code</p>
              <button
                onClick={refreshQrCode}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
