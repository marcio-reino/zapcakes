import prisma from '../config/database.js'
import evolutionApi from '../config/evolution.js'
import { OpenAiService } from '../services/openai.service.js'

const openAiService = new OpenAiService()

export class WebhookController {
  // Webhook global da Evolution API (WEBHOOK_GLOBAL_URL)
  async handleEvolutionGlobal(request, reply) {
    const payload = request.body
    const instanceName = payload.instance || request.params?.instanceName

    if (!instanceName) {
      return reply.status(400).send({ error: 'Instance name não encontrado' })
    }

    return this._processEvent(instanceName, payload, reply)
  }

  // Webhook por instância (rota com :instanceName)
  async handleEvolution(request, reply) {
    const { instanceName } = request.params
    const payload = request.body

    return this._processEvent(instanceName, payload, reply)
  }

  async _processEvent(instanceName, payload, reply) {
    const instance = await prisma.instance.findUnique({
      where: { instanceName },
    })

    if (!instance) {
      return { received: true }
    }

    // Atualizar status da conexão
    if (payload.event === 'connection.update') {
      const state = payload.data?.state
      const status = state === 'open' ? 'CONNECTED' : 'DISCONNECTED'
      await prisma.instance.update({
        where: { id: instance.id },
        data: {
          status,
          phone: payload.data?.phone || instance.phone,
          profileName: payload.data?.profileName || instance.profileName,
          profilePicUrl: payload.data?.profilePicUrl || instance.profilePicUrl,
        },
      })
    }

    // Processar mensagens recebidas
    if (payload.event === 'messages.upsert') {
      const message = payload.data
      if (message && !message.key?.fromMe) {
        const remoteJid = message.key?.remoteJid || ''

        // Ignora mensagens de grupos e status
        if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
          return { received: true }
        }

        // Extrai conteúdo da mensagem
        let textContent = ''
        let imageUrl = null

        if (message.message?.conversation) {
          textContent = message.message.conversation
        } else if (message.message?.extendedTextMessage?.text) {
          textContent = message.message.extendedTextMessage.text
        } else if (message.message?.imageMessage) {
          textContent = message.message.imageMessage.caption || 'Imagem recebida'
          if (message.message.imageMessage.url) {
            imageUrl = message.message.imageMessage.url
          }
        } else if (message.message?.audioMessage) {
          textContent = '[Áudio recebido - transcrição não disponível]'
        } else if (message.message?.documentMessage) {
          textContent = `[Documento recebido: ${message.message.documentMessage.fileName || 'arquivo'}]`
        } else if (message.message?.stickerMessage) {
          textContent = '[Sticker recebido]'
        } else if (message.message?.contactMessage) {
          textContent = `[Contato recebido: ${message.message.contactMessage.displayName || 'contato'}]`
        } else if (message.message?.locationMessage) {
          textContent = `[Localização recebida: ${message.message.locationMessage.degreesLatitude}, ${message.message.locationMessage.degreesLongitude}]`
        } else {
          textContent = '[Mensagem não suportada]'
        }

        // Salva mensagem recebida no log
        await prisma.message.create({
          data: {
            instanceId: instance.id,
            remoteJid,
            fromMe: false,
            messageType: message.messageType || 'text',
            content: textContent,
          },
        })

        // Processa com OpenAI e responde
        try {
          let aiReply

          if (imageUrl) {
            aiReply = await openAiService.chatWithImage(instance.userId, remoteJid, textContent, imageUrl)
          } else {
            aiReply = await openAiService.chat(instance.userId, remoteJid, textContent)
          }

          // Envia resposta via Evolution API
          await evolutionApi.post(`/message/sendText/${instanceName}`, {
            number: remoteJid.replace('@s.whatsapp.net', ''),
            text: aiReply,
          })

          // Salva resposta no log
          await prisma.message.create({
            data: {
              instanceId: instance.id,
              remoteJid,
              fromMe: true,
              messageType: 'text',
              content: aiReply,
            },
          })
        } catch (err) {
          console.error('Erro ao processar mensagem com OpenAI:', err.message)
        }
      }
    }

    return { received: true }
  }
}
