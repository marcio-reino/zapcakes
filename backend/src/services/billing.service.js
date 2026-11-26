import prisma from '../config/database.js'

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export async function generateUniquePaymentCode() {
  for (let i = 0; i < 50; i++) {
    let code = ''
    for (let j = 0; j < 4; j++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    const exists = await prisma.payment.findUnique({ where: { code } })
    if (!exists) return code
  }
  throw new Error('Não foi possível gerar código único')
}

// Vencimento da mensalidade: dia de cobrança da conta, limitado ao último dia do mês ("2026-02" + 30 → 28/02)
export function dueDateFor(referenceMonth, billingDay) {
  const [year, month] = referenceMonth.split('-').map(Number)
  const day = Math.min(billingDay, new Date(Date.UTC(year, month, 0)).getUTCDate())
  return new Date(Date.UTC(year, month - 1, day))
}

// Ano corrente no fuso de São Paulo
export function currentYear(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(now))
}

// Mês que o cliente pode pagar pelo painel: só do ano corrente e a partir do mês em que o plano começou
export function validateBillingMonth(referenceMonth, { planStartedAt, now = new Date() } = {}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth || '')) return 'Mês inválido'
  if (Number(referenceMonth.slice(0, 4)) !== currentYear(now)) return 'Só é possível pagar meses do ano corrente'
  if (planStartedAt) {
    const start = new Date(planStartedAt).toISOString().slice(0, 7)
    if (referenceMonth < start) return 'Este mês é anterior ao início do plano'
  }
  return null
}
