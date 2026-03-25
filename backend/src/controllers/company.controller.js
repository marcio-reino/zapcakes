import prisma from '../config/database.js'

export class CompanyController {
  // GET /api/company — retorna dados da empresa do usuário logado
  async get(request, reply) {
    const userId = request.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true,
        street: true, number: true, complement: true,
        neighborhood: true, city: true, state: true,
        zipCode: true, reference: true,
        account: {
          select: {
            id: true, companyName: true, legalName: true,
            document: true, documentType: true,
            logoUrl: true, responsible: true, hourlyRate: true, useReservation: true, reservationPercent: true,
            status: true, trialEndsAt: true, planStartedAt: true, planExpiresAt: true,
            plan: {
              select: {
                id: true, title: true, description: true, price: true, features: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado' })
    }

    return {
      // Dados do usuário (endereço)
      name: user.name,
      email: user.email,
      phone: user.phone,
      street: user.street,
      number: user.number,
      complement: user.complement,
      neighborhood: user.neighborhood,
      city: user.city,
      state: user.state,
      zipCode: user.zipCode,
      reference: user.reference,
      // Dados da conta/empresa
      companyName: user.account?.companyName || '',
      legalName: user.account?.legalName || '',
      document: user.account?.document || '',
      documentType: user.account?.documentType || '',
      logoUrl: user.account?.logoUrl || '',
      responsible: user.account?.responsible || '',
      hourlyRate: user.account?.hourlyRate || 0,
      useReservation: user.account?.useReservation || false,
      reservationPercent: user.account?.reservationPercent || null,
      // Plano
      plan: user.account?.plan || null,
      accountStatus: user.account?.status || null,
      trialEndsAt: user.account?.trialEndsAt || null,
      planStartedAt: user.account?.planStartedAt || null,
      planExpiresAt: user.account?.planExpiresAt || null,
    }
  }

  // GET /api/company/payments — retorna pagamentos do cliente
  async payments(request, reply) {
    const userId = request.user.id

    const account = await prisma.account.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!account) {
      return reply.status(404).send({ error: 'Conta não encontrada' })
    }

    const payments = await prisma.payment.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return payments
  }

  // GET /api/company/pending-payment — retorna cobrança pendente do mês atual + dados PIX
  async pendingPayment(request, reply) {
    const userId = request.user.id

    const account = await prisma.account.findUnique({
      where: { userId },
      select: { id: true, companyName: true, plan: { select: { title: true, price: true } } },
    })
    if (!account) {
      return reply.status(404).send({ error: 'Conta não encontrada' })
    }

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const payment = await prisma.payment.findFirst({
      where: {
        accountId: account.id,
        referenceMonth: currentMonth,
        status: 'PENDING',
      },
    })

    // Busca configurações de PIX
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ['pix_key', 'pix_name', 'payment_instructions'] } },
    })
    const configMap = {}
    for (const c of configs) configMap[c.key] = c.value

    return {
      payment: payment || null,
      plan: account.plan,
      companyName: account.companyName,
      pixKey: configMap.pix_key || null,
      pixName: configMap.pix_name || null,
      paymentInstructions: configMap.payment_instructions || null,
    }
  }

  // PUT /api/company/payments/:id/proof — anexar comprovante de pagamento
  async attachProof(request, reply) {
    const userId = request.user.id
    const { id } = request.params
    const { proofUrl } = request.body

    const account = await prisma.account.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!account) {
      return reply.status(404).send({ error: 'Conta não encontrada' })
    }

    const payment = await prisma.payment.findFirst({
      where: { id: Number(id), accountId: account.id },
    })
    if (!payment) {
      return reply.status(404).send({ error: 'Pagamento não encontrado' })
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { proofUrl },
    })

    return updated
  }

  // GET /api/company/store — retorna configurações da loja
  async getStoreSettings(request, reply) {
    const account = await prisma.account.findUnique({
      where: { userId: request.user.id },
      select: { slug: true, storeActive: true, deliveryEnabled: true },
    })
    if (!account) return reply.status(404).send({ error: 'Conta não encontrada' })
    return account
  }

  // PUT /api/company/store — atualiza configurações da loja
  async updateStoreSettings(request, reply) {
    const { slug, storeActive, deliveryEnabled } = request.body

    if (slug !== undefined) {
      const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100)
      if (normalized.length < 3) {
        return reply.status(400).send({ error: 'O slug deve ter no mínimo 3 caracteres (letras, números e hífens)' })
      }
      const existing = await prisma.account.findFirst({
        where: { slug: normalized, userId: { not: request.user.id } },
      })
      if (existing) {
        return reply.status(409).send({ error: 'Este endereço já está em uso por outra loja' })
      }
    }

    const data = {}
    if (slug !== undefined) data.slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100)
    if (storeActive !== undefined) data.storeActive = storeActive
    if (deliveryEnabled !== undefined) data.deliveryEnabled = deliveryEnabled

    const account = await prisma.account.update({
      where: { userId: request.user.id },
      data,
      select: { slug: true, storeActive: true, deliveryEnabled: true },
    })

    return account
  }

  // PUT /api/company — atualiza dados da empresa
  async update(request, reply) {
    const userId = request.user.id
    const {
      companyName, legalName, document, documentType,
      logoUrl, responsible, hourlyRate, useReservation, reservationPercent,
      phone, street, number, complement,
      neighborhood, city, state, zipCode, reference,
    } = request.body

    // Atualiza campos de endereço no User
    const userData = {}
    if (phone !== undefined) userData.phone = phone
    if (street !== undefined) userData.street = street
    if (number !== undefined) userData.number = number
    if (complement !== undefined) userData.complement = complement
    if (neighborhood !== undefined) userData.neighborhood = neighborhood
    if (city !== undefined) userData.city = city
    if (state !== undefined) userData.state = state
    if (zipCode !== undefined) userData.zipCode = zipCode
    if (reference !== undefined) userData.reference = reference

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({ where: { id: userId }, data: userData })
    }

    // Atualiza campos da empresa na Account
    const accountData = {}
    if (companyName !== undefined) accountData.companyName = companyName
    if (legalName !== undefined) accountData.legalName = legalName
    if (document !== undefined) accountData.document = document
    if (documentType !== undefined) accountData.documentType = documentType || null
    if (logoUrl !== undefined) accountData.logoUrl = logoUrl
    if (responsible !== undefined) accountData.responsible = responsible
    if (hourlyRate !== undefined) accountData.hourlyRate = hourlyRate
    if (useReservation !== undefined) accountData.useReservation = useReservation
    if (reservationPercent !== undefined) accountData.reservationPercent = reservationPercent

    if (Object.keys(accountData).length > 0) {
      await prisma.account.update({
        where: { userId },
        data: accountData,
      })
    }

    return { success: true }
  }

  // GET /api/company/delivery-zones
  async listDeliveryZones(request, reply) {
    const zones = await prisma.deliveryZone.findMany({
      where: { userId: request.user.id },
      orderBy: { name: 'asc' },
    })
    return zones
  }

  // POST /api/company/delivery-zones
  async createDeliveryZone(request, reply) {
    const { name, fee } = request.body
    if (!name?.trim()) return reply.status(400).send({ error: 'Nome é obrigatório' })
    if (fee === undefined || fee === null || Number(fee) < 0) return reply.status(400).send({ error: 'Taxa inválida' })

    const zone = await prisma.deliveryZone.create({
      data: { userId: request.user.id, name: name.trim(), fee: Number(fee) },
    })
    return reply.status(201).send(zone)
  }

  // PUT /api/company/delivery-zones/:id
  async updateDeliveryZone(request, reply) {
    const { id } = request.params
    const { name, fee, active } = request.body

    const zone = await prisma.deliveryZone.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!zone) return reply.status(404).send({ error: 'Zona não encontrada' })

    const data = {}
    if (name !== undefined) data.name = name.trim()
    if (fee !== undefined) data.fee = Number(fee)
    if (active !== undefined) data.active = active

    const updated = await prisma.deliveryZone.update({
      where: { id: zone.id },
      data,
    })
    return updated
  }

  // DELETE /api/company/delivery-zones/:id
  async deleteDeliveryZone(request, reply) {
    const { id } = request.params
    const zone = await prisma.deliveryZone.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!zone) return reply.status(404).send({ error: 'Zona não encontrada' })

    await prisma.deliveryZone.delete({ where: { id: zone.id } })
    return { success: true }
  }
}
