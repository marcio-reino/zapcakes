import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import prisma from '../config/database.js'
import { UploadService } from '../services/upload.service.js'
import { AccountService } from '../services/account.service.js'
import openai from '../config/openai.js'
import evolutionApi from '../config/evolution.js'
import { resolveItemAdditionals, persistOrderItemAdditionals } from '../services/order.service.js'

// Armazena códigos de recuperação: { `${userId}_${phone}`: { customerId, code, expiresAt } }
const resetCodes = new Map()

// Normaliza telefone para busca: remove não-dígitos e prefixo 55
function normalizePhone(p) {
  const digits = (p || '').replace(/\D/g, '')
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
}

async function resolveSlug(slug, reply) {
  const account = await prisma.account.findFirst({
    where: { slug, storeActive: true },
    select: { userId: true, companyName: true, logoUrl: true },
  })
  if (!account) {
    reply.status(404).send({ error: 'Loja não encontrada' })
    return null
  }
  return account
}

export class StoreController {
  // GET /api/store/:slug — info da loja
  async getStore(request, reply) {
    const { slug } = request.params
    const account = await prisma.account.findFirst({
      where: { slug, storeActive: true },
      select: {
        companyName: true, logoUrl: true, useReservation: true, reservationPercent: true, deliveryEnabled: true, pixKey: true,
        user: {
          select: {
            phone: true, city: true, state: true,
            street: true, number: true, neighborhood: true,
          },
        },
      },
    })
    if (!account) return reply.status(404).send({ error: 'Loja não encontrada' })

    return {
      companyName: account.companyName,
      logoUrl: account.logoUrl,
      phone: account.user.phone,
      city: account.user.city,
      state: account.user.state,
      address: [account.user.street, account.user.number, account.user.neighborhood].filter(Boolean).join(', '),
      useReservation: account.useReservation || false,
      reservationPercent: account.reservationPercent || null,
      deliveryEnabled: account.deliveryEnabled || false,
      pixKey: account.pixKey || null,
    }
  }

  // GET /api/store/:slug/categories
  async getCategories(request, reply) {
    const { slug } = request.params
    const account = await resolveSlug(slug, reply)
    if (!account) return

    const categories = await prisma.category.findMany({
      where: { userId: account.userId, active: true },
      select: {
        id: true, name: true,
        _count: { select: { products: { where: { active: true } } } },
      },
      orderBy: { name: 'asc' },
    })

    return categories.filter(c => c._count.products > 0)
  }

