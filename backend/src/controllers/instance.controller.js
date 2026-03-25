import prisma from '../config/database.js'
import evolutionApi from '../config/evolution.js'

function ownerWhere(request, id) {
  return { id: Number(id), userId: request.user.id }
}

async function findOwnInstance(request, id) {
  return prisma.instance.findFirst({ where: ownerWhere(request, id) })
}

export class InstanceController {
  async list(request, reply) {
    const instances = await prisma.instance.findMany({
      where: { userId: request.user.id },
      include: { chatbot: true },
      orderBy: { createdAt: 'desc' },
    })
    return instances
  }

  async create(request, reply) {
    // Busca account do usuário para gerar nome automático
    const account = await prisma.account.findUnique({ where: { userId: request.user.id } })
    if (!account) {
      return reply.status(400).send({ error: 'Conta empresarial não configurada' })
    }

    // Verifica se já existe instância para este usuário
    const existing = await prisma.instance.findFirst({ where: { userId: request.user.id } })
    if (existing) {
      return reply.status(400).send({ error: 'Já existe uma instância WhatsApp para esta conta. Remova a existente antes de criar outra.' })
    }

    const instanceName = `ZapCakes-${account.id}`

    const { data } = await evolutionApi.post('/instance/create', {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    })

    const instance = await prisma.instance.create({
      data: {
        userId: request.user.id,
        instanceName,
        instanceId: data?.instance?.instanceId || null,
      },
    })

    return reply.status(201).send({ instance, evolution: data })
  }

  async getById(request, reply) {
    const instance = await prisma.instance.findFirst({
      where: ownerWhere(request, request.params.id),
      include: { chatbot: true, user: { select: { id: true, name: true, email: true } } },
    })

    if (!instance) {
      return reply.status(404).send({ error: 'Instância não encontrada' })
    }

    return instance
  }

  async delete(request, reply) {
    const instance = await findOwnInstance(request, request.params.id)
    if (!instance) {
      return reply.status(404).send({ error: 'Instância não encontrada' })
    }

    try {
      await evolutionApi.delete(`/instance/delete/${instance.instanceName}`)
    } catch (err) {
      // Ignora erro se já não existe na Evolution
    }

    await prisma.instance.delete({ where: { id: instance.id } })
    return { message: 'Instância removida com sucesso' }
  }

  async connect(request, reply) {
    const instance = await findOwnInstance(request, request.params.id)
    if (!instance) {
      return reply.status(404).send({ error: 'Instância não encontrada' })
    }

    const { data } = await evolutionApi.get(`/instance/connect/${instance.instanceName}`)

    await prisma.instance.update({
      where: { id: instance.id },
      data: { status: 'CONNECTING' },
    })

    return data
  }

  async getQrCode(request, reply) {
    const instance = await findOwnInstance(request, request.params.id)
    if (!instance) {
      return reply.status(404).send({ error: 'Instância não encontrada' })
    }

    const { data } = await evolutionApi.get(`/instance/connect/${instance.instanceName}`)
    return data
  }

  async disconnect(request, reply) {
    const instance = await findOwnInstance(request, request.params.id)
    if (!instance) {
      return reply.status(404).send({ error: 'Instância não encontrada' })
    }

    await evolutionApi.delete(`/instance/logout/${instance.instanceName}`)

    await prisma.instance.update({
      where: { id: instance.id },
      data: { status: 'DISCONNECTED' },
    })

    return { message: 'Instância desconectada' }
  }

  async getStatus(request, reply) {
    const instance = await findOwnInstance(request, request.params.id)
    if (!instance) {
      return reply.status(404).send({ error: 'Instância não encontrada' })
    }

    const { data } = await evolutionApi.get(`/instance/connectionState/${instance.instanceName}`)

    const status = data?.instance?.state === 'open' ? 'CONNECTED' : 'DISCONNECTED'
    await prisma.instance.update({
      where: { id: instance.id },
      data: { status },
    })

    return { status, details: data }
  }
}
