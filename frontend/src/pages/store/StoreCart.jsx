import { useState, useRef, useEffect } from 'react'
import { useNavigate, useOutletContext, Link } from 'react-router-dom'
import { FiPlus, FiMinus, FiTrash2, FiArrowLeft, FiCamera, FiX, FiImage, FiCalendar, FiChevronLeft, FiChevronRight, FiSearch, FiMapPin, FiLoader, FiCopy } from 'react-icons/fi'
import { useCart } from '../../hooks/useCart.jsx'
import { useStoreAuth } from '../../contexts/StoreAuthContext.jsx'
import storeApi from '../../services/storeApi.js'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'

function fmtBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function InspirationUpload({ product, attachments = [], onChange }) {
  const fileRef = useRef(null)
  const max = product.maxInspirationImages || 3

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem')
      return
    }
    // Convert to base64 for localStorage persistence
    const reader = new FileReader()
    reader.onload = () => {
      onChange([...attachments, { dataUrl: reader.result, type: file.type, name: file.name }])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleRemove(index) {
    const next = attachments.filter((_, i) => i !== index)
    onChange(next)
  }

  return (
    <div className="mt-3 bg-green-50 rounded-xl p-4 border border-green-100">
      <div className="flex items-center gap-2.5 mb-2.5">
        <FiImage size={18} className="text-green-600" />
        <span className="text-sm font-semibold text-green-700">Imagens de inspiração</span>
        <span className="text-sm text-green-500">({attachments.length}/{max})</span>
      </div>
      {product.inspirationInstruction && (
        <p className="text-sm text-green-600 mb-3">{product.inspirationInstruction}</p>
      )}
      <div className="flex gap-3 flex-wrap">
        {attachments.map((att, i) => (
          <div key={i} className="relative w-20 h-20">
            <img
              src={att.dataUrl || att.imageUrl}
              alt=""
              className="w-20 h-20 rounded-xl object-cover border border-green-200"
            />
            <button
              onClick={() => handleRemove(i)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm"
            >
              <FiX size={12} />
            </button>
          </div>
        ))}
        {attachments.length < max && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-green-300 flex flex-col items-center justify-center text-green-500 hover:border-green-500 hover:text-green-600 transition-colors"
          >
            <FiCamera size={22} />
            <span className="text-[11px] mt-1 font-medium">Foto</span>
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}

export default function StoreCart() {
  const { slug, store } = useOutletContext()
  const { items, updateQuantity, removeItem, updateAttachments, clearCart, total, count } = useCart()
  const { customer } = useStoreAuth()
  const navigate = useNavigate()
  const [notes, setNotes] = useState('')
  const [deliveryType, setDeliveryType] = useState('pickup')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [addressSource, setAddressSource] = useState('saved')
  const [customerProfile, setCustomerProfile] = useState(null)
  const [newAddr, setNewAddr] = useState({ zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', reference: '' })
  const [searchingCep, setSearchingCep] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState('')
  const [deliveryZones, setDeliveryZones] = useState([])
  const [sending, setSending] = useState(false)
  const [availableDates, setAvailableDates] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() } })

  // Modo edicao: StoreMyOrders salva um snapshot do pedido em sessionStorage
  // antes de navegar pra ca; lemos uma unica vez e usamos pra (a) pre-preencher
  // entrega/endereco/data, (b) alternar submit para PUT em /orders/:id
  const [editingOrder, setEditingOrder] = useState(() => {
    try {
      const raw = sessionStorage.getItem(`zapcakes_editing_order_${slug}`)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  useEffect(() => {
    if (!editingOrder) return
    if (editingOrder.notes) setNotes(editingOrder.notes)
    if (editingOrder.deliveryType) {
      const dt = String(editingOrder.deliveryType).toLowerCase()
      setDeliveryType(dt === 'entrega' || dt === 'delivery' ? 'delivery' : 'pickup')
    }
    if (editingOrder.deliveryAddress) {
      setDeliveryAddress(editingOrder.deliveryAddress)
      setAddressSource('other')
    }
    if (editingOrder.estimatedDeliveryDate) {
      const m = String(editingOrder.estimatedDeliveryDate).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+às\s+(\d{1,2}):(\d{2}))?/)
      if (m) {
        const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
        setSelectedDate(iso)
        if (m[4] && m[5]) setSelectedTime(`${m[4].padStart(2, '0')}:${m[5]}`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clearEditingFlag() {
    sessionStorage.removeItem(`zapcakes_editing_order_${slug}`)
    setEditingOrder(null)
  }

  useEffect(() => {
    storeApi.get(`/store/${slug}/availability`)
      .then(({ data }) => setAvailableDates(data))
      .catch(() => {})
    if (store?.deliveryEnabled) {
      storeApi.get(`/store/${slug}/delivery-zones`)
        .then(({ data }) => setDeliveryZones(data))
        .catch(() => {})
    }
    if (customer) {
      storeApi.get(`/store/${slug}/customer/me`)
        .then(({ data }) => setCustomerProfile(data))
        .catch(() => {})
    }
  }, [slug, store?.deliveryEnabled, customer])

  const savedAddress = customerProfile?.street
    ? [
        customerProfile.street,
        customerProfile.number,
        customerProfile.complement,
        customerProfile.neighborhood,
        customerProfile.city,
        customerProfile.state,
      ].filter(Boolean).join(', ')
    : null

  // Auto-populate delivery address when customer has saved address
  useEffect(() => {
    if (savedAddress && addressSource === 'saved') {
      setDeliveryAddress(savedAddress)
    } else if (!savedAddress && addressSource === 'saved') {
      setAddressSource('other')
    }
  }, [savedAddress, addressSource])

  // Build deliveryAddress string from newAddr fields when using "other"
  useEffect(() => {
    if (addressSource === 'other') {
      const parts = [newAddr.street, newAddr.number, newAddr.complement, newAddr.neighborhood, newAddr.city, newAddr.state].filter(Boolean)
      const addr = parts.join(', ')
      setDeliveryAddress(newAddr.reference ? `${addr} (Ref: ${newAddr.reference})` : addr)
    }
  }, [addressSource, newAddr])

  async function handleSearchCep() {
    const cep = newAddr.zipCode.replace(/\D/g, '')
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
      setNewAddr(prev => ({
        ...prev,
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
        complement: data.complemento || prev.complement,
      }))
    } catch {
      toast.error('Erro ao buscar CEP')
    } finally {
      setSearchingCep(false)
    }
  }

  function handleShareLocation() {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada pelo navegador')
      return
    }
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=pt-BR`)
          const data = await res.json()
          const a = data.address || {}
          setNewAddr(prev => ({
            ...prev,
            street: a.road || prev.street,
            number: a.house_number || prev.number,
            neighborhood: a.suburb || a.neighbourhood || prev.neighborhood,
            city: a.city || a.town || a.village || prev.city,
            state: a.state || prev.state,
            zipCode: a.postcode?.replace('-', '') || prev.zipCode,
          }))
          toast.success('Localização obtida!')
        } catch {
          toast.error('Erro ao obter endereço da localização')
        } finally {
          setGettingLocation(false)
        }
      },
      () => {
        toast.error('Permissão de localização negada')
        setGettingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  function getCalendarDays() {
    const { year, month } = calMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    return days
  }

  function isDateAvailable(day) {
    if (!day) return false
    const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return availableDates.some(d => d.date === dateStr)
  }

  function getDateStr(day) {
    return `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function isPastDate(day) {
    if (!day) return true
    const dateStr = getDateStr(day)
    const today = new Date().toISOString().slice(0, 10)
    return dateStr < today
  }

  function handleSelectDate(day) {
    if (!day || !isDateAvailable(day) || isPastDate(day)) {
      toast.error('Esta data não está disponível para agendamento')
      return
    }
    const dateStr = getDateStr(day)
    setSelectedDate(dateStr)
    setSelectedTime('')
    setShowCalendar(false)
  }

  function formatDateBR(dateStr) {
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  function prevMonth() {
    setCalMonth(prev => prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 })
  }

  function nextMonth() {
    setCalMonth(prev => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 })
  }

  async function handleOrder() {
    if (!customer) {
      toast('Faça login para finalizar o pedido', { icon: '🔑' })
      navigate(`/loja/${slug}/login`)
      return
    }

    if (!items.length) return

    setSending(true)
    try {
      // Upload inspiration images & separate combos from individual items
      const uploadedItems = []
      const combos = []
      for (const item of items) {
        const isCombo = typeof item.product.id === 'string' && item.product.id.startsWith('combo_')

        if (isCombo) {
          combos.push({ comboId: item.product.comboId, quantity: item.quantity })
          continue
        }

        const attachments = []
        if (item.attachments?.length) {
          for (const att of item.attachments) {
            if (att.dataUrl) {
              const res = await fetch(att.dataUrl)
              const blob = await res.blob()
              const formData = new FormData()
              formData.append('file', blob, att.name || 'inspiracao.jpg')
              const { data: uploaded } = await storeApi.post(`/store/${slug}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
              })
              attachments.push({ imageUrl: uploaded.url })
            } else if (att.imageUrl) {
              attachments.push({ imageUrl: att.imageUrl })
            }
          }

          // Validar imagens com IA
          if (attachments.length) {
            const { data: validation } = await storeApi.post(`/store/${slug}/validate-images`, {
              images: attachments,
              productName: item.product.name,
            })
            if (!validation.approved) {
              toast.error(validation.message || 'Imagens de inspiração rejeitadas. Verifique e tente novamente.', { duration: 5000 })
              setSending(false)
              return
            }
          }
        }

        const additionals = Array.isArray(item.additionals) && item.additionals.length > 0
          ? item.additionals.map((a) => ({ additionalId: a.id, quantity: a.quantity || 1 }))
          : undefined

        uploadedItems.push({
          productId: item.product.id,
          quantity: item.quantity,
          attachments: attachments.length ? attachments : undefined,
          additionals,
        })
      }

      if (!uploadedItems.length && !combos.length) {
        toast.error('Adicione pelo menos um item ao carrinho')
        setSending(false)
        return
      }

      const selectedZone = deliveryType === 'delivery' && selectedZoneId
        ? deliveryZones.find(z => z.id === Number(selectedZoneId))
        : null

      const payload = {
        items: uploadedItems.length ? uploadedItems : undefined,
        combos: combos.length ? combos : undefined,
        deliveryType,
        deliveryAddress: deliveryType === 'delivery' ? deliveryAddress : null,
        deliveryZoneId: selectedZone ? selectedZone.id : null,
        deliveryFee: selectedZone ? Number(selectedZone.fee) : null,
        notes: notes || null,
        estimatedDeliveryDate: selectedDate
          ? (selectedTime ? `${selectedDate}|${selectedTime}` : selectedDate)
          : null,
      }

      if (editingOrder) {
        await storeApi.put(`/store/${slug}/orders/${editingOrder.orderId}`, payload)
        clearCart()
        clearEditingFlag()
        toast.success('Pedido atualizado!')
        setTimeout(() => navigate(`/loja/${slug}/meus-pedidos`), 800)
        return
      }

      const { data } = await storeApi.post(`/store/${slug}/orders`, payload)

      clearCart()

      // Explosão de confete colorido
      const end = Date.now() + 1500
      const colors = ['#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#ef4444']
      ;(function frame() {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
        if (Date.now() < end) requestAnimationFrame(frame)
      })()
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors })

      toast.success('Pedido realizado com sucesso!')
      setTimeout(() => navigate(`/loja/${slug}/pedido/${data.publicId || data.id}`), 1800)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar pedido')
    } finally {
      setSending(false)
    }
  }

  if (!items.length) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-5xl mb-4">🛒</p>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Seu carrinho está vazio</h2>
        <p className="text-sm text-gray-500 mb-6">Adicione produtos para fazer seu pedido</p>
        <Link
          to={`/loja/${slug}`}
          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
        >
          <FiArrowLeft size={18} />
          Ver catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-8">
      <Link to={`/loja/${slug}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-green-600 mb-4">
        <FiArrowLeft size={16} />
        Voltar ao catálogo
      </Link>

      <h1 className="text-xl font-bold text-gray-800 mb-1">
        {editingOrder
          ? `Editando pedido #${String(editingOrder.orderNumber).padStart(5, '0')}`
          : `Seu pedido (${count} ${count === 1 ? 'item' : 'itens'})`}
      </h1>
      {editingOrder && (
        <div className="mb-4">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ Você está editando um pedido existente. As alterações substituem o pedido original. Você pode editar até 6h após o envio OU até anexar o comprovante.
          </p>
          <button
            onClick={() => {
              clearCart()
              clearEditingFlag()
              navigate(`/loja/${slug}/meus-pedidos`)
            }}
            className="mt-2 text-xs text-gray-500 underline hover:text-gray-700"
          >
            Cancelar edição e voltar para Meus pedidos
          </button>
        </div>
      )}

      {/* Items */}
      <div className="space-y-3 mb-6">
        {items.map(({ product, quantity, attachments, additionals }) => {
          const addonSum = Array.isArray(additionals)
            ? additionals.reduce((s, a) => s + Number(a.price) * (a.quantity || 1), 0)
            : 0
          const lineTotal = (Number(product.price) + addonSum) * quantity
          return (
          <div key={product.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">🧁</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{product.name}</p>
                <p className="text-green-600 font-bold text-sm">{fmtBRL(lineTotal)}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => quantity <= (product.minOrder || 1) ? removeItem(product.id) : updateQuantity(product.id, quantity - 1)}
                  className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300"
                >
                  {quantity <= (product.minOrder || 1) ? <FiTrash2 size={15} /> : <FiMinus size={16} />}
                </button>
                <span className="text-base font-bold w-6 text-center">{quantity}</span>
                <button
                  onClick={() => updateQuantity(product.id, quantity + 1)}
                  className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-white hover:bg-green-700"
                >
                  <FiPlus size={16} />
                </button>
              </div>
            </div>
            {Array.isArray(additionals) && additionals.length > 0 && (
              <div className="mt-2 pl-1 border-l-2 border-green-100 ml-1 space-y-0.5">
                {additionals.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs text-gray-600">
                    <span>+ {a.description}</span>
                    <span className="text-green-600 font-medium">{fmtBRL(Number(a.price) * (a.quantity || 1))}</span>
                  </div>
                ))}
              </div>
            )}
            {product.allowInspirationImages && (
              <InspirationUpload
                product={product}
                attachments={attachments || []}
                onChange={(atts) => updateAttachments(product.id, atts)}
              />
            )}
          </div>
          )
        })}
      </div>

      {/* Delivery type */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
        <p className="text-base font-semibold text-gray-800 mb-3">Tipo de entrega</p>
        {store?.deliveryEnabled ? (
          <select
            value={deliveryType}
            onChange={e => { setDeliveryType(e.target.value); if (e.target.value === 'pickup') setSelectedZoneId('') }}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base font-medium text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
          >
            <option value="pickup">📍 Retirar no local</option>
            <option value="delivery">🚗 Entrega</option>
          </select>
        ) : (
          <div className="py-3 px-4 bg-green-50 border border-green-200 rounded-xl text-base font-medium text-green-700 text-center">
            📍 Retirar no local
          </div>
        )}
        {deliveryType === 'delivery' && (
          <div className="mt-3 space-y-3">
            {deliveryZones.length > 0 && (
              <div>
                <label className="block text-base font-semibold text-gray-800 mb-1.5">Região de entrega</label>
                <select
                  value={selectedZoneId}
                  onChange={e => setSelectedZoneId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="">Selecione sua região</option>
                  {deliveryZones.map(z => (
                    <option key={z.id} value={z.id}>
                      {z.name} — {Number(z.fee) === 0 ? 'Grátis' : fmtBRL(z.fee)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5">Endereço de entrega</label>
              <select
                value={addressSource}
                onChange={e => {
                  setAddressSource(e.target.value)
                  if (e.target.value === 'saved' && savedAddress) {
                    setDeliveryAddress(savedAddress)
                  } else if (e.target.value === 'other') {
                    setDeliveryAddress('')
                    setNewAddr({ zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', reference: '' })
                  }
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
              >
                {savedAddress && <option value="saved">{savedAddress}</option>}
                <option value="other">Outro endereço</option>
              </select>
              {addressSource === 'other' && (
                <div className="mt-3 space-y-3">
                  {/* Botão compartilhar localização */}
                  <button
                    type="button"
                    onClick={handleShareLocation}
                    disabled={gettingLocation}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    {gettingLocation ? <FiLoader size={18} className="animate-spin" /> : <FiMapPin size={18} />}
                    {gettingLocation ? 'Obtendo localização...' : 'Usar minha localização atual'}
                  </button>

                  {/* CEP */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">CEP</label>
                    <div className="flex gap-2">
                      <input
                        value={newAddr.zipCode}
                        onChange={e => setNewAddr({ ...newAddr, zipCode: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                        placeholder="28000000"
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
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
                  </div>

                  {/* Rua + Nº */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Rua</label>
                      <input value={newAddr.street} onChange={e => setNewAddr({ ...newAddr, street: e.target.value })} placeholder="Rua / Avenida" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Nº</label>
                      <input value={newAddr.number} onChange={e => setNewAddr({ ...newAddr, number: e.target.value })} placeholder="123" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
                    </div>
                  </div>

                  {/* Complemento */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Complemento</label>
                    <input value={newAddr.complement} onChange={e => setNewAddr({ ...newAddr, complement: e.target.value })} placeholder="Apto, bloco, etc. (opcional)" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
                  </div>

                  {/* Bairro */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Bairro</label>
                    <input value={newAddr.neighborhood} onChange={e => setNewAddr({ ...newAddr, neighborhood: e.target.value })} placeholder="Bairro" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
                  </div>

                  {/* Cidade + UF */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Cidade</label>
                      <input value={newAddr.city} onChange={e => setNewAddr({ ...newAddr, city: e.target.value })} placeholder="Cidade" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">UF</label>
                      <input value={newAddr.state} onChange={e => setNewAddr({ ...newAddr, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="RJ" maxLength={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
                    </div>
                  </div>

                  {/* Referência */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Referência</label>
                    <textarea value={newAddr.reference} onChange={e => setNewAddr({ ...newAddr, reference: e.target.value })} placeholder="Próximo a... (opcional)" rows={3} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Agendar data */}
      {availableDates.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Programar data para {deliveryType === 'delivery' ? 'entrega' : 'retirada'}
          </p>

          {selectedDate && (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3">
              <div className="flex items-center gap-2.5">
                <FiCalendar size={18} className="text-green-600" />
                <span className="text-base font-semibold text-green-700">{formatDateBR(selectedDate)}</span>
              </div>
              <button
                onClick={() => { setSelectedDate(null); setSelectedTime('') }}
                className="text-green-600 hover:text-red-500 transition-colors"
              >
                <FiX size={18} />
              </button>
            </div>
          )}

          {!selectedDate && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Header mês */}
              <div className="flex items-center justify-between bg-green-600 text-white px-4 py-3">
                <button onClick={prevMonth} className="p-1 hover:bg-green-700 rounded-lg transition-colors">
                  <FiChevronLeft size={20} />
                </button>
                <span className="font-bold text-base">{MONTHS[calMonth.month]} {calMonth.year}</span>
                <button onClick={nextMonth} className="p-1 hover:bg-green-700 rounded-lg transition-colors">
                  <FiChevronRight size={20} />
                </button>
              </div>

              {/* Dias da semana */}
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
                ))}
              </div>

              {/* Dias */}
              <div className="grid grid-cols-7 p-2 gap-1">
                {getCalendarDays().map((day, i) => {
                  if (!day) return <div key={i} />
                  const available = isDateAvailable(day)
                  const past = isPastDate(day)
                  const selected = selectedDate === getDateStr(day)
                  const today = getDateStr(day) === new Date().toISOString().slice(0, 10)

                  return (
                    <button
                      key={i}
                      onClick={() => handleSelectDate(day)}
                      disabled={past && !available}
                      className={`relative aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all
                        ${selected ? 'bg-green-600 text-white shadow-md' : ''}
                        ${!selected && available && !past ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' : ''}
                        ${!selected && !available && !past ? 'text-gray-300 cursor-not-allowed' : ''}
                        ${past ? 'text-gray-300 cursor-not-allowed' : ''}
                        ${today && !selected ? 'ring-2 ring-green-400' : ''}
                      `}
                    >
                      {day}
                      {available && !past && !selected && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legenda */}
              <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-green-50 border border-green-200" />
                  Disponível
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-gray-100" />
                  Indisponível
                </div>
              </div>
          </div>
          )}

          {/* Seleção de horário */}
          {selectedDate && (
            <div className="mt-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Horário previsto para {deliveryType === 'delivery' ? 'entrega' : 'retirada'}
              </label>
              <select
                value={selectedTime}
                onChange={e => setSelectedTime(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-base text-gray-700 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">Selecione o horário</option>
                {Array.from({ length: 21 }, (_, i) => {
                  const hour = 8 + Math.floor(i / 2)
                  const min = i % 2 === 0 ? '00' : '30'
                  const value = `${String(hour).padStart(2, '0')}:${min}`
                  return <option key={value} value={value}>{value}</option>
                })}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Observações</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Alguma observação? (opcional)"
          rows={3}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
        />
      </div>

      {/* Total + Order button */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        {(() => {
          const selectedZone = deliveryType === 'delivery' && selectedZoneId
            ? deliveryZones.find(z => z.id === Number(selectedZoneId))
            : null
          const deliveryFee = selectedZone ? Number(selectedZone.fee) : 0
          const grandTotal = total + deliveryFee
          return (
            <>
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-500 text-sm">Subtotal</span>
                <span className="text-sm font-medium text-gray-700">{fmtBRL(total)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-500 text-sm">Taxa de entrega ({selectedZone.name})</span>
                  <span className="text-sm font-medium text-gray-700">{fmtBRL(deliveryFee)}</span>
                </div>
              )}
              {deliveryType === 'delivery' && selectedZone && deliveryFee === 0 && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-500 text-sm">Taxa de entrega ({selectedZone.name})</span>
                  <span className="text-sm font-medium text-green-600">Grátis</span>
                </div>
              )}
              <div className="flex justify-between items-center mb-2 pt-1 border-t border-gray-100">
                <span className="text-gray-600 font-medium">Total</span>
                <span className="text-xl font-bold text-gray-800">{fmtBRL(grandTotal)}</span>
              </div>
            </>
          )
        })()}
        {store?.useReservation && store.reservationPercent > 0 && total > 0 && (
          <div className="mb-4 px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-amber-800">Valor de reserva ({store.reservationPercent}%)</span>
              <span className="text-base font-bold text-amber-800">{fmtBRL(total * store.reservationPercent / 100)}</span>
            </div>
            <p className="text-xs text-amber-600 leading-relaxed">
              Para confirmar seu pedido, é necessário o pagamento antecipado de {store.reservationPercent}% do valor total como reserva. O restante ({fmtBRL(total - (total * store.reservationPercent / 100))}) será pago na entrega/retirada.
            </p>
          </div>
        )}
        {store?.pixKey && (
          <div className="mb-4 px-3 py-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-1">Chave PIX para pagamento</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-700 font-mono break-all flex-1">{store.pixKey}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(store.pixKey)
                  toast.success('Chave PIX copiada!')
                }}
                className="p-1.5 text-green-600 hover:text-green-800 transition-colors flex-shrink-0"
                title="Copiar chave PIX"
              >
                <FiCopy size={16} />
              </button>
            </div>
          </div>
        )}
        {!(store?.useReservation && store.reservationPercent > 0 && total > 0) && !store?.pixKey && <div className="mb-2" />}
        <button
          onClick={handleOrder}
          disabled={sending}
          className="w-full py-3.5 bg-green-600 text-white rounded-xl font-semibold text-base hover:bg-green-700 transition-colors disabled:opacity-50 shadow-lg shadow-green-600/30"
        >
          {sending
            ? (editingOrder ? 'Salvando alterações...' : 'Analisando e enviando pedido...')
            : !customer ? 'Fazer login para pedir'
            : editingOrder ? 'Salvar alterações'
            : 'Finalizar pedido'}
        </button>
      </div>
    </div>
  )
}
