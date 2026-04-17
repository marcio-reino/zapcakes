import { useState, useEffect, useRef } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { FiSave, FiLoader, FiWifi, FiWifiOff } from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import { HiOutlineBuildingOffice2, HiOutlineCreditCard, HiOutlineGlobeAlt } from 'react-icons/hi2'

const TABS = [
  { id: 'empresa', label: 'Dados da Empresa', icon: HiOutlineBuildingOffice2 },
  { id: 'pagamento', label: 'Pagamento', icon: HiOutlineCreditCard },
  { id: 'whatsapp', label: 'WhatsApp', icon: FaWhatsapp },
  { id: 'site', label: 'Site', icon: HiOutlineGlobeAlt },
]

export default function Config() {
  const [activeTab, setActiveTab] = useState('empresa')
  const [pixKey, setPixKey] = useState('')
  const [pixName, setPixName] = useState('')
  const [paymentInstructions, setPaymentInstructions] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [notifyPhone, setNotifyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [siteConfeitarias, setSiteConfeitarias] = useState('')
  const [sitePedidos, setSitePedidos] = useState('')
  const [siteSatisfacao, setSiteSatisfacao] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // WhatsApp
  const [waStatus, setWaStatus] = useState('NOT_CREATED')
  const [waPhone, setWaPhone] = useState('')
  const [waProfileName, setWaProfileName] = useState('')
  const [waQrCode, setWaQrCode] = useState(null)
  const [waPairingCode, setWaPairingCode] = useState(null)
  const [waLoading, setWaLoading] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [pairingInputVisible, setPairingInputVisible] = useState(false)
  const [pairingPhone, setPairingPhone] = useState('')
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    Promise.all([
      api.get('/superadmin/config').then(({ data }) => {
        setPixKey(data.pix_key || '')
        setPixName(data.pix_name || '')
        setPaymentInstructions(data.payment_instructions || '')
        setCompanyPhone(data.company_phone || '')
        setNotifyPhone(data.notify_phone || '')
        setCompanyEmail(data.company_email || '')
        setSiteConfeitarias(data.site_confeitarias || '')
        setSitePedidos(data.site_pedidos || '')
        setSiteSatisfacao(data.site_satisfacao || '')
      }).catch(() => {}),
      loadWhatsappStatus(),
    ]).finally(() => setLoading(false))

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  async function loadWhatsappStatus() {
    try {
      const { data } = await api.get('/superadmin/whatsapp/status')
      setWaStatus(data.status)
      setWaPhone(data.phone || '')
      setWaProfileName(data.profileName || '')
      if (data.status === 'CONNECTED') {
        setWaQrCode(null)
        setQrModalOpen(false)
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      }
      return data.status
    } catch {
      return null
    }
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const st = await loadWhatsappStatus()
      if (st === 'CONNECTED') {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }, 3000)
  }

  async function handleConnect(phoneNumber = null) {
    setWaLoading(true)
    setWaQrCode(null)
    setWaPairingCode(null)
    try {
      const body = phoneNumber ? { phoneNumber } : {}
      const { data } = await api.post('/superadmin/whatsapp/connect', body)
      const qr = data.qrcode
      if (qr) {
        const src = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`
        setWaQrCode(src)
      }
      if (data.pairingCode) {
        setWaPairingCode(data.pairingCode)
      }
      if (qr || data.pairingCode) {
        setWaStatus('CONNECTING')
        setQrModalOpen(true)
        startPolling()
      } else {
        toast.error('Evolution não retornou QR Code nem código de pareamento')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao conectar WhatsApp')
    } finally {
      setWaLoading(false)
    }
  }

  async function handleGeneratePairingCode() {
    const digits = pairingPhone.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 15) {
      toast.error('Número inválido. Use formato DDI+DDD+número (ex: 5521999999999)')
      return
    }
    await handleConnect(digits)
  }

  async function handleDisconnect() {
    setWaLoading(true)
    try {
      await api.post('/superadmin/whatsapp/disconnect', {})
      setWaStatus('DISCONNECTED')
      setWaPhone('')
      setWaProfileName('')
      setWaQrCode(null)
      setQrModalOpen(false)
    } catch {
      // erro
    } finally {
      setWaLoading(false)
    }
  }

  function handleCloseQrModal() {
    setQrModalOpen(false)
    setWaPairingCode(null)
    setWaQrCode(null)
    setPairingInputVisible(false)
    setPairingPhone('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      await api.put('/superadmin/config', { pixKey, pixName, paymentInstructions, companyPhone, notifyPhone, companyEmail, siteConfeitarias, sitePedidos, siteSatisfacao })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // erro silencioso
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        <FiLoader className="animate-spin mr-2" size={20} /> Carregando...
      </div>
    )
  }

  const inputClass = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Configurações</h1>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-1.5 flex gap-1">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Icon size={18} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab: Dados da Empresa */}
      {activeTab === 'empresa' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Contato da Empresa</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Celular Agente ZapCakes</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={e => {
                    const n = e.target.value.replace(/\D/g, '').slice(0, 11)
                    setCompanyPhone(n.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3'))
                  }}
                  placeholder="(22) 99999-9999"
                  className={inputClass}
                />
                <span className="text-xs text-gray-400 mt-1 block">Número utilizado pelo agente IA para atendimento</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Celular Recebimento de Avisos</label>
                <input
                  type="text"
                  value={notifyPhone}
                  onChange={e => {
                    const n = e.target.value.replace(/\D/g, '').slice(0, 11)
                    setNotifyPhone(n.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3'))
                  }}
                  placeholder="(22) 99999-9999"
                  className={inputClass}
                />
                <span className="text-xs text-gray-400 mt-1 block">Recebe notificações de novos cadastros e alertas do sistema</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail</label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={e => setCompanyEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <SaveButton saving={saving} saved={saved} />
        </form>
      )}

      {/* Tab: Pagamento */}
      {activeTab === 'pagamento' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Pagamento PIX</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chave PIX</label>
              <input
                type="text"
                value={pixKey}
                onChange={e => setPixKey(e.target.value)}
                placeholder="CPF, CNPJ, e-mail ou chave aleatória"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do beneficiário</label>
              <input
                type="text"
                value={pixName}
                onChange={e => setPixName(e.target.value)}
                placeholder="Nome que aparece no PIX"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instruções de pagamento</label>
              <textarea
                value={paymentInstructions}
                onChange={e => setPaymentInstructions(e.target.value)}
                rows={5}
                placeholder="Instruções que o cliente verá ao pagar (ex: PIX para chave XX, enviar comprovante...)"
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          <SaveButton saving={saving} saved={saved} />
        </form>
      )}

      {/* Tab: WhatsApp */}
      {activeTab === 'whatsapp' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaWhatsapp className="text-[#25D366]" size={24} />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">WhatsApp do Superadmin</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Conecte um número de WhatsApp para enviar notificações do sistema (avisos de pagamento, alertas, etc.)
          </p>

          {waStatus === 'CONNECTED' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <FiWifi className="text-green-500 flex-shrink-0" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Conectado</p>
                  <p className="text-xs text-green-600 dark:text-green-500 truncate">
                    {waProfileName && <span>{waProfileName} &middot; </span>}
                    {waPhone || 'Número não identificado'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDisconnectModalOpen(true)}
                disabled={waLoading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm disabled:opacity-50"
              >
                {waLoading ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {waStatus !== 'NOT_CREATED' && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <FiWifiOff className="text-gray-400 flex-shrink-0" size={20} />
                  <p className="text-sm text-gray-500 dark:text-gray-400">WhatsApp desconectado</p>
                </div>
              )}
              <button
                onClick={handleConnect}
                disabled={waLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-lg hover:bg-[#20bd5a] transition-colors text-sm font-medium disabled:opacity-50"
              >
                {waLoading ? <FiLoader className="animate-spin" size={16} /> : <FaWhatsapp size={18} />}
                Conectar WhatsApp
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Site */}
      {activeTab === 'site' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Dados do Site</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 -mt-3">Informações exibidas na página inicial do site</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confeitarias</label>
                <input
                  type="text"
                  value={siteConfeitarias}
                  onChange={e => setSiteConfeitarias(e.target.value)}
                  placeholder="50"
                  className={inputClass}
                />
                <span className="text-xs text-gray-400 mt-1 block">Ex: 50 confeitarias</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pedidos</label>
                <input
                  type="text"
                  value={sitePedidos}
                  onChange={e => setSitePedidos(e.target.value)}
                  placeholder="+340"
                  className={inputClass}
                />
                <span className="text-xs text-gray-400 mt-1 block">Ex: +340 pedidos hoje</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Satisfação</label>
                <input
                  type="text"
                  value={siteSatisfacao}
                  onChange={e => setSiteSatisfacao(e.target.value)}
                  placeholder="4.9"
                  className={inputClass}
                />
                <span className="text-xs text-gray-400 mt-1 block">Ex: 4.9 satisfação</span>
              </div>
            </div>
          </div>

          <SaveButton saving={saving} saved={saved} />
        </form>
      )}

      {/* Modal QR Code */}
      <Modal isOpen={qrModalOpen} onClose={handleCloseQrModal} title="Conectar WhatsApp">
        <div className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-2 p-3 w-full bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <FiLoader className="animate-spin text-yellow-600 flex-shrink-0" size={16} />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              {waPairingCode ? 'Aguardando confirmação no WhatsApp...' : 'Aguardando leitura do QR Code...'}
            </p>
          </div>

          {waPairingCode ? (
            <div className="w-full flex flex-col items-center gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">Digite este código no WhatsApp:</p>
              <div className="px-6 py-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-xl">
                <p className="text-4xl md:text-5xl font-mono font-bold tracking-[0.4em] text-green-700 dark:text-green-400 text-center select-all">
                  {String(waPairingCode).replace(/^(.{4})(.{4})$/, '$1-$2')}
                </p>
              </div>
              <div className="text-center space-y-1 mt-2">
                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Como conectar com código:</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  1. Abra o WhatsApp no celular<br />
                  2. Toque em <strong>Dispositivos conectados</strong><br />
                  3. Toque em <strong>Conectar dispositivo</strong><br />
                  4. Toque em <strong>Conectar com número de telefone</strong><br />
                  5. Digite o código acima
                </p>
              </div>
            </div>
          ) : waQrCode ? (
            <>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <img src={waQrCode} alt="QR Code WhatsApp" className="w-72 h-72" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Como conectar:</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  1. Abra o WhatsApp no celular<br />
                  2. Toque em <strong>Dispositivos conectados</strong><br />
                  3. Toque em <strong>Conectar dispositivo</strong><br />
                  4. Aponte a câmera para o QR Code
                </p>
              </div>
            </>
          ) : (
            <div className="w-72 h-72 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-xl">
              <FiLoader className="animate-spin text-gray-400" size={32} />
            </div>
          )}

          {/* Alternativa: código de pareamento */}
          {!waPairingCode && (
            <div className="w-full border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-col items-center gap-2">
              {pairingInputVisible ? (
                <div className="w-full space-y-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300 block text-center">
                    Digite o número do WhatsApp (DDI + DDD + número)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      placeholder="Ex: 5521999999999"
                      disabled={waLoading}
                      className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      onClick={handleGeneratePairingCode}
                      disabled={waLoading || !pairingPhone.trim()}
                      className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                    >
                      {waLoading ? 'Gerando...' : 'Gerar código'}
                    </button>
                  </div>
                  <button
                    onClick={() => { setPairingInputVisible(false); setPairingPhone('') }}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 block mx-auto"
                  >
                    Voltar ao QR Code
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleConnect()}
                    disabled={waLoading}
                    className="text-sm text-green-600 dark:text-green-400 hover:underline disabled:opacity-50"
                  >
                    {waLoading ? 'Gerando...' : 'Gerar novo QR Code'}
                  </button>
                  <button
                    onClick={() => setPairingInputVisible(true)}
                    disabled={waLoading}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  >
                    Conectar com código (sem QR)
                  </button>
                </>
              )}
            </div>
          )}

          {waPairingCode && (
            <button
              onClick={() => { setWaPairingCode(null); handleConnect() }}
              disabled={waLoading}
              className="text-sm text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-50"
            >
              Voltar ao QR Code
            </button>
          )}
        </div>
      </Modal>

      {/* Modal confirmação desconectar */}
      <ConfirmModal
        isOpen={disconnectModalOpen}
        onClose={() => setDisconnectModalOpen(false)}
        onConfirm={() => { setDisconnectModalOpen(false); handleDisconnect() }}
        title="Desconectar WhatsApp"
        message="Tem certeza que deseja desconectar o WhatsApp do sistema? As notificações não serão enviadas enquanto estiver desconectado."
        confirmText="Desconectar"
      />
    </div>
  )
}

function SaveButton({ saving, saved }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg disabled:opacity-50 transition-colors"
      >
        {saving ? <FiLoader className="animate-spin" size={18} /> : <FiSave size={18} />}
        Salvar
      </button>
      {saved && (
        <span className="text-green-600 dark:text-green-400 text-sm font-medium">Configurações salvas!</span>
      )}
    </div>
  )
}
