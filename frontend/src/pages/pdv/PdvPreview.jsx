import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FiCamera, FiMoreVertical, FiTrash2, FiMinus, FiPlus, FiCloud, FiCloudOff, FiRefreshCw,
  FiArrowUpCircle, FiArrowDownCircle, FiLock, FiUnlock, FiMoon, FiSun, FiLogOut, FiSearch,
} from 'react-icons/fi'
import { LuScanBarcode, LuScale } from 'react-icons/lu'
import { useTheme } from '../../contexts/ThemeContext.jsx'
import logo from '../../assets/logo.svg'
import { PRODUCTS, CATEGORIES, CATEGORY_COLORS, PAYMENT_METHODS, brl, kg, round2, parseScaleLabel } from './pdvMock.js'
import { PaymentModal, WeightModal, CashMoveModal, METHOD_ICONS } from './PdvModals.jsx'
import { CameraOverlay } from './PdvCamera.jsx'
import { OpenCashScreen, CloseCashScreen } from './PdvCashScreens.jsx'

// Protótipo de layout do PDV, versão PC (dados de exemplo, sem backend).
// Leitor de código como entrada principal, tabela de itens, painel de total e atalhos de teclado.

let keySeq = 0
const newKey = () => ++keySeq

function itemFrom(product, qty, total) {
  return {
    key: newKey(), productId: product.id, name: product.name, soldBy: product.soldBy, price: product.price, qty,
    total: total ?? round2(product.price * qty),
    code: product.barcode || (product.scaleCode && `Balança ${product.scaleCode}`),
  }
}

const DEMO_CART = [
  itemFrom(PRODUCTS[0], 0.512),
  itemFrom(PRODUCTS[1], 6),
  itemFrom(PRODUCTS[11], 2),
  itemFrom(PRODUCTS[8], 1),
]

