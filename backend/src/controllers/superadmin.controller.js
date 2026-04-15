import bcrypt from 'bcryptjs'
import axios from 'axios'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import prisma from '../config/database.js'
import evolutionApi from '../config/evolution.js'
import { sendMail } from '../services/mail.service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
async function generateUniquePaymentCode() {
  for (let i = 0; i < 50; i++) {
    let code = ''
    for (let j = 0; j < 4; j++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    const exists = await prisma.payment.findUnique({ where: { code } })
    if (!exists) return code
  }
  throw new Error('Não foi possível gerar código único')
}

export class SuperadminController {
  // Dashboard stats
  async stats(request, reply) {
    const [totalClients, activeClients, totalPlans, totalPayments, recentClients] = await Promise.all([
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.user.count({ where: { role: 'CLIENT', active: true } }),
      prisma.plan.count({ where: { active: true } }),
      prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true }, _count: true }),
      prisma.user.findMany({
        where: { role: 'CLIENT' },
        select: {
          id: true, name: true, email: true, active: true, createdAt: true,
          account: {
            select: {
              companyName: true, status: true,
              plan: { select: { title: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    return {
      totalClients,
      activeClients,
      inactiveClients: totalClients - activeClients,
      totalPlans,
      totalRevenue: totalPayments._sum.amount || 0,
      totalPaidPayments: totalPayments._count,
      recentClients,
    }
  }

  // Listar todas as contas de clientes com dados da empresa e plano
  async listAccounts(request, reply) {
    const users = await prisma.user.findMany({
      where: { role: 'CLIENT' },
      select: {
        id: true, name: true, email: true, phone: true, active: true, createdAt: true,
        street: true, number: true, complement: true, neighborhood: true,
        city: true, state: true, zipCode: true, reference: true,
        account: {
          select: {
            id: true, companyName: true, legalName: true, document: true, documentType: true,
            status: true, trialEndsAt: true, planStartedAt: true, planExpiresAt: true, billingDay: true,
            plan: { select: { id: true, title: true, price: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return users
  }

  // Visualizar conta específica com detalhes completos
  async getAccount(request, reply) {
    const { id } = request.params
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true, name: true, email: true, phone: true, role: true, active: true, createdAt: true,
        street: true, number: true, complement: true, neighborhood: true,
        city: true, state: true, zipCode: true, reference: true,
        account: {
          select: {
            id: true, companyName: true, legalName: true, document: true, documentType: true,
            logoUrl: true, responsible: true, hourlyRate: true, slug: true, storeActive: true,
            status: true, trialEndsAt: true, planStartedAt: true, planExpiresAt: true, billingDay: true, notes: true,
            plan: { select: { id: true, title: true, price: true } },
            payments: {
              select: { id: true, amount: true, method: true, status: true, referenceMonth: true, paidAt: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        },
        instances: {
          select: { id: true, instanceName: true, status: true, phone: true, profileName: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { orders: true, products: true, customers: true, instances: true },
        },
      },
    })

    if (!user) return reply.status(404).send({ error: 'Conta não encontrada' })

    // Atualiza status real das instâncias consultando a Evolution API
    if (user.instances?.length > 0) {
      await Promise.all(user.instances.map(async (inst) => {
        try {
          const { data } = await evolutionApi.get(`/instance/connectionState/${inst.instanceName}`)
          const state = data?.instance?.state ?? data?.state
          const realStatus = state === 'open' ? 'CONNECTED' : 'DISCONNECTED'
          if (realStatus !== inst.status) {
            await prisma.instance.update({ where: { id: inst.id }, data: { status: realStatus } })
          }
          inst.status = realStatus
        } catch (err) {
          console.log(`[superadmin] Erro ao checar status da instância ${inst.instanceName}:`, err?.response?.status, err?.response?.data || err.message)
        }
      }))
    }

    return user
  }

  // Atualizar conta (ativar/desativar, trocar plano, etc)
  async updateAccount(request, reply) {
    const { id } = request.params
    const { active, planId, status, name, email, phone, logoUrl, billingDay, notes } = request.body

    const user = await prisma.user.findUnique({ where: { id: Number(id) } })
    if (!user) return reply.status(404).send({ error: 'Conta não encontrada' })

    // Atualizar dados do user
    const userData = {}
    if (active !== undefined) userData.active = active
    if (name) userData.name = name
    if (email) userData.email = email
    if (phone !== undefined) userData.phone = phone

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({ where: { id: Number(id) }, data: userData })
    }

    // Atualizar dados da account
    const accountData = {}
    if (planId !== undefined) {
      accountData.planId = planId
      if (planId) {
        accountData.planStartedAt = new Date()
        accountData.status = 'ACTIVE'
      }
    }
    if (status) accountData.status = status
    if (logoUrl !== undefined) accountData.logoUrl = logoUrl
    if (billingDay !== undefined) accountData.billingDay = billingDay
    if (notes !== undefined) accountData.notes = notes

    if (Object.keys(accountData).length > 0) {
      await prisma.account.update({ where: { userId: Number(id) }, data: accountData })
    }

    return { message: 'Conta atualizada com sucesso' }
  }

  // Listar planos
  async listPlans(request, reply) {
    const plans = await prisma.plan.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { accounts: true } } },
    })
    return plans
  }

  // Criar plano
  async createPlan(request, reply) {
    const { title, description, price, features, trialDays, popular } = request.body
    if (!title || price === undefined) {
      return reply.status(400).send({ error: 'Título e preço são obrigatórios' })
    }

    const plan = await prisma.plan.create({
      data: {
        title, description, price,
        features: features ? JSON.stringify(features) : null,
        trialDays: trialDays ?? 15,
        popular: popular ?? false,
      },
    })
    return reply.status(201).send(plan)
  }

  // Atualizar plano
  async updatePlan(request, reply) {
    const { id } = request.params
    const { title, description, price, active, features, trialDays, popular } = request.body

    const plan = await prisma.plan.findUnique({ where: { id: Number(id) } })
    if (!plan) return reply.status(404).send({ error: 'Plano não encontrado' })

    const data = {}
    if (title) data.title = title
    if (description !== undefined) data.description = description
    if (price !== undefined) data.price = price
    if (active !== undefined) data.active = active
    if (features !== undefined) data.features = features ? JSON.stringify(features) : null
    if (trialDays !== undefined) data.trialDays = trialDays
    if (popular !== undefined) data.popular = popular

    const updated = await prisma.plan.update({ where: { id: Number(id) }, data })
    return updated
  }

  // Deletar plano
  async deletePlan(request, reply) {
    const { id } = request.params

    const plan = await prisma.plan.findUnique({
      where: { id: Number(id) },
      include: { _count: { select: { accounts: true } } },
    })
    if (!plan) return reply.status(404).send({ error: 'Plano não encontrado' })

    if (plan._count.accounts > 0) {
      return reply.status(400).send({ error: `Não é possível excluir. ${plan._count.accounts} conta(s) usam este plano.` })
    }

    await prisma.plan.delete({ where: { id: Number(id) } })
    return { message: 'Plano removido com sucesso' }
  }

  // ==================== FINANCEIRO ====================

  // Gerar cobranças do mês para todas as contas ativas com plano
  async generateBillings(request, reply) {
    const { month } = request.body // formato "2026-04"
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return reply.status(400).send({ error: 'Informe o mês no formato AAAA-MM' })
    }

    // Busca contas ativas com plano e billingDay definido
    const accounts = await prisma.account.findMany({
      where: {
        status: 'ACTIVE',
        planId: { not: null },
        billingDay: { not: null },
      },
      include: { plan: true, user: { select: { name: true } } },
    })

    let created = 0
    let skipped = 0

    for (const account of accounts) {
      // Verifica se já existe cobrança para este mês
      const existing = await prisma.payment.findFirst({
        where: { accountId: account.id, referenceMonth: month },
      })
      if (existing) { skipped++; continue }

      const [year, mon] = month.split('-').map(Number)
      const day = Math.min(account.billingDay, new Date(year, mon, 0).getDate())
      const dueDate = new Date(year, mon - 1, day)

      const code = await generateUniquePaymentCode()
      await prisma.payment.create({
        data: {
          code,
          accountId: account.id,
          amount: account.plan.price,
          method: 'PIX',
          status: 'PENDING',
          referenceMonth: month,
          dueDate,
        },
      })
      created++
    }

    return { created, skipped, total: accounts.length }
  }

  // Listar cobranças com filtros
  async listPayments(request, reply) {
    const { month, status } = request.query
    const where = {}
    if (month) where.referenceMonth = month
    if (status) where.status = status

    const payments = await prisma.payment.findMany({
      where,
      include: {
        account: {
          select: {
            companyName: true, billingDay: true, userId: true,
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return payments
  }

  // Confirmar pagamento
  async confirmPayment(request, reply) {
    const { id } = request.params
    const payment = await prisma.payment.findUnique({ where: { id: Number(id) } })
    if (!payment) return reply.status(404).send({ error: 'Cobrança não encontrada' })

    await prisma.payment.update({
      where: { id: Number(id) },
      data: { status: 'PAID', paidAt: new Date() },
    })
    return { message: 'Pagamento confirmado' }
  }

  // Cancelar cobrança
  async cancelPayment(request, reply) {
    const { id } = request.params
    const payment = await prisma.payment.findUnique({ where: { id: Number(id) } })
    if (!payment) return reply.status(404).send({ error: 'Cobrança não encontrada' })

    await prisma.payment.update({
      where: { id: Number(id) },
      data: { status: 'CANCELLED' },
    })
    return { message: 'Cobrança cancelada' }
  }

  // Reverter pagamento para pendente
  async revertPayment(request, reply) {
    const { id } = request.params
    const payment = await prisma.payment.findUnique({ where: { id: Number(id) } })
    if (!payment) return reply.status(404).send({ error: 'Cobrança não encontrada' })
    if (payment.status !== 'PAID') return reply.status(400).send({ error: 'Apenas pagamentos com status Pago podem ser revertidos' })

    await prisma.payment.update({
      where: { id: Number(id) },
      data: { status: 'PENDING', paidAt: null },
    })
    return { message: 'Pagamento revertido para pendente' }
  }

  // ==================== SERVIÇOS ====================

  // Desconectar (logout) instância WhatsApp de um cliente
  async disconnectInstance(request, reply) {
    const { instanceId } = request.params

    const instance = await prisma.instance.findUnique({ where: { id: Number(instanceId) } })
    if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })

    try {
      await evolutionApi.delete(`/instance/logout/${instance.instanceName}`)
    } catch (err) {
      // Ignora erro se já desconectada na Evolution
    }

    await prisma.instance.update({
      where: { id: instance.id },
      data: { status: 'DISCONNECTED' },
    })

    return { message: 'Instância desconectada com sucesso' }
  }

  // ==================== WHATSAPP DO SISTEMA ====================

  async getWhatsappStatus(request, reply) {
    const instance = await prisma.instance.findFirst({
      where: { instanceName: 'ZapCakes-System' },
    })
    if (!instance) return { status: 'NOT_CREATED' }

    // Atualiza status real consultando a Evolution API
    try {
      const { data } = await evolutionApi.get(`/instance/connectionState/${instance.instanceName}`)
      const state = data?.instance?.state ?? data?.state
      const realStatus = state === 'open' ? 'CONNECTED' : 'DISCONNECTED'
      if (realStatus !== instance.status) {
        await prisma.instance.update({ where: { id: instance.id }, data: { status: realStatus } })
      }
      return { status: realStatus, phone: instance.phone, profileName: instance.profileName }
    } catch {
      return { status: instance.status, phone: instance.phone, profileName: instance.profileName }
    }
  }

  async connectWhatsapp(request, reply) {
    const userId = request.user.id
    let instance = await prisma.instance.findFirst({
      where: { instanceName: 'ZapCakes-System' },
    })

    // Cria instância se não existir
    if (!instance) {
      try {
        await evolutionApi.post('/instance/create', {
          instanceName: 'ZapCakes-System',
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
        })
      } catch (err) {
        // Ignora se já existe na Evolution
        const msg = JSON.stringify(err?.response?.data || '')
        if (!msg.includes('already')) {
          return reply.status(500).send({ error: 'Erro ao criar instância na Evolution API' })
        }
      }

      instance = await prisma.instance.create({
        data: { userId, instanceName: 'ZapCakes-System' },
      })
    }

    // Solicita QR code
    try {
      const { data } = await evolutionApi.get(`/instance/connect/${instance.instanceName}`)
      await prisma.instance.update({ where: { id: instance.id }, data: { status: 'CONNECTING' } })
      // Evolution API pode retornar base64 em diferentes caminhos
      const qrcode = data?.base64 || data?.qrcode?.base64 || data?.qrcode || null
      return { qrcode, pairingCode: data?.pairingCode || null, status: 'CONNECTING' }
    } catch (err) {
      return reply.status(500).send({ error: 'Erro ao gerar QR Code' })
    }
  }

  async disconnectWhatsapp(request, reply) {
    const instance = await prisma.instance.findFirst({
      where: { instanceName: 'ZapCakes-System' },
    })
    if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })

    try {
      await evolutionApi.delete(`/instance/logout/${instance.instanceName}`)
    } catch {
      // Ignora se já desconectada
    }

    await prisma.instance.update({ where: { id: instance.id }, data: { status: 'DISCONNECTED', phone: null, profileName: null } })
    return { message: 'WhatsApp desconectado' }
  }

  // ==================== RELATÓRIO DO CLIENTE ====================

  async clientReport(request, reply) {
    const { id } = request.params
    const { startDate, endDate } = request.query

    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true, name: true,
        account: { select: { companyName: true, plan: { select: { title: true, price: true } } } },
        instances: { select: { id: true } },
      },
    })
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' })

    // Define período: datas customizadas ou últimos 6 meses
    let dateFrom, dateTo, periodLabel
    if (startDate && endDate) {
      dateFrom = new Date(startDate + 'T00:00:00')
      dateTo = new Date(endDate + 'T23:59:59')
      periodLabel = `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}`
    } else {
      dateFrom = new Date()
      dateFrom.setMonth(dateFrom.getMonth() - 5)
      dateFrom.setDate(1)
      dateFrom.setHours(0, 0, 0, 0)
      dateTo = new Date()
      dateTo.setHours(23, 59, 59, 999)
      periodLabel = 'Ultimos 6 meses'
    }

    const orders = await prisma.order.findMany({
      where: { userId: Number(id), createdAt: { gte: dateFrom, lte: dateTo } },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    // Agrupa por mês — gera chaves para cada mês no intervalo
    const monthlyData = {}
    const cursor = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), 1)
    const endMonth = new Date(dateTo.getFullYear(), dateTo.getMonth(), 1)
    while (cursor <= endMonth) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      monthlyData[key] = { orders: 0, revenue: 0 }
      cursor.setMonth(cursor.getMonth() + 1)
    }

    for (const order of orders) {
      const key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (monthlyData[key]) {
        monthlyData[key].orders++
        monthlyData[key].revenue += Number(order.total)
      }
    }

    const months = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      orders: data.orders,
      revenue: Math.round(data.revenue * 100) / 100,
      avgTicket: data.orders > 0 ? Math.round((data.revenue / data.orders) * 100) / 100 : 0,
    }))

    // Totais
    const totalOrders = orders.length
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0)
    const avgTicket = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0

    // Uso de IA — tokens das mensagens
    const instanceIds = user.instances.map(i => i.id)
    let tokenData = { totalTokens: 0, promptTokens: 0, completionTokens: 0, totalMessages: 0, aiMessages: 0 }

    if (instanceIds.length > 0) {
      const messagesAgg = await prisma.message.aggregate({
        where: { instanceId: { in: instanceIds }, createdAt: { gte: dateFrom, lte: dateTo } },
        _count: true,
      })
      const aiMessagesAgg = await prisma.message.aggregate({
        where: { instanceId: { in: instanceIds }, fromMe: true, createdAt: { gte: dateFrom, lte: dateTo } },
        _count: true,
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
      })

      tokenData.totalMessages = messagesAgg._count
      tokenData.aiMessages = aiMessagesAgg._count
      tokenData.promptTokens = aiMessagesAgg._sum.promptTokens || 0
      tokenData.completionTokens = aiMessagesAgg._sum.completionTokens || 0
      tokenData.totalTokens = aiMessagesAgg._sum.totalTokens || 0

      if (tokenData.totalTokens === 0 && tokenData.aiMessages > 0) {
        tokenData.totalTokens = tokenData.aiMessages * 800
        tokenData.promptTokens = tokenData.aiMessages * 500
        tokenData.completionTokens = tokenData.aiMessages * 300
        tokenData.estimated = true
      }
    }

    // Custo estimado GPT-4o: input $2.50/1M, output $10.00/1M
    const inputCost = (tokenData.promptTokens / 1_000_000) * 2.50
    const outputCost = (tokenData.completionTokens / 1_000_000) * 10.00
    const totalCostUSD = Math.round((inputCost + outputCost) * 10000) / 10000
    const totalCostBRL = Math.round(totalCostUSD * 5.80 * 100) / 100

    return {
      user: { name: user.name, companyName: user.account?.companyName },
      plan: user.account?.plan || null,
      period: periodLabel,
      orders: { months, totalOrders, totalRevenue: Math.round(totalRevenue * 100) / 100, avgTicket },
      ai: {
        ...tokenData,
        costUSD: totalCostUSD,
        costBRL: totalCostBRL,
      },
    }
  }

  // ==================== NOTIFICAÇÕES ====================

  async sendNotification(request, reply) {
    const { userId, type, paymentId } = request.body

    if (!userId || !type) {
      return reply.status(400).send({ error: 'userId e type são obrigatórios' })
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { name: true, email: true, phone: true, account: { select: { companyName: true } } },
    })
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' })

    const results = { email: false, whatsapp: false }

    // Helper para enviar WhatsApp via instância do sistema
    const sendWhatsApp = async (text) => {
      if (!user.phone) return
      try {
        const instance = await prisma.instance.findFirst({
          where: { instanceName: 'ZapCakes-System', status: 'CONNECTED' },
        })
        if (instance) {
          const phoneDigits = user.phone.replace(/\D/g, '')
          const whatsappNumber = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`
          await evolutionApi.post(`/message/sendText/${instance.instanceName}`, {
            number: whatsappNumber,
            text,
          })
          results.whatsapp = true
        }
      } catch (err) {
        console.error('[notificação] Erro ao enviar WhatsApp:', err.message)
      }
    }

    if (type === 'payment-pending') {
      // Busca dados do pagamento
      let payment = null
      if (paymentId) {
        payment = await prisma.payment.findUnique({
          where: { id: Number(paymentId) },
          include: { account: { select: { companyName: true, plan: { select: { title: true } } } } },
        })
      }

      const valor = payment ? `R$ ${Number(payment.amount).toFixed(2).replace('.', ',')}` : 'não informado'
      const mesRef = payment?.referenceMonth || 'não informado'
      const vencimento = payment?.dueDate ? new Date(payment.dueDate).toLocaleDateString('pt-BR') : 'não informado'
      const plano = payment?.account?.plan?.title || 'não informado'
      const codigo = payment?.code || ''

      // --- E-MAIL ---
      try {
        const html = `
          <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            <div style="background:linear-gradient(135deg,#16a34a,#22c55e);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">ZapCakes</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Sistema de Pedidos Inteligente</p>
            </div>
            <div style="padding:36px 40px 24px;">
              <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;">Cobrança pendente</h2>
              <p style="color:#6b7280;font-size:14px;line-height:1.6;">Olá <strong>${user.name}</strong>,<br>Você possui uma cobrança pendente de pagamento.</p>
              <div style="background:#fefce8;border:2px solid #fde68a;border-radius:12px;padding:20px;margin:24px 0;">
                <table style="width:100%;font-size:14px;color:#1f2937;">
                  ${codigo ? `<tr><td style="padding:4px 0;color:#6b7280;">Código</td><td style="padding:4px 0;text-align:right;font-weight:600;">${codigo}</td></tr>` : ''}
                  <tr><td style="padding:4px 0;color:#6b7280;">Plano</td><td style="padding:4px 0;text-align:right;font-weight:600;">${plano}</td></tr>
                  <tr><td style="padding:4px 0;color:#6b7280;">Mês referência</td><td style="padding:4px 0;text-align:right;font-weight:600;">${mesRef}</td></tr>
                  <tr><td style="padding:4px 0;color:#6b7280;">Vencimento</td><td style="padding:4px 0;text-align:right;font-weight:600;">${vencimento}</td></tr>
                  <tr><td style="padding:4px 0;color:#6b7280;">Valor</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#dc2626;font-size:18px;">${valor}</td></tr>
                </table>
              </div>
              <p style="color:#6b7280;font-size:14px;">Para regularizar, acesse seu painel, realize o pagamento e anexe o comprovante na área de pagamentos.</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${process.env.LOGIN_URL || process.env.FRONTEND_URL || '#'}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:600;">Acessar minha conta</a>
              </div>
              <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:6px;padding:14px 16px;">
                <p style="margin:0;color:#166534;font-size:12px;line-height:1.5;"><strong>Precisa de ajuda?</strong> Responda este e-mail ou entre em contato pelo WhatsApp.</p>
              </div>
            </div>
            <div style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:11px;">&copy; ${new Date().getFullYear()} ZapCakes — Todos os direitos reservados.</p>
            </div>
          </div>`

        await sendMail({
          to: user.email,
          subject: `Cobrança pendente${codigo ? ` #${codigo}` : ''} — ZapCakes`,
          html,
        })
        results.email = true
      } catch (err) {
        console.error('[notificação] Erro ao enviar e-mail:', err.message)
      }

      // --- WHATSAPP ---
      const waMessage = `*ZapCakes - Cobrança Pendente*\n\nOlá ${user.name},\n\nVocê possui uma cobrança pendente de pagamento.\n\n${codigo ? `*Código:* ${codigo}\n` : ''}*Plano:* ${plano}\n*Mês referência:* ${mesRef}\n*Vencimento:* ${vencimento}\n*Valor:* ${valor}\n\nPara regularizar, acesse seu painel, realize o pagamento e anexe o comprovante na área de pagamentos.\n\nPrecisa de ajuda? Responda esta mensagem.`
      await sendWhatsApp(waMessage)

    } else if (type === 'deactivation-warning') {
      // --- E-MAIL ---
      try {
        const templatePath = join(__dirname, '..', 'templates', 'deactivation-warning.html')
        let html = readFileSync(templatePath, 'utf-8')
        html = html.replace(/\{\{NAME\}\}/g, user.name)
        html = html.replace(/\{\{LOGIN_URL\}\}/g, process.env.LOGIN_URL || process.env.FRONTEND_URL || '#')
        html = html.replace(/\{\{YEAR\}\}/g, String(new Date().getFullYear()))

        await sendMail({
          to: user.email,
          subject: 'Aviso: Sua conta será desativada em 10 dias — ZapCakes',
          html,
        })
        results.email = true
      } catch (err) {
        console.error('[notificação] Erro ao enviar e-mail:', err.message)
      }

      // --- WHATSAPP ---
      const waMsg = `*ZapCakes - Aviso Importante*\n\nOlá ${user.name},\n\nIdentificamos que o pagamento da sua assinatura está pendente.\n\n*Sua conta será desativada em 10 dias.*\n\nO que acontece se a conta for desativada:\n- O agente de atendimento no WhatsApp será pausado\n- O acesso ao painel administrativo será bloqueado\n- Seus clientes não poderão fazer pedidos\n\nPara evitar a desativação, regularize seu pagamento o quanto antes.\n\nSeus dados serão mantidos e a conta pode ser reativada após o pagamento.\n\nPrecisa de ajuda? Responda esta mensagem.`
      await sendWhatsApp(waMsg)

    } else if (type === 'payment-received') {
      // Busca dados do pagamento
      let payment = null
      if (paymentId) {
        payment = await prisma.payment.findUnique({
          where: { id: Number(paymentId) },
          include: { account: { select: { companyName: true, plan: { select: { title: true } } } } },
        })
      }

      const valor = payment ? `R$ ${Number(payment.amount).toFixed(2).replace('.', ',')}` : 'não informado'
      const mesRef = payment?.referenceMonth || 'não informado'
      const plano = payment?.account?.plan?.title || 'não informado'
      const codigo = payment?.code || ''

      // --- E-MAIL ---
      try {
        const html = `
          <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            <div style="background:linear-gradient(135deg,#16a34a,#22c55e);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">ZapCakes</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Sistema de Pedidos Inteligente</p>
            </div>
            <div style="padding:36px 40px 24px;">
              <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;">Pagamento confirmado</h2>
              <p style="color:#6b7280;font-size:14px;line-height:1.6;">Olá <strong>${user.name}</strong>,<br>Confirmamos o recebimento do seu pagamento. Obrigado!</p>
              <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:20px;margin:24px 0;">
                <table style="width:100%;font-size:14px;color:#1f2937;">
                  ${codigo ? `<tr><td style="padding:4px 0;color:#6b7280;">Código</td><td style="padding:4px 0;text-align:right;font-weight:600;">${codigo}</td></tr>` : ''}
                  <tr><td style="padding:4px 0;color:#6b7280;">Plano</td><td style="padding:4px 0;text-align:right;font-weight:600;">${plano}</td></tr>
                  <tr><td style="padding:4px 0;color:#6b7280;">Mês referência</td><td style="padding:4px 0;text-align:right;font-weight:600;">${mesRef}</td></tr>
                  <tr><td style="padding:4px 0;color:#6b7280;">Valor</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#16a34a;font-size:18px;">${valor}</td></tr>
                </table>
              </div>
              <p style="color:#6b7280;font-size:14px;">Sua assinatura está ativa. Continue aproveitando todos os recursos do ZapCakes!</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${process.env.LOGIN_URL || process.env.FRONTEND_URL || '#'}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:600;">Acessar minha conta</a>
              </div>
            </div>
            <div style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:11px;">&copy; ${new Date().getFullYear()} ZapCakes — Todos os direitos reservados.</p>
            </div>
          </div>`

        await sendMail({
          to: user.email,
          subject: `Pagamento confirmado${codigo ? ` #${codigo}` : ''} — ZapCakes`,
          html,
        })
        results.email = true
      } catch (err) {
        console.error('[notificação] Erro ao enviar e-mail:', err.message)
      }

      // --- WHATSAPP ---
      const waMessage = `✅ *ZapCakes - Pagamento Confirmado*\n\nOlá ${user.name},\n\nConfirmamos o recebimento do seu pagamento. Obrigado!\n\n${codigo ? `*Código:* ${codigo}\n` : ''}*Plano:* ${plano}\n*Mês referência:* ${mesRef}\n*Valor:* ${valor}\n\nSua assinatura está ativa. Continue aproveitando todos os recursos do ZapCakes!`
      await sendWhatsApp(waMessage)

    } else {
      return reply.status(400).send({ error: 'Tipo de notificação inválido' })
    }

    // Salva no histórico
    await prisma.notification.create({
      data: {
        userId: Number(userId),
        sentBy: request.user.id,
        type,
        emailSent: results.email,
        whatsappSent: results.whatsapp,
      },
    })

    return { success: true, results }
  }

  async listNotifications(request, reply) {
    const { userId } = request.query
    const where = {}
    if (userId) where.userId = Number(userId)

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        sender: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return notifications
  }

  // ==================== IA / OPENAI ====================

  async aiStatus(request, reply) {
    const apiKey = process.env.OPENAI_API_KEY
    const adminKey = process.env.OPENAI_ADMIN_KEY
    const result = {
      keyConfigured: !!apiKey,
      keyValid: false,
      keyPreview: apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : null,
      adminKeyConfigured: !!adminKey,
      modelsCount: 0,
      organization: null,
      budget: null,
      totalSpend: 0,
      totalTokens: 0,
      totalRequests: 0,
      dailySpend: [],
      period: null,
    }

    if (!apiKey) return result

    const headers = { Authorization: `Bearer ${apiKey}` }

    // Verifica se a key é válida
    try {
      const { data } = await axios.get('https://api.openai.com/v1/models', { headers })
      result.keyValid = true
      result.modelsCount = (data.data || []).filter(m => m.id.startsWith('gpt-') || m.id.startsWith('o')).length
    } catch (err) {
      result.keyValid = false
      result.error = err.response?.data?.error?.message || 'Chave inválida ou sem acesso'
      return result
    }

    // Período: mês atual
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    const start = startDate.toISOString().split('T')[0]
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const end = endDate.toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]
    result.period = { start, end: today, monthEnd: end }

    // Se não tem admin key, retorna só a validação
    if (!adminKey) return result

    const adminHeaders = { Authorization: `Bearer ${adminKey}` }
    const startTs = Math.floor(startDate.getTime() / 1000)
    const endTs = Math.floor(now.getTime() / 1000)

    // Uso via /v1/organization/usage/completions (admin key) — busca dia a dia em paralelo
    try {
      const dates = []
      const d = new Date(startDate)
      while (d <= now) {
        dates.push(new Date(d))
        d.setDate(d.getDate() + 1)
      }

      const dailySpend = []
      let totalTokens = 0
      let totalRequests = 0

      // Busca usage + costs dia a dia em paralelo (batches de 5)
      for (let i = 0; i < dates.length; i += 5) {
        const batch = dates.slice(i, i + 5)
        const results = await Promise.all(
          batch.map(async (day) => {
            const dayStart = Math.floor(day.getTime() / 1000)
            const dayEnd = dayStart + 86400
            const dateStr = day.toISOString().split('T')[0]

            // Busca usage (tokens/requests)
            const usage = await axios.get(
              `https://api.openai.com/v1/organization/usage/completions?start_time=${dayStart}&end_time=${dayEnd}&bucket_width=1d`,
              { headers: adminHeaders, timeout: 10000 }
            ).then(r => r.data).catch(() => null)

            // Busca costs (custo real)
            const costs = await axios.get(
              `https://api.openai.com/v1/organization/costs?start_time=${dayStart}&end_time=${dayEnd}&bucket_width=1d`,
              { headers: adminHeaders, timeout: 10000 }
            ).then(r => r.data).catch(() => null)

            return { date: dateStr, usage, costs }
          })
        )
        for (const { date, usage, costs } of results) {
          let dayTokens = 0
          let dayReqs = 0
          let dayCost = 0

          // Tokens e requests
          if (usage?.data) {
            for (const bucket of usage.data) {
              for (const r of (bucket.results || [])) {
                dayTokens += (r.input_tokens || 0) + (r.output_tokens || 0)
                dayReqs += r.num_model_requests || 0
              }
            }
          }

          // Custo real da API
          if (costs?.data) {
            for (const bucket of costs.data) {
              for (const r of (bucket.results || [])) {
                dayCost += r.amount?.value || 0
              }
            }
          }

          totalTokens += dayTokens
          totalRequests += dayReqs
          dailySpend.push({ date, amount: Math.round(dayCost * 10000) / 10000 })
        }
      }

      result.totalTokens = totalTokens
      result.totalRequests = totalRequests
      result.totalSpend = Math.round(dailySpend.reduce((s, d) => s + d.amount, 0) * 100) / 100
      result.dailySpend = dailySpend
    } catch (err) {
      console.log('[AI] usage falhou:', err.response?.status, err.response?.data?.error?.message || err.message)
    }

    return result
  }

  // ==================== CONFIG ====================

  async getConfig(request, reply) {
    const configs = await prisma.systemConfig.findMany()
    const result = {}
    for (const c of configs) result[c.key] = c.value
    return result
  }

  async updateConfig(request, reply) {
    const { pixKey, pixName, paymentInstructions, companyPhone, notifyPhone, companyEmail, siteConfeitarias, sitePedidos, siteSatisfacao } = request.body

    const upsert = async (key, value) => {
      if (value === undefined) return
      await prisma.systemConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    }

    await upsert('pix_key', pixKey)
    await upsert('pix_name', pixName)
    await upsert('payment_instructions', paymentInstructions)
    await upsert('company_phone', companyPhone)
    await upsert('notify_phone', notifyPhone)
    await upsert('company_email', companyEmail)
    await upsert('site_confeitarias', siteConfeitarias)
    await upsert('site_pedidos', sitePedidos)
    await upsert('site_satisfacao', siteSatisfacao)

    return { message: 'Configurações salvas' }
  }

  // Analytics do site
  async siteAnalytics(request, reply) {
    const now = new Date()

    // Início do dia (UTC)
    const todayStart = new Date(now)
    todayStart.setUTCHours(0, 0, 0, 0)

    // Início do mês (UTC)
    const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1)

    const [todayVisits, monthVisits, todayRegister, monthRegister, recentVisits, topCities] = await Promise.all([
      prisma.siteVisit.count({
        where: { page: 'home', createdAt: { gte: todayStart } },
      }),
      prisma.siteVisit.count({
        where: { page: 'home', createdAt: { gte: monthStart } },
      }),
      prisma.siteVisit.count({
        where: { page: 'register', createdAt: { gte: todayStart } },
      }),
      prisma.siteVisit.count({
        where: { page: 'register', createdAt: { gte: monthStart } },
      }),
      prisma.siteVisit.findMany({
        where: { createdAt: { gte: todayStart } },
        select: { page: true, city: true, region: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.siteVisit.groupBy({
        by: ['city', 'region'],
        where: { createdAt: { gte: monthStart }, city: { not: null } },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: 10,
      }),
    ])

    return {
      todayVisits,
      monthVisits,
      todayRegister,
      monthRegister,
      recentVisits,
      topCities: topCities.map(c => ({
        city: c.city,
        region: c.region,
        count: c._count,
      })),
    }
  }
}
