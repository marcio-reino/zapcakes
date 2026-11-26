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

  it('aceita mês do ano corrente a partir de novembro/2026, inclusive futuro', () => {
    expect(validateBillingMonth('2026-11', { now })).toBeNull()
    expect(validateBillingMonth('2026-12', { now })).toBeNull()
  })

  it('recusa meses de 2026 antes de novembro (sem cobrança)', () => {
    expect(validateBillingMonth('2026-01', { now })).toBe('Este mês não tem cobrança')
    expect(validateBillingMonth('2026-10', { now })).toBe('Este mês não tem cobrança')
  })

  it('em 2027 todos os meses têm cobrança', () => {
    const in2027 = new Date('2027-03-15T15:00:00Z')
    expect(validateBillingMonth('2027-01', { now: in2027 })).toBeNull()
    expect(validateBillingMonth('2027-12', { now: in2027 })).toBeNull()
  })

  it('recusa formato inválido e outro ano', () => {
    expect(validateBillingMonth('2026-13', { now })).toBe('Mês inválido')
    expect(validateBillingMonth('12/2026', { now })).toBe('Mês inválido')
    expect(validateBillingMonth('2027-01', { now })).toBe('Só é possível pagar meses do ano corrente')
  })

  it('recusa mês anterior ao início do plano', () => {
    const in2027 = new Date('2027-08-01T15:00:00Z')
    const planStartedAt = new Date('2027-05-03T12:00:00Z')
    expect(validateBillingMonth('2027-04', { now: in2027, planStartedAt })).toBe('Este mês é anterior ao início do plano')
    expect(validateBillingMonth('2027-05', { now: in2027, planStartedAt })).toBeNull()
  })
})
