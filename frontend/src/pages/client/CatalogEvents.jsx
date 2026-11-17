import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiCopy, FiExternalLink, FiCalendar } from 'react-icons/fi'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import ImageUpload from '../../components/ImageUpload.jsx'

const BANNER_ASPECTS = [{ label: '3:1', value: 3, w: 1200, h: 400 }]

const emptyForm = { name: '', slug: '', description: '', banner: null, startsAt: '', endsAt: '', active: true }

function toSlug(value) {
  return String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function periodLabel(ev) {
  const start = formatDate(ev.startsAt)
  const end = formatDate(ev.endsAt)
  if (start && end) return `${start} a ${end}`
  if (start) return `A partir de ${start}`
  if (end) return `Até ${end}`
  return 'Sem período definido'
}

function StatusBadge({ ev }) {
  let cls = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  let label = 'No ar'
  if (!ev.active) {
    cls = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    label = 'Inativo'
  } else if (!ev.live) {
    cls = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    label = 'Fora do período'
  }
  return <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full ${cls}`}>{label}</span>
}

export default function CatalogEvents() {
  const [events, setEvents] = useState([])
  const [storeSlug, setStoreSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [slugTouched, setSlugTouched] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [evRes, storeRes] = await Promise.all([
        api.get('/catalog-events'),
        api.get('/company/store'),
      ])
      setEvents(evRes.data)
      setStoreSlug(storeRes.data?.slug || '')
    } catch {
      toast.error('Erro ao carregar catálogos')
    } finally {
      setLoading(false)
    }
  }

  function eventUrl(ev) {
    return `${window.location.origin}/loja/${storeSlug}/${ev.slug}`
  }

  function copyLink(ev) {
    if (!storeSlug) {
      toast.error('Configure o endereço da loja no menu Site primeiro')
      return
    }
    navigator.clipboard.writeText(eventUrl(ev))
    toast.success('Link copiado!')
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setSlugTouched(false)
    setShowModal(true)
  }

  function startEdit(ev) {
    setEditingId(ev.id)
    setForm({
      name: ev.name,
      slug: ev.slug,
      description: ev.description || '',
      banner: ev.bannerUrl || null,
      startsAt: ev.startsAt ? ev.startsAt.slice(0, 10) : '',
      endsAt: ev.endsAt ? ev.endsAt.slice(0, 10) : '',
      active: ev.active,
    })
    setSlugTouched(true)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function handleNameChange(name) {
    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : toSlug(name) }))
  }

  async function uploadBanner(blob) {
    const formData = new FormData()
    formData.append('file', blob, 'banner.webp')
    const res = await api.post('/uploads?folder=events', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.url
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.startsAt && form.endsAt && form.startsAt > form.endsAt) {
      toast.error('A data final deve ser depois da data inicial')
      return
    }
    setSaving(true)
    try {
      let bannerUrl = null
      if (form.banner instanceof Blob) bannerUrl = await uploadBanner(form.banner)
      else if (typeof form.banner === 'string') bannerUrl = form.banner

      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description,
        bannerUrl,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        active: form.active,
      }

      if (editingId) {
        await api.put(`/catalog-events/${editingId}`, payload)
        toast.success('Catálogo atualizado!')
      } else {
        await api.post('/catalog-events', payload)
        toast.success('Catálogo criado!')
      }
      closeModal()
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar catálogo')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    try {
      const { data } = await api.delete(`/catalog-events/${deleteId}`)
      toast.success(data?.message || 'Catálogo removido!')
      setDeleteId(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao remover catálogo')
    }
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  const inputClass = 'w-full px-4 py-3 md:py-2.5 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none dark:bg-gray-700 dark:text-white'
  const labelClass = 'block text-base lg:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  return (
    <div>
      <div className="flex justify-between items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Datas Comemorativas</h1>
        <button onClick={openNew} className="bg-green-600 text-white px-4 py-2.5 md:py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 shrink-0">
          <FiPlus size={18} /> <span className="hidden sm:inline">Novo Catálogo</span><span className="sm:hidden">Novo</span>
        </button>
      </div>
      <p className="text-sm md:text-xs text-gray-500 dark:text-gray-400 mb-6">
        Produtos e combos vinculados a um catálogo aparecem apenas no link dele, e não no catálogo principal da loja.
        Vincule pelo campo "Catálogo" em <Link to="/client/products" className="text-green-600 hover:underline">Produtos</Link> e <Link to="/client/combos" className="text-green-600 hover:underline">Combos</Link>.
      </p>

      {!storeSlug && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
          Sua loja ainda não tem endereço. Configure em <Link to="/client/store-site" className="font-semibold underline">Site</Link> para gerar os links dos catálogos.
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editingId ? 'Editar Catálogo' : 'Novo Catálogo'} maxWidth="max-w-2xl" maxHeight="640px" footer={
        <div className="flex flex-col-reverse md:flex-row md:justify-end gap-3">
          <button type="button" onClick={closeModal} className="px-5 py-3 md:py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button type="submit" form="event-form" disabled={saving} className="px-5 py-3 md:py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Salvando...' : editingId ? <><FiEdit2 size={16} /> Atualizar</> : <><FiPlus size={16} /> Criar</>}
          </button>
        </div>
      }>
        <form id="event-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nome</label>
            <input type="text" value={form.name} onChange={(e) => handleNameChange(e.target.value)} className={inputClass} placeholder="Ex: Natal 2026" required autoFocus />
          </div>

          <div>
            <label className={labelClass}>Endereço do catálogo</label>
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-0">
              <span className="text-sm md:text-xs text-gray-400 md:whitespace-nowrap md:pr-1 break-all">.../loja/{storeSlug || 'sua-loja'}/</span>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: toSlug(e.target.value) }) }}
                className={inputClass}
                placeholder="natal"
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Banner (opcional)</label>
            <ImageUpload value={form.banner} onChange={(img) => setForm({ ...form, banner: img })} aspectOptions={BANNER_ASPECTS} />
          </div>

          <div>
            <label className={labelClass}>Descrição (opcional)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} rows={3} placeholder="Ex: Encomendas de Natal até 20/12. Retirada até 24/12." />
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className={labelClass}>Início (opcional)</label>
              <input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className={inputClass} />
            </div>
            <div className="flex-1">
              <label className={labelClass}>Fim (opcional)</label>
              <input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className={inputClass} />
            </div>
          </div>
          <p className="text-sm md:text-xs text-gray-500 dark:text-gray-400 -mt-2">
            Fora do período o link mostra "catálogo encerrado" e os itens não podem ser pedidos.
          </p>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-5 h-5 text-green-600 rounded" />
            <span className="text-base lg:text-sm text-gray-700 dark:text-gray-300">Catálogo ativo</span>
          </label>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Remover Catálogo"
        message="Os produtos e combos deste catálogo voltarão para o catálogo principal, mas ficarão INATIVOS. Deseja continuar?"
        confirmText="Remover"
      />

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {events.map((ev) => (
          <div key={ev.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            {ev.bannerUrl && <img src={ev.bannerUrl} alt={ev.name} className="w-full aspect-[3/1] object-cover" />}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{ev.name}</h3>
                <StatusBadge ev={ev} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5"><FiCalendar size={14} /> {periodLabel(ev)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ev.productCount} produtos · {ev.comboCount} combos</p>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1 break-all">/{ev.slug}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => copyLink(ev)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg">
                  <FiCopy size={18} /> Copiar link
                </button>
                <button onClick={() => startEdit(ev)} className="p-3 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded-lg">
                  <FiEdit2 size={20} />
                </button>
                <button onClick={() => setDeleteId(ev.id)} className="p-3 bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 rounded-lg">
                  <FiTrash2 size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-6 py-8 text-center text-gray-400">Nenhum catálogo cadastrado</div>
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Catálogo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Período</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Itens</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {events.map((ev) => (
              <tr key={ev.id}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {ev.bannerUrl ? (
                      <img src={ev.bannerUrl} alt={ev.name} className="w-24 h-8 rounded object-cover" />
                    ) : (
                      <div className="w-24 h-8 rounded bg-gray-100 dark:bg-gray-700" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{ev.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">/{ev.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{periodLabel(ev)}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{ev.productCount} produtos · {ev.comboCount} combos</td>
                <td className="px-6 py-4"><StatusBadge ev={ev} /></td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => copyLink(ev)} title="Copiar link" className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm">
                      <FiCopy size={15} /> Link
                    </button>
                    {storeSlug && ev.live && (
                      <a href={eventUrl(ev)} target="_blank" rel="noreferrer" title="Abrir catálogo" className="flex items-center px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm">
                        <FiExternalLink size={15} />
                      </a>
                    )}
                    <button onClick={() => startEdit(ev)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm">
                      <FiEdit2 size={15} /> Editar
                    </button>
                    <button onClick={() => setDeleteId(ev.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors text-sm">
                      <FiTrash2 size={15} /> Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Nenhum catálogo cadastrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
