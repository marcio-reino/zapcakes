import { useState } from 'react'
import { FiUnlock, FiLock, FiArrowLeft, FiCloudOff, FiAlertTriangle, FiCheckCircle, FiArrowUpCircle, FiArrowDownCircle } from 'react-icons/fi'
import { Numpad, useDigitEntry, METHOD_ICONS } from './PdvModals.jsx'
import { PAYMENT_METHODS, CASH_SESSION, brl, round2 } from './pdvMock.js'

// ---------------------------------------------------------------------------
// Abertura de caixa
// ---------------------------------------------------------------------------
export function OpenCashScreen({ onOpen }) {
  const entry = useDigitEntry(15000, { onEnter: () => onOpen(entry.value / 100) })

  return (
    <div className="flex-1 overflow-y-auto bg-white lg:bg-gray-100 dark:bg-gray-900 flex lg:items-center justify-center p-0 md:p-6">
      <div className="w-full md:max-w-md bg-white dark:bg-gray-800 md:rounded-2xl md:shadow-xl p-5 md:p-8 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center">
            <FiUnlock size={22} />
          </span>
          <div>
            <h1 className="text-2xl md:text-xl font-bold text-gray-900 dark:text-white">Abrir caixa</h1>
            <p className="text-sm md:text-xs text-gray-500 dark:text-gray-400">Informe o dinheiro que está na gaveta para troco</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-base lg:text-sm text-gray-700 dark:text-gray-300 mb-1">Caixa</label>
            <select className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white text-base md:text-sm">
              <option>Caixa 01 · Balcão</option>
              <option>Caixa 02 · Café</option>
            </select>
          </div>
          <div>
            <label className="block text-base lg:text-sm text-gray-700 dark:text-gray-300 mb-1">Operador</label>
            <input defaultValue="Ana" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white text-base md:text-sm" />
          </div>
        </div>

        <div className="rounded-2xl border-2 border-green-600 px-4 py-3 text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-left">Troco inicial</p>
          <p className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums">{brl(entry.value / 100)}</p>
        </div>

        <Numpad onPress={entry.press} />

        <button onClick={() => onOpen(entry.value / 100)} className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-lg font-semibold">
          Abrir caixa
        </button>

        <p className="flex items-start gap-2 text-sm md:text-xs text-gray-500 dark:text-gray-400">
          <FiCloudOff className="mt-0.5 shrink-0" />
          O caixa pode ser aberto sem internet. A abertura é enviada ao servidor assim que a conexão voltar.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fechamento de caixa: esperado x contado por forma de pagamento
// ---------------------------------------------------------------------------
function parseMoney(text) {
  return Number(String(text).replace(/\./g, '').replace(',', '.')) || 0
}

export function CloseCashScreen({ pending, online, onBack, onClosed }) {
  const s = CASH_SESSION
  const sangrias = s.movements.filter((m) => m.type === 'SANGRIA').reduce((t, m) => t + m.amount, 0)
  const suprimentos = s.movements.filter((m) => m.type === 'SUPRIMENTO').reduce((t, m) => t + m.amount, 0)
  const totalSales = Object.values(s.byMethod).reduce((t, v) => t + v, 0)

  const expected = {
    CASH: round2(s.openingAmount + s.byMethod.CASH + suprimentos - sangrias),
    PIX: s.byMethod.PIX,
    DEBIT: s.byMethod.DEBIT,
    CREDIT: s.byMethod.CREDIT,
  }

  const [counted, setCounted] = useState({ CASH: '', PIX: '964,30', DEBIT: '401,90', CREDIT: '167,00' })
  const [closed, setClosed] = useState(false)

  const diff = (id) => (counted[id] === '' ? null : round2(parseMoney(counted[id]) - expected[id]))
  const totalExpected = round2(Object.values(expected).reduce((t, v) => t + v, 0))
  const totalCounted = round2(Object.keys(expected).reduce((t, id) => t + parseMoney(counted[id]), 0))
  const allFilled = Object.values(counted).every((v) => v !== '')

  if (closed) {
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 bg-white lg:bg-gray-100 dark:bg-gray-900">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 md:rounded-2xl md:shadow-xl p-8 text-center flex flex-col items-center gap-4">
          <FiCheckCircle size={64} className="text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caixa fechado</h1>
          <p className="text-gray-600 dark:text-gray-300">
            {s.salesCount} vendas · {brl(totalSales)}
            <br />
            Diferença total: <strong className={totalCounted - totalExpected < 0 ? 'text-red-600' : 'text-green-700'}>{brl(totalCounted - totalExpected)}</strong>
          </p>
          <button onClick={onClosed} className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-lg font-semibold">Abrir novo caixa</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-4 md:gap-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800" aria-label="Voltar">
            <FiArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl md:text-xl font-bold text-gray-900 dark:text-white">Fechar caixa</h1>
            <p className="text-sm md:text-xs text-gray-500 dark:text-gray-400">{s.register} · {s.operator} · aberto às {s.openedAt}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Stat label="Vendas" value={s.salesCount} />
          <Stat label="Total vendido" value={brl(totalSales)} />
          <Stat label="Troco inicial" value={brl(s.openingAmount)} />
          <Stat label="Sangrias" value={`-${brl(sangrias)}`} />
          <Stat label="Suprimentos" value={`+${brl(suprimentos)}`} />
        </div>

        {pending > 0 && (
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200">
            <FiAlertTriangle className="mt-0.5 shrink-0" size={18} />
            <p className="text-sm">
              {pending} {pending === 1 ? 'venda ainda não foi enviada' : 'vendas ainda não foram enviadas'} ao servidor.
              {online ? ' Elas serão enviadas antes do fechamento.' : ' O fechamento fica salvo no aparelho e é enviado junto quando a internet voltar.'}
            </p>
          </div>
        )}

        {/* Conferência por forma de pagamento */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-800 dark:text-white">Conferência</h2>
            <p className="text-sm md:text-xs text-gray-500 dark:text-gray-400">Conte a gaveta e confira os relatórios da maquininha e do Pix</p>
          </div>

          {/* Tabela: tablet e PC */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left font-medium px-5 py-2.5">Forma</th>
                <th className="text-right font-medium px-5 py-2.5">Esperado</th>
                <th className="text-right font-medium px-5 py-2.5 w-44">Contado</th>
                <th className="text-right font-medium px-5 py-2.5 w-36">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {PAYMENT_METHODS.map((m) => {
                const Icon = METHOD_ICONS[m.id]
                return (
                  <tr key={m.id}>
                    <td className="px-5 py-3"><span className="flex items-center gap-2 text-gray-800 dark:text-gray-200"><Icon size={18} className="text-gray-400" />{m.label}</span></td>
                    <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">{brl(expected[m.id])}</td>
                    <td className="px-5 py-3"><MoneyInput value={counted[m.id]} onChange={(v) => setCounted({ ...counted, [m.id]: v })} /></td>
                    <td className="px-5 py-3 text-right"><Diff value={diff(m.id)} /></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-900/40 font-semibold text-gray-800 dark:text-gray-100">
              <tr>
                <td className="px-5 py-3">Total</td>
                <td className="px-5 py-3 text-right tabular-nums">{brl(totalExpected)}</td>
                <td className="px-5 py-3 text-right tabular-nums">{brl(totalCounted)}</td>
                <td className="px-5 py-3 text-right"><Diff value={allFilled ? round2(totalCounted - totalExpected) : null} /></td>
              </tr>
            </tfoot>
          </table>

          {/* Cartões: celular */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
            {PAYMENT_METHODS.map((m) => {
              const Icon = METHOD_ICONS[m.id]
              return (
                <div key={m.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-200"><Icon size={18} className="text-gray-400" />{m.label}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Esperado {brl(expected[m.id])}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MoneyInput value={counted[m.id]} onChange={(v) => setCounted({ ...counted, [m.id]: v })} />
                    <span className="w-28 text-right"><Diff value={diff(m.id)} /></span>
                  </div>
                </div>
              )
            })}
            <div className="p-4 flex items-center justify-between font-semibold text-gray-800 dark:text-gray-100">
              <span>Total contado</span>
              <span>{brl(totalCounted)}</span>
            </div>
          </div>
        </div>

        {/* Movimentações */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
          <h2 className="px-4 md:px-5 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-white">Sangrias e suprimentos</h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {s.movements.map((mv) => (
              <li key={mv.id} className="flex items-center gap-3 px-4 md:px-5 py-3">
                {mv.type === 'SANGRIA'
                  ? <FiArrowUpCircle className="text-red-500 shrink-0" size={20} />
                  : <FiArrowDownCircle className="text-green-600 shrink-0" size={20} />}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 dark:text-gray-200">{mv.type === 'SANGRIA' ? 'Sangria' : 'Suprimento'} · {mv.time}</p>
                  <p className="text-sm md:text-xs text-gray-500 dark:text-gray-400 truncate">{mv.reason}</p>
                </div>
                <span className={`font-semibold tabular-nums ${mv.type === 'SANGRIA' ? 'text-red-600' : 'text-green-700 dark:text-green-400'}`}>
                  {mv.type === 'SANGRIA' ? '-' : '+'}{brl(mv.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label className="block text-base lg:text-sm text-gray-700 dark:text-gray-300 mb-1">Observação</label>
          <textarea rows={2} placeholder="Opcional" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white text-base md:text-sm" />
        </div>

        <div className="flex flex-col-reverse md:flex-row md:justify-end gap-2 pb-4">
          <button onClick={onBack} className="py-3 md:py-2.5 md:px-5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium">
            Voltar às vendas
          </button>
          <button
            onClick={() => setClosed(true)}
            disabled={!allFilled}
            className="flex items-center justify-center gap-2 py-3 md:py-2.5 md:px-6 rounded-xl bg-gray-900 hover:bg-black dark:bg-green-600 dark:hover:bg-green-700 text-white font-semibold disabled:opacity-40"
          >
            <FiLock /> Fechar caixa
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, small }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
      <p className="text-sm md:text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`font-bold text-gray-900 dark:text-white mt-1 ${small ? 'text-base' : 'text-2xl md:text-xl'}`}>{value}</p>
    </div>
  )
}

function MoneyInput({ value, onChange }) {
  return (
    <div className="relative flex-1">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base md:text-sm">R$</span>
      <input
        inputMode="decimal"
        value={value}
        placeholder="0,00"
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        className="w-full pl-10 pr-3 py-2.5 md:py-2 text-right rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white text-base md:text-sm tabular-nums"
      />
    </div>
  )
}

function Diff({ value }) {
  if (value === null) return <span className="text-gray-400">—</span>
  if (value === 0) return <span className="text-green-700 dark:text-green-400 font-medium">Confere</span>
  return (
    <span className={`font-semibold tabular-nums ${value < 0 ? 'text-red-600' : 'text-blue-600 dark:text-blue-400'}`}>
      {value > 0 ? '+' : ''}{brl(value)}
    </span>
  )
}
