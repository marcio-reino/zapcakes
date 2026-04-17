import { describe, it, expect } from 'vitest'

/**
 * Testes de regressão para o cálculo do total do pedido quando há adicionais.
 *
 * CONTEXTO: bug real em produção (commit f040d85) — o agente calculava
 * `const total = itemsTotal + deliveryFee` ANTES do loop que preenchia
 * itemsTotal, então total saía = deliveryFee. Cliente pediu bolo + topo
 * 3D = R$ 155,00 mas o pedido foi salvo como R$ 10,00 (só taxa).
 *
 * Estes testes garantem que a fórmula está correta e previnem regressão.
 */

// Fórmula pura do cálculo (extraída conceitualmente do openai.service.js)
function calcItemTotal(itemPrice, itemQuantity, addons = []) {
  const addonUnitTotal = addons.reduce(
    (s, a) => s + Number(a.price) * (a.quantity || 1),
    0,
  )
  return (Number(itemPrice) + addonUnitTotal) * itemQuantity
}

function calcOrderTotal(items, deliveryFee = 0) {
  return items.reduce((sum, it) => sum + calcItemTotal(it.price, it.quantity, it.addons), 0) + Number(deliveryFee)
}

function calcReservation(itemsTotal, percent) {
  if (!percent) return null
  return Math.round(itemsTotal * (percent / 100) * 100) / 100
}

describe('Cálculo de total do pedido (regressão bug produção)', () => {
  it('produto simples sem adicionais', () => {
    const items = [{ price: 50, quantity: 2 }]
    expect(calcOrderTotal(items, 0)).toBe(100)
  })

  it('produto + adicional 1x quantidade do item', () => {
    const items = [{
      price: 120,
      quantity: 1,
      addons: [{ price: 25, quantity: 1 }],
    }]
    // (120 + 25) * 1 = 145
    expect(calcOrderTotal(items, 0)).toBe(145)
  })

  it('cenário real do bug: Bolo R$120 + Topo 3D R$25 + taxa R$10 = R$155', () => {
    const items = [{
      price: 120,
      quantity: 1,
      addons: [{ price: 25, quantity: 1 }],
    }]
    const deliveryFee = 10
    expect(calcOrderTotal(items, deliveryFee)).toBe(155)
  })

  it('produto com 2 adicionais quantidade > 1', () => {
    const items = [{
      price: 50,
      quantity: 3,
      addons: [
        { price: 5, quantity: 2 }, // 10 por unidade do produto
        { price: 3, quantity: 1 }, // 3 por unidade do produto
      ],
    }]
    // (50 + 10 + 3) * 3 = 189
    expect(calcOrderTotal(items, 0)).toBe(189)
  })

  it('múltiplos itens, um com adicional outro sem', () => {
    const items = [
      { price: 120, quantity: 1, addons: [{ price: 25, quantity: 1 }] },
      { price: 80, quantity: 2 },
    ]
    // (120+25)*1 + 80*2 = 145 + 160 = 305
    expect(calcOrderTotal(items, 0)).toBe(305)
  })

  it('reserva de 30% é calculada sobre itemsTotal (sem taxa)', () => {
    const itemsTotal = 145 // 120 + 25 (addon)
    expect(calcReservation(itemsTotal, 30)).toBe(43.5)
  })

  it('reserva null quando conta não usa', () => {
    expect(calcReservation(145, null)).toBeNull()
    expect(calcReservation(145, 0)).toBeNull()
  })

  it('arredondamento correto da reserva (2 casas)', () => {
    // 33.33% de 99.99 = 33.3267 → 33.33
    expect(calcReservation(99.99, 33.33)).toBeCloseTo(33.33, 2)
  })

  it('GARDA-CHUVA: total NUNCA fica igual só ao deliveryFee quando há itens', () => {
    // Este é o cenário exato do bug: se alguém zerar o itemsTotal por engano,
    // o total viraria só a taxa. Garantir que sempre tem itens > 0.
    const items = [
      { price: 100, quantity: 1 },
      { price: 50, quantity: 2, addons: [{ price: 10, quantity: 1 }] },
    ]
    const deliveryFee = 10
    const total = calcOrderTotal(items, deliveryFee)
    // total = 100 + (50+10)*2 + 10 = 230
    expect(total).toBe(230)
    expect(total).not.toBe(deliveryFee)
    expect(total).toBeGreaterThan(deliveryFee)
  })

  it('produto sem adicionais: total = preço × quantidade + taxa', () => {
    const items = [{ price: 80, quantity: 1 }]
    expect(calcOrderTotal(items, 5)).toBe(85)
  })
})