export default function PdvPreview() {
  const { dark, toggleTheme } = useTheme()
  const [screen, setScreen] = useState('sale') // open | sale | close
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(3)
  const [cart, setCart] = useState(DEMO_CART)
  const [lastKey, setLastKey] = useState(DEMO_CART[DEMO_CART.length - 1].key)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todos')
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState(null) // { type: 'payment' | 'weight' | 'cash' | 'camera', ... }
  const [now, setNow] = useState(new Date())
  const scanRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const subtotal = round2(cart.reduce((s, i) => s + i.total, 0))
  const volumes = cart.reduce((s, i) => s + (i.soldBy === 'KG' ? 1 : i.qty), 0)
  const lastItem = cart.find((i) => i.key === lastKey) || cart[cart.length - 1]

  const focusScan = useCallback(() => setTimeout(() => scanRef.current?.focus(), 0), [])

  const addItem = useCallback((product, qty = 1, total) => {
    setCart((prev) => {
      // Mesmo produto por unidade soma na mesma linha
      if (product.soldBy === 'UN' && total === undefined) {
        const existing = prev.find((i) => i.productId === product.id && i.soldBy === 'UN')
        if (existing) {
          setLastKey(existing.key)
          return prev.map((i) => (i.key === existing.key ? { ...i, qty: i.qty + qty, total: round2(i.price * (i.qty + qty)) } : i))
        }
      }
      const item = itemFrom(product, qty, total)
      setLastKey(item.key)
      return [...prev, item]
    })
  }, [])

  const pickProduct = useCallback((product) => {
    setQuery('')
    if (product.soldBy === 'KG') setModal({ type: 'weight', product })
    else { addItem(product); focusScan() }
  }, [addItem, focusScan])

  // Leitura do campo: código de barras, etiqueta da balança, "3*código" ou nome
  const handleCode = useCallback((raw) => {
    const text = raw.trim()
    if (!text) return
    let qty = 1
    let code = text
    const mult = text.match(/^(\d+)\s*[*xX]\s*(.+)$/)
    if (mult) { qty = Number(mult[1]); code = mult[2].trim() }

    const byBarcode = PRODUCTS.find((p) => p.barcode === code)
    if (byBarcode) { addItem(byBarcode, qty); setQuery(''); return }

    const label = parseScaleLabel(code)
    if (label) { addItem(label.product, label.weight, label.total); setQuery(''); return }

    const byName = PRODUCTS.filter((p) => p.name.toLowerCase().includes(code.toLowerCase()))
    if (byName.length === 1) { pickProduct(byName[0]); return }
    toast.error(byName.length ? 'Mais de um produto encontrado. Escolha na lista.' : 'Produto não encontrado')
  }, [addItem, pickProduct])

  function changeQty(key, delta) {
    setCart((prev) => prev.flatMap((i) => {
      if (i.key !== key) return [i]
      const qty = i.qty + delta
      return qty <= 0 ? [] : [{ ...i, qty, total: round2(i.price * qty) }]
    }))
  }

  function removeItem(key) {
    setCart((prev) => prev.filter((i) => i.key !== key))
  }

  function openPayment(method = 'CASH') {
    if (cart.length === 0) return toast.error('Adicione produtos antes de cobrar')
    setModal({ type: 'payment', method })
  }

  function finishSale() {
    setModal(null)
    setCart([])
    setQuery('')
    if (!online) setPending((p) => p + 1)
    focusScan()
  }

  function closeModal() {
    setModal(null)
    focusScan()
  }

  // Atalhos de teclado
  useEffect(() => {
    if (screen !== 'sale' || modal) return
    function onKey(e) {
      if (e.key === 'F2') { e.preventDefault(); scanRef.current?.focus() }
      else if (e.key === 'F4') { e.preventDefault(); setModal({ type: 'weight', product: PRODUCTS[0] }) }
      else if (e.key === 'F7') { e.preventDefault(); setModal({ type: 'camera' }) }
      else if (e.key === 'F8') { e.preventDefault(); setModal({ type: 'cash', initialType: 'SANGRIA' }) }
      else if (e.key === 'F9') { e.preventDefault(); if (lastItem) removeItem(lastItem.key) }
      else if (e.key === 'F10') { e.preventDefault(); openPayment() }
      else if (e.key === 'Escape') { setQuery('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2 || /^\d+$/.test(q) || /^\d+\s*[*xX]/.test(q)) return []
    return PRODUCTS.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query])

  // Item marcado na lista de sugestões (setas ↑ ↓ + Enter)
  const [activeIdx, setActiveIdx] = useState(0)
  useEffect(() => { setActiveIdx(0) }, [query])

  function handleScanKeyDown(e) {
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pickProduct(suggestions[activeIdx] || suggestions[0])
    }
  }

  const gridProducts = category === 'Todos' ? PRODUCTS : PRODUCTS.filter((p) => p.category === category)

  return (
    <div className="h-screen min-w-[1024px] flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Aviso do protótipo */}
      <div className="shrink-0 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-xs px-4 py-1.5 text-center">
        Protótipo de layout (versão PC) · dados de exemplo · teste os códigos <b>7890000000017</b>, <b>3*2900000000025</b> e a etiqueta da balança <b>2000001008508</b>
      </div>

      {/* Cabeçalho */}
      <header className="shrink-0 flex items-center gap-4 bg-green-700 dark:bg-gray-800 text-white px-5 h-14">
        <img src={logo} alt="ZapCakes" className="h-7 brightness-0 invert dark:brightness-100 dark:invert-0" />
        <span className="text-xs font-bold tracking-wider bg-white/15 rounded px-2 py-0.5">PDV</span>
        <div className="flex flex-col leading-tight pl-4 border-l border-white/20">
          <span className="text-sm font-semibold">Caixa 01 · Balcão</span>
          <span className="text-xs text-green-200 dark:text-gray-400">Operador: Ana · aberto às 06:02</span>
        </div>
        <div className="flex-1" />
        <SyncStatus online={online} pending={pending} onSync={() => { if (online && pending) { setPending(0); toast.success('Vendas sincronizadas') } }} />
        <span className="text-lg font-semibold tabular-nums">
          {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="p-2 -mr-2 rounded-lg hover:bg-white/10" aria-label="Menu do caixa">
            <FiMoreVertical size={22} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-12 z-40 w-64 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-2xl border border-gray-200 dark:border-gray-700 py-2 text-sm">
                <MenuItem icon={FiArrowUpCircle} label="Sangria" hint="F8" onClick={() => { setMenuOpen(false); setModal({ type: 'cash', initialType: 'SANGRIA' }) }} />
                <MenuItem icon={FiArrowDownCircle} label="Suprimento" onClick={() => { setMenuOpen(false); setModal({ type: 'cash', initialType: 'SUPRIMENTO' }) }} />
                <MenuItem icon={FiLock} label="Fechar caixa" onClick={() => { setMenuOpen(false); setScreen('close') }} />
                <hr className="my-2 border-gray-200 dark:border-gray-700" />
                <p className="px-4 pb-1 text-[11px] uppercase tracking-wide text-gray-400">Protótipo</p>
                <MenuItem icon={online ? FiCloudOff : FiCloud} label={online ? 'Simular sem internet' : 'Simular internet de volta'} onClick={() => { setMenuOpen(false); setOnline((v) => !v) }} />
                <MenuItem icon={FiUnlock} label="Ver tela de abertura" onClick={() => { setMenuOpen(false); setScreen('open') }} />
                <MenuItem icon={dark ? FiSun : FiMoon} label={dark ? 'Tema claro' : 'Tema escuro'} onClick={() => { setMenuOpen(false); toggleTheme() }} />
                <hr className="my-2 border-gray-200 dark:border-gray-700" />
                <Link to="/client" className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <FiLogOut size={18} className="text-gray-500" /> Sair do PDV
                </Link>
              </div>
            </>
          )}
        </div>
      </header>

      {screen === 'open' && <OpenCashScreen onOpen={() => { setScreen('sale'); setCart([]); toast.success('Caixa aberto'); focusScan() }} />}
      {screen === 'close' && <CloseCashScreen pending={pending} online={online} onBack={() => setScreen('sale')} onClosed={() => setScreen('open')} />}

      {screen === 'sale' && (
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
          {/* ---------------- Coluna principal ---------------- */}
          <section className="min-h-0 flex flex-col">
            {/* Campo do leitor */}
            <div className="shrink-0 px-5 pt-5 pb-3">
              <form onSubmit={(e) => { e.preventDefault(); handleCode(query) }} className="flex gap-3">
                <div className="relative flex-1">
                  <LuScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-green-700 dark:text-green-400" size={26} />
                  <input
                    ref={scanRef}
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleScanKeyDown}
                    role="combobox"
                    aria-expanded={suggestions.length > 0}
                    aria-controls="pdv-suggestions"
                    aria-activedescendant={suggestions.length ? `pdv-sug-${suggestions[activeIdx]?.id}` : undefined}
                    placeholder="Bipe o código de barras ou digite o nome do produto"
                    className="w-full pl-14 pr-4 py-4 rounded-xl border-2 border-green-600 bg-white dark:bg-gray-800 text-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-green-600/20"
                  />
                  {suggestions.length > 0 && (
                    <div id="pdv-suggestions" role="listbox" className="absolute z-20 left-0 right-0 top-full mt-1 rounded-xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      {suggestions.map((p, idx) => (
                        <button
                          key={p.id}
                          id={`pdv-sug-${p.id}`}
                          type="button"
                          role="option"
                          aria-selected={idx === activeIdx}
                          tabIndex={-1}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => pickProduct(p)}
                          className={`w-full flex items-center justify-between px-5 py-3 text-left border-l-4 ${
                            idx === activeIdx
                              ? 'bg-green-100 dark:bg-green-900/50 border-green-600'
                              : 'border-transparent'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <FiSearch className="text-gray-400" size={14} />
                            {p.name}
                            {p.soldBy === 'KG' && <LuScale className="text-gray-400" size={14} />}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">{brl(p.price)}{p.soldBy === 'KG' ? '/kg' : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setModal({ type: 'camera' })}
                  className="shrink-0 flex items-center gap-2 px-5 rounded-xl bg-gray-900 dark:bg-gray-700 text-white hover:bg-black"
                  title="Ler pela câmera (F7)"
                >
                  <FiCamera size={20} />
                  <span className="text-sm font-medium">Câmera</span>
                </button>
              </form>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Dica: <b>3*código</b> lança 3 unidades. Na busca por nome, use <b>↑ ↓</b> para escolher e <b>Enter</b> para lançar. A etiqueta da balança é reconhecida sozinha.
              </p>
            </div>

            {/* Itens da venda */}
            <CartTable cart={cart} lastKey={lastKey} onQty={changeQty} onRemove={removeItem}
              onWeight={(i) => setModal({ type: 'weight', product: PRODUCTS.find((p) => p.id === i.productId), itemKey: i.key })} />

            {/* Produtos sem código (pão, café, salgados) */}
            <div className="shrink-0 mx-5 mb-3 rounded-2xl bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex gap-1.5 px-3 pt-3 overflow-x-auto">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${
                      category === c ? 'bg-green-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-5 xl:grid-cols-6 gap-2 p-3 max-h-[188px] [@media(max-height:820px)]:max-h-[126px] overflow-y-auto">
                {gridProducts.map((p) => <ProductButton key={p.id} product={p} onClick={() => pickProduct(p)} />)}
              </div>
            </div>

            {/* Atalhos */}
            <div className="shrink-0 flex flex-wrap gap-x-6 gap-y-1 px-5 py-2.5 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
              <Shortcut k="F2" label="Buscar" />
              <Shortcut k="F4" label="Peso manual" />
              <Shortcut k="F7" label="Câmera" />
              <Shortcut k="F8" label="Sangria" />
              <Shortcut k="F9" label="Remover último item" />
              <Shortcut k="F10" label="Cobrar" />
              <Shortcut k="Esc" label="Limpar / fechar janela" />
            </div>
          </section>

          {/* ---------------- Painel lateral ---------------- */}
          <aside className="min-h-0 flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
            {/* Último item lançado */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Último item</p>
              {lastItem ? (
                <>
                  <p className="mt-1 text-2xl font-semibold truncate">{lastItem.name}</p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {lastItem.soldBy === 'KG' ? kg(lastItem.qty) : `${lastItem.qty} un`} × {brl(lastItem.price)}{lastItem.soldBy === 'KG' ? '/kg' : ''}
                  </p>
                  <p className="text-4xl font-bold text-green-700 dark:text-green-400 mt-2 tabular-nums">{brl(lastItem.total)}</p>
                </>
              ) : (
                <p className="mt-1 text-gray-400">Nenhum item lançado</p>
              )}
            </div>

            <div className="flex-1" />

            {/* Totais e cobrança */}
            <div className="p-6 space-y-4">
              <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex justify-between"><span>Itens</span><span>{cart.length}</span></div>
                <div className="flex justify-between"><span>Volumes</span><span>{volumes}</span></div>
              </div>
              <div className="flex items-end justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xl font-medium text-gray-700 dark:text-gray-300">Total</span>
                <span className="text-5xl font-bold tabular-nums">{brl(subtotal)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = METHOD_ICONS[m.id]
                  return (
                    <button
                      key={m.id}
                      onClick={() => openPayment(m.id)}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-green-600 hover:bg-green-50 dark:hover:bg-gray-700 font-medium"
                    >
                      <Icon size={20} className="text-gray-500 dark:text-gray-400" /> {m.short}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => openPayment()}
                disabled={cart.length === 0}
                className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-2xl font-bold"
              >
                Cobrar <span className="text-sm font-medium opacity-75">(F10)</span>
              </button>
              <button
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                className="w-full py-1.5 text-sm text-gray-500 hover:text-red-600 disabled:opacity-40"
              >
                Cancelar venda
              </button>
            </div>
          </aside>
        </div>
      )}

      {modal?.type === 'payment' && (
        <PaymentModal subtotal={subtotal} initialMethod={modal.method} online={online} onClose={closeModal} onFinish={finishSale} />
      )}
      {modal?.type === 'weight' && (
        <WeightModal
          product={modal.product}
          onClose={closeModal}
          onConfirm={(w) => {
            if (modal.itemKey) {
              setCart((prev) => prev.map((i) => (i.key === modal.itemKey ? { ...i, qty: w, total: round2(i.price * w) } : i)))
              setLastKey(modal.itemKey)
            } else {
              addItem(modal.product, w)
            }
            closeModal()
          }}
        />
      )}
      {modal?.type === 'cash' && (
        <CashMoveModal
          initialType={modal.initialType}
          onClose={closeModal}
          onConfirm={({ type, amount }) => { closeModal(); toast.success(`${type === 'SANGRIA' ? 'Sangria' : 'Suprimento'} de ${brl(amount)} registrado`) }}
        />
      )}
      {modal?.type === 'camera' && (
        <CameraOverlay
          onClose={closeModal}
          onDetect={(code) => {
            // Pesquisa o produto na hora, como o leitor USB. Se não achar, o código fica no campo para conferir.
            setQuery(code)
            closeModal()
            handleCode(code)
            setTimeout(() => scanRef.current?.select(), 0)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function SyncStatus({ online, pending, onSync }) {
  return (
    <button
      onClick={onSync}
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${online ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-amber-400 text-amber-950'}`}
      title={online ? 'Sincronizar agora' : 'Sem internet. As vendas ficam salvas no computador.'}
    >
      {online ? <FiCloud size={14} /> : <FiCloudOff size={14} />}
      {online ? 'Online' : 'Offline'}
      {pending > 0 && (
        <span className="flex items-center gap-1">
          · {pending} {pending === 1 ? 'venda pendente' : 'vendas pendentes'}
          {online && <FiRefreshCw size={12} />}
        </span>
      )}
    </button>
  )
}

function MenuItem({ icon: Icon, label, hint, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700">
      <Icon size={18} className="text-gray-500" />
      <span className="flex-1">{label}</span>
      {hint && <kbd className="text-xs text-gray-400">{hint}</kbd>}
    </button>
  )
}

function Shortcut({ k, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-mono text-[11px]">{k}</kbd>
      {label}
    </span>
  )
}

function ProductButton({ product, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border border-gray-200 dark:border-gray-700 border-l-4 ${CATEGORY_COLORS[product.category] || ''} px-3 py-2 hover:bg-green-50 dark:hover:bg-gray-700 hover:border-green-400`}
    >
      <span className="block text-sm font-medium leading-tight truncate">{product.name}</span>
      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        {brl(product.price)}{product.soldBy === 'KG' ? '/kg' : ''}
        {product.soldBy === 'KG' && <LuScale size={12} />}
      </span>
    </button>
  )
}

function QtyControl({ item, onQty, onWeight }) {
  if (item.soldBy === 'KG') {
    return (
      <button onClick={() => onWeight(item)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm tabular-nums" title="Alterar peso">
        {kg(item.qty)}
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onQty(item.key, -1)} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center" aria-label="Diminuir"><FiMinus size={15} /></button>
      <span className="w-9 text-center font-semibold tabular-nums">{item.qty}</span>
      <button onClick={() => onQty(item.key, 1)} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center" aria-label="Aumentar"><FiPlus size={15} /></button>
    </div>
  )
}

function CartTable({ cart, lastKey, onQty, onRemove, onWeight }) {
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [cart.length])

  if (cart.length === 0) {
    return (
      <div className="flex-1 min-h-0 mx-5 mb-3 rounded-2xl bg-white dark:bg-gray-800 shadow-sm flex flex-col items-center justify-center gap-3 text-gray-400">
        <LuScanBarcode size={64} />
        <p className="text-xl">Bipe o primeiro produto</p>
        <p className="text-sm">ou escolha um produto sem código abaixo</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 mx-5 mb-3 rounded-2xl bg-white dark:bg-gray-800 shadow-sm overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left font-medium px-5 py-3 w-14">#</th>
            <th className="text-left font-medium px-4 py-3">Produto</th>
            <th className="text-center font-medium px-4 py-3 w-40">Qtd</th>
            <th className="text-right font-medium px-4 py-3 w-32">Unitário</th>
            <th className="text-right font-medium px-4 py-3 w-32">Total</th>
            <th className="w-14" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {cart.map((item, idx) => (
            <tr key={item.key} className={item.key === lastKey ? 'bg-green-100 dark:bg-green-900/40' : ''}>
              <td className="px-5 py-3 text-gray-400 tabular-nums">{String(idx + 1).padStart(2, '0')}</td>
              <td className="px-4 py-3">
                <p className="font-medium text-base">{item.name}</p>
                {item.code && <p className="text-xs text-gray-400 tabular-nums">{item.code}</p>}
              </td>
              <td className="px-4 py-3"><div className="flex justify-center"><QtyControl item={item} onQty={onQty} onWeight={onWeight} /></div></td>
              <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 tabular-nums">{brl(item.price)}{item.soldBy === 'KG' ? '/kg' : ''}</td>
              <td className="px-4 py-3 text-right font-semibold text-base tabular-nums">{brl(item.total)}</td>
              <td className="px-3 py-3 text-right">
                <button onClick={() => onRemove(item.key)} className="p-2 text-gray-400 hover:text-red-600" aria-label="Remover item"><FiTrash2 size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div ref={endRef} />
    </div>
  )
}
