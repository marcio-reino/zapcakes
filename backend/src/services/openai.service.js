import openai from '../config/openai.js'
import prisma from '../config/database.js'

// Cache de conversas em memória (remoteJid -> messages[])
const conversationCache = new Map()
const CONVERSATION_TTL = 30 * 60 * 1000 // 30 minutos

export class OpenAiService {
  // Monta instrução do sistema baseado nas instruções cadastradas
  async buildSystemPrompt(userId) {
    const instructions = await prisma.agentInstruction.findMany({
      where: { userId, active: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })

    if (instructions.length === 0) {
      return 'Você é um agente de atendimento ao cliente via WhatsApp. Seja educado e prestativo.'
    }

    const categoryLabels = {
      GREETING: 'Saudação',
      COMPANY: 'Empresa',
      ORDERS: 'Pedidos',
      PRODUCTS: 'Produtos',
      QUESTIONS: 'Dúvidas',
      CLOSING: 'Encerramento',
    }

    let prompt = 'Você é um agente de atendimento ao cliente via WhatsApp.\n\n'
    let currentCategory = null

    for (const inst of instructions) {
      if (inst.category !== currentCategory) {
        currentCategory = inst.category
        prompt += `## ${categoryLabels[inst.category] || inst.category}\n\n`
      }
      prompt += `### ${inst.title}\n${inst.content}\n\n`
    }

    return prompt.trim()
  }

  // Obtém ou cria contexto de conversa
  getConversation(remoteJid) {
    const existing = conversationCache.get(remoteJid)
    if (existing && Date.now() - existing.lastActivity < CONVERSATION_TTL) {
      existing.lastActivity = Date.now()
      return existing.messages
    }
    conversationCache.set(remoteJid, { messages: [], lastActivity: Date.now() })
    return []
  }

  // Adiciona mensagem ao contexto
  addMessage(remoteJid, role, content) {
    const conv = this.getConversation(remoteJid)
    conv.push({ role, content })
    // Mantém no máximo 20 mensagens de contexto
    if (conv.length > 20) {
      conv.splice(0, conv.length - 20)
    }
    conversationCache.set(remoteJid, { messages: conv, lastActivity: Date.now() })
  }

  // Limpa conversa expirada
  clearExpired() {
    const now = Date.now()
    for (const [jid, data] of conversationCache) {
      if (now - data.lastActivity > CONVERSATION_TTL) {
        conversationCache.delete(jid)
      }
    }
  }

  // Processa mensagem e retorna resposta da OpenAI
  async chat(userId, remoteJid, userMessage) {
    const systemPrompt = await this.buildSystemPrompt(userId)

    // Adiciona mensagem do usuário ao contexto
    this.addMessage(remoteJid, 'user', userMessage)

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.getConversation(remoteJid),
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    })

    const reply = completion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.'

    // Adiciona resposta ao contexto
    this.addMessage(remoteJid, 'assistant', reply)

    // Limpa conversas expiradas periodicamente
    this.clearExpired()

    return reply
  }

  // Processa mensagem com imagem (multimodal)
  async chatWithImage(userId, remoteJid, userMessage, imageUrl) {
    const systemPrompt = await this.buildSystemPrompt(userId)

    const content = []
    if (userMessage) {
      content.push({ type: 'text', text: userMessage })
    }
    content.push({ type: 'image_url', image_url: { url: imageUrl } })

    this.addMessage(remoteJid, 'user', content)

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.getConversation(remoteJid),
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    })

    const reply = completion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.'
    this.addMessage(remoteJid, 'assistant', reply)
    this.clearExpired()

    return reply
  }
}
