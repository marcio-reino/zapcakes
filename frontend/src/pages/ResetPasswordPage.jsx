import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api.js'
import toast from 'react-hot-toast'
import logoSvg from '../assets/logo.svg'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) return toast.error('A senha deve ter no mínimo 6 caracteres')
    if (password !== confirm) return toast.error('As senhas não conferem')

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      toast.success('Senha redefinida com sucesso!')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Token inválido ou expirado')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-green-700 dark:from-gray-800 dark:to-gray-900 p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-4">Link inválido. Solicite novamente a recuperação de senha.</p>
          <button onClick={() => navigate('/login')} className="text-green-600 font-semibold hover:underline">
            Voltar ao login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-green-700 dark:from-gray-800 dark:to-gray-900 p-6 relative overflow-hidden" style={{ fontFamily: "'Nunito', system-ui, -apple-system, sans-serif" }}>
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-10 w-full max-w-md relative">
        <div className="text-center mb-8">
          <img src={logoSvg} alt="ZapCakes" className="h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Nova senha</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Digite sua nova senha abaixo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nova senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white transition-all"
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Confirmar senha</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white transition-all"
              placeholder="Repita a senha"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-3.5 rounded-xl font-semibold hover:bg-green-700 transition-all hover:shadow-lg hover:shadow-green-600/30 disabled:opacity-50 text-base"
          >
            {loading ? 'Salvando...' : 'Redefinir senha'}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-500 dark:text-gray-400">
          <button onClick={() => navigate('/login')} className="text-green-600 dark:text-green-400 font-semibold hover:underline">
            Voltar ao login
          </button>
        </p>
      </div>
    </div>
  )
}
