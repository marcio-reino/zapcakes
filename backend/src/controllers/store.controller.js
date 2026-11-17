import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import prisma from '../config/database.js'
import { UploadService } from '../services/upload.service.js'
import { AccountService } from '../services/account.service.js'
import openai from '../config/openai.js'
import evolutionApi from '../config/evolution.js'
import { resolveItemAdditionals, persistOrderItemAdditionals } from '../services/order.service.js'
import { liveEventWhere, sellableWhere } from '../services/catalog-event.service.js'

const publicEventSelect = { id: true, name: true, slug: true, description: true, bannerUrl: true, startsAt: true, endsAt: true }

// Sem ?event= → catálogo principal (eventId null). Com ?event=slug → só itens do evento em vigor.
async function resolveCatalogScope(userId, eventSlug, reply) {
  if (!eventSlug) return { eventId: null }
  const event = await prisma.catalogEvent.findFirst({
    where: { userId, slug: String(eventSlug), ...liveEventWhere() },
    select: { id: true },
  })
  if (!event) {
    reply.status(404).send({ error: 'Catálogo não encontrado ou encerrado' })
    return null
  }
  return { eventId: event.id }
}

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
        userId: true,
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

    const events = await prisma.catalogEvent.findMany({
      where: { userId: account.userId, ...liveEventWhere() },
      select: publicEventSelect,
      orderBy: [{ endsAt: 'asc' }, { name: 'asc' }],
    })

    return {
      events,
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

  // GET /api/store/:slug/events/:eventSlug — dados do catálogo de data comemorativa
  async getEvent(request, reply) {
    const { slug, eventSlug } = request.params
    const account = await resolveSlug(slug, reply)
    if (!account) return

    const event = await prisma.catalogEvent.findFirst({
      where: { userId: account.userId, slug: eventSlug, ...liveEventWhere() },
      select: publicEventSelect,
    })
    if (!event) return reply.status(404).send({ error: 'Catálogo não encontrado ou encerrado' })
    return event
  }

  // GET /api/store/:slug/categories?event=slug
  async getCategories(request, reply) {
    const { slug } = request.params
    const account = await resolveSlug(slug, reply)
    if (!account) return
    const scope = await resolveCatalogScope(account.userId, request.query.event, reply)
    if (!scope) return

    const categories = await prisma.category.findMany({
      where: { userId: account.userId, active: true },
      select: {
        id: true, name: true,
        _count: { select: { products: { where: { active: true, eventId: scope.eventId } } } },
      },
      orderBy: { name: 'asc' },
    })

    return categories.filter(c => c._count.products > 0)
  }

  // GET /api/store/:slug/products?categoryId=N&event=slug
  async getProducts(request, reply) {
    const { slug } = request.params
    const { categoryId } = request.query
    const account = await resolveSlug(slug, reply)
    if (!account) return
    const scope = await resolveCatalogScope(account.userId, request.query.event, reply)
    if (!scope) return

    const where = { userId: account.userId, active: true, eventId: scope.eventId }
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

  // GET /api/store/:slug/combos?event=slug
  async getCombos(request, reply) {
    const { slug } = request.params
    const account = await resolveSlug(slug, reply)
    if (!account) return
    const scope = await resolveCatalogScope(account.userId, request.query.event, reply)
    if (!scope) return

    const combos = await prisma.combo.findMany({
      where: { userId: account.userId, active: true, eventId: scope.eventId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, price: true, imageUrl: true,
                allowInspirationImages: true,
                maxInspirationImages: true,
                inspirationInstruction: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        comboAdditionals: {
          where: { additional: { active: true } },
          include: { additional: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    return combos.map(c => {
      const totalItems = c.items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0)
      const additionals = (c.comboAdditionals || []).map(ca => ({
        id: ca.additional.id,
        description: ca.additional.description,
        imageUrl: ca.additional.imageUrl,
        price: ca.additional.price,
      }))
      const { comboAdditionals, ...rest } = c
      return { ...rest, additionals, totalPrice: totalItems - Number(c.discount || 0) }
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
    const { items, combos, deliveryAddress, deliveryZipCode, deliveryType, notes, estimatedDeliveryDate, deliveryFee, deliveryZoneId } = request.body
    const { customerId, userId } = request.customer

    if ((!items || !items.length) && (!combos || !combos.length)) {
      return reply.status(400).send({ error: 'Adicione pelo menos um item' })
    }

    // Data de entrega agora e obrigatoria pra fechar pedido
    if (!estimatedDeliveryDate) {
      return reply.status(400).send({ error: 'Selecione a data de entrega antes de finalizar o pedido' })
    }

    // Validar data de agendamento
    let agendaSlot = null
    {
      const datePart = String(estimatedDeliveryDate).split('|')[0]
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
        where: { id: { in: productIds }, userId, active: true, ...sellableWhere() },
      })

      if (products.length !== productIds.length) {
        return reply.status(400).send({ error: 'Um ou mais produtos não estão mais disponíveis (o catálogo pode ter sido encerrado). Revise o carrinho.' })
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
        where: { id: { in: comboIds }, userId, active: true, ...sellableWhere() },
        include: {
          items: {
            include: { product: true },
            orderBy: { sortOrder: 'asc' },
          },
          comboAdditionals: {
            where: { additional: { active: true } },
            include: { additional: true },
          },
        },
      })

      if (dbCombos.length !== comboIds.length) {
        return reply.status(400).send({ error: 'Um ou mais combos não estão mais disponíveis (o catálogo pode ter sido encerrado). Revise o carrinho.' })
      }

      for (const comboEntry of combos) {
        const combo = dbCombos.find(c => c.id === comboEntry.comboId)
        const qty = comboEntry.quantity || 1

        // Adicionais selecionados pelo cliente para este combo (snapshot)
        const allowedAddonIds = new Set(combo.comboAdditionals.map(ca => ca.additionalId))
        const requestedAddons = Array.isArray(comboEntry.additionals) ? comboEntry.additionals : []
        const comboAddons = []
        for (const reqA of requestedAddons) {
          const additionalId = Number(reqA.additionalId)
          if (!allowedAddonIds.has(additionalId)) continue
          const ca = combo.comboAdditionals.find(x => x.additionalId === additionalId)
          if (!ca) continue
          const addonQty = Math.max(1, Number(reqA.quantity) || 1)
          comboAddons.push({
            additionalId: ca.additionalId,
            description: ca.additional.description,
            price: ca.additional.price,
            quantity: addonQty,
          })
          total += Number(ca.additional.price) * addonQty * qty
        }

        // Imagens de inspiracao escolhidas pelo cliente para cada produto
        // interno do combo. Formato: { [productId]: [{ imageUrl, description? }] }
        const innerAttachmentsByProduct = (comboEntry.attachments && typeof comboEntry.attachments === 'object')
          ? comboEntry.attachments
          : {}

        let firstItemKey = null
        for (const ci of combo.items) {
          const innerAtts = Array.isArray(innerAttachmentsByProduct[ci.productId])
            ? innerAttachmentsByProduct[ci.productId]
            : []
          const existing = orderItems.find(oi => oi.productId === ci.productId)
          if (existing) {
            existing.quantity += ci.quantity * qty
            if (innerAtts.length) {
              existing._attachments = [...(existing._attachments || []), ...innerAtts]
            }
            if (firstItemKey === null) firstItemKey = ci.productId
          } else {
            const entry = {
              productId: ci.productId,
              quantity: ci.quantity * qty,
              price: ci.product.price,
              _attachments: innerAtts,
              _addons: [],
            }
            orderItems.push(entry)
            if (firstItemKey === null) firstItemKey = ci.productId
          }
          total += Number(ci.product.price) * ci.quantity * qty
        }

        // Anexa os adicionais do combo no primeiro item expandido. Multiplica
        // quantidade pelo qty do combo (ex: 2x combo + 1 topper = 2 toppers).
        if (comboAddons.length > 0 && firstItemKey !== null) {
          const target = orderItems.find(oi => oi.productId === firstItemKey)
          if (target) {
            target._addons = target._addons || []
            for (const addon of comboAddons) {
              target._addons.push({ ...addon, quantity: addon.quantity * qty })
            }
          }
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
        deliveryZipCode: deliveryZipCode ? String(deliveryZipCode).replace(/\D/g, '').slice(0, 8) || null : null,
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
      deliveryZipCode,
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

    // Pedido editavel enquanto PENDING (antes do comprovante) ou
    // RESERVATION (com comprovante enviado, aguardando verificacao da loja).
    // Em RESERVATION, entra no "modo limitado": so observacoes e fotos de
    // inspiracao podem ser alteradas. Os demais campos (itens, adicionais,
    // endereco, data) ficam congelados.
    const EDITABLE_STATUSES = ['PENDING', 'RESERVATION']
    if (!EDITABLE_STATUSES.includes(order.status)) {
      return reply.status(403).send({ error: 'Este pedido não pode mais ser editado (status atual: ' + order.status + ')' })
    }
    const limitedMode = !!order.paymentProof
    // Bloqueia edicao no dia da entrega em diante (cliente edita ate o dia
    // anterior). Parser aceita "dd/mm/yyyy", "yyyy-mm-dd" ou "dd/mm" (com
    // ano corrente como fallback) -- mesmo padrao usado no resto do app.
    const deliveryISO = (() => {
      const s = order.estimatedDeliveryDate
      if (!s) return null
      const iso = String(s).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
      if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
      const br = String(s).match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
      if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
      const brShort = String(s).match(/(?<!\d)(\d{1,2})[/-](\d{1,2})(?!\d|[/-]\d)/)
      if (brShort) {
        const y = new Date().getFullYear()
        return `${y}-${brShort[2].padStart(2, '0')}-${brShort[1].padStart(2, '0')}`
      }
      return null
    })()
    if (!deliveryISO) {
      return reply.status(403).send({ error: 'Pedido sem data de entrega definida — fale com a loja para editar' })
    }
    // "Hoje" em America/Sao_Paulo (UTC-3). Sem isso o container em UTC
    // considera a virada da meia-noite UTC -- por volta de 21h em Brasilia
    // -- como "amanha", bloqueando edicoes legitimas no fim do dia.
    const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    if (todayISO >= deliveryISO) {
      return reply.status(403).send({ error: 'O pedido não pode mais ser editado: hoje é o dia da entrega (ou já passou)' })
    }

    // ---- MODO LIMITADO: pedido com comprovante anexado ----
    // So permite alterar notes (observacoes) e fotos de inspiracao dos
    // itens existentes. Os demais campos (itens, quantidade, adicionais,
    // entrega, data, etc.) sao ignorados silenciosamente -- congelados.
    if (limitedMode) {
      await prisma.$transaction(async (tx) => {
        // Atualiza notes se veio no body
        if (notes !== undefined) {
          await tx.order.update({
            where: { id: order.id },
            data: { notes: notes || null },
          })
        }

        // Para cada item do body, se trouxer attachments, substitui os
        // attachments do orderItem existente correspondente (por productId).
        if (Array.isArray(items) && items.length > 0) {
          for (const it of items) {
            const productId = Number(it.productId)
            const existingOrderItem = order.items.find(oi => oi.productId === productId)
            if (!existingOrderItem) continue
            if (!Array.isArray(it.attachments)) continue
            const cleaned = it.attachments
              .map(a => ({ imageUrl: a?.imageUrl, description: a?.description || null }))
              .filter(a => a.imageUrl)
            // Substitui anexos do item
            await tx.orderItemAttachment.deleteMany({ where: { orderItemId: existingOrderItem.id } })
            if (cleaned.length) {
              await tx.orderItemAttachment.createMany({
                data: cleaned.map(att => ({
                  orderItemId: existingOrderItem.id,
                  imageUrl: att.imageUrl,
                  description: att.description,
                })),
              })
            }
          }
        }
      })
      const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { items: { include: { product: true, attachments: true, additionals: true } } },
      })
      return reply.send(fullOrder)
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

    // Carrega produtos novos pra recalcular preco usando snapshot atual do catalogo.
    // Itens que ja estavam no pedido continuam aceitos mesmo se o catalogo do evento encerrou.
    const productIds = [...new Set(items.map(i => Number(i.productId)).filter(Boolean))]
    const existingProductIds = order.items.map(oi => oi.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds }, userId, active: true,
        OR: [{ id: { in: existingProductIds } }, sellableWhere()],
      },
    })
    if (products.length !== productIds.length) {
      return reply.status(400).send({ error: 'Um ou mais produtos não encontrados ou inativos' })
    }

    // Resolve adicionais informados no payload (por item), permissivo.
    // No edit, o pedido pode ter adicionais "legados" — vindos de combo
    // ou ja desvinculados do produto pelo admin depois da criacao. Aqui
    // aceitamos qualquer adicional ATIVO de propriedade do usuario (sem
    // exigir o link em ProductAdditional). Isso e' mais permissivo que
    // o resolveItemAdditionals usado no create, mas evita travar o save
    // por adicional pre-existente que mudou de status.
    const reqAddonIds = new Set()
    for (const it of items) {
      for (const a of it?.additionals || []) {
        const id = Number(a.additionalId)
        if (!isNaN(id)) reqAddonIds.add(id)
      }
    }
    const ownedAddons = reqAddonIds.size > 0
      ? await prisma.additional.findMany({
          where: { id: { in: [...reqAddonIds] }, userId, active: true },
        })
      : []
    const addonById = Object.fromEntries(ownedAddons.map(a => [a.id, a]))
    const itemAddons = items.map((it) => {
      const resolved = []
      let addonTotal = 0
      for (const a of it?.additionals || []) {
        const id = Number(a.additionalId)
        const add = addonById[id]
        if (!add) continue // ignora silenciosamente adicional invalido/inativo
        const qty = Math.max(1, Number(a.quantity) || 1)
        resolved.push({
          additionalId: id,
          description: add.description,
          price: add.price,
          quantity: qty,
        })
        addonTotal += Number(add.price) * qty
      }
      return { _addons: resolved, _addonTotal: addonTotal }
    })

    // Anexos: aceita o que o cliente enviou no body (cart envia o conjunto
    // completo: existentes + novos uploads). Se o item do body nao tem
    // attachments definido, cai pro snapshot do que ja estava no banco
    // (compatibilidade pra clientes/sessoes antigas que nao enviavam o campo).
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

      // Resolve attachments: prioriza o que veio no body, normalizando para
      // { imageUrl, description }. Se nao veio campo, mantem o que ja estava.
      let resolvedAttachments
      if (Array.isArray(it.attachments)) {
        resolvedAttachments = it.attachments
          .map(a => ({ imageUrl: a.imageUrl, description: a.description || null }))
          .filter(a => a.imageUrl)
      } else {
        resolvedAttachments = (existingAttachmentsByProduct.get(productId) || [])
          .map(a => ({ imageUrl: a.imageUrl, description: a.description || null }))
      }

      newItemsData.push({
        productId,
        quantity,
        price: product.price,
        _addons: addons,
        _attachments: resolvedAttachments,
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
          ...(deliveryZipCode !== undefined ? { deliveryZipCode: deliveryZipCode ? String(deliveryZipCode).replace(/\D/g, '').slice(0, 8) || null : null } : {}),
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
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, imageUrl: true, price: true,
                minOrder: true, maxOrder: true, description: true,
                allowInspirationImages: true, maxInspirationImages: true, inspirationInstruction: true,
                productAdditionals: {
                  where: { additional: { active: true } },
                  include: { additional: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
            attachments: true,
            additionals: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Mapeia productAdditionals -> additionals[] (mesmo formato usado pelo
    // ProductModal/cart) para o cliente conseguir editar adicionais no
    // modo de edicao do pedido.
    return orders.map(o => ({
      ...o,
      items: o.items.map(it => {
        const p = it.product
        const productAdditionals = p?.productAdditionals || []
        const additionalsArr = productAdditionals.map(pa => ({
          id: pa.additional.id,
          description: pa.additional.description,
          imageUrl: pa.additional.imageUrl,
          price: pa.additional.price,
        }))
        const { productAdditionals: _drop, ...prod } = p || {}
        return { ...it, product: { ...prod, additionals: additionalsArr } }
      }),
    }))
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
