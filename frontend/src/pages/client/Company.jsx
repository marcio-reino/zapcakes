import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import ImageUpload from '../../components/ImageUpload.jsx'
import { FiSave, FiMapPin, FiSearch } from 'react-icons/fi'

const UF_OPTIONS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

function maskCPF(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function maskCNPJ(v) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function maskCEP(v) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
}

function maskCelular(v) {
  const n = v.replace(/\D/g, '').slice(0, 11)
  return n.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

export default function Company() {
  const [form, setForm] = useState({
    companyName: '', legalName: '', document: '', documentType: '',
    logoUrl: '', responsible: '', phone: '',
    street: '', number: '', complement: '', neighborhood: '',
    city: '', state: '', zipCode: '', reference: '',
  })
  const [logoFile, setLogoFile] = useState(null) // blob do ImageUpload
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadCompany() }, [])

  async function loadCompany() {
    try {
      const { data } = await api.get('/company')
      setForm({
        companyName: data.companyName || '',
        legalName: data.legalName || '',
        document: data.document || '',
        documentType: data.documentType || '',
        logoUrl: data.logoUrl || '',
        responsible: data.responsible || '',
        phone: data.phone || '',
        street: data.street || '',
        number: data.number || '',
        complement: data.complement || '',
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        state: data.state || '',
        zipCode: data.zipCode || '',
        reference: data.reference || '',
      })
    } catch {
      toast.error('Erro ao carregar dados da empresa')
    } finally {
      setLoading(false)
    }
  }

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleDocumentChange(value) {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 11) {
      setField('document', maskCPF(value))
      setField('documentType', digits.length > 0 ? 'CPF' : '')
    } else {
      setField('document', maskCNPJ(value))
      setField('documentType', 'CNPJ')
    }
  }

  async function handleCEP() {
    const cep = form.zipCode.replace(/\D/g, '')
    if (cep.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          street: data.logradouro || f.street,
          neighborhood: data.bairro || f.neighborhood,
          city: data.localidade || f.city,
          state: data.uf || f.state,
        }))
      }
    } catch { /* silencioso */ }
  }

  async function handleSave() {
    setSaving(true)
    try {
      let logoUrl = form.logoUrl

      // Se tem nova logo (blob), faz upload
      if (logoFile && logoFile instanceof Blob) {
        const fd = new FormData()
        fd.append('file', logoFile, 'logo.webp')
        const { data: upload } = await api.post('/uploads?folder=perfil', fd)
        logoUrl = upload.url
      }

      await api.put('/company', { ...form, logoUrl })
      setForm((f) => ({ ...f, logoUrl }))
      setLogoFile(null)
      toast.success('Dados salvos com sucesso!')
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function getMapUrl() {
    const parts = [form.street, form.number, form.neighborhood, form.city, form.state].filter(Boolean)
    if (parts.length < 2) return null
    const q = encodeURIComponent(parts.join(', '))
    return `https://www.google.com/maps?q=${q}&output=embed`
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  const mapUrl = getMapUrl()

  const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none text-sm'
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Minha Empresa</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50 text-sm font-medium"
        >
          <FiSave size={16} /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="space-y-6">
        {/* Logo e Identidade */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Identidade da Empresa</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClass}>Logo (PNG)</label>
              <ImageUpload
                value={logoFile || form.logoUrl || null}
                onChange={(img) => {
                  setLogoFile(img)
                  if (!img) setField('logoUrl', '')
                }}
                aspectOptions={[
                  { label: '4:3', value: 4 / 3, w: 800, h: 600 },
                ]}
              />
            </div>
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className={labelClass}>Nome Fantasia</label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setField('companyName', e.target.value)}
                  placeholder="Nome da empresa"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Razão Social</label>
                <input
                  type="text"
                  value={form.legalName}
                  onChange={(e) => setField('legalName', e.target.value)}
                  placeholder="Razão social"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dados da Empresa */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Dados da Empresa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>CPF / CNPJ</label>
              <input
                type="text"
                value={form.document}
                onChange={(e) => handleDocumentChange(e.target.value)}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className={inputClass}
              />
              {form.documentType && (
                <span className="text-xs text-gray-400 mt-1 block">{form.documentType}</span>
              )}
            </div>
            <div>
              <label className={labelClass}>Responsável</label>
              <input
                type="text"
                value={form.responsible}
                onChange={(e) => setField('responsible', e.target.value)}
                placeholder="Nome do responsável"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Celular</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setField('phone', maskCelular(e.target.value))}
                placeholder="(22) 99999-9999"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Endereço</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>CEP</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.zipCode}
                  onChange={(e) => setField('zipCode', maskCEP(e.target.value))}
                  onBlur={handleCEP}
                  placeholder="00000-000"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleCEP}
                  className="px-3 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Buscar CEP"
                >
                  <FiSearch size={16} />
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Rua / Logradouro</label>
              <input
                type="text"
                value={form.street}
                onChange={(e) => setField('street', e.target.value)}
                placeholder="Rua, Avenida..."
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Número</label>
              <input
                type="text"
                value={form.number}
                onChange={(e) => setField('number', e.target.value)}
                placeholder="Nº"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Complemento</label>
              <input
                type="text"
                value={form.complement}
                onChange={(e) => setField('complement', e.target.value)}
                placeholder="Sala, Bloco..."
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Bairro</label>
              <input
                type="text"
                value={form.neighborhood}
                onChange={(e) => setField('neighborhood', e.target.value)}
                placeholder="Bairro"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Cidade</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                placeholder="Cidade"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <select
                value={form.state}
                onChange={(e) => setField('state', e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione</option>
                {UF_OPTIONS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Ponto de Referência</label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setField('reference', e.target.value)}
                placeholder="Próximo a..."
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Mapa */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <FiMapPin size={20} className="text-pink-500" />
            Localização no Mapa
          </h2>
          {mapUrl ? (
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <iframe
                src={mapUrl}
                width="100%"
                height="350"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localização da empresa"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 bg-gray-50 dark:bg-gray-700 rounded-xl text-gray-400 dark:text-gray-500 text-sm">
              <div className="text-center">
                <FiMapPin size={32} className="mx-auto mb-2 opacity-50" />
                <p>Preencha o endereço para visualizar no mapa</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
