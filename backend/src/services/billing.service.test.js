import { describe, it, expect } from 'vitest'
import { dueDateFor, currentYear, validateBillingMonth } from './billing.service.js'

const ymd = (d) => d.toISOString().slice(0, 10)

describe('dueDateFor', () => {
  it('usa o dia de cobrança da conta', () => {
    expect(ymd(dueDateFor('2026-12', 10))).toBe('2026-12-10')
  })

  it('limita ao último dia do mês', () => {
    expect(ymd(dueDateFor('2026-02', 30))).toBe('2026-02-28')
    expect(ymd(dueDateFor('2028-02', 30))).toBe('2028-02-29')
  })
})

describe('currentYear', () => {
  it('usa o fuso de São Paulo na virada do ano', () => {
    // 01/01/2027 01:00 UTC ainda é 31/12/2026 em São Paulo
    expect(currentYear(new Date('2027-01-01T01:00:00Z'))).toBe(2026)
  })
})

describe('validateBillingMonth', () => {
  const now = new Date('2026-11-26T15:00:00Z')

  it('aceita mês do ano corrente, inclusive futuro', () => {
    expect(validateBillingMonth('2026-12', { now })).toBeNull()
    expect(validateBillingMonth('2026-01', { now })).toBeNull()
  })

  it('recusa formato inválido e outro ano', () => {
    expect(validateBillingMonth('2026-13', { now })).toBe('Mês inválido')
    expect(validateBillingMonth('12/2026', { now })).toBe('Mês inválido')
    expect(validateBillingMonth('2027-01', { now })).toBe('Só é possível pagar meses do ano corrente')
  })

  it('recusa mês anterior ao início do plano', () => {
    const planStartedAt = new Date('2026-05-03T12:00:00Z')
    expect(validateBillingMonth('2026-04', { now, planStartedAt })).toBe('Este mês é anterior ao início do plano')
    expect(validateBillingMonth('2026-05', { now, planStartedAt })).toBeNull()
  })
})
