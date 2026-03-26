import { useState, useRef } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useStoreAuth } from '../../contexts/StoreAuthContext.jsx'
import { FiPhone, FiLock, FiUser, FiArrowLeft } from 'react-icons/fi'
import toast from 'react-hot-toast'
import storeApi from '../../services/storeApi.js'

function maskPhone(v) {
  const n = v.replace(/\D/g, '').slice(0, 11)
  return n.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

export default function StoreLogin() {
  const { slug, store } = useOutletContext()
  const { login, register, loginWithToken } = useStoreAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [showNotFound, setShowNotFound] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Login
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  // Register
  const [regName, setRegName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')

  // Forgot password
  const [forgotStep, setForgotStep] = useState(null) // null | 'phone' | 'code' | 'newpass'
  const [forgotPhone, setForgotPhone] = useState('')
  const [forgotCode, setForgotCode] = useState(['', '', '', '', '', ''])
  const [forgotNewPass, setForgotNewPass] = useState('')
  const [forgotConfirmPass, setForgotConfirmPass] = useState('')
  const codeRefs = useRef([])

  function startForgotPassword() {
    setForgotPhone(phone || '')
    setForgotCode(['', '', '', '', '', ''])
    setForgotNewPass('')
    setForgotConfirmPass('')
    setForgotStep('phone')
  }

  function cancelForgotPassword() {
    setForgotStep(null)
  }

  async function handleForgotSendCode(e) {
    e.preventDefault()
    const raw = forgotPhone.trim().replace(/\D/g, '')
    if (raw.length < 10) return toast.error('Digite um celular valido')
    setLoading(true)
    try {
      await storeApi.post(`/store/${slug}/customer/forgot-password`, { phone: raw })
      toast.success('Codigo enviado via WhatsApp!')
      setForgotStep('code')
      setTimeout(() => codeRefs.current[0]?.focus(), 100)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar codigo')
    } finally {
      setLoading(false)
    }
  }

  function handleCodeChange(index, value) {
    if (!/^\d?$/.test(value)) return
    const next = [...forgotCode]
    next[index] = value
    setForgotCode(next)
    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus()
    }
  }

  function handleCodeKeyDown(index, e) {
    if (e.key === 'Backspace' && !forgotCode[index] && index > 0) {
      codeRefs.current[index - 1]?.focus()
    }
  }

  function handleCodePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      e.preventDefault()
      setForgotCode(pasted.split(''))
      codeRefs.current[5]?.focus()
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    const code = forgotCode.join('')
    if (code.length !== 6) return toast.error('Digite o codigo completo')
    const raw = forgotPhone.trim().replace(/\D/g, '')
    setLoading(true)
    try {
      await storeApi.post(`/store/${slug}/customer/verify-reset-code`, { phone: raw, code })
      toast.success('Codigo verificado!')
      setForgotStep('newpass')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Codigo invalido')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    if (forgotNewPass.length < 4) return toast.error('Senha deve ter no minimo 4 caracteres')
    if (forgotNewPass !== forgotConfirmPass) return toast.error('As senhas nao coincidem')
    const raw = forgotPhone.trim().replace(/\D/g, '')
    const code = forgotCode.join('')
    setLoading(true)
    try {
      const { data } = await storeApi.post(`/store/${slug}/customer/reset-password`, {
        phone: raw, code, password: forgotNewPass,
      })
      loginWithToken(data.token, data.customer)
      toast.success('Senha alterada com sucesso!')
      navigate(`/loja/${slug}/carrinho`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao redefinir senha')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const raw = phone.trim().replace(/\D/g, '')
      await login(raw, password.trim())
      toast.success('Bem-vindo de volta!')
      navigate(`/loja/${slug}/carrinho`)
    } catch (err) {
      const status = err.response?.status
      if (status === 401 || status === 404) {
        setShowNotFound(true)
      } else {
        toast.error(err.response?.data?.error || 'Erro ao entrar')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleRegisterPreview(e) {
    e.preventDefault()
    if (!regName.trim() || !regPhone.trim() || !regPassword.trim()) return
    setShowConfirm(true)
  }

  async function handleRegisterConfirm() {
    setShowConfirm(false)
    setLoading(true)
    try {
      const raw = regPhone.trim().replace(/\D/g, '')
      await register(regName.trim(), raw, regPassword.trim())
      toast.success('Conta criada com sucesso!')
      navigate(`/loja/${slug}/carrinho`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  // Render forgot password flow
  if (forgotStep) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center mb-6">
          {store?.logoUrl ? (
            <img src={store.logoUrl} alt="" className="w-16 h-16 rounded-full object-cover mx-auto mb-3 shadow-md" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-3 flex items-center justify-center shadow-md">
              <span className="text-green-600 font-bold text-2xl">{store?.companyName?.[0] || 'Z'}</span>
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-800">Recuperar senha</h1>
          <p className="text-sm text-gray-500 mt-1">
            {forgotStep === 'phone' && 'Digite seu celular para receber o codigo via WhatsApp'}
            {forgotStep === 'code' && 'Digite o codigo que enviamos para seu WhatsApp'}
            {forgotStep === 'newpass' && 'Crie uma nova senha de acesso'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6">
          {forgotStep === 'phone' && (
            <form onSubmit={handleForgotSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Celular</label>
                <div className="relative">
                  <FiPhone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={forgotPhone}
                    onChange={e => setForgotPhone(maskPhone(e.target.value))}
                    placeholder="(22) 99999-9999"
                    className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-all disabled:opacity-50 shadow-lg shadow-green-600/20 active:scale-[0.98]"
              >
                {loading ? 'Enviando...' : 'Enviar codigo via WhatsApp'}
              </button>
              <button
                type="button"
                onClick={cancelForgotPassword}
                className="w-full py-3 text-gray-500 font-semibold text-base hover:text-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <FiArrowLeft size={16} /> Voltar ao login
              </button>
            </form>
          )}

          {forgotStep === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 text-center">Codigo de verificacao</label>
                <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
                  {forgotCode.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => codeRefs.current[i] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleCodeChange(i, e.target.value)}
                      onKeyDown={e => handleCodeKeyDown(i, e)}
                      className="w-12 h-14 text-center text-2xl font-bold border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">Verifique seu WhatsApp</p>
              </div>
              <button
                type="submit"
                disabled={loading || forgotCode.join('').length !== 6}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-all disabled:opacity-50 shadow-lg shadow-green-600/20 active:scale-[0.98]"
              >
                {loading ? 'Verificando...' : 'Verificar codigo'}
              </button>
              <button
                type="button"
                onClick={() => setForgotStep('phone')}
                className="w-full py-3 text-gray-500 font-semibold text-base hover:text-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <FiArrowLeft size={16} /> Reenviar codigo
              </button>
            </form>
          )}

          {forgotStep === 'newpass' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nova senha</label>
                <div className="relative">
                  <FiLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={forgotNewPass}
                    onChange={e => setForgotNewPass(e.target.value)}
                    placeholder="Minimo 4 caracteres"
                    minLength={4}
                    className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Repetir senha</label>
                <div className="relative">
                  <FiLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={forgotConfirmPass}
                    onChange={e => setForgotConfirmPass(e.target.value)}
                    placeholder="Digite a senha novamente"
                    minLength={4}
                    className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-all disabled:opacity-50 shadow-lg shadow-green-600/20 active:scale-[0.98]"
              >
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          O codigo expira em 10 minutos.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header da loja */}
      <div className="text-center mb-6">
        {store?.logoUrl ? (
          <img src={store.logoUrl} alt="" className="w-16 h-16 rounded-full object-cover mx-auto mb-3 shadow-md" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-3 flex items-center justify-center shadow-md">
            <span className="text-green-600 font-bold text-2xl">{store?.companyName?.[0] || 'Z'}</span>
          </div>
        )}
        <h1 className="text-xl font-bold text-gray-800">
          {tab === 'login' ? 'Entrar na sua conta' : 'Crie sua conta'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {tab === 'login'
            ? `Acesse para fazer pedidos em ${store?.companyName || 'nossa loja'}`
            : `Cadastre-se para comprar em ${store?.companyName || 'nossa loja'}`
          }
        </p>
      </div>

      {/* Card principal */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('login')}
            className={`flex-1 py-3.5 text-base font-bold transition-all relative ${
              tab === 'login'
                ? 'text-green-600'
                : 'text-gray-400 hover:text-gray-500'
            }`}
          >
            Entrar
            {tab === 'login' && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-green-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex-1 py-3.5 text-base font-bold transition-all relative ${
              tab === 'register'
                ? 'text-green-600'
                : 'text-gray-400 hover:text-gray-500'
            }`}
          >
            Criar conta
            {tab === 'register' && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-green-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Formularios */}
        <div className="p-6">
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Celular</label>
                <div className="relative">
                  <FiPhone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(maskPhone(e.target.value))}
                    placeholder="(22) 99999-9999"
                    className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Senha</label>
                <div className="relative">
                  <FiLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-all disabled:opacity-50 shadow-lg shadow-green-600/20 active:scale-[0.98]"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <p className="text-center text-base text-gray-500 pt-3">
                <button type="button" onClick={startForgotPassword} className="text-green-600 font-bold hover:underline">
                  Esqueci minha senha
                </button>
              </p>

              <p className="text-center text-base text-gray-500">
                Ainda não tem conta?{' '}
                <button type="button" onClick={() => setTab('register')} className="text-green-600 font-bold hover:underline">
                  Cadastre-se
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegisterPreview} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nome</label>
                <div className="relative">
                  <FiUser size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Celular</label>
                <div className="relative">
                  <FiPhone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={e => setRegPhone(maskPhone(e.target.value))}
                    placeholder="(22) 99999-9999"
                    className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Senha</label>
                <div className="relative">
                  <FiLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Minimo 4 caracteres"
                    minLength={4}
                    className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-all disabled:opacity-50 shadow-lg shadow-green-600/20 active:scale-[0.98]"
              >
                {loading ? 'Criando conta...' : 'Criar conta'}
              </button>

              <p className="text-center text-base text-gray-500 pt-3">
                Ja tem uma conta?{' '}
                <button type="button" onClick={() => setTab('login')} className="text-green-600 font-bold hover:underline">
                  Entrar
                </button>
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 mt-6">
        Seus dados estao protegidos e serao usados apenas para gerenciar seus pedidos.
      </p>

      {/* Modal login nao encontrado */}
      {showNotFound && (
        <>
          <style>{`
            @keyframes notfound-overlay { from { opacity: 0 } to { opacity: 1 } }
            @keyframes notfound-pop {
              0% { opacity: 0; transform: scale(0.3) }
              50% { opacity: 1; transform: scale(1.05) }
              70% { transform: scale(0.97) }
              100% { transform: scale(1) }
            }
          `}</style>
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setShowNotFound(false)}>
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              style={{ animation: 'notfound-overlay 0.2s ease-out forwards' }}
            />
            <div
              className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-7 text-center"
              style={{ animation: 'notfound-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">😕</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Login nao encontrado</h3>
              <p className="text-sm text-gray-500 mb-6">
                Nao encontramos uma conta com esses dados. Deseja criar uma conta nova?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNotFound(false)}
                  className="flex-1 py-3.5 border border-gray-200 text-gray-600 rounded-xl font-bold text-base hover:bg-gray-50 transition-colors"
                >
                  Tentar novamente
                </button>
                <button
                  onClick={() => { setShowNotFound(false); setTab('register') }}
                  className="flex-1 py-3.5 bg-green-600 text-white rounded-xl font-bold text-base hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20"
                >
                  Criar conta
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal confirmacao de cadastro */}
      {showConfirm && (
        <>
          <style>{`
            @keyframes confirm-overlay { from { opacity: 0 } to { opacity: 1 } }
            @keyframes confirm-pop {
              0% { opacity: 0; transform: scale(0.3) }
              50% { opacity: 1; transform: scale(1.05) }
              70% { transform: scale(0.97) }
              100% { transform: scale(1) }
            }
          `}</style>
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setShowConfirm(false)}>
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              style={{ animation: 'confirm-overlay 0.2s ease-out forwards' }}
            />
            <div
              className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-7"
              style={{ animation: 'confirm-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-800 text-center mb-4">Confirme seus dados</h3>

              <div className="space-y-3 mb-6">
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nome</p>
                  <p className="text-base font-medium text-gray-800 mt-0.5">{regName.trim()}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Celular</p>
                  <p className="text-base font-medium text-gray-800 mt-0.5">{regPhone}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3.5 border border-gray-200 text-gray-600 rounded-xl font-bold text-base hover:bg-gray-50 transition-colors"
                >
                  Corrigir
                </button>
                <button
                  onClick={handleRegisterConfirm}
                  disabled={loading}
                  className="flex-1 py-3.5 bg-green-600 text-white rounded-xl font-bold text-base hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
