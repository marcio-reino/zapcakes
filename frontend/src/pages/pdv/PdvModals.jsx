import { useState, useEffect, useCallback, useRef } from 'react'
import { FiX, FiCheckCircle, FiDelete, FiTrash2, FiZap, FiArrowDownCircle, FiArrowUpCircle, FiCloudOff, FiCloud } from 'react-icons/fi'
import { LuBanknote, LuCreditCard, LuWallet, LuScale } from 'react-icons/lu'
import { MdPix } from 'react-icons/md'
import { PAYMENT_METHODS, brl, kg, round2 } from './pdvMock.js'

export const METHOD_ICONS = { CASH: LuBanknote, PIX: MdPix, DEBIT: LuCreditCard, CREDIT: LuWallet }

// ---------------------------------------------------------------------------
// Entrada numérica estilo maquininha: os dígitos entram pela direita (centavos ou gramas).
// Funciona pelo teclado numérico na tela e pelo teclado físico.
// ---------------------------------------------------------------------------
export function useDigitEntry(initial = 0, { onEnter, maxDigits = 8 } = {}) {
  const [value, setValue] = useState(initial)
  const fresh = useRef(true) // o primeiro dígito substitui o valor sugerido

  const press = useCallback((key) => {
    setValue((prev) => {
      if (key === 'C') return 0
      if (key === 'BACK') return Math.floor(prev / 10)
      let next = fresh.current ? 0 : prev
      for (const ch of key) next = next * 10 + Number(ch)
      return String(next).length > maxDigits ? prev : next
    })
    fresh.current = false
  }, [maxDigits])

  const reset = useCallback((v = 0) => {
    setValue(v)
    fresh.current = true
  }, [])

  const enterRef = useRef(onEnter)
  enterRef.current = onEnter

  useEffect(() => {
    function onKey(e) {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key) }
      else if (e.key === 'Backspace') { e.preventDefault(); press('BACK') }
      else if (e.key === 'Delete') { e.preventDefault(); press('C') }
      else if (e.key === 'Enter') { e.preventDefault(); enterRef.current?.() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  return { value, press, reset }
}

export function Numpad({ onPress, className = '' }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BACK']
  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onPress(k)}
          className={`h-14 lg:h-12 rounded-xl text-2xl lg:text-xl font-semibold select-none active:scale-95 transition-transform ${
            k === 'C'
              ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
          }`}
        >
          {k === 'BACK' ? <FiDelete className="mx-auto" size={22} /> : k}
        </button>
      ))}
    </div>
  )
}

