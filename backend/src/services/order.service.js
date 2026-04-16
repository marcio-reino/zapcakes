import prisma from '../config/database.js'

/**
 * Valida adicionais por item e retorna estrutura normalizada com snapshot de preço/descrição.
 * Cada item de entrada: { productId, quantity, additionals?: [{ additionalId, quantity? }] }
 * Retorna array paralelo: [{ _addons: [{additionalId, description, price, quantity}], _addonTotal }]
 * Lança Error com .statusCode se inválido.
 */
export async function resolveItemAdditionals(userId, items) {
  const result = items.map(() => ({ _addons: [], _addonTotal: 0 }))

  const requested = new Set()
  for (const it of items || []) {
    for (const a of it?.additionals || []) {
      const id = Number(a.additionalId)
      if (!isNaN(id)) requested.add(id)
    }
  }
  if (requested.size === 0) return result

  const ids = [...requested]
  const [additionals, links] = await Promise.all([
    prisma.additional.findMany({
      where: { id: { in: ids }, userId, active: true },
    }),
    prisma.productAdditional.findMany({
      where: {
        productId: { in: items.map((i) => Number(i.productId)) },
        additionalId: { in: ids },
      },
      select: { productId: true, additionalId: true },
    }),
  ])

  const byId = Object.fromEntries(additionals.map((a) => [a.id, a]))
  const linkSet = new Set(links.map((l) => `${l.productId}:${l.additionalId}`))

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const resolved = []
    let addonTotal = 0
    for (const a of item?.additionals || []) {
      const addId = Number(a.additionalId)
      const add = byId[addId]
      if (!add) {
        const err = new Error(`Adicional ${addId} não encontrado ou inativo`)
        err.statusCode = 400
        throw err
      }
      if (!linkSet.has(`${Number(item.productId)}:${addId}`)) {
        const err = new Error(`Adicional ${addId} não está disponível para este produto`)
        err.statusCode = 400
        throw err
      }
      const qty = Math.max(1, Number(a.quantity) || 1)
      resolved.push({
        additionalId: addId,
        description: add.description,
        price: add.price,
        quantity: qty,
      })
      addonTotal += Number(add.price) * qty
    }
    result[i] = { _addons: resolved, _addonTotal: addonTotal }
  }
  return result
}

/**
 * Cria OrderItemAdditional para os orderItems já criados, baseado no mapeamento
 * `perItemAddons[i]` retornado por resolveItemAdditionals.
 * `orderItems` é o array retornado de `order.items` (com id e productId).
 * `resolvedItems` é o input original (lineup de productIds).
 */
export async function persistOrderItemAdditionals(orderItems, resolvedItems, perItemAddons) {
  const payload = []
  for (let i = 0; i < resolvedItems.length; i++) {
    const addons = perItemAddons[i]?._addons || []
    if (addons.length === 0) continue
    const productId = Number(resolvedItems[i].productId)
    const orderItem = orderItems.find((oi) => oi.productId === productId)
    if (!orderItem) continue
    for (const a of addons) {
      payload.push({
        orderItemId: orderItem.id,
        additionalId: a.additionalId,
        description: a.description,
        price: a.price,
        quantity: a.quantity,
      })
    }
  }
  if (payload.length > 0) {
    await prisma.orderItemAdditional.createMany({ data: payload })
  }
}
