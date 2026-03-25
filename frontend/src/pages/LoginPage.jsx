import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import api from '../services/api.js'
import toast from 'react-hot-toast'
import logoSvg from '../assets/logo.svg'

export default function LoginPage() {
  // Modo: 'login' | 'register' | 'activation'
  const initialMode = new URLSearchParams(window.location.search).get('mode') === 'register' ? 'register' : 'login'
  const [mode, setMode] = useState(initialMode)

  // Login fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [stayLogged, setStayLogged] = useState(true)

  // Register fields
  const [name, setName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')

  // Activation code
  const [activationEmail, setActivationEmail] = useState('')
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', ''])
  const [codeLoading, setCodeLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(60)
  const inputRefs = useRef([])

  // Forgot password
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  const [loading, setLoading] = useState(false)
  const { login, register, loginWithToken } = useAuth()
  const navigate = useNavigate()

  // Timer de reenvio
  useEffect(() => {
    if (mode !== 'activation' || resendTimer <= 0) return
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [mode, resendTimer])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(email, password, stayLogged)
      toast.success('Login realizado com sucesso!')
      navigate(user.role === 'ADMIN' ? '/admin' : '/client')
    } catch (err) {
      // Se conta pendente de ativação
      if (err.response?.data?.pendingActivation) {
        setActivationEmail(err.response.data.email)
        setCodeDigits(['', '', '', '', '', ''])
        setResendTimer(60)
        setMode('activation')
        toast('Código de ativação enviado para seu e-mail!')
      } else {
        toast.error(err.response?.data?.error || 'Erro ao fazer login')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await register(name, regEmail, regPassword, phone)
      if (data.pendingActivation) {
        setActivationEmail(data.email)
        setCodeDigits(['', '', '', '', '', ''])
        setResendTimer(60)
        setMode('activation')
        toast.success('Conta criada! Verifique seu e-mail para o código de ativação.')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  function handleCodeChange(index, value) {
    if (value && !/^\d$/.test(value)) return
    const newDigits = [...codeDigits]
    newDigits[index] = value
    setCodeDigits(newDigits)

    // Auto-avança para o próximo input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submete quando todos os 6 dígitos foram preenchidos
    if (value && index === 5 && newDigits.every((d) => d !== '')) {
      submitCode(newDigits.join(''))
    }
  }

  function handleCodeKeyDown(index, e) {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handleCodePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const digits = pasted.split('')
      setCodeDigits(digits)
      inputRefs.current[5]?.focus()
      submitCode(pasted)
    }
  }

  async function submitCode(code) {
    setCodeLoading(true)
    try {
      const { data } = await api.post('/auth/verify-code', { email: activationEmail, code })
      loginWithToken(data.token, data.user)
      toast.success('Conta ativada com sucesso!')
      navigate(data.user.role === 'ADMIN' ? '/admin' : '/client')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Código inválido')
      setCodeDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setCodeLoading(false)
    }
  }

  async function handleResendCode() {
    try {
      await api.post('/auth/resend-code', { email: activationEmail })
      setResendTimer(60)
      toast.success('Novo código enviado!')
    } catch {
      toast.error('Erro ao reenviar código')
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    if (!forgotEmail) return toast.error('Digite seu e-mail')
    setForgotLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail })
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.')
      setShowForgot(false)
      setForgotEmail('')
    } catch {
      toast.error('Erro ao enviar e-mail. Tente novamente.')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-gray-800 lg:bg-gradient-to-br lg:from-green-500 lg:to-green-700 lg:dark:from-gray-800 lg:dark:to-gray-900 relative overflow-hidden" style={{ fontFamily: "'Nunito', system-ui, -apple-system, sans-serif" }}>
      {/* Background shapes - only desktop */}
      <div className="hidden lg:block absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      <div className="hidden lg:block absolute -bottom-32 -right-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

      {/* Left side - Branding */}
      <div className="hidden lg:flex flex-1 items-center justify-end p-12 pr-20 relative">
        <div className="max-w-xl text-right">
          <img src={logoSvg} alt="ZapCakes" className="h-24 ml-auto mb-10 brightness-0 invert" />
          <h1 className="text-5xl xl:text-6xl font-extrabold text-white mb-6 leading-tight">
            Você faz os <span className="text-green-200">doces</span>,<br />
            o ZapCakes faz <span className="text-green-200">o resto</span>.
          </h1>
          <p className="text-green-100/80 text-xl xl:text-2xl leading-relaxed">
            Atenda seus clientes 24h pelo WhatsApp com inteligência artificial. Pedidos, entregas e financeiro — tudo automatizado em um só lugar.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:p-12">
        <div className="bg-white dark:bg-gray-800 lg:rounded-2xl lg:shadow-2xl p-0 lg:p-10 w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <img src={logoSvg} alt="ZapCakes" className="h-14 mx-auto mb-2" />
          </div>

          {mode === 'login' && (
            /* ===== LOGIN FORM ===== */
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bem-vindo de volta!</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Entre na sua conta para continuar</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-base lg:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white transition-all text-base lg:text-sm"
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-base lg:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white transition-all text-base lg:text-sm"
                    placeholder="Sua senha"
                    required
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setStayLogged(!stayLogged)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${stayLogged ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${stayLogged ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="text-base lg:text-sm text-gray-600 dark:text-gray-400">Permanecer logado</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-base lg:text-sm text-green-600 dark:text-green-400 font-semibold hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3.5 rounded-xl font-semibold hover:bg-green-700 transition-all hover:shadow-lg hover:shadow-green-600/30 disabled:opacity-50 text-lg lg:text-base"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>

              <p className="text-center mt-8 text-base lg:text-sm text-gray-500 dark:text-gray-400">
                Ainda não tem conta?{' '}
                <button onClick={() => setMode('register')} className="text-green-600 dark:text-green-400 font-semibold hover:underline">
                  Cadastre-se
                </button>
              </p>
            </>
          )}

          {mode === 'register' && (
            /* ===== REGISTER FORM ===== */
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Criar sua conta</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Preencha os dados abaixo para começar</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nome</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white transition-all"
                    placeholder="Seu nome"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white transition-all"
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Telefone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white transition-all"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Senha</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white transition-all"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3.5 rounded-xl font-semibold hover:bg-green-700 transition-all hover:shadow-lg hover:shadow-green-600/30 disabled:opacity-50 text-base"
                >
                  {loading ? 'Criando conta...' : 'Criar conta'}
                </button>
              </form>

              <p className="text-center mt-8 text-gray-500 dark:text-gray-400">
                Já tem conta?{' '}
                <button onClick={() => setMode('login')} className="text-green-600 dark:text-green-400 font-semibold hover:underline">
                  Fazer login
                </button>
              </p>
            </>
          )}

          {mode === 'activation' && (
            /* ===== ACTIVATION CODE ===== */
            <>
              <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verifique seu e-mail</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                  Enviamos um código de 6 dígitos para
                </p>
                <p className="text-green-600 dark:text-green-400 font-semibold text-sm mt-1">{activationEmail}</p>
              </div>

              <div className="flex justify-center gap-2 mb-6" onPaste={handleCodePaste}>
                {codeDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(i, e)}
                    disabled={codeLoading}
                    className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none transition-all
                      ${digit ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white'}
                      focus:border-green-500 focus:ring-2 focus:ring-green-500/30 disabled:opacity-50`}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {codeLoading && (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">Verificando...</p>
              )}

              <div className="text-center space-y-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Não recebeu o código?
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Verifique no seu e-mail a caixa de spam
                </p>
                {resendTimer > 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Reenviar em <span className="font-semibold text-green-600 dark:text-green-400">{resendTimer}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="text-sm text-white font-semibold bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 px-4 py-2 rounded-lg transition-colors"
                  >
                    Reenviar código
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="block mx-auto text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mt-4"
                >
                  Voltar ao login
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Esqueci minha senha */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForgot(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Recuperar senha</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white transition-all"
                placeholder="seu@email.com"
                required
                autoFocus
              />
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all disabled:opacity-50"
              >
                {forgotLoading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="w-full py-4 text-lg lg:text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
