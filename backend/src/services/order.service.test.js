import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do Prisma ANTES de importar o módulo testado
vi.mock('../config/database.js', () => {
  const mockPrisma = {
    additional: { findMany: vi.fn() },
    productAdditional: { findMany: vi.fn() },
    orderItemAdditional: { createMany: vi.fn() },
  }
  return { default: mockPrisma }
})

import prisma from '../config/database.js'
import { resolveItemAdditionals, persistOrderItemAdditionals } from './order.service.js'

describe('resolveItemAdditionals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna array vazio quando itens não têm adicionais', async () => {
    const items = [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1, additionals: [] },
    ]
    const result = await resolveItemAdditionals(5, items)
    expect(result).toEqual([
      { _addons: [], _addonTotal: 0 },
      { _addons: [], _addonTotal: 0 },
    ])
    // Sem chamar Prisma se não tem adicionais
    expect(prisma.additional.findMany).not.toHaveBeenCalled()
  })

  it('resolve adicionais válidos com snapshot de preço', async () => {
    prisma.additional.findMany.mockResolvedValue([
      { id: 10, description: 'Topo 3D', price: 25, userId: 5, active: true },
      { id: 11, description: 'Cobertura extra', price: 5, userId: 5, active: true },
    ])
    prisma.productAdditional.findMany.mockResolvedValue([
      { productId: 1, additionalId: 10 },
      { productId: 1, additionalId: 11 },
    ])

    const items = [{
      productId: 1,
      quantity: 2,
      additionals: [
        { additionalId: 10, quantity: 1 },
        { additionalId: 11, quantity: 2 },
      ],
    }]

    const result = await resolveItemAdditionals(5, items)
    expect(result).toHaveLength(1)
    expect(result[0]._addons).toHaveLength(2)
    expect(result[0]._addons[0]).toMatchObject({
      additionalId: 10,
      description: 'Topo 3D',
      price: 25,
      quantity: 1,
    })
    // addonTotal = 25*1 + 5*2 = 35 (POR UNIDADE do produto, NÃO multiplica pela quantity do item)
    expect(result[0]._addonTotal).toBe(35)
  })

  it('lança erro 400 quando additionalId não pertence ao userId', async () => {
    prisma.additional.findMany.mockResolvedValue([]) // retorna vazio (não encontrado)
    prisma.productAdditional.findMany.mockResolvedValue([])

    const items = [{
      productId: 1,
      quantity: 1,
      additionals: [{ additionalId: 999 }],
    }]

    await expect(resolveItemAdditionals(5, items)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('999'),
    })
  })

  it('lança erro 400 quando adicional existe mas não está vinculado ao produto (anti-tampering)', async () => {
    prisma.additional.findMany.mockResolvedValue([
      { id: 10, description: 'Topo 3D', price: 25, userId: 5, active: true },
    ])
    // Vínculo só com produto 2, cliente tentando adicionar ao produto 1
    prisma.productAdditional.findMany.mockResolvedValue([
      { productId: 2, additionalId: 10 },
    ])

    const items = [{
      productId: 1,
      quantity: 1,
      additionals: [{ additionalId: 10 }],
    }]

    await expect(resolveItemAdditionals(5, items)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('não está disponível para este produto'),
    })
  })

  it('força quantidade mínima 1 mesmo se vier 0 ou negativo', async () => {
    prisma.additional.findMany.mockResolvedValue([
      { id: 10, description: 'X', price: 10, userId: 5, active: true },
    ])
    prisma.productAdditional.findMany.mockResolvedValue([
      { productId: 1, additionalId: 10 },
    ])

    const items = [{
      productId: 1,
      quantity: 1,
      additionals: [
        { additionalId: 10, quantity: 0 },
        { additionalId: 10, quantity: -5 },
      ],
    }]

    const result = await resolveItemAdditionals(5, items)
    expect(result[0]._addons[0].quantity).toBe(1)
    expect(result[0]._addons[1].quantity).toBe(1)
  })

  it('ignora additionalId NaN sem quebrar o fluxo', async () => {
    prisma.additional.findMany.mockResolvedValue([])
    prisma.productAdditional.findMany.mockResolvedValue([])

    const items = [{
      productId: 1,
      quantity: 1,
      additionals: [{ additionalId: 'abc' }], // inválido
    }]

    // Deve retornar vazio (nenhum additionalId válido foi extraído)
    const result = await resolveItemAdditionals(5, items)
    expect(result[0]._addons).toEqual([])
    expect(result[0]._addonTotal).toBe(0)
  })

  it('mantém posição no array quando múltiplos itens, alguns sem adicionais', async () => {
    prisma.additional.findMany.mockResolvedValue([
      { id: 10, description: 'X', price: 10, userId: 5, active: true },
    ])
    prisma.productAdditional.findMany.mockResolvedValue([
      { productId: 2, additionalId: 10 },
    ])

    const items = [
      { productId: 1, quantity: 1 }, // sem adicionais
      { productId: 2, quantity: 1, additionals: [{ additionalId: 10 }] },
      { productId: 3, quantity: 2 }, // sem adicionais
    ]

    const result = await resolveItemAdditionals(5, items)
    expect(result).toHaveLength(3)
    expect(result[0]._addonTotal).toBe(0)
    expect(result[1]._addonTotal).toBe(10)
    expect(result[2]._addonTotal).toBe(0)
  })
})

describe('persistOrderItemAdditionals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cria registros respeitando mapeamento orderItem.productId → resolvedItem', async () => {
    const orderItems = [
      { id: 100, productId: 1 },
      { id: 101, productId: 2 },
    ]
    const resolvedItems = [
      { productId: 1 },
      { productId: 2 },
    ]
    const perItemAddons = [
      { _addons: [{ additionalId: 10, description: 'A', price: 5, quantity: 1 }] },
      { _addons: [{ additionalId: 20, description: 'B', price: 8, quantity: 2 }] },
    ]

    await persistOrderItemAdditionals(orderItems, resolvedItems, perItemAddons)

    expect(prisma.orderItemAdditional.createMany).toHaveBeenCalledWith({
      data: [
        { orderItemId: 100, additionalId: 10, description: 'A', price: 5, quantity: 1 },
        { orderItemId: 101, additionalId: 20, description: 'B', price: 8, quantity: 2 },
      ],
    })
  })

  it('não chama createMany quando não há adicionais', async () => {
    await persistOrderItemAdditionals(
      [{ id: 100, productId: 1 }],
      [{ productId: 1 }],
      [{ _addons: [] }],
    )
    expect(prisma.orderItemAdditional.createMany).not.toHaveBeenCalled()
  })
})
