import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks de TODAS as deps externas antes de importar o módulo testado.
// openai.service.js tem muitas dependências; vamos mockar o que precisa.
vi.mock('../config/openai.js', () => ({ default: {} }))
vi.mock('../config/database.js', () => ({ default: {} }))
vi.mock('../config/evolution.js', () => ({ default: {} }))
vi.mock('../config/s3.js', () => ({ default: {}, S3_BUCKET: 'test' }))
vi.mock('@aws-sdk/client-s3', () => ({ PutObjectCommand: vi.fn() }))
vi.mock('./redis.service.js', () => ({ default: null }), { virtual: true })
vi.mock('../config/redis.js', () => ({
  default: null,
  isRedisReady: () => false,
}))

import { OpenAiService } from './openai.service.js'

describe('OpenAiService._parseDeliveryDate', () => {
  let svc

  beforeEach(() => {
    svc = new OpenAiService()
  })

  it('retorna null para string vazia ou nula', () => {
    expect(svc._parseDeliveryDate(null)).toBeNull()
    expect(svc._parseDeliveryDate('')).toBeNull()
    expect(svc._parseDeliveryDate(undefined)).toBeNull()
  })

  it('parse formato dd/mm/yyyy', () => {
    const d = svc._parseDeliveryDate('20/04/2026')
    expect(d).toBeInstanceOf(Date)
    expect(d.toISOString()).toBe('2026-04-20T00:00:00.000Z')
  })

  it('parse formato yyyy-mm-dd (ISO)', () => {
    const d = svc._parseDeliveryDate('2026-04-20')
    expect(d.toISOString()).toBe('2026-04-20T00:00:00.000Z')
  })

  it('corrige ano no passado (IA ainda alucinando 2023) para ano atual', () => {
    const currentYear = new Date().getFullYear()
    const d = svc._parseDeliveryDate('20/04/2023')
    expect(d.getUTCFullYear()).toBe(currentYear)
    expect(d.getUTCMonth()).toBe(3) // abril (0-indexed)
    expect(d.getUTCDate()).toBe(20)
  })

  it('parse formato dd/mm (sem ano, assume ano atual)', () => {
    const currentYear = new Date().getFullYear()
    const d = svc._parseDeliveryDate('20/04')
    expect(d.getUTCFullYear()).toBe(currentYear)
    expect(d.getUTCMonth()).toBe(3)
    expect(d.getUTCDate()).toBe(20)
  })

  it('parse "dia X" sozinho assume mês atual se dia ainda não passou', () => {
    const now = new Date()
    const today = now.getUTCDate()
    const futureDay = Math.min(today + 3, 28) // evitar problemas de fim de mês
    const d = svc._parseDeliveryDate(`dia ${futureDay}`)
    expect(d.getUTCDate()).toBe(futureDay)
    expect(d.getUTCMonth()).toBe(now.getUTCMonth())
  })

  it('parse "dia X" para dia passado assume próximo mês', () => {
    const now = new Date()
    if (now.getUTCDate() > 3) {
      const pastDay = 2 // assumindo que hoje > dia 3
      const d = svc._parseDeliveryDate(`dia ${pastDay}`)
      expect(d.getUTCDate()).toBe(pastDay)
      // mês avança
      const expectedMonth = (now.getUTCMonth() + 1) % 12
      expect(d.getUTCMonth()).toBe(expectedMonth)
    }
  })

  it('extrai dia de frase longa "Sábado dia 20"', () => {
    const d = svc._parseDeliveryDate('Sábado dia 20')
    expect(d).toBeInstanceOf(Date)
    expect(d.getUTCDate()).toBe(20)
  })

  it('retorna null para formato irreconhecível', () => {
    expect(svc._parseDeliveryDate('amanhã de manhã')).toBeNull()
    expect(svc._parseDeliveryDate('próxima semana')).toBeNull()
  })

  it('20/04/2026 é Segunda-feira (regressão do bug do agente que dizia Sábado)', () => {
    const d = svc._parseDeliveryDate('20/04/2026')
    // getUTCDay: 0=domingo, 1=segunda, 6=sábado
    expect(d.getUTCDay()).toBe(1)
  })
})

describe('OpenAiService._findDeliveryFee', () => {
  let svc

  beforeEach(() => {
    svc = new OpenAiService()
  })

  it('retorna 0 quando lista de taxas vazia', () => {
    expect(svc._findDeliveryFee([], 'qualquer', 'lugar')).toBe(0)
  })

  it('encontra taxa por bairro (match exato)', () => {
    const fees = [
      { location: 'unamar', value: 10 },
      { location: 'centro', value: 5 },
    ]
    expect(svc._findDeliveryFee(fees, 'Unamar', 'Cabo Frio')).toBe(10)
  })

  it('encontra taxa por bairro (includes parcial)', () => {
    const fees = [{ location: 'aquarius', value: 15 }]
    expect(svc._findDeliveryFee(fees, 'Bairro Aquarius', 'Cabo Frio')).toBe(15)
  })

  it('fallback para cidade quando bairro não bate', () => {
    const fees = [{ location: 'cabo frio', value: 20 }]
    expect(svc._findDeliveryFee(fees, 'Jardim Esperança', 'Cabo Frio')).toBe(20)
  })

  it('retorna 0 quando nada bate', () => {
    const fees = [{ location: 'niterói', value: 12 }]
    expect(svc._findDeliveryFee(fees, 'Copacabana', 'Rio de Janeiro')).toBe(0)
  })

  it('case insensitive', () => {
    const fees = [{ location: 'unamar', value: 10 }]
    expect(svc._findDeliveryFee(fees, 'UNAMAR', null)).toBe(10)
  })
})
