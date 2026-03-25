import { useState, useEffect } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { FiArrowLeft, FiUser, FiPhone, FiMail, FiMapPin, FiEdit2, FiSave, FiX, FiSearch, FiLoader } from 'react-icons/fi'
import { useStoreAuth } from '../../contexts/StoreAuthContext.jsx'
import storeApi from '../../services/storeApi.js'
import toast from 'react-hot-toast'

export default function StoreAccount() {
  const { slug } = useOutletContext()
  const { customer } = useStoreAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Edição de e-mail
  const [editingEmail, setEditingEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  // Edição de endereço
  const [editingAddress, setEditingAddress] = useState(false)
  const [addr, setAddr] = useState({ street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', reference: '' })
  const [savingAddr, setSavingAddr] = useState(false)
  const [searchingCep, setSearchingCep] = useState(false)

  async function handleSearchCep() {
    const cep = addr.zipCode.replace(/\D/g, '')
    if (cep.length !== 8) {
      toast.error('Digite um CEP válido com 8 dígitos')
      return
    }
    setSearchingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (data.erro) {
        toast.error('CEP não encontrado')
        return
      }
      setAddr(prev => ({
        ...prev,
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
        complement: data.complemento || prev.complement,
      }))
      toast.success('Endereço preenchido!')
    } catch {
      toast.error('Erro ao buscar CEP')
    } finally {
      setSearchingCep(false)
    }
  }

  useEffect(() => {
    storeApi.get(`/store/${slug}/customer/me`)
      .then(({ data }) => {
        setProfile(data)
        setEmail(data.email || '')
        setAddr({
          street: data.street || '', number: data.number || '', complement: data.complement || '',
          neighborhood: data.neighborhood || '', city: data.city || '', state: data.state || '',
          zipCode: data.zipCode || '', reference: data.reference || '',
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  async function handleSaveEmail() {
    setSavingEmail(true)
    try {
      const { data } = await storeApi.put(`/store/${slug}/customer/me`, { email: email.trim() })
      setProfile(data)
      setEditingEmail(false)
      toast.success('E-mail atualizado!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSavingEmail(false)
    }
  }

  async function handleSaveAddress() {
    setSavingAddr(true)
    try {
      const { data } = await storeApi.put(`/store/${slug}/customer/me`, {
        street: addr.street.trim(), number: addr.number.trim(), complement: addr.complement.trim(),
        neighborhood: addr.neighborhood.trim(), city: addr.city.trim(), state: addr.state.trim(),
        zipCode: addr.zipCode.trim(), reference: addr.reference.trim(),
      })
      setProfile(data)
      setEditingAddress(false)
      toast.success('Endereço atualizado!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSavingAddr(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-400">
        Carregando...
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Não foi possível carregar seus dados.</p>
        <Link to={`/loja/${slug}/login`} className="text-green-600 font-semibold hover:underline mt-2 inline-block">
          Fazer login
        </Link>
      </div>
    )
  }

  const hasAddress = profile.street || profile.city
  const addressText = hasAddress
    ? [profile.street, profile.number, profile.complement, profile.neighborhood, profile.city, profile.state].filter(Boolean).join(', ')
    : null

  const inputClass = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors'

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <Link to={`/loja/${slug}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-green-600 mb-4">
        <FiArrowLeft size={16} />
        Voltar
      </Link>

      <h1 className="text-xl font-bold text-gray-800 mb-5">Minha conta</h1>

      {/* Dados pessoais */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        <div className="p-5 space-y-4">
          {/* Nome */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
              <FiUser size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nome</p>
              <p className="text-base text-gray-800 font-medium">{profile.name}</p>
            </div>
          </div>

          {/* Celular */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
              <FiPhone size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Celular</p>
              <p className="text-base text-gray-800 font-medium">{profile.phone?.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</p>
            </div>
          </div>

          {/* E-mail */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <FiMail size={18} className="text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">E-mail</p>
                {!editingEmail && (
                  <button onClick={() => setEditingEmail(true)} className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors">
                    <FiEdit2 size={18} />
                  </button>
                )}
              </div>
              {editingEmail ? (
                <div className="mt-1.5 space-y-2">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className={inputClass}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingEmail(false); setEmail(profile.email || '') }}
                      className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <FiX size={14} /> Cancelar
                    </button>
                    <button
                      onClick={handleSaveEmail}
                      disabled={savingEmail}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <FiSave size={14} /> {savingEmail ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className={`text-base font-medium ${profile.email ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                  {profile.email || 'Adicione seu e-mail'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                <FiMapPin size={18} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Endereço de entrega</p>
              </div>
            </div>
          </div>

          {editingAddress ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">CEP</label>
                <div className="flex gap-2">
                  <input
                    value={addr.zipCode}
                    onChange={e => setAddr({ ...addr, zipCode: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                    placeholder="28000000"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleSearchCep}
                    disabled={searchingCep}
                    className="flex-shrink-0 w-12 h-12 bg-green-600 text-white rounded-xl flex items-center justify-center hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {searchingCep ? <FiLoader size={20} className="animate-spin" /> : <FiSearch size={20} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Digite o CEP e clique na lupa para preencher automaticamente</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Rua</label>
                  <input value={addr.street} onChange={e => setAddr({ ...addr, street: e.target.value })} placeholder="Rua / Avenida" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Nº</label>
                  <input value={addr.number} onChange={e => setAddr({ ...addr, number: e.target.value })} placeholder="123" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Complemento</label>
                <input value={addr.complement} onChange={e => setAddr({ ...addr, complement: e.target.value })} placeholder="Apto, bloco, etc. (opcional)" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Bairro</label>
                <input value={addr.neighborhood} onChange={e => setAddr({ ...addr, neighborhood: e.target.value })} placeholder="Bairro" className={inputClass} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Cidade</label>
                  <input value={addr.city} onChange={e => setAddr({ ...addr, city: e.target.value })} placeholder="Cidade" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">UF</label>
                  <input value={addr.state} onChange={e => setAddr({ ...addr, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="RJ" maxLength={2} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Referência</label>
                <input value={addr.reference} onChange={e => setAddr({ ...addr, reference: e.target.value })} placeholder="Próximo a... (opcional)" className={inputClass} />
              </div>
              <div className="pt-2">
                <button
                  onClick={handleSaveAddress}
                  disabled={savingAddr}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-600 text-white rounded-xl font-bold text-base hover:bg-green-700 transition-colors disabled:opacity-50 shadow-lg shadow-green-600/20"
                >
                  <FiSave size={16} /> {savingAddr ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            addressText ? (
              <div>
                <p className="text-base text-gray-800 font-medium">{addressText}</p>
                {profile.zipCode && <p className="text-sm text-gray-500 mt-0.5">CEP: {profile.zipCode}</p>}
                {profile.reference && <p className="text-sm text-gray-500">Ref: {profile.reference}</p>}
                <button
                  onClick={() => setEditingAddress(true)}
                  className="mt-3 ml-auto flex items-center gap-2 px-6 py-3.5 bg-green-50 text-green-600 rounded-xl font-bold text-base hover:bg-green-100 transition-colors"
                >
                  <FiEdit2 size={18} /> Editar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingAddress(true)}
                className="w-full py-4 border-2 border-dashed border-green-300 rounded-xl text-green-600 font-semibold text-sm hover:border-green-500 hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
              >
                <FiMapPin size={16} />
                Adicionar endereço de entrega
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
