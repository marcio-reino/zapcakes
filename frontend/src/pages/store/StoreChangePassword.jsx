import { useState } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { FiArrowLeft, FiLock } from 'react-icons/fi'
import storeApi from '../../services/storeApi.js'
import toast from 'react-hot-toast'

export default function StoreChangePassword() {
  const { slug } = useOutletContext()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (newPassword.trim().length < 4) {
      toast.error('Nova senha deve ter no mínimo 4 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }
    setLoading(true)
    try {
      await storeApi.put(`/store/${slug}/customer/password`, {
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      })
      toast.success('Senha alterada com sucesso!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar senha')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors'

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <Link to={`/loja/${slug}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-green-600 mb-4">
        <FiArrowLeft size={16} />
        Voltar
      </Link>

      <h1 className="text-xl font-bold text-gray-800 mb-5">Alterar senha</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Senha atual</label>
            <div className="relative">
              <FiLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha atual"
                className={inputClass}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nova senha</label>
            <div className="relative">
              <FiLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                minLength={4}
                className={inputClass}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Confirmar nova senha</label>
            <div className="relative">
              <FiLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className={inputClass}
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-all disabled:opacity-50 shadow-lg shadow-green-600/20 active:scale-[0.98]"
          >
            {loading ? 'Salvando...' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
