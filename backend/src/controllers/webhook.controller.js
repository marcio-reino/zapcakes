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
      delay: 2000,
    })
  } catch {
    // Ignora erros de presença
  }
}

// Baixa mídia da Evolution API e retorna base64
async function getMediaBase64(instanceName, messageId) {
  try {
    // Usa POST pois alguns servidores não suportam body em GET
    const { data } = await evolutionApi.post(
      `/chat/getBase64FromMediaMessage/${instanceName}`,
      { message: { key: { id: messageId } } }
    )
    return data?.base64 || null
  } catch (err) {
    console.error('Erro ao baixar mídia:', err.message)
    return null
  }
}

// Limite de tamanho: texto (1000 caracteres) e áudio (2MB base64 ≈ ~2min)
const MAX_TEXT_LENGTH = 1000
const MAX_AUDIO_BASE64_SIZE = 2 * 1024 * 1024 // 2MB em base64

// Baixa áudio da Evolution API e transcreve com Whisper
async function transcribeAudio(instanceName, messageId) {
  try {
    const base64 = await getMediaBase64(instanceName, messageId)
    if (!base64) return null

    // Verifica se o áudio é muito grande
    if (base64.length > MAX_AUDIO_BASE64_SIZE) {
      return '__AUDIO_TOO_LONG__'
    }

    const buffer = Buffer.from(base64, 'base64')
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

// Baixa imagem da Evolution API e retorna data URL para o GPT-4o
// Reverse geocoding via OpenStreetMap Nominatim (gratuito, sem chave)
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=pt-BR`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ZapCakes/1.0 (contato@mach9.com.br)',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.address) return null
    const a = data.address
    const parts = []
    const street = a.road || a.pedestrian || a.footway || a.path
    if (street) parts.push(street)
    const houseNumber = a.house_number
    const neighborhood = a.suburb || a.neighbourhood || a.quarter || a.district
    if (neighborhood) parts.push(`Bairro ${neighborhood}`)
    const city = a.city || a.town || a.village || a.municipality
    if (city) parts.push(city)
    const state = a.state_code || a.state
    if (state) parts.push(state)
    const postcode = a.postcode
    if (postcode) parts.push(`CEP ${postcode}`)
    return {
      formatted: parts.join(', ') || data.display_name || null,
      displayName: data.display_name || null,
      street,
      houseNumber,
      neighborhood: neighborhood || null,
      city: city || null,
      state: state || null,
      postcode: postcode || null,
    }
  } catch {
    return null
  }
}

async function getImageDataUrl(instanceName, messageId) {
  try {
    const base64 = await getMediaBase64(instanceName, messageId)
    if (!base64) return null

    return `data:image/jpeg;base64,${base64}`
  } catch (err) {
    console.error('Erro ao baixar imagem:', err.message)
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
          textContent = message.message.imageMessage.caption || 'O cliente enviou uma imagem. Descreva o que você vê.'
          // Baixa a imagem via Evolution API e converte para data URL acessível pelo GPT-4o
          const imgDataUrl = await getImageDataUrl(instanceName, message.key.id)
          if (imgDataUrl) {
            imageUrl = imgDataUrl
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
          const loc = message.message.locationMessage
          const lat = loc.degreesLatitude
          const lng = loc.degreesLongitude
          const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`
          const userName = loc.name || null
          const userAddr = loc.address || null

          // Tenta resolver endereço via reverse geocoding
          const geo = await reverseGeocode(lat, lng)

          const lines = []
          lines.push('[LOCALIZAÇÃO COMPARTILHADA PELO CLIENTE via WhatsApp]')
          lines.push(`Coordenadas: ${lat}, ${lng}`)
          lines.push(`Google Maps: ${mapsUrl}`)
          if (userName) lines.push(`Nome do local (do cliente): ${userName}`)
          if (userAddr) lines.push(`Endereço (do cliente): ${userAddr}`)
          if (geo?.formatted) {
            lines.push(`Endereço resolvido: ${geo.formatted}`)
            if (geo.neighborhood) lines.push(`Bairro: ${geo.neighborhood}`)
            if (geo.city) lines.push(`Cidade: ${geo.city}`)
          }
          lines.push('')
          lines.push('INSTRUÇÃO: use este endereço como local de entrega (deliveryAddress) deste pedido. Inclua o link do Google Maps e as coordenadas no campo "notes" (observações) do pedido para o entregador encontrar o ponto exato. NÃO altere o cadastro do cliente. Se necessário, peça ao cliente apenas para confirmar o número/complemento do local antes de criar o pedido.')
          textContent = lines.join('\n')
        } else {
          textContent = '[Mensagem não suportada]'
        }

        // Verifica se texto ou áudio é muito grande - não envia para a IA
        const tooLong = textContent === '__AUDIO_TOO_LONG__' || (!imageUrl && textContent.length > MAX_TEXT_LENGTH)
        if (tooLong) {
          const rejectMsg = 'Por favor, envie sua mensagem de forma mais curta e objetiva. 😊 Mensagens muito longas não conseguimos processar. Tente resumir sua solicitação!'

          await prisma.message.create({
            data: {
              instanceId: instance.id,
              remoteJid,
              fromMe: false,
              messageType: message.messageType || 'text',
              content: textContent === '__AUDIO_TOO_LONG__' ? '[Áudio muito longo]' : textContent.substring(0, 200) + '...',
            },
          })

          await evolutionApi.post(`/message/sendText/${instanceName}`, {
            number: remoteJid.replace('@s.whatsapp.net', ''),
            text: rejectMsg,
          })

          await prisma.message.create({
            data: {
              instanceId: instance.id,
              remoteJid,
              fromMe: true,
              messageType: 'text',
              content: rejectMsg,
            },
          })

          return { received: true }
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

          // Envia "digitando..." e aguarda 2 segundos antes de enviar
          await sendTyping(instanceName, remoteJid)
          await new Promise(resolve => setTimeout(resolve, 2000))

          // Envia resposta via Evolution API
          await evolutionApi.post(`/message/sendText/${instanceName}`, {
            number: remoteJid.replace('@s.whatsapp.net', ''),
            text: aiReply,
          })

          // Salva resposta no log com tokens usados
          const usage = openAiService._lastUsage || {}
          await prisma.message.create({
            data: {
              instanceId: instance.id,
              remoteJid,
              fromMe: true,
              messageType: 'text',
              content: aiReply,
              promptTokens: usage.prompt_tokens || null,
              completionTokens: usage.completion_tokens || null,
              totalTokens: usage.total_tokens || null,
            },
          })
          openAiService._lastUsage = null
        } catch (err) {
          console.error('Erro ao processar mensagem com OpenAI:', err.message)
        }
      }
    }

    return { received: true }
  }
}
