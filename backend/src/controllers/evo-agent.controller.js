import prisma from '../config/database.js'
import evolutionApi from '../config/evolution.js'

export class EvoAgentController {
  // Status do agente e WhatsApp
  async status(request, reply) {
    try {
      const instructionCount = await prisma.agentInstruction.count({
        where: { userId: request.user.id, active: true },
      })

      // Busca instância WhatsApp do usuário
      const instance = await prisma.instance.findFirst({
        where: { userId: request.user.id },
        select: { id: true, instanceName: true, status: true, phone: true },
      })

      let whatsappStatus = null
      if (instance) {
        try {
          const { data } = await evolutionApi.get(`/instance/connectionState/${instance.instanceName}`)
          whatsappStatus = data?.instance?.state === 'open' ? 'CONNECTED' : 'DISCONNECTED'
          const updateData = { status: whatsappStatus }

          // Se conectado e sem phone salvo, busca ownerJid da instância
          if (whatsappStatus === 'CONNECTED' && !instance.phone) {
            try {
              const { data: fetchData } = await evolutionApi.get(`/instance/fetchInstances`, { params: { instanceName: instance.instanceName } })
              const info = Array.isArray(fetchData) ? fetchData[0] : fetchData
              const ownerJid = info?.instance?.ownerJid || info?.ownerJid
              if (ownerJid) {
                updateData.phone = ownerJid.replace(/@.*/, '')
              }
            } catch { /* silencioso */ }
          }

          await prisma.instance.update({
            where: { id: instance.id },
            data: updateData,
          })
          if (updateData.phone) instance.phone = updateData.phone
        } catch {
          whatsappStatus = instance.status
        }
      }

      return {
        hasAgent: instructionCount > 0,
        instructionCount,
        whatsapp: instance ? { id: instance.id, name: instance.instanceName, status: whatsappStatus, phone: instance.phone } : null,
      }
    } catch (err) {
      return reply.status(500).send({ error: 'Erro ao verificar status do agente', details: err.message })
    }
  }

  // Cria instância WhatsApp e retorna QR code (webhook global cuida do resto)
  async connectWhatsApp(request, reply) {
    try {
      const account = await prisma.account.findFirst({ where: { userId: request.user.id } })
      if (!account) {
        return reply.status(404).send({ error: 'Conta não encontrada' })
      }

      let instance = await prisma.instance.findFirst({
        where: { userId: request.user.id },
      })

      const instanceName = `zapcakes-${account.id}`

      if (!instance) {
        try {
          const { data } = await evolutionApi.post('/instance/create', {
            instanceName,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
          })

          instance = await prisma.instance.create({
            data: {
              userId: request.user.id,
              instanceName,
              instanceId: data?.instance?.instanceId || null,
              status: 'CONNECTING',
            },
          })
        } catch (err) {
          if (err.response?.status === 403 || err.response?.status === 409) {
            instance = await prisma.instance.create({
              data: {
                userId: request.user.id,
                instanceName,
                status: 'DISCONNECTED',
              },
            })
          } else {
            throw err
          }
        }
      }

      // Solicita QR code
      const { data: qrData } = await evolutionApi.get(`/instance/connect/${instance.instanceName}`)

      await prisma.instance.update({
        where: { id: instance.id },
        data: { status: 'CONNECTING' },
      })

      return {
        instance: { id: instance.id, name: instance.instanceName },
        qrcode: qrData,
      }
    } catch (err) {
      return reply.status(500).send({ error: 'Erro ao conectar WhatsApp', details: err.message })
    }
  }

  // Desconecta WhatsApp
  async disconnectWhatsApp(request, reply) {
    try {
      const instance = await prisma.instance.findFirst({
        where: { userId: request.user.id },
      })

      if (!instance) {
        return reply.status(404).send({ error: 'Instância não encontrada' })
      }

      try {
        await evolutionApi.delete(`/instance/logout/${instance.instanceName}`)
      } catch {
        // Ignora se já desconectado
      }

      await prisma.instance.update({
        where: { id: instance.id },
        data: { status: 'DISCONNECTED' },
      })

      return { message: 'WhatsApp desconectado' }
    } catch (err) {
      return reply.status(500).send({ error: 'Erro ao desconectar', details: err.message })
    }
  }
}
