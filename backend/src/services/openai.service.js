import openai from '../config/openai.js'
import prisma from '../config/database.js'

// Cache de conversas em memória (remoteJid -> messages[])
const conversationCache = new Map()
const CONVERSATION_TTL = 30 * 60 * 1000 // 30 minutos

export class OpenAiService {
  // Busca catálogo de produtos agrupado por categoria
  async buildCatalog(userId) {
    const categories = await prisma.category.findMany({
      where: { userId, active: true },
      include: {
        products: {
          where: { active: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    if (categories.length === 0) return ''

    let catalog = '\n\n## CATÁLOGO DE PRODUTOS\n\n'
    catalog += 'Quando o cliente perguntar sobre produtos, apresente as categorias numeradas:\n\n'

    categories.forEach((cat, i) => {
      catalog += `${i + 1}. ${cat.name}\n`
    })

    catalog += '\nApós o cliente escolher a categoria, mostre os produtos dela:\n\n'

    categories.forEach((cat) => {
      catalog += `### ${cat.name}\n`
      if (cat.products.length === 0) {
        catalog += '- Nenhum produto disponível nesta categoria\n\n'
      } else {
        cat.products.forEach((prod, j) => {
          const price = Number(prod.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          catalog += `${j + 1}. *${prod.name}* - ${price}`
          if (prod.description) catalog += ` - ${prod.description}`
          catalog += '\n'
        })
        catalog += '\n'
      }
    })

    return catalog
  }

  // Busca combos ativos
  async buildCombos(userId) {
    const combos = await prisma.combo.findMany({
      where: { userId, active: true },
      include: {
        items: {
          include: { product: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    if (combos.length === 0) return ''

    let comboText = '\n\n## COMBOS DISPONÍVEIS\n\n'
    combos.forEach((combo, i) => {
      const discount = Number(combo.discount)
      comboText += `${i + 1}. *${combo.name}*`
      if (combo.description) comboText += ` - ${combo.description}`
      if (discount > 0) comboText += ` (Desconto: ${discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
      comboText += '\n   Inclui: '
      comboText += combo.items.map(item => `${item.quantity}x ${item.product.name}`).join(', ')
      comboText += '\n'
    })

    return comboText
  }

  // Monta instrução do sistema baseado nas instruções cadastradas + catálogo
  async buildSystemPrompt(userId) {
    const instructions = await prisma.agentInstruction.findMany({
      where: { userId, active: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })

    const categoryLabels = {
      GREETING: 'Saudação',
      COMPANY: 'Empresa',
      ORDERS: 'Pedidos',
      PRODUCTS: 'Produtos',
      QUESTIONS: 'Dúvidas',
      CLOSING: 'Encerramento',
    }

    let prompt = 'Você é um agente de atendimento ao cliente via WhatsApp.\n\n'

    if (instructions.length > 0) {
      let currentCategory = null
      for (const inst of instructions) {
        if (inst.category !== currentCategory) {
          currentCategory = inst.category
          prompt += `## ${categoryLabels[inst.category] || inst.category}\n\n`
        }
        prompt += `### ${inst.title}\n${inst.content}\n\n`
      }
    }

    // Adiciona catálogo de produtos do banco
    const catalog = await this.buildCatalog(userId)
    prompt += catalog

    // Adiciona combos
    const combos = await this.buildCombos(userId)
    prompt += combos

    // Instruções de fluxo de pedido
    prompt += `\n\n## FLUXO DE PEDIDO\n\n`
    prompt += `Siga este fluxo ao atender o cliente:\n\n`
    prompt += `1. Quando o cliente perguntar sobre produtos, mostre as CATEGORIAS numeradas (1. Bolos, 2. Doces, etc.)\n`
    prompt += `2. Quando ele escolher a categoria, mostre os PRODUTOS dessa categoria com número, nome, descrição e preço\n`
    prompt += `3. Pergunte qual produto deseja e a quantidade\n`
    prompt += `4. O cliente pode adicionar mais produtos ao pedido\n`
    prompt += `5. Quando o cliente finalizar, pergunte o nome e endereço de entrega\n`
    prompt += `6. Ao concluir, apresente o resumo assim:\n\n`
    prompt += `---\n`
    prompt += `✅ *Pedido Confirmado!*\n\n`
    prompt += `📋 *Pedido #(número sequencial)*\n\n`
    prompt += `*Itens:*\n`
    prompt += `- Qtd x Produto - R$ valor\n`
    prompt += `- Qtd x Produto - R$ valor\n\n`
    prompt += `💰 *Total: R$ XXXXX*\n`
    prompt += `💳 *Reserva (30%): R$ XXXXX*\n\n`
    prompt += `Efetue o pagamento da reserva e envie o comprovante aqui.\n`
    prompt += `---\n\n`
    prompt += `IMPORTANTE:\n`
    prompt += `- Sempre use os preços exatos do catálogo acima\n`
    prompt += `- Calcule o total corretamente (quantidade x preço de cada item)\n`
    prompt += `- A reserva é sempre 30% do total\n`
    prompt += `- Formate valores em Real brasileiro (R$ X.XXX,XX)\n`
    prompt += `- Seja educado e prestativo\n`
    prompt += `- Não invente produtos que não estão no catálogo\n`

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
    // Mantém no máximo 30 mensagens de contexto
    if (conv.length > 30) {
      conv.splice(0, conv.length - 30)
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
