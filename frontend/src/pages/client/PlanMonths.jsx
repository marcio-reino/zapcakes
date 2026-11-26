import { FiCheckCircle, FiAlertCircle, FiClock, FiFileText, FiCalendar, FiSlash } from 'react-icons/fi'

const pad = (n) => String(n).padStart(2, '0')
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export const monthName = (ym) => `${MONTH_NAMES[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`
export const ymdToBr = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '')

function localYmd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function dueYmdFor(ym, billingDay) {
  const [y, m] = ym.split('-').map(Number)
  const day = Math.min(billingDay || 1, new Date(y, m, 0).getDate())
  return `${ym}-${pad(day)}`
}

// Primeiro mês com cobrança de mensalidade (igual ao BILLING_START_MONTH do backend).
// Em 2026 só novembro e dezembro são cobrados; de 2027 em diante, todos os meses.
export const BILLING_START_YM = '2026-11'

// Quando um mês tem mais de uma cobrança, a paga ou a em aberto vale mais que a cancelada
const PRIORITY = { PAID: 0, PENDING: 1, FAILED: 2, REFUNDED: 3, CANCELLED: 4 }

// Monta os 12 meses do ano com a situação de cada um
export function buildYearMonths({ year, payments, billingDay, planPrice, planStartedAt, today = new Date() }) {
  const todayYmd = localYmd(today)
  const currentYm = todayYmd.slice(0, 7)
  const startYm = planStartedAt ? String(planStartedAt).slice(0, 7) : null

  return Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${pad(i + 1)}`
    const payment = payments
      .filter((p) => p.referenceMonth === ym)
      .sort((a, b) => (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9))[0] || null
    const dueYmd = payment?.dueDate ? String(payment.dueDate).slice(0, 10) : dueYmdFor(ym, billingDay)

    let state
    if (ym < BILLING_START_YM) state = 'BEFORE_PLAN'
    else if (payment?.status === 'PAID') state = 'PAID'
    else if (payment && ['CANCELLED', 'REFUNDED'].includes(payment.status)) state = 'CANCELLED'
    else if (!payment && startYm && ym < startYm) state = 'BEFORE_PLAN'
    else if (payment?.proofUrl) state = 'REVIEW'
    else if (dueYmd < todayYmd) state = 'OVERDUE'
    else if (payment) state = 'OPEN'
    else state = 'UPCOMING'

    return {
      ym,
      payment,
      dueYmd,
      amount: payment ? Number(payment.amount) : Number(planPrice || 0),
      state,
      current: ym === currentYm,
      clickable: !['BEFORE_PLAN', 'CANCELLED'].includes(state),
    }
  })
}

export const MONTH_STATES = {
  PAID: { label: 'Pago', Icon: FiCheckCircle, card: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  REVIEW: { label: 'Comprovante enviado', Icon: FiFileText, card: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  OVERDUE: { label: 'Vencido', Icon: FiAlertCircle, card: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  OPEN: { label: 'Em aberto', Icon: FiClock, card: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  UPCOMING: { label: 'A vencer', Icon: FiCalendar, card: 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  BEFORE_PLAN: { label: 'Sem cobrança', Icon: FiSlash, card: 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 opacity-60', badge: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
  CANCELLED: { label: 'Cancelado', Icon: FiSlash, card: 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 opacity-60', badge: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
}

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function PlanMonthsGrid({ months, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {months.map((m) => {
        const s = MONTH_STATES[m.state]
        const content = (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-base md:text-sm font-bold text-gray-900 dark:text-white">{MONTH_NAMES[Number(m.ym.slice(5, 7)) - 1]}</span>
              {m.current && <span className="text-[10px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">Atual</span>}
            </div>
            <p className="text-lg md:text-base font-extrabold text-gray-900 dark:text-white mt-1">{m.state === 'BEFORE_PLAN' ? '—' : BRL(m.amount)}</p>
            <p className="text-sm md:text-xs text-gray-500 dark:text-gray-400">
              {m.state === 'BEFORE_PLAN'
                ? 'Nada a pagar'
                : m.state === 'PAID' && m.payment?.paidAt
                  ? `Pago em ${new Date(m.payment.paidAt).toLocaleDateString('pt-BR')}`
                  : `Vence ${ymdToBr(m.dueYmd)}`}
            </p>
            <span className={`mt-2 self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
              <s.Icon size={12} /> {s.label}
            </span>
          </>
        )
        const base = `text-left rounded-xl border p-3 flex flex-col ${s.card} ${m.current ? 'ring-2 ring-green-500' : ''}`
        return m.clickable ? (
          <button key={m.ym} onClick={() => onSelect(m)} className={`${base} hover:shadow-md hover:-translate-y-0.5 transition-all`}>
            {content}
          </button>
        ) : (
          <div key={m.ym} className={base} title={m.state === 'BEFORE_PLAN' ? 'Sem cobrança neste mês' : undefined}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
