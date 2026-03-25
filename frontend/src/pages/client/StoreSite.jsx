import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import { FiSave, FiLoader, FiExternalLink, FiCopy, FiCheck, FiTruck, FiPlus, FiTrash2, FiEdit2, FiX, FiMapPin } from 'react-icons/fi'
import toast from 'react-hot-toast'

function fmtBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function StoreSite() {
  const [slug, setSlug] = useState('')
  const [storeActive, setStoreActive] = useState(false)
  const [deliveryEnabled, setDeliveryEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // Delivery zones
  const [zones, setZones] = useState([])
  const [loadingZones, setLoadingZones] = useState(false)
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [editingZone, setEditingZone] = useState(null)
  const [zoneName, setZoneName] = useState('')
  const [zoneFee, setZoneFee] = useState('')
  const [savingZone, setSavingZone] = useState(false)

  const frontendUrl = 'https://app.zapcakes.com'

  useEffect(() => {
    api.get('/company/store')
      .then(({ data }) => {
        setSlug(data.slug || '')
        setStoreActive(data.storeActive || false)
        setDeliveryEnabled(data.deliveryEnabled || false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (deliveryEnabled) loadZones()
  }, [deliveryEnabled])

  async function loadZones() {
    setLoadingZones(true)
    try {
      const { data } = await api.get('/company/delivery-zones')
      setZones(data)
    } catch {}
    setLoadingZones(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!slug || slug.length < 3) {
      toast.error('O endereço deve ter no mínimo 3 caracteres')
      return
    }
    setSaving(true)
    try {
      const { data } = await api.put('/company/store', { slug, storeActive, deliveryEnabled })
      setSlug(data.slug)
      setStoreActive(data.storeActive)
      setDeliveryEnabled(data.deliveryEnabled)
      toast.success('Configurações salvas!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(`${frontendUrl}/loja/${slug}`)
    setCopied(true)
    toast.success('Link copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

  function openZoneForm(zone = null) {
    if (zone) {
      setEditingZone(zone)
      setZoneName(zone.name)
      const cents = Math.round(Number(zone.fee) * 100)
      const padded = String(cents).padStart(3, '0')
      setZoneFee(padded.slice(0, -2) + ',' + padded.slice(-2))
    } else {
      setEditingZone(null)
      setZoneName('')
      setZoneFee('')
    }
    setShowZoneForm(true)
  }

  function closeZoneForm() {
    setShowZoneForm(false)
    setEditingZone(null)
    setZoneName('')
    setZoneFee('')
  }

  async function handleSaveZone() {
    if (!zoneName.trim()) return toast.error('Informe o nome da cidade/bairro')
    const feeNum = parseFloat(zoneFee.replace(',', '.'))
    if (isNaN(feeNum) || feeNum < 0) return toast.error('Informe uma taxa válida')

    setSavingZone(true)
    try {
      if (editingZone) {
        const { data } = await api.put(`/company/delivery-zones/${editingZone.id}`, { name: zoneName.trim(), fee: feeNum })
        setZones(prev => prev.map(z => z.id === data.id ? data : z))
        toast.success('Zona atualizada!')
      } else {
        const { data } = await api.post('/company/delivery-zones', { name: zoneName.trim(), fee: feeNum })
        setZones(prev => [...prev, data])
        toast.success('Zona adicionada!')
      }
      closeZoneForm()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSavingZone(false)
    }
  }

  async function handleDeleteZone(id) {
    if (!confirm('Remover esta zona de entrega?')) return
    try {
      await api.delete(`/company/delivery-zones/${id}`)
      setZones(prev => prev.filter(z => z.id !== id))
      toast.success('Zona removida!')
    } catch {
      toast.error('Erro ao remover')
    }
  }

  async function handleToggleZone(zone) {
    try {
      const { data } = await api.put(`/company/delivery-zones/${zone.id}`, { active: !zone.active })
      setZones(prev => prev.map(z => z.id === data.id ? data : z))
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
  const storeUrl = `${frontendUrl}/loja/${normalizedSlug}`

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        <FiLoader className="animate-spin mr-2" size={20} /> Carregando...
      </div>
    )
  }

  const inputClass = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Site da Loja</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Configurações */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Configurações</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Endereço da loja
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 whitespace-nowrap">{frontendUrl}/loja/</span>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="minha-confeitaria"
                maxLength={100}
                className={inputClass}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Apenas letras minúsculas, números e hífens. Mínimo 3 caracteres.</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Loja ativa</p>
              <p className="text-xs text-gray-400">Quando ativada, seus clientes podem acessar o catálogo e fazer pedidos</p>
            </div>
            <button
              type="button"
              onClick={() => setStoreActive(!storeActive)}
              className={`relative w-12 h-6 rounded-full transition-colors ${storeActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${storeActive ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>

        {/* Preview do link */}
        {normalizedSlug.length >= 3 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Link da Loja</h2>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
              <span className="text-sm text-gray-600 dark:text-gray-300 flex-1 truncate">{storeUrl}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                title="Copiar link"
              >
                {copied ? <FiCheck size={18} className="text-green-600" /> : <FiCopy size={18} />}
              </button>
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                title="Abrir loja"
              >
                <FiExternalLink size={18} />
              </a>
            </div>
            {!storeActive && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                A loja está desativada. Ative-a para que os clientes possam acessar.
              </p>
            )}
          </div>
        )}

        {/* Entrega / Delivery */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <FiTruck size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Entrega (Delivery)</p>
                <p className="text-xs text-gray-400">Quando ativada, o cliente poderá escolher entre retirada ou entrega no pedido</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDeliveryEnabled(!deliveryEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${deliveryEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${deliveryEnabled ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {/* Zonas de entrega */}
          {deliveryEnabled && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Taxas de entrega</h3>
                  <p className="text-xs text-gray-400">Defina o valor da taxa por cidade ou bairro</p>
                </div>
                <button
                  type="button"
                  onClick={() => openZoneForm()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiPlus size={14} /> Adicionar
                </button>
              </div>

              {/* Modal de zona */}
              {showZoneForm && (
                <>
                  <div className="fixed inset-0 z-50 bg-black/40" onClick={closeZoneForm} />
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeZoneForm}>
                    <div
                      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 animate-[fade-in_0.2s_ease-out]"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                          {editingZone ? 'Editar zona' : 'Nova zona de entrega'}
                        </h3>
                        <button type="button" onClick={closeZoneForm} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors">
                          <FiX size={20} />
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cidade / Bairro</label>
                          <input
                            type="text"
                            value={zoneName}
                            onChange={e => setZoneName(e.target.value)}
                            placeholder="Ex: Centro, Jardim América..."
                            className={inputClass}
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Taxa (R$)</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={zoneFee}
                              onChange={e => {
                                let v = e.target.value.replace(/[^0-9]/g, '')
                                if (v.length === 0) { setZoneFee(''); return }
                                v = v.replace(/^0+/, '') || '0'
                                const padded = v.padStart(3, '0')
                                const formatted = padded.slice(0, -2) + ',' + padded.slice(-2)
                                setZoneFee(formatted)
                              }}
                              placeholder="0,00"
                              className={inputClass + ' pl-10'}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Coloque 0,00 para entrega grátis nesta região</p>
                        </div>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={closeZoneForm} className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveZone}
                          disabled={savingZone}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {savingZone ? <FiLoader className="animate-spin" size={16} /> : <FiSave size={16} />}
                          {editingZone ? 'Atualizar' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Lista de zonas */}
              {loadingZones ? (
                <div className="text-center py-4 text-gray-400 text-sm">
                  <FiLoader className="animate-spin inline mr-2" size={16} /> Carregando zonas...
                </div>
              ) : zones.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <FiMapPin size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma zona de entrega cadastrada</p>
                  <p className="text-xs mt-1">Adicione cidades ou bairros com suas taxas de entrega</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {zones.map(zone => (
                    <div
                      key={zone.id}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                        zone.active
                          ? 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FiMapPin size={14} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${zone.active ? 'text-gray-800 dark:text-white' : 'text-gray-500'}`}>
                            {zone.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-sm font-bold ${zone.active ? 'text-green-600' : 'text-gray-400'}`}>
                          {Number(zone.fee) === 0 ? 'Grátis' : fmtBRL(zone.fee)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleZone(zone)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${zone.active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${zone.active ? 'translate-x-5' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openZoneForm(zone)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <FiEdit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteZone(zone.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? <FiLoader className="animate-spin" size={18} /> : <FiSave size={18} />}
          Salvar
        </button>
      </form>
    </div>
  )
}
