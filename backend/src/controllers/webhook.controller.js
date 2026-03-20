import prisma from '../config/database.js'
import evolutionApi from '../config/evolution.js'
import openai from '../config/openai.js'
import { OpenAiService } from '../services/openai.service.js'
import { Readable } from 'stream'

const openAiService = new OpenAiService()

// Envia indicador "digitando..." no WhatsApp
async function sendTyping(instanceName, remoteJid) {
  try {
    await evolutionApi.post(`/chat/sendPresence/${instanceName}`, {
      number: remoteJid.replace('@s.whatsapp.net', ''),
      presence: 'composing',
    })
  } catch {
    // Ignora erros de presença
  }
}

// Baixa áudio da Evolution API e transcreve com Whisper
async function transcribeAudio(instanceName, messageId) {
  try {
    const { data } = await evolutionApi.get(
      `/chat/getBase64FromMediaMessage/${instanceName}`,
      { data: { message: { key: { id: messageId } } } }
    )

    if (!data?.base64) return null

    const buffer = Buffer.from(data.base64, 'base64')
    const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' })

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'pt',
    })

    return transcription.text
  } catch (err) {
    console.error('Erro ao transcrever áudio:', err.message)
    return null
  }
}

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
          // Transcreve áudio com Whisper
          const transcription = await transcribeAudio(instanceName, message.key.id)
          if (transcription) {
            textContent = transcription
          } else {
            textContent = '[Áudio recebido mas não foi possível transcrever]'
          }
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

        // Envia "digitando..." enquanto processa
        await sendTyping(instanceName, remoteJid)

        // Processa com OpenAI e responde
        try {
          let aiReply

          if (imageUrl) {
            aiReply = await openAiService.chatWithImage(instance.userId, remoteJid, textContent, imageUrl, instanceName)
          } else {
            aiReply = await openAiService.chat(instance.userId, remoteJid, textContent, instanceName)
          }

          // Se retornou null, as imagens dos produtos já foram enviadas diretamente
          if (aiReply === null) {
            return { received: true }
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