// Janela: tela cheia no celular, centralizada no tablet e no PC
export function PdvModal({ title, onClose, children, footer, size = 'md:max-w-lg' }) {
  // Tira o foco do campo do leitor para o teclado físico digitar na janela
  useEffect(() => { document.activeElement?.blur?.() }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 animate-fadeIn">
      <div className={`w-full h-[100dvh] md:h-auto md:max-h-[92vh] ${size} bg-white dark:bg-gray-800 md:rounded-2xl shadow-2xl flex flex-col animate-slideDown`}>
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-xl md:text-lg font-bold text-gray-800 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Fechar">
            <FiX size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">{children}</div>
        {footer && <div className="px-4 md:px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pagamento: várias formas na mesma venda, desconto e troco
// ---------------------------------------------------------------------------
export function PaymentModal({ subtotal, initialMethod = 'CASH', online, onClose, onFinish }) {
  const [discount, setDiscount] = useState(0)
  const [showDiscount, setShowDiscount] = useState(false)
  const [payments, setPayments] = useState([])
  const [method, setMethod] = useState(initialMethod)
  const [done, setDone] = useState(null)

  const due = round2(Math.max(0, subtotal - discount))
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0))
  const remaining = round2(Math.max(0, due - paid))
  const change = round2(Math.max(0, paid - due))

  const entry = useDigitEntry(Math.round(remaining * 100), { onEnter: () => handleEnter() })

  function selectMethod(id) {
    setMethod(id)
    entry.reset(Math.round(remaining * 100))
  }

  function addPayment() {
    let amount = entry.value / 100
    if (amount <= 0) return
    // Só dinheiro pode passar do valor (gera troco)
    if (method !== 'CASH' && amount > remaining) amount = remaining
    if (amount <= 0) return
    const next = [...payments, { id: Date.now(), method, amount }]
    setPayments(next)
    const left = round2(Math.max(0, due - next.reduce((s, p) => s + p.amount, 0)))
    entry.reset(Math.round(left * 100))
  }

  function removePayment(id) {
    const next = payments.filter((p) => p.id !== id)
    setPayments(next)
    entry.reset(Math.round(Math.max(0, due - next.reduce((s, p) => s + p.amount, 0)) * 100))
  }

  function finish() {
    if (remaining > 0 || payments.length === 0) return
    setDone({ change })
  }

  function handleEnter() {
    if (done) return onFinish(done)
    if (remaining <= 0 && payments.length) finish()
    else addPayment()
  }

  if (done) {
    return (
      <PdvModal title="Venda concluída" onClose={() => onFinish(done)}>
        <div className="flex flex-col items-center text-center py-6 gap-4">
          <FiCheckCircle className="text-green-600" size={72} />
          {done.change > 0 ? (
            <>
              <p className="text-lg text-gray-600 dark:text-gray-300">Troco</p>
              <p className="text-5xl font-bold text-green-700 dark:text-green-400">{brl(done.change)}</p>
            </>
          ) : (
            <p className="text-2xl font-semibold text-gray-800 dark:text-white">Pagamento recebido</p>
          )}
          <p className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full ${online ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
            {online ? <FiCloud /> : <FiCloudOff />}
            {online ? 'Venda enviada ao servidor' : 'Venda salva no aparelho. Será enviada quando a internet voltar.'}
          </p>
          <button autoFocus onClick={() => onFinish(done)} className="mt-4 w-full md:w-auto md:px-10 py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-lg font-semibold">
            Nova venda <span className="opacity-70 text-sm">(Enter)</span>
          </button>
        </div>
      </PdvModal>
    )
  }

  const quick = method === 'CASH'
    ? [{ label: 'Exato', value: remaining }, { label: 'R$ 10', value: 10 }, { label: 'R$ 20', value: 20 }, { label: 'R$ 50', value: 50 }, { label: 'R$ 100', value: 100 }]
    : [{ label: 'Valor restante', value: remaining }]

  return (
    <PdvModal
      title="Pagamento"
      onClose={onClose}
      size="md:max-w-3xl"
      footer={
        <button
          onClick={finish}
          disabled={remaining > 0 || payments.length === 0}
          className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 text-white text-lg font-semibold"
        >
          Finalizar venda
        </button>
      }
    >
      <div className="grid md:grid-cols-2 gap-5 md:gap-6">
        {/* Resumo */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/40 p-4 space-y-2">
            <Row label="Subtotal" value={brl(subtotal)} />
            <div className="flex items-center justify-between text-base md:text-sm">
              <span className="text-gray-600 dark:text-gray-400">Desconto</span>
              {showDiscount ? (
                <input
                  autoFocus
                  inputMode="decimal"
                  placeholder="0,00"
                  className="w-28 text-right px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white text-base md:text-sm"
                  onChange={(e) => setDiscount(Math.min(subtotal, Number(e.target.value.replace(/\./g, '').replace(',', '.')) || 0))}
                  onBlur={() => entry.reset(Math.round(Math.max(0, round2(subtotal - discount) - paid) * 100))}
                />
              ) : (
                <button onClick={() => setShowDiscount(true)} className="text-green-700 dark:text-green-400 font-medium">
                  {discount > 0 ? `- ${brl(discount)}` : 'Aplicar'}
                </button>
              )}
            </div>
            <div className="flex items-end justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-300 font-medium">Total</span>
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{brl(due)}</span>
            </div>
          </div>

          {payments.length > 0 && (
            <div className="space-y-2">
              {payments.map((p) => {
                const Icon = METHOD_ICONS[p.method]
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <Icon size={20} className="text-gray-500 dark:text-gray-400" />
                    <span className="flex-1 text-gray-700 dark:text-gray-200">{PAYMENT_METHODS.find((m) => m.id === p.method).label}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{brl(p.amount)}</span>
                    <button onClick={() => removePayment(p.id)} className="p-1.5 text-gray-400 hover:text-red-600" aria-label="Remover pagamento">
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {change > 0 ? (
            <div className="rounded-2xl bg-green-50 dark:bg-green-900/30 p-4 flex items-center justify-between">
              <span className="text-green-800 dark:text-green-300 font-medium">Troco</span>
              <span className="text-3xl font-bold text-green-700 dark:text-green-400">{brl(change)}</span>
            </div>
          ) : (
            <div className={`rounded-2xl p-4 flex items-center justify-between ${remaining > 0 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-green-50 dark:bg-green-900/30'}`}>
              <span className={`font-medium ${remaining > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-green-800 dark:text-green-300'}`}>
                {remaining > 0 ? 'Falta pagar' : 'Pago'}
              </span>
              <span className={`text-2xl font-bold ${remaining > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-400'}`}>{brl(remaining)}</span>
            </div>
          )}
        </div>

        {/* Entrada do pagamento */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-4 md:grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => {
              const Icon = METHOD_ICONS[m.id]
              const active = method === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => selectMethod(m.id)}
                  className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-3 rounded-xl border-2 text-sm font-medium ${
                    active
                      ? 'border-green-600 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Icon size={20} />
                  {m.short}
                </button>
              )
            })}
          </div>

          <div className="rounded-2xl border-2 border-green-600 px-4 py-3 text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-left">Valor em {PAYMENT_METHODS.find((m) => m.id === method).short.toLowerCase()}</p>
            <p className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums">{brl(entry.value / 100)}</p>
          </div>

          <div className="flex gap-2 overflow-x-auto">
            {quick.map((q) => (
              <button
                key={q.label}
                onClick={() => entry.reset(Math.round(q.value * 100))}
                className="flex-1 whitespace-nowrap px-3 py-2.5 md:py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {q.label}
              </button>
            ))}
          </div>

          <Numpad onPress={entry.press} />

          <button
            onClick={addPayment}
            disabled={remaining <= 0 && method !== 'CASH'}
            className="py-3 rounded-xl bg-gray-900 hover:bg-black dark:bg-gray-100 dark:text-gray-900 text-white font-semibold disabled:opacity-40"
          >
            Lançar pagamento <span className="opacity-60 text-sm hidden lg:inline">(Enter)</span>
          </button>
        </div>
      </div>
    </PdvModal>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-base md:text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Peso digitado para produto vendido por quilo
// ---------------------------------------------------------------------------
export function WeightModal({ product, onClose, onConfirm }) {
  const entry = useDigitEntry(0, { maxDigits: 6, onEnter: () => confirm() })
  const weight = entry.value / 1000
  const total = round2(weight * product.price)

  function confirm() {
    if (entry.value > 0) onConfirm(weight)
  }

  return (
    <PdvModal
      title={product.name}
      onClose={onClose}
      footer={
        <button onClick={confirm} disabled={entry.value === 0} className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-lg font-semibold">
          Adicionar {total > 0 && `· ${brl(total)}`}
        </button>
      }
    >
      <div className="flex flex-col gap-4 max-w-sm mx-auto">
        <p className="text-center text-gray-600 dark:text-gray-300">{brl(product.price)} / kg</p>
        <div className="rounded-2xl border-2 border-green-600 px-4 py-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Peso</p>
          <p className="text-5xl font-bold text-gray-900 dark:text-white tabular-nums">{kg(weight)}</p>
          <p className="mt-1 text-lg text-green-700 dark:text-green-400 font-semibold">{brl(total)}</p>
        </div>
        <Numpad onPress={entry.press} />
        <p className="flex items-center justify-center gap-2 text-sm md:text-xs text-gray-500 dark:text-gray-400">
          <LuScale /> Ou bipe a etiqueta da balança para lançar o peso automaticamente.
        </p>
      </div>
    </PdvModal>
  )
}

// ---------------------------------------------------------------------------
// Sangria (retirada) e suprimento (entrada) de dinheiro na gaveta
// ---------------------------------------------------------------------------
export function CashMoveModal({ initialType = 'SANGRIA', onClose, onConfirm }) {
  const [type, setType] = useState(initialType)
  const [reason, setReason] = useState('')
  const entry = useDigitEntry(0, { onEnter: () => confirm() })

  function confirm() {
    if (entry.value > 0) onConfirm({ type, amount: entry.value / 100, reason })
  }

  return (
    <PdvModal
      title="Movimentar dinheiro"
      onClose={onClose}
      footer={
        <button onClick={confirm} disabled={entry.value === 0} className={`w-full py-3.5 rounded-xl text-white text-lg font-semibold disabled:bg-gray-300 dark:disabled:bg-gray-700 ${type === 'SANGRIA' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
          Confirmar {type === 'SANGRIA' ? 'sangria' : 'suprimento'}
        </button>
      }
    >
      <div className="flex flex-col gap-4 max-w-sm mx-auto">
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-900/50">
          {[
            { id: 'SANGRIA', label: 'Sangria', hint: 'Retirar', Icon: FiArrowUpCircle },
            { id: 'SUPRIMENTO', label: 'Suprimento', hint: 'Colocar', Icon: FiArrowDownCircle },
          ].map(({ id, label, hint, Icon }) => (
            <button
              key={id}
              onClick={() => setType(id)}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg font-medium ${type === id ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <Icon size={18} />
              {label}
              <span className="text-xs opacity-60 hidden sm:inline">({hint})</span>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-4 py-3 text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-left">Valor</p>
          <p className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums">{brl(entry.value / 100)}</p>
        </div>
        <Numpad onPress={entry.press} />
        <div>
          <label className="block text-base lg:text-sm text-gray-700 dark:text-gray-300 mb-1">Motivo</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={type === 'SANGRIA' ? 'Ex: depósito no banco' : 'Ex: troco em moedas'}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white text-base md:text-sm"
          />
        </div>
      </div>
    </PdvModal>
  )
}

// ---------------------------------------------------------------------------
// Leitura pela câmera (no protótipo a leitura é simulada)
// ---------------------------------------------------------------------------
export function CameraOverlay({ onClose, onDetect }) {
  useEffect(() => {
    const t = setTimeout(() => onDetect('7890000000017'), 2200)
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [onClose, onDetect])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fadeIn">
      <div className="flex items-center justify-between px-4 py-4 text-white">
        <span className="font-semibold">Ler código de barras</span>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10" aria-label="Fechar câmera"><FiX size={22} /></button>
      </div>
      <div className="flex-1 relative flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900">
        <div className="relative w-72 h-44 md:w-96 md:h-56">
          <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-xl" />
          <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-xl" />
          <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-xl" />
          <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-xl" />
          <span className="pdv-scan-line absolute left-3 right-3 h-0.5 bg-red-500 shadow-[0_0_12px_2px_rgba(239,68,68,0.7)]" />
        </div>
      </div>
      <div className="px-4 py-6 text-center text-white space-y-4">
        <p className="text-gray-300">Aponte a câmera para o código de barras ou para a etiqueta da balança</p>
        <button className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 text-white">
          <FiZap /> Lanterna
        </button>
      </div>
    </div>
  )
}