  // GET /api/store/:slug/products?categoryId=N
  async getProducts(request, reply) {
    const { slug } = request.params
    const { categoryId } = request.query
    const account = await resolveSlug(slug, reply)
    if (!account) return

    const where = { userId: account.userId, active: true }
    if (categoryId) where.categoryId = Number(categoryId)

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true, name: true, description: true, price: true,
        imageUrl: true, minOrder: true, categoryId: true,
        allowInspirationImages: true, inspirationInstruction: true, maxInspirationImages: true,
        category: { select: { id: true, name: true } },
        productAdditionals: {
          where: { additional: { active: true } },
          select: {
            sortOrder: true,
            additional: { select: { id: true, description: true, imageUrl: true, price: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    return products.map((p) => {
      const additionals = (p.productAdditionals || []).map((pa) => pa.additional)
      const { productAdditionals, ...rest } = p
      return { ...rest, additionals }
    })
  }

  // GET /api/store/:slug/delivery-zones — taxas de entrega públicas
  async getDeliveryZones(request, reply) {
    const { slug } = request.params
    const account = await resolveSlug(slug, reply)
    if (!account) return

    const zones = await prisma.deliveryZone.findMany({
      where: { userId: account.userId, active: true },
      select: { id: true, name: true, fee: true },
      orderBy: { name: 'asc' },
    })
    return zones
  }

  // GET /api/store/:slug/combos
  async getCombos(request, reply) {
    const { slug } = request.params
    const account = await resolveSlug(slug, reply)
    if (!account) return

    const combos = await prisma.combo.findMany({
      where: { userId: account.userId, active: true },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, price: true, imageUrl: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    return combos.map(c => {
      const totalItems = c.items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0)
      return { ...c, totalPrice: totalItems - Number(c.discount || 0) }
    })
  }

  // POST /api/store/:slug/customer/login
  async customerLogin(request, reply) {
    const { slug } = request.params
    const { phone, password } = request.body
    const account = await resolveSlug(slug, reply)
    if (!account) return

    if (!phone || !password) {
      return reply.status(400).send({ error: 'Celular e senha são obrigatórios' })
    }

    // Busca por telefone exato ou normalizado
    const norm = normalizePhone(phone)
    let customer = await prisma.customer.findFirst({
      where: { userId: account.userId, phone, active: true },
    })
    if (!customer && norm) {
      const candidates = await prisma.customer.findMany({
        where: { userId: account.userId, active: true },
      })
      customer = candidates.find(c => normalizePhone(c.phone) === norm) || null
    }

    if (!customer || !customer.password) {
      return reply.status(401).send({ error: 'Credenciais inválidas' })
    }

    const valid = await bcrypt.compare(password, customer.password)
    if (!valid) {
      return reply.status(401).send({ error: 'Credenciais inválidas' })
    }

    const token = request.server.jwt.sign(
      { customerId: customer.id, userId: account.userId, type: 'customer' },
      { expiresIn: '30d' },
    )

    const { password: _, ...safe } = customer
    return { token, customer: safe }
  }

  // POST /api/store/:slug/customer/register
  async customerRegister(request, reply) {
    const { slug } = request.params
    const { name, phone, password } = request.body
    const account = await resolveSlug(slug, reply)
    if (!account) return

    if (!name || !phone || !password) {
      return reply.status(400).send({ error: 'Nome, celular e senha são obrigatórios' })
    }
    if (password.length < 4) {
      return reply.status(400).send({ error: 'Senha deve ter no mínimo 4 caracteres' })
    }

    const phoneDigitsCheck = phone.replace(/\D/g, '')
    const allCustomers = await prisma.customer.findMany({ where: { userId: account.userId } })
    const exists = allCustomers.find(c => normalizePhone(c.phone) === normalizePhone(phoneDigitsCheck))
    if (exists) {
      return reply.status(409).send({ error: 'Já existe uma conta com este celular' })
    }

    const hashed = await bcrypt.hash(password, 10)
    const phoneDigits = phone.replace(/\D/g, '')
    const customer = await prisma.customer.create({
      data: { userId: account.userId, name, phone: phoneDigits, password: hashed },
    })

    const token = request.server.jwt.sign(
      { customerId: customer.id, userId: account.userId, type: 'customer' },
      { expiresIn: '30d' },
    )

    const { password: _, ...safe } = customer
    return reply.status(201).send({ token, customer: safe })
  }

  // GET /api/store/:slug/customer/me
  async customerMe(request, reply) {
    const customer = await prisma.customer.findUnique({
      where: { id: request.customer.customerId },
      select: {
        id: true, name: true, phone: true, email: true,
        street: true, number: true, complement: true,
        neighborhood: true, city: true, state: true, zipCode: true, reference: true,
      },
    })
    if (!customer) return reply.status(404).send({ error: 'Cliente não encontrado' })
    return customer
  }

  // PUT /api/store/:slug/customer/me
  async customerUpdateProfile(request, reply) {
    const { name, email, street, number, complement, neighborhood, city, state, zipCode, reference } = request.body
    const data = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email
    if (street !== undefined) data.street = street
    if (number !== undefined) data.number = number
    if (complement !== undefined) data.complement = complement
    if (neighborhood !== undefined) data.neighborhood = neighborhood
    if (city !== undefined) data.city = city
    if (state !== undefined) data.state = state
    if (zipCode !== undefined) data.zipCode = zipCode
    if (reference !== undefined) data.reference = reference

    const customer = await prisma.customer.update({
      where: { id: request.customer.customerId },
      data,
      select: {
        id: true, name: true, phone: true, email: true,
        street: true, number: true, complement: true,
        neighborhood: true, city: true, state: true, zipCode: true, reference: true,
      },
    })
    return customer
  }

  // PUT /api/store/:slug/customer/password
  async customerChangePassword(request, reply) {
    const { currentPassword, newPassword } = request.body
    if (!currentPassword || !newPassword) {
      return reply.status(400).send({ error: 'Senha atual e nova senha são obrigatórias' })
    }
    if (newPassword.length < 4) {
      return reply.status(400).send({ error: 'Nova senha deve ter no mínimo 4 caracteres' })
    }

    const customer = await prisma.customer.findUnique({
      where: { id: request.customer.customerId },
      select: { password: true },
    })

    const valid = await bcrypt.compare(currentPassword, customer.password)
    if (!valid) return reply.status(401).send({ error: 'Senha atual incorreta' })

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.customer.update({
      where: { id: request.customer.customerId },
      data: { password: hashed },
    })

    return { message: 'Senha alterada com sucesso' }
  }

  // GET /api/store/:slug/availability — datas disponíveis (público)
  async getAvailability(request, reply) {
    const { slug } = request.params
    const account = await resolveSlug(slug, reply)
    if (!account) return

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 60)

    const slots = await prisma.agendaSlot.findMany({
      where: {
        userId: account.userId,
        active: true,
        date: { gte: today, lte: endDate },
      },
      orderBy: { date: 'asc' },
    })

    return slots
      .filter(s => s.currentOrders < s.maxOrders)
      .map(s => ({
        date: s.date.toISOString().slice(0, 10),
        remaining: s.maxOrders - s.currentOrders,
      }))
  }

  // POST /api/store/:slug/orders
  async createOrder(request, reply) {
    const { items, combos, deliveryAddress, deliveryType, notes, estimatedDeliveryDate, deliveryFee, deliveryZoneId } = request.body
    const { customerId, userId } = request.customer

    if ((!items || !items.length) && (!combos || !combos.length)) {
      return reply.status(400).send({ error: 'Adicione pelo menos um item' })
    }

    // Validar data de agendamento se fornecida
    let agendaSlot = null
    if (estimatedDeliveryDate) {
      const datePart = estimatedDeliveryDate.split('|')[0]
      const dateObj = new Date(datePart + 'T00:00:00.000Z')
      agendaSlot = await prisma.agendaSlot.findFirst({
        where: { userId, date: dateObj, active: true },
      })
      if (!agendaSlot) {
        return reply.status(400).send({ error: 'Data selecionada não está disponível na agenda' })
      }
      if (agendaSlot.currentOrders >= agendaSlot.maxOrders) {
        return reply.status(400).send({ error: 'Data selecionada está lotada. Escolha outra data.' })
      }
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { name: true, phone: true },
    })

    // Processar itens individuais
    const orderItems = []
    let total = 0

    let itemAddons = []
    if (items?.length) {
      const productIds = items.map(i => i.productId)
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, userId, active: true },
      })

      if (products.length !== productIds.length) {
        return reply.status(400).send({ error: 'Um ou mais produtos não encontrados' })
      }

      try {
        itemAddons = await resolveItemAdditionals(userId, items)
      } catch (err) {
        return reply.status(err.statusCode || 500).send({ error: err.message })
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const product = products.find(p => p.id === item.productId)
        const addonTotal = itemAddons[i]?._addonTotal || 0
        orderItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
          _attachments: item.attachments || [],
          _addons: itemAddons[i]?._addons || [],
        })
        total += (Number(product.price) + addonTotal) * item.quantity
      }
    }

    // Processar combos — expande cada combo nos seus produtos com desconto aplicado
    let comboDiscount = 0
    if (combos?.length) {
      const comboIds = combos.map(c => c.comboId)
      const dbCombos = await prisma.combo.findMany({
        where: { id: { in: comboIds }, userId, active: true },
        include: {
          items: {
            include: { product: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      })

      if (dbCombos.length !== comboIds.length) {
        return reply.status(400).send({ error: 'Um ou mais combos não encontrados' })
      }

      for (const comboEntry of combos) {
        const combo = dbCombos.find(c => c.id === comboEntry.comboId)
        const qty = comboEntry.quantity || 1

        for (const ci of combo.items) {
          const existing = orderItems.find(oi => oi.productId === ci.productId)
          if (existing) {
            existing.quantity += ci.quantity * qty
          } else {
            orderItems.push({
              productId: ci.productId,
              quantity: ci.quantity * qty,
              price: ci.product.price,
              _attachments: [],
            })
          }
          total += Number(ci.product.price) * ci.quantity * qty
        }
        // Acumula desconto do combo
        comboDiscount += Number(combo.discount || 0) * qty
      }
    }

    // Aplica desconto dos combos ao total
    total = Math.max(0, total - comboDiscount)

    // Calcula valor de reserva se a conta usa reserva
    const account = await prisma.account.findUnique({
      where: { userId },
      select: { useReservation: true, reservationPercent: true },
    })
    const totalWithFee = deliveryFee ? total + Number(deliveryFee) : total
    const reservationValue = (account?.useReservation && account?.reservationPercent > 0)
      ? Math.round(totalWithFee * account.reservationPercent) / 100
      : null

    // Formatar data para exibição (dd/mm/yyyy às HH:mm)
    let deliveryDateDisplay = null
    if (estimatedDeliveryDate) {
      const [datePart, timePart] = estimatedDeliveryDate.split('|')
      const [y, m, d] = datePart.split('-')
      deliveryDateDisplay = `${d}/${m}/${y}`
      if (timePart) deliveryDateDisplay += ` às ${timePart}`
    }

    const lastOrder = await prisma.order.findFirst({
      where: { userId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    })
    const nextOrderNumber = (lastOrder?.orderNumber || 0) + 1

    const order = await prisma.order.create({
      data: {
        userId,
        publicId: randomUUID(),
        orderNumber: nextOrderNumber,
        customerId,
        customerName: customer.name,
        customerPhone: customer.phone,
        deliveryAddress: deliveryAddress || null,
        deliveryType: deliveryType || null,
        notes: notes || null,
        estimatedDeliveryDate: deliveryDateDisplay,
        total: totalWithFee,
        deliveryFee: deliveryFee ? Number(deliveryFee) : null,
        ...(reservationValue !== null ? { reservation: reservationValue, depositAmount: reservationValue } : {}),
        items: {
          create: orderItems.map(({ _attachments, _addons, ...item }) => item),
        },
      },
      include: { items: { include: { product: true } } },
    })

    // Criar attachments separadamente
    for (const orderItem of order.items) {
      const original = orderItems.find(oi => oi.productId === orderItem.productId)
      if (original?._attachments?.length) {
        await prisma.orderItemAttachment.createMany({
          data: original._attachments.map(a => ({
            orderItemId: orderItem.id,
            imageUrl: a.imageUrl,
            description: a.description || null,
          })),
        })
      }
    }

    // Criar adicionais por item (snapshot de preço/descrição)
    const addonPayload = []
    for (const orderItem of order.items) {
      const original = orderItems.find(oi => oi.productId === orderItem.productId)
      for (const a of original?._addons || []) {
        addonPayload.push({
          orderItemId: orderItem.id,
          additionalId: a.additionalId,
          description: a.description,
          price: a.price,
          quantity: a.quantity,
        })
      }
    }
    if (addonPayload.length > 0) {
      await prisma.orderItemAdditional.createMany({ data: addonPayload })
    }

    // Recarregar com attachments e adicionais
    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: { include: { product: true, attachments: true, additionals: true } } },
    })

    // Incrementar contador da agenda
    if (agendaSlot) {
      await prisma.agendaSlot.update({
        where: { id: agendaSlot.id },
        data: { currentOrders: { increment: 1 } },
      })
    }

    return reply.status(201).send(fullOrder)
  }

  // PUT /api/store/:slug/orders/:id — cliente edita um pedido proprio
  // Permitido somente se: dono bate, status=PENDING, sem paymentProof, dentro de 6h.
  async updateMyOrder(request, reply) {
    const orderId = Number(request.params.id)
    const { customerId, userId } = request.customer
    const {
      items,
      notes,
      deliveryAddress,
      deliveryType,
      deliveryFee,
      deliveryZoneId,
      estimatedDeliveryDate,
    } = request.body

    if (!orderId) return reply.status(400).send({ error: 'Pedido inválido' })

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId, customerId },
      include: { items: { include: { additionals: true, attachments: true } } },
    })
    if (!order) return reply.status(404).send({ error: 'Pedido não encontrado' })

    if (order.status !== 'PENDING') {
      return reply.status(403).send({ error: 'Este pedido não pode mais ser editado (status atual: ' + order.status + ')' })
    }
    if (order.paymentProof) {
      return reply.status(403).send({ error: 'Pedido bloqueado para edição: comprovante de pagamento já foi enviado' })
    }
    const ageMs = Date.now() - new Date(order.createdAt).getTime()
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000
    if (ageMs > SIX_HOURS_MS) {
      return reply.status(403).send({ error: 'A janela de 6 horas para edição expirou' })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: 'O pedido precisa ter pelo menos um item' })
    }

    // Valida data nova se mudou
    let newAgendaSlot = null
    let oldAgendaSlot = null
    if (estimatedDeliveryDate !== undefined) {
      // Resolve slot novo
      if (estimatedDeliveryDate) {
        const datePart = String(estimatedDeliveryDate).split('|')[0]
        const dateObj = new Date(datePart + 'T00:00:00.000Z')
        newAgendaSlot = await prisma.agendaSlot.findFirst({
          where: { userId, date: dateObj, active: true },
        })
        if (!newAgendaSlot) {
          return reply.status(400).send({ error: 'Data selecionada não está disponível na agenda' })
        }
      }
      // Resolve slot antigo (para decrementar)
      if (order.estimatedDeliveryDate) {
        const m = String(order.estimatedDeliveryDate).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (m) {
          const isoOld = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
          oldAgendaSlot = await prisma.agendaSlot.findFirst({
            where: { userId, date: new Date(isoOld + 'T00:00:00.000Z') },
          })
        }
      }
      // Se mudou de slot e o novo esta lotado, bloqueia
      if (newAgendaSlot && (!oldAgendaSlot || oldAgendaSlot.id !== newAgendaSlot.id)) {
        if (newAgendaSlot.currentOrders >= newAgendaSlot.maxOrders) {
          return reply.status(400).send({ error: 'Data selecionada está lotada. Escolha outra data.' })
        }
      }
    }

    // Carrega produtos novos pra recalcular preco usando snapshot atual do catalogo
    const productIds = [...new Set(items.map(i => Number(i.productId)).filter(Boolean))]
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, userId, active: true },
    })
    if (products.length !== productIds.length) {
      return reply.status(400).send({ error: 'Um ou mais produtos não encontrados ou inativos' })
    }

    // Resolve adicionais informados no payload (por item), com mesma logica do create
    let itemAddons = []
    try {
      itemAddons = await resolveItemAdditionals(userId, items)
    } catch (err) {
      return reply.status(err.statusCode || 500).send({ error: err.message })
    }

    // Reaproveita anexos existentes por productId (cliente nao re-envia anexos no edit)
    const existingAttachmentsByProduct = new Map()
    for (const oi of order.items) {
      if ((oi.attachments || []).length) {
        existingAttachmentsByProduct.set(oi.productId, oi.attachments)
      }
    }

    let total = 0
    const newItemsData = []
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const productId = Number(it.productId)
      const quantity = Math.max(1, Math.min(500, Number(it.quantity) || 1))
      const product = products.find(p => p.id === productId)
      if (!product) continue
      const addons = itemAddons[i]?._addons || []
      const addonTotal = itemAddons[i]?._addonTotal || 0
      total += (Number(product.price) + addonTotal) * quantity
      newItemsData.push({
        productId,
        quantity,
        price: product.price,
        _addons: addons,
        _attachments: existingAttachmentsByProduct.get(productId) || [],
      })
    }

    const effectiveDeliveryFee = deliveryFee !== undefined
      ? (deliveryFee ? Number(deliveryFee) : 0)
      : (order.deliveryFee ? Number(order.deliveryFee) : 0)
    const totalWithFee = total + effectiveDeliveryFee

    // Recalcula reserva se a conta usa reserva
    const account = await prisma.account.findUnique({
      where: { userId },
      select: { useReservation: true, reservationPercent: true },
    })
    const reservationValue = (account?.useReservation && account?.reservationPercent > 0)
      ? Math.round(totalWithFee * account.reservationPercent) / 100
      : null

    // Formata data de entrega para exibicao
    let deliveryDateDisplay = order.estimatedDeliveryDate
    if (estimatedDeliveryDate !== undefined) {
      if (estimatedDeliveryDate) {
        const [datePart, timePart] = String(estimatedDeliveryDate).split('|')
        const [y, m, d] = datePart.split('-')
        deliveryDateDisplay = `${d}/${m}/${y}`
        if (timePart) deliveryDateDisplay += ` às ${timePart}`
      } else {
        deliveryDateDisplay = null
      }
    }

    await prisma.$transaction(async (tx) => {
      const oldItemIds = order.items.map(i => i.id)
      if (oldItemIds.length) {
        await tx.orderItemAdditional.deleteMany({ where: { orderItemId: { in: oldItemIds } } })
        await tx.orderItemAttachment.deleteMany({ where: { orderItemId: { in: oldItemIds } } })
        await tx.orderItem.deleteMany({ where: { id: { in: oldItemIds } } })
      }

      for (const data of newItemsData) {
        const created = await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: data.productId,
            quantity: data.quantity,
            price: data.price,
          },
        })
        if (data._addons.length) {
          await tx.orderItemAdditional.createMany({
            data: data._addons.map(a => ({
              orderItemId: created.id,
              additionalId: a.additionalId,
              description: a.description,
              price: a.price,
              quantity: a.quantity,
            })),
          })
        }
        if (data._attachments.length) {
          await tx.orderItemAttachment.createMany({
            data: data._attachments.map(att => ({
              orderItemId: created.id,
              imageUrl: att.imageUrl,
              description: att.description,
            })),
          })
        }
      }

      // Atualiza contador da agenda se a data mudou
      if (estimatedDeliveryDate !== undefined) {
        if (oldAgendaSlot && (!newAgendaSlot || oldAgendaSlot.id !== newAgendaSlot.id)) {
          await tx.agendaSlot.update({
            where: { id: oldAgendaSlot.id },
            data: { currentOrders: { decrement: 1 } },
          })
        }
        if (newAgendaSlot && (!oldAgendaSlot || oldAgendaSlot.id !== newAgendaSlot.id)) {
          await tx.agendaSlot.update({
            where: { id: newAgendaSlot.id },
            data: { currentOrders: { increment: 1 } },
          })
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          total: totalWithFee,
          ...(deliveryAddress !== undefined ? { deliveryAddress: deliveryAddress || null } : {}),
          ...(deliveryType !== undefined ? { deliveryType: deliveryType || null } : {}),
          ...(deliveryFee !== undefined ? { deliveryFee: deliveryFee ? Number(deliveryFee) : null } : {}),
          ...(notes !== undefined ? { notes: notes || null } : {}),
          ...(estimatedDeliveryDate !== undefined ? { estimatedDeliveryDate: deliveryDateDisplay } : {}),
          ...(reservationValue !== null
            ? { reservation: reservationValue, depositAmount: reservationValue }
            : {}),
        },
      })
    })

    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: { include: { product: true, attachments: true, additionals: true } } },
    })
    return reply.send(fullOrder)
  }

  // GET /api/store/:slug/customer/orders
  async listMyOrders(request, reply) {
    const { customerId, userId } = request.customer

    const orders = await prisma.order.findMany({
      where: { customerId, userId },
      include: {
        items: { include: { product: { select: { id: true, name: true, imageUrl: true, price: true, minOrder: true, maxOrder: true, description: true, allowInspirationImages: true, maxInspirationImages: true, inspirationInstruction: true } }, attachments: true, additionals: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return orders
  }

  // POST /api/store/:slug/upload — upload de imagem de inspiração (customer auth)
  async uploadInspirationImage(request, reply) {
    const { slug } = request.params
    const account = await prisma.account.findFirst({
      where: { slug, storeActive: true },
      select: { id: true },
    })
    if (!account) return reply.status(404).send({ error: 'Loja não encontrada' })

    const file = await request.file()
    if (!file) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.mimetype)) {
      return reply.status(400).send({ error: 'Tipo não permitido. Use JPEG, PNG, WebP ou GIF.' })
    }

    const folder = AccountService.getUploadFolder(account.id, 'inspirations')
    const result = await UploadService.uploadFile(file, folder)
    return reply.status(201).send(result)
  }

  // POST /api/store/:slug/validate-images — valida imagens de inspiração com IA
  async validateInspirationImages(request, reply) {
    const { images, productName } = request.body
    // images: [{ imageUrl }], productName: string

    if (!images?.length || !productName) {
      return reply.status(400).send({ error: 'Imagens e nome do produto são obrigatórios' })
    }

    try {
      const content = [
        {
          type: 'text',
          text: `Você é um validador de imagens de inspiração para pedidos de confeitaria/doceria.

O cliente está fazendo um pedido de: "${productName}"
Ele enviou ${images.length} imagem(ns) de inspiração/referência.

Analise CADA imagem e verifique se:
1. A imagem é relacionada a confeitaria, doces, bolos, decoração de festas ou alimentos em geral
2. A imagem NÃO contém conteúdo impróprio, ofensivo ou completamente irrelevante (ex: memes, screenshots aleatórios, conteúdo adulto)

Responda APENAS com um JSON válido neste formato:
{"approved": true/false, "message": "mensagem curta em português explicando o resultado"}

Se TODAS as imagens forem apropriadas como referência para confeitaria, aprove.
Se alguma imagem for claramente irrelevante ou imprópria, rejeite e explique qual imagem e por quê.
Seja tolerante — aceite imagens de paletas de cores, decorações, temas de festa, personagens (para bolos temáticos), etc.`,
        },
      ]

      for (const img of images) {
        content.push({ type: 'image_url', image_url: { url: img.imageUrl } })
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content }],
        max_tokens: 200,
        temperature: 0.3,
      })

      const text = response.choices[0]?.message?.content?.trim() || ''
      // Extrair JSON da resposta
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        return { approved: !!result.approved, message: result.message || '' }
      }

      return { approved: true, message: 'Imagens validadas' }
    } catch (err) {
      console.error('Erro ao validar imagens:', err.message)
      // Em caso de erro na IA, aprovar para não bloquear o pedido
      return { approved: true, message: 'Validação indisponível, imagens aceitas' }
    }
  }

  // POST /api/store/:slug/customer/forgot-password — envia código via WhatsApp
  async customerForgotPassword(request, reply) {
    const { slug } = request.params
    const { phone } = request.body
    const account = await resolveSlug(slug, reply)
    if (!account) return

    if (!phone) return reply.status(400).send({ error: 'Celular é obrigatório' })

    // Busca por telefone exato ou normalizado
    const norm = normalizePhone(phone)
    let customer = await prisma.customer.findFirst({
      where: { userId: account.userId, phone, active: true },
    })
    if (!customer && norm) {
      const candidates = await prisma.customer.findMany({
        where: { userId: account.userId, active: true },
      })
      customer = candidates.find(c => normalizePhone(c.phone) === norm) || null
    }
    if (!customer) {
      return reply.status(404).send({ error: 'Nenhuma conta encontrada com este celular' })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = Date.now() + 10 * 60 * 1000

    resetCodes.set(`${account.userId}_${norm}`, { customerId: customer.id, code, expiresAt })

    // Limpa códigos expirados
    for (const [k, v] of resetCodes) {
      if (v.expiresAt < Date.now()) resetCodes.delete(k)
    }

    // Envia código via WhatsApp (instância do sistema)
    try {
      const instance = await prisma.instance.findFirst({
        where: { instanceName: 'ZapCakes-System', status: 'CONNECTED' },
      })
      if (instance) {
        const digits = phone.replace(/\D/g, '')
        const number = digits.startsWith('55') ? digits : `55${digits}`

        await evolutionApi.post(`/message/sendText/${instance.instanceName}`, {
          number,
          text: `*${account.companyName}*\nUse o codigo ${code} para informar uma nova senha de acesso.`,
        })
      } else {
        console.error('[ForgotPassword] Instância ZapCakes-System não conectada')
        return reply.status(500).send({ error: 'Serviço de WhatsApp indisponível no momento' })
      }
    } catch (err) {
      console.error('[ForgotPassword] Erro ao enviar WhatsApp:', err.message)
      return reply.status(500).send({ error: 'Erro ao enviar código via WhatsApp' })
    }

    return { success: true }
  }

  // POST /api/store/:slug/customer/verify-reset-code — verifica código
  async customerVerifyResetCode(request, reply) {
    const { slug } = request.params
    const { phone, code } = request.body
    const account = await resolveSlug(slug, reply)
    if (!account) return

    if (!phone || !code) return reply.status(400).send({ error: 'Celular e código são obrigatórios' })

    const key = `${account.userId}_${normalizePhone(phone)}`
    const entry = resetCodes.get(key)

    if (!entry) return reply.status(400).send({ error: 'Código não encontrado. Solicite um novo.' })
    if (entry.expiresAt < Date.now()) {
      resetCodes.delete(key)
      return reply.status(400).send({ error: 'Código expirado. Solicite um novo.' })
    }
    if (entry.code !== code) return reply.status(400).send({ error: 'Código inválido' })

    return { valid: true }
  }

  // POST /api/store/:slug/customer/reset-password — redefine senha e faz login
  async customerResetPassword(request, reply) {
    const { slug } = request.params
    const { phone, code, password } = request.body
    const account = await resolveSlug(slug, reply)
    if (!account) return

    if (!phone || !code || !password) {
      return reply.status(400).send({ error: 'Celular, código e nova senha são obrigatórios' })
    }
    if (password.length < 4) {
      return reply.status(400).send({ error: 'Senha deve ter no mínimo 4 caracteres' })
    }

    const key = `${account.userId}_${normalizePhone(phone)}`
    const entry = resetCodes.get(key)

    if (!entry) return reply.status(400).send({ error: 'Código não encontrado. Solicite um novo.' })
    if (entry.expiresAt < Date.now()) {
      resetCodes.delete(key)
      return reply.status(400).send({ error: 'Código expirado. Solicite um novo.' })
    }
    if (entry.code !== code) return reply.status(400).send({ error: 'Código inválido' })

    const hashed = await bcrypt.hash(password, 10)
    const customer = await prisma.customer.update({
      where: { id: entry.customerId },
      data: { password: hashed },
    })

    resetCodes.delete(key)

    // Auto-login
    const token = request.server.jwt.sign(
      { customerId: customer.id, userId: account.userId, type: 'customer' },
      { expiresIn: '30d' },
    )

    const { password: _, ...safe } = customer
    return { token, customer: safe }
  }

  // POST /api/store/:slug/orders/:orderId/payment-proof — upload comprovante PIX
  async uploadPaymentProof(request, reply) {
    const { slug, orderId } = request.params
    const { customerId, userId } = request.customer

    const order = await prisma.order.findFirst({
      where: { id: Number(orderId), customerId, userId },
    })
    if (!order) return reply.status(404).send({ error: 'Pedido não encontrado' })

    if (order.proofVerified) {
      return reply.status(400).send({ error: 'Comprovante já foi verificado' })
    }

    const account = await prisma.account.findFirst({
      where: { slug, storeActive: true },
      select: { id: true },
    })
    if (!account) return reply.status(404).send({ error: 'Loja não encontrada' })

    const file = await request.file()
    if (!file) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.mimetype)) {
      return reply.status(400).send({ error: 'Tipo não permitido. Use JPEG, PNG, WebP ou PDF.' })
    }

    // Lê o buffer antes do upload para poder enviar à IA
    const fileBuffer = await file.toBuffer()
    console.log(`[Comprovante] Pedido #${order.id} - Buffer size: ${fileBuffer.length} bytes, mimetype: ${file.mimetype}`)

    const folder = AccountService.getUploadFolder(account.id, 'payment-proofs')
    const result = await UploadService.uploadBuffer(fileBuffer, file.mimetype, folder)

    // Valor esperado: reservation (valor real da reserva) ou total
    const expectedAmount = order.reservation ? Number(order.reservation) : Number(order.total)

    // Análise do comprovante via IA (apenas para imagens)
    let proofAmount = null
    let valueDivergent = false
    let aiMessage = null

    console.log(`[Comprovante IA] Mimetype: ${file.mimetype} | isImage: ${file.mimetype.startsWith('image/')}`)
    if (file.mimetype.startsWith('image/')) {
      try {
        const base64 = fileBuffer.toString('base64')
        const dataUrl = `data:${file.mimetype};base64,${base64}`

        const aiResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: [
                    'Analise esta imagem de comprovante de pagamento PIX/transferência bancária e extraia APENAS o VALOR MONETÁRIO da transação em reais.',
                    '',
                    'REGRA OBRIGATÓRIA: o valor SÓ pode vir de um campo rotulado como "Valor pago", "Valor da transação", "Valor do PIX", "Valor transferido", "Total" ou "Valor", e SEMPRE acompanhado de "R$" ou contexto de moeda.',
                    '',
                    'NUNCA extraia números de:',
                    '- CPF/CNPJ (ex: "***.473.597-**", "12.345.678/0001-90")',
                    '- Agência/Conta (ex: "Ag 2987 Cc 2099628-6")',
                    '- ID/Transação (ex: "E904008882026...")',
                    '- Chave PIX, telefone, data, hora',
                    '',
                    'Responda SOMENTE com o número decimal usando ponto (ex: 46.80 para R$ 46,80). Se NÃO conseguir localizar com certeza um campo de valor monetário rotulado com "R$", responda "0".',
                  ].join('\n'),
                },
                {
                  type: 'image_url',
                  image_url: { url: dataUrl, detail: 'low' },
                },
              ],
            },
          ],
        })

        const extracted = aiResponse.choices?.[0]?.message?.content?.trim()
        console.log(`[Comprovante IA] Pedido #${order.id} - Resposta: "${extracted}" | Esperado: R$ ${expectedAmount.toFixed(2)}`)
        const parsed = parseFloat(extracted?.replace(',', '.'))
        if (!isNaN(parsed) && parsed > 0) {
          proofAmount = parsed
        }
      } catch (err) {
        console.error('Erro ao analisar comprovante via IA:', err.message)
      }
    }

    // Sanity check: descarta valores absurdos (IA pode pegar CPF/ID/conta
    // por engano). Se proofAmount for >R$ 100.000 OU >50x o esperado,
    // trata como "nao extraido" e equipe verifica manualmente.
    if (proofAmount !== null) {
      const tooHighAbsolute = proofAmount > 100000
      const tooHighRelative = expectedAmount > 0 && proofAmount > expectedAmount * 50
      if (tooHighAbsolute || tooHighRelative) {
        console.warn('[Comprovante IA] proofAmount descartado por valor implausivel:', { proofAmount, expectedAmount, orderId: order.id })
        proofAmount = null
      }
    }

    // Verifica divergência de valor (mesma lógica do WhatsApp)
    if (proofAmount !== null && expectedAmount > 0) {
      const diff = Math.abs(proofAmount - expectedAmount)
      if (diff > 0.50) {
        valueDivergent = true
        if (proofAmount > expectedAmount) {
          aiMessage = `Parece que seu comprovante de pagamento tem o valor diferente do esperado (R$ ${expectedAmount.toFixed(2)}), mas fique tranquilo, nossa equipe irá verificar e responder.`
        } else {
          aiMessage = `O valor do comprovante (R$ ${proofAmount.toFixed(2)}) parece diferente do valor esperado (R$ ${expectedAmount.toFixed(2)}). Fique tranquilo, nossa equipe irá verificar e responder.`
        }
      }
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentProof: result.url,
        status: 'RESERVATION',
        ...(proofAmount !== null ? { depositAmount: proofAmount } : {}),
        ...(valueDivergent ? { depositDivergence: true } : {}),
      },
      select: { id: true, paymentProof: true, proofVerified: true, depositAmount: true, depositDivergence: true, status: true },
    })

    // Notificar confeiteiro via WhatsApp (instância do sistema)
    try {
      const owner = await prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true, name: true },
      })
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { name: true, phone: true },
      })

      if (owner?.phone) {
        const instance = await prisma.instance.findFirst({
          where: { instanceName: 'ZapCakes-System', status: 'CONNECTED' },
        })
        if (instance) {
          const phoneDigits = owner.phone.replace(/\D/g, '')
          const whatsappNumber = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`
          const depositValue = proofAmount !== null ? proofAmount : (order.reservation ? Number(order.reservation) : Number(order.total))
          const divergenceWarning = valueDivergent ? '\n*Atenção:* Valor do comprovante divergente do esperado!' : ''

          const frontendUrl = process.env.FRONTEND_URL
          const orderCode = String(order.orderNumber).padStart(5, '0')
          const orderLinkLine = frontendUrl
            ? `\n\nAcesse o pedido: ${frontendUrl.replace(/\/$/, '')}/client/orders/${orderCode}`
            : ''

          const msg = `*Novo comprovante de reserva recebido!*\n\n` +
            `*Pedido #${orderCode}*\n` +
            `*Cliente:* ${customer?.name || 'N/A'}\n` +
            `*Celular:* ${customer?.phone || 'N/A'}\n` +
            `*Valor da reserva:* R$ ${depositValue.toFixed(2).replace('.', ',')}\n` +
            `*Total do pedido:* R$ ${Number(order.total).toFixed(2).replace('.', ',')}` +
            `${divergenceWarning}` +
            orderLinkLine

          await evolutionApi.post(`/message/sendText/${instance.instanceName}`, {
            number: whatsappNumber,
            text: msg,
          })
        }
      }
    } catch (err) {
      console.error('[Comprovante] Erro ao notificar confeiteiro via WhatsApp:', err.message)
    }

    return reply.status(201).send({
      ...updated,
      aiMessage: aiMessage || (proofAmount !== null
        ? `Comprovante recebido! Valor identificado: R$ ${proofAmount.toFixed(2)}. Aguarde a verificação da loja.`
        : 'Comprovante enviado! Aguarde a verificação da loja.'),
      valueDivergent,
    })
  }
}
