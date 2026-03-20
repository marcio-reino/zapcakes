import openai from '../config/openai.js'
import prisma from '../config/database.js'
import evolutionApi from '../config/evolution.js'
import bcrypt from 'bcryptjs'

// Cache de conversas em memória (remoteJid -> messages[])
const conversationCache = new Map()
const CONVERSATION_TTL = 30 * 60 * 1000 // 30 minutos

// Definição das tools do OpenAI para o agente
const agentTools = [
  {
    type: 'function',
    function: {
      name: 'buscar_cliente',
      description: 'Busca um cliente pelo número de celular com DDD (ex: 22998524209). Use quando o cliente informar o telefone para identificação.',
      parameters: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Número de celular com DDD, apenas números (ex: 22998524209)',
          },
        },
        required: ['phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cadastrar_cliente',
      description: 'Cadastra um novo cliente na base de dados. Use após confirmar todos os dados com o cliente.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome completo do cliente' },
          phone: { type: 'string', description: 'Celular com DDD, apenas números' },
          email: { type: 'string', description: 'E-mail do cliente (opcional)' },
          zipCode: { type: 'string', description: 'CEP apenas números (opcional)' },
          street: { type: 'string', description: 'Rua/Logradouro' },
          number: { type: 'string', description: 'Número' },
          complement: { type: 'string', description: 'Complemento (opcional)' },
          neighborhood: { type: 'string', description: 'Bairro' },
          city: { type: 'string', description: 'Cidade' },
          state: { type: 'string', description: 'Estado (sigla UF, ex: RJ)' },
          reference: { type: 'string', description: 'Ponto de referência (opcional)' },
        },
        required: ['name', 'phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_cep',
      description: 'Consulta um CEP na API ViaCEP para preencher automaticamente o endereço. Use quando o cliente informar o CEP.',
      parameters: {
        type: 'object',
        properties: {
          cep: {
            type: 'string',
            description: 'CEP com 8 dígitos, apenas números (ex: 28035100)',
          },
        },
        required: ['cep'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificar_entrega',
      description: 'Verifica nas instruções do agente se existe configuração de tipo de entrega (delivery/retirada). Use antes de perguntar endereço ao cliente.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
]

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

    catalog += '\nApós o cliente escolher a categoria, você DEVE responder APENAS com o comando:\n'
    catalog += '[MOSTRAR_PRODUTOS:NomeDaCategoria]\n\n'
    catalog += 'Exemplo: se o cliente escolher "Bolos", responda:\n'
    catalog += '[MOSTRAR_PRODUTOS:Bolos]\n\n'
    catalog += 'O sistema vai enviar automaticamente as imagens dos produtos com preços.\n'
    catalog += 'Após enviar as imagens, pergunte qual produto o cliente deseja e a quantidade.\n\n'

    catalog += 'Lista completa de categorias e produtos (para referência de preços):\n\n'
    categories.forEach((cat) => {
      catalog += `### ${cat.name}\n`
      cat.products.forEach((prod, j) => {
        const price = Number(prod.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        catalog += `${j + 1}. *${prod.name}* - ${price}`
        if (prod.description) catalog += ` - ${prod.description}`
        catalog += '\n'
      })
      catalog += '\n'
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

  // Envia indicador "digitando..." no WhatsApp
  async sendTyping(instanceName, remoteJid) {
    try {
      await evolutionApi.post(`/chat/sendPresence/${instanceName}`, {
        number: remoteJid.replace('@s.whatsapp.net', ''),
        presence: 'composing',
      })
    } catch {
      // Ignora erros de presença
    }
  }

  // Envia produtos de uma categoria como imagens individuais no WhatsApp
  async sendProductImages(userId, instanceName, remoteJid, categoryName) {
    const number = remoteJid.replace('@s.whatsapp.net', '')

    const category = await prisma.category.findFirst({
      where: {
        userId,
        active: true,
        name: { contains: categoryName },
      },
      include: {
        products: {
          where: { active: true },
          orderBy: { name: 'asc' },
        },
      },
    })

    if (!category || category.products.length === 0) {
      await evolutionApi.post(`/message/sendText/${instanceName}`, {
        number,
        text: `Não encontrei produtos na categoria "${categoryName}".`,
      })
      return
    }

    for (const product of category.products) {
      const price = Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      let caption = `*${product.name}*\n${price}`
      if (product.description) caption += `\n\n${product.description}`

      await this.sendTyping(instanceName, remoteJid)

      if (product.imageUrl) {
        try {
          await evolutionApi.post(`/message/sendMedia/${instanceName}`, {
            number,
            mediatype: 'image',
            media: product.imageUrl,
            caption,
          })
        } catch {
          await evolutionApi.post(`/message/sendText/${instanceName}`, {
            number,
            text: caption,
          })
        }
      } else {
        await evolutionApi.post(`/message/sendText/${instanceName}`, {
          number,
          text: caption,
        })
      }
    }

    await this.sendTyping(instanceName, remoteJid)
    await evolutionApi.post(`/message/sendText/${instanceName}`, {
      number,
      text: `Esses são os nossos produtos de *${category.name}*! 😊\n\nQual produto você gostaria de pedir e em que quantidade?`,
    })
  }

  // Envia anexo de instrução (imagem, PDF ou áudio) no WhatsApp
  async sendAttachment(userId, instanceName, remoteJid, instructionId) {
    const number = remoteJid.replace('@s.whatsapp.net', '')

    const instruction = await prisma.agentInstruction.findFirst({
      where: { id: Number(instructionId), userId, active: true },
    })

    if (!instruction || !instruction.imageUrl) return

    const url = instruction.imageUrl.toLowerCase()
    await this.sendTyping(instanceName, remoteJid)

    try {
      if (url.match(/\.pdf(\?|$)/)) {
        await evolutionApi.post(`/message/sendMedia/${instanceName}`, {
          number,
          mediatype: 'document',
          media: instruction.imageUrl,
          caption: instruction.title,
          fileName: `${instruction.title}.pdf`,
        })
      } else if (url.match(/\.(mp3|mpeg)(\?|$)/)) {
        await evolutionApi.post(`/message/sendMedia/${instanceName}`, {
          number,
          mediatype: 'audio',
          media: instruction.imageUrl,
        })
      } else {
        // Imagem
        await evolutionApi.post(`/message/sendMedia/${instanceName}`, {
          number,
          mediatype: 'image',
          media: instruction.imageUrl,
          caption: instruction.title,
        })
      }
    } catch (err) {
      console.error('Erro ao enviar anexo:', err.message)
      await evolutionApi.post(`/message/sendText/${instanceName}`, {
        number,
        text: `[Não foi possível enviar o anexo: ${instruction.title}]`,
      })
    }
  }

  // Executa uma tool call do OpenAI
  async executeToolCall(toolName, args, userId) {
    switch (toolName) {
      case 'buscar_cliente': {
        const phone = args.phone.replace(/\D/g, '')
        const customer = await prisma.customer.findFirst({
          where: {
            userId,
            phone: { contains: phone },
            active: true,
          },
        })
        if (customer) {
          return JSON.stringify({
            found: true,
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email || null,
            street: customer.street || null,
            number: customer.number || null,
            complement: customer.complement || null,
            neighborhood: customer.neighborhood || null,
            city: customer.city || null,
            state: customer.state || null,
            zipCode: customer.zipCode || null,
            reference: customer.reference || null,
          })
        }
        return JSON.stringify({ found: false, message: 'Cliente não encontrado com este número.' })
      }

      case 'cadastrar_cliente': {
        const data = {
          userId,
          name: args.name,
          phone: args.phone.replace(/\D/g, ''),
        }
        if (args.email) data.email = args.email
        if (args.zipCode) data.zipCode = args.zipCode.replace(/\D/g, '')
        if (args.street) data.street = args.street
        if (args.number) data.number = args.number
        if (args.complement) data.complement = args.complement
        if (args.neighborhood) data.neighborhood = args.neighborhood
        if (args.city) data.city = args.city
        if (args.state) data.state = args.state
        if (args.reference) data.reference = args.reference

        // Gera senha padrão com os 4 últimos dígitos do telefone
        const lastDigits = data.phone.slice(-4)
        data.password = await bcrypt.hash(lastDigits, 10)

        const customer = await prisma.customer.create({ data })
        return JSON.stringify({
          success: true,
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          message: 'Cliente cadastrado com sucesso!',
        })
      }

      case 'consultar_cep': {
        const cep = args.cep.replace(/\D/g, '')
        try {
          const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
          const data = await response.json()
          if (data.erro) {
            return JSON.stringify({ found: false, message: 'CEP não encontrado.' })
          }
          return JSON.stringify({
            found: true,
            street: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: data.uf || '',
            zipCode: cep,
          })
        } catch {
          return JSON.stringify({ found: false, message: 'Erro ao consultar CEP.' })
        }
      }

      case 'verificar_entrega': {
        const instructions = await prisma.agentInstruction.findMany({
          where: { userId, active: true },
        })
        const allContent = instructions.map(i => `${i.title} ${i.content}`).join(' ').toLowerCase()
        const hasDelivery = allContent.includes('entrega') || allContent.includes('delivery') || allContent.includes('frete')
        const hasPickup = allContent.includes('retirada') || allContent.includes('retirar') || allContent.includes('buscar no local')

        // Busca endereço da empresa (do User)
        const user = await prisma.user.findUnique({ where: { id: userId } })
        const companyAddress = [user?.street, user?.number, user?.neighborhood, user?.city, user?.state]
          .filter(Boolean).join(', ')

        if (hasDelivery && hasPickup) {
          return JSON.stringify({
            deliveryAvailable: true,
            pickupAvailable: true,
            companyAddress: companyAddress || 'Endereço não cadastrado',
            message: 'Entrega e retirada no local disponíveis. Pergunte ao cliente qual prefere.',
          })
        } else if (hasDelivery) {
          return JSON.stringify({
            deliveryAvailable: true,
            pickupAvailable: false,
            companyAddress: companyAddress || 'Endereço não cadastrado',
            message: 'Apenas entrega disponível. Peça o endereço do cliente.',
          })
        } else {
          return JSON.stringify({
            deliveryAvailable: false,
            pickupAvailable: true,
            companyAddress: companyAddress || 'Endereço não cadastrado',
            message: `Apenas retirada no local. Informe o endereço: ${companyAddress || 'Endereço não cadastrado'}`,
          })
        }
      }

      default:
        return JSON.stringify({ error: 'Função não encontrada' })
    }
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

    const attachments = []

    if (instructions.length > 0) {
      let currentCategory = null
      for (const inst of instructions) {
        if (inst.category !== currentCategory) {
          currentCategory = inst.category
          prompt += `## ${categoryLabels[inst.category] || inst.category}\n\n`
        }
        prompt += `### ${inst.title}\n${inst.content}\n`
        if (inst.imageUrl) {
          const url = inst.imageUrl.toLowerCase()
          let tipo = 'imagem'
          if (url.match(/\.pdf(\?|$)/)) tipo = 'PDF'
          else if (url.match(/\.(mp3|mpeg)(\?|$)/)) tipo = 'áudio'
          prompt += `📎 Anexo disponível (${tipo}): Para enviar este anexo ao cliente, responda com [ENVIAR_ANEXO:${inst.id}]\n`
          attachments.push({ id: inst.id, url: inst.imageUrl, tipo, titulo: inst.title })
        }
        prompt += '\n'
      }
    }

    // Instruções sobre anexos
    if (attachments.length > 0) {
      prompt += `\n## ANEXOS DISPONÍVEIS\n\n`
      prompt += `Você tem os seguintes anexos que podem ser enviados ao cliente quando relevante:\n\n`
      attachments.forEach(a => {
        prompt += `- ID ${a.id}: ${a.titulo} (${a.tipo}) → Use [ENVIAR_ANEXO:${a.id}] para enviar\n`
      })
      prompt += `\nQuando o conteúdo de uma instrução tiver um anexo, envie-o ao cliente junto com sua resposta usando o comando [ENVIAR_ANEXO:ID].\n`
      prompt += `Você pode incluir texto antes do comando. O sistema enviará o arquivo automaticamente.\n\n`
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
    prompt += `2. Quando ele escolher a categoria, responda APENAS com o comando [MOSTRAR_PRODUTOS:NomeDaCategoria] - o sistema vai enviar as fotos dos produtos automaticamente\n`
    prompt += `3. Após as imagens serem enviadas, pergunte qual produto deseja e a quantidade\n`
    prompt += `4. Quando o cliente escolher um produto e quantidade, CONFIRME o item adicionado (ex: "Adicionei 2x Bolo de Chocolate - R$ 120,00") e pergunte se deseja mais algum produto\n`
    prompt += `5. O cliente pode adicionar mais produtos ao pedido. Mantenha a lista mental de TODOS os itens pedidos com nome, quantidade e preço unitário\n`
    prompt += `6. Quando o cliente quiser finalizar o pedido, ANTES de confirmar, siga este fluxo obrigatório:\n\n`

    prompt += `### IDENTIFICAÇÃO DO CLIENTE (obrigatório antes de fechar pedido)\n\n`
    prompt += `a) Peça o número de celular com DDD para identificação (ex: 22 99852-4209)\n`
    prompt += `b) Use a função "buscar_cliente" para procurar o cliente na base\n`
    prompt += `c) Se o cliente for ENCONTRADO:\n`
    prompt += `   - Mostre os dados cadastrados (nome, telefone, endereço completo)\n`
    prompt += `   - Peça confirmação: "Estes dados estão corretos?"\n`
    prompt += `   - Se confirmar, prossiga para a verificação de entrega\n`
    prompt += `d) Se o cliente NÃO for encontrado:\n`
    prompt += `   - Informe que não encontrou cadastro com esse número\n`
    prompt += `   - Pergunte: "Deseja tentar outro número ou fazer um novo cadastro?"\n`
    prompt += `   - Se quiser tentar outro número, peça o novo número e busque novamente\n`
    prompt += `   - Se quiser cadastrar, colete os dados na seguinte ordem:\n`
    prompt += `     1. Nome completo\n`
    prompt += `     2. E-mail (opcional)\n`
    prompt += `     3. CEP - use a função "consultar_cep" para preencher endereço automaticamente\n`
    prompt += `        - Se o CEP for encontrado, mostre o endereço e peça apenas o número e complemento\n`
    prompt += `        - Se o CEP não for encontrado ou o cliente não souber, peça: rua, número, bairro, cidade, estado\n`
    prompt += `     4. Complemento (opcional)\n`
    prompt += `     5. Ponto de referência (opcional)\n`
    prompt += `   - Antes de cadastrar, mostre TODOS os dados para confirmação:\n`
    prompt += `     "Vou cadastrar seus dados assim:\n`
    prompt += `     📋 Nome: ...\n`
    prompt += `     📱 Celular: ...\n`
    prompt += `     📧 E-mail: ...\n`
    prompt += `     📍 Endereço: Rua ..., Nº ..., Bairro ..., Cidade/UF, CEP ...\n`
    prompt += `     Está tudo correto?"\n`
    prompt += `   - Somente após confirmação, use a função "cadastrar_cliente"\n\n`

    prompt += `### VERIFICAÇÃO DE ENTREGA\n\n`
    prompt += `e) Use a função "verificar_entrega" para checar os tipos de entrega disponíveis\n`
    prompt += `f) Se só tiver RETIRADA no local:\n`
    prompt += `   - Informe o endereço da loja e diga que o pedido será para retirada\n`
    prompt += `g) Se tiver ENTREGA disponível:\n`
    prompt += `   - Pergunte se prefere entrega ou retirada\n`
    prompt += `   - Se entrega, use o endereço cadastrado do cliente\n`
    prompt += `   - Se retirada, informe o endereço da loja\n\n`

    prompt += `### CONFIRMAÇÃO DO PEDIDO\n\n`
    prompt += `h) Apresente o resumo completo do pedido. ATENÇÃO: você DEVE listar TODOS os itens que o cliente pediu durante a conversa, com os nomes reais dos produtos, quantidades e preços do catálogo. NÃO use placeholders como "[Itens e quantidades do pedido a serem listados]" ou "R$ ValorTotal". Calcule os valores reais.\n\n`
    prompt += `Formato obrigatório do resumo (preencha com os dados REAIS):\n\n`
    prompt += `---\n`
    prompt += `✅ *Pedido Confirmado!*\n\n`
    prompt += `📋 *Pedido #(número sequencial)*\n\n`
    prompt += `👤 *Cliente:* (nome real do cliente)\n`
    prompt += `📱 *Celular:* (celular real formatado)\n\n`
    prompt += `*Itens:*\n`
    prompt += `(liste CADA item que o cliente pediu, ex:)\n`
    prompt += `- 2x Bolo de Chocolate - R$ 120,00\n`
    prompt += `- 1x Brigadeiro (cento) - R$ 80,00\n\n`
    prompt += `💰 *Total: R$ (soma real calculada)*\n`
    prompt += `💳 *Reserva (30%): R$ (30% do total real)*\n\n`
    prompt += `📍 *Entrega:* (endereço real do cliente) OU *Retirada no local:* (endereço real da loja)\n\n`
    prompt += `Efetue o pagamento da reserva e envie o comprovante aqui.\n`
    prompt += `---\n\n`

    prompt += `IMPORTANTE:\n`
    prompt += `- Quando o cliente escolher uma categoria, responda SOMENTE com [MOSTRAR_PRODUTOS:NomeDaCategoria], sem nenhum texto antes ou depois\n`
    prompt += `- SEMPRE peça o celular com DDD antes de fechar o pedido\n`
    prompt += `- SEMPRE busque o cliente na base antes de prosseguir\n`
    prompt += `- SEMPRE verifique o tipo de entrega disponível\n`
    prompt += `- SEMPRE confirme os dados com o cliente antes de cadastrar\n`
    prompt += `- Sempre use os preços exatos do catálogo acima\n`
    prompt += `- Calcule o total corretamente (quantidade x preço de cada item)\n`
    prompt += `- A reserva é sempre 30% do total\n`
    prompt += `- NUNCA use placeholders genéricos no resumo do pedido. Preencha com os dados REAIS do cliente e dos itens pedidos\n`
    prompt += `- Mantenha controle mental de TODOS os itens que o cliente pediu durante a conversa\n`
    prompt += `- Formate valores em Real brasileiro (R$ X.XXX,XX)\n`
    prompt += `- Formate celular como (XX) XXXXX-XXXX\n`
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
    // Mantém no máximo 50 mensagens de contexto (aumentado para suportar tool calls)
    if (conv.length > 50) {
      conv.splice(0, conv.length - 50)
    }
    conversationCache.set(remoteJid, { messages: conv, lastActivity: Date.now() })
  }

  // Adiciona mensagem de tool call ao contexto
  addToolMessages(remoteJid, assistantMessage, toolResults) {
    const conv = this.getConversation(remoteJid)
    conv.push(assistantMessage)
    for (const result of toolResults) {
      conv.push(result)
    }
    if (conv.length > 50) {
      conv.splice(0, conv.length - 50)
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

  // Loop de processamento com tool calls
  async processWithTools(messages, userId, remoteJid, instanceName) {
    let maxIterations = 5 // Evita loops infinitos

    while (maxIterations > 0) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 1024,
        temperature: 0.7,
        tools: agentTools,
        tool_choice: 'auto',
      })

      const choice = completion.choices[0]
      const assistantMessage = choice.message

      // Se não tem tool calls, retorna a resposta final
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return assistantMessage.content || 'Desculpe, não consegui processar sua mensagem.'
      }

      // Processa cada tool call
      const toolResults = []
      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments)
        const result = await this.executeToolCall(toolCall.function.name, args, userId)
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        })
      }

      // Adiciona ao contexto da conversa
      this.addToolMessages(remoteJid, assistantMessage, toolResults)

      // Atualiza messages para a próxima iteração
      messages.push(assistantMessage)
      messages.push(...toolResults)

      // Se o agente está digitando enquanto processa tools, mostra typing
      if (instanceName) {
        await this.sendTyping(instanceName, remoteJid)
      }

      maxIterations--
    }

    return 'Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.'
  }

  // Processa comandos especiais na resposta do GPT e retorna { reply, handled }
  async processCommands(reply, userId, instanceName, remoteJid) {
    if (!instanceName) return { reply, handled: false }

    // Comando: mostrar produtos de uma categoria
    const productMatch = reply.match(/\[MOSTRAR_PRODUTOS:(.+?)\]/)
    if (productMatch) {
      const categoryName = productMatch[1].trim()
      await this.sendProductImages(userId, instanceName, remoteJid, categoryName)
      return { reply: `[Imagens dos produtos de ${categoryName} enviadas ao cliente]`, handled: true }
    }

    // Comando: enviar anexo de instrução (pode ter texto junto)
    const attachmentMatches = reply.matchAll(/\[ENVIAR_ANEXO:(\d+)\]/g)
    let hasAttachment = false
    let textReply = reply

    for (const match of attachmentMatches) {
      hasAttachment = true
      const instructionId = match[1]
      textReply = textReply.replace(match[0], '').trim()
      await this.sendAttachment(userId, instanceName, remoteJid, instructionId)
    }

    if (hasAttachment) {
      // Se tinha texto além do comando, retorna o texto para ser enviado normalmente
      if (textReply) {
        return { reply: textReply, handled: false }
      }
      return { reply: '[Anexo enviado ao cliente]', handled: true }
    }

    return { reply, handled: false }
  }

  // Processa mensagem e retorna resposta da OpenAI
  async chat(userId, remoteJid, userMessage, instanceName = null) {
    const systemPrompt = await this.buildSystemPrompt(userId)

    this.addMessage(remoteJid, 'user', userMessage)

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.getConversation(remoteJid),
    ]

    let reply = await this.processWithTools(messages, userId, remoteJid, instanceName)

    const { reply: processedReply, handled } = await this.processCommands(reply, userId, instanceName, remoteJid)
    reply = processedReply

    this.addMessage(remoteJid, 'assistant', reply)
    this.clearExpired()

    return handled ? null : reply
  }

  // Processa mensagem com imagem (multimodal)
  async chatWithImage(userId, remoteJid, userMessage, imageUrl, instanceName = null) {
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

    let reply = await this.processWithTools(messages, userId, remoteJid, instanceName)

    const { reply: processedReply, handled } = await this.processCommands(reply, userId, instanceName, remoteJid)
    reply = processedReply

    this.addMessage(remoteJid, 'assistant', reply)
    this.clearExpired()

    return handled ? null : reply
  }
}
