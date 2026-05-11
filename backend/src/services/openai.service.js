import openai from '../config/openai.js'
import prisma from '../config/database.js'
import evolutionApi from '../config/evolution.js'
import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import s3Client, { S3_BUCKET } from '../config/s3.js'
import bcrypt from 'bcryptjs'

// Normaliza telefone: remove não-dígitos e prefixo 55 se necessário
function normalizePhone(p) {
  const digits = (p || '').replace(/\D/g, '')
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
}

// Cache de conversas — Redis (prioritario) + Map em memoria como fallback
import redisClient, { isRedisReady } from '../config/redis.js'
const conversationCache = new Map() // fallback
const CONVERSATION_TTL = 30 * 60 * 1000 // 30 minutos (ms)
const CONVERSATION_TTL_SEC = 30 * 60 // 30 minutos (s) para Redis EXPIRE
const REDIS_KEY = (jid) => `zapcakes:conv:${jid}`
const MAX_MESSAGES = 50

// Cache de imagens de inspiracao enviadas via WhatsApp (populado pelo webhook)
const INSPIRATION_KEY = (jid) => `zapcakes:inspiration:${jid}`

// Cache temporário da última imagem recebida por jid (para comprovantes)
const lastImageCache = new Map()

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
  {
    type: 'function',
    function: {
      name: 'criar_pedido',
      description: 'Cria um pedido no sistema após o cliente confirmar todos os itens, dados e forma de entrega. Use SOMENTE após confirmação explícita do cliente.',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'number', description: 'ID do cliente cadastrado' },
          customerName: { type: 'string', description: 'Nome do cliente' },
          customerPhone: { type: 'string', description: 'Celular do cliente com DDD' },
          deliveryType: { type: 'string', enum: ['ENTREGA', 'RETIRADA'], description: 'Tipo: ENTREGA ou RETIRADA' },
          deliveryAddress: { type: 'string', description: 'Endereço de entrega ou da loja para retirada' },
          deliveryFee: { type: 'number', description: 'Taxa de entrega em reais (0 se retirada ou sem taxa)' },
          neighborhood: { type: 'string', description: 'Bairro do cliente (para cálculo de taxa de entrega)' },
          city: { type: 'string', description: 'Cidade do cliente (para cálculo de taxa de entrega)' },
          notes: { type: 'string', description: 'Observações do pedido (sabores, decoração, etc)' },
          estimatedDeliveryDate: { type: 'string', description: 'Data e horário previsto para entrega/retirada informado pelo cliente (ex: 25/03/2026 às 14h, Sábado dia 22, etc)' },
          items: {
            type: 'array',
            description: 'Lista de itens do pedido',
            items: {
              type: 'object',
              properties: {
                productName: { type: 'string', description: 'Nome do produto (exato do catálogo)' },
                quantity: { type: 'number', description: 'Quantidade' },
                price: { type: 'number', description: 'Preço unitário do produto' },
                additionals: {
                  type: 'array',
                  description: 'Adicionais escolhidos pelo cliente para este item (opcional)',
                  items: {
                    type: 'object',
                    properties: {
                      additionalName: { type: 'string', description: 'Nome do adicional (exato do catálogo)' },
                      quantity: { type: 'number', description: 'Quantidade do adicional (padrão 1)' },
                    },
                    required: ['additionalName'],
                  },
                },
              },
              required: ['productName', 'quantity', 'price'],
            },
          },
        },
        required: ['customerId', 'customerName', 'customerPhone', 'deliveryType', 'deliveryAddress', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_pedido',
      description: 'Consulta dados de um pedido. Se o cliente informar o numero do pedido (ex: "pedido 9", "#00012"), passe em orderNumber. Se informar so o telefone, use customerPhone e retorna o pedido mais recente. IMPORTANTE: use SEMPRE orderNumber quando o cliente mencionar um numero especifico — nao confunda com orderId (id interno).',
      parameters: {
        type: 'object',
        properties: {
          orderNumber: { type: 'number', description: 'Numero do pedido visivel ao cliente (ex: 9 para "pedido 9" ou 12 para "#00012"). Use sempre este campo quando o cliente citar um numero de pedido.' },
          customerPhone: { type: 'string', description: 'Celular do cliente com DDD, apenas numeros (ex: 22998524209). Use quando o cliente nao informar o numero do pedido — retorna o mais recente.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviar_codigo_verificacao',
      description: 'Envia um codigo de 6 digitos por WhatsApp para o numero informado pelo cliente, para confirmar que o numero pertence a ele. Use APOS o cliente informar o numero (em buscar_cliente ou cadastrar_cliente) e ANTES de criar_pedido. Se o numero ja foi verificado nos ultimos 30 dias, retorna success com alreadyVerified=true e NAO reenvia.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Celular com DDD, apenas numeros (ex: 22998524209)' },
        },
        required: ['phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificar_codigo',
      description: 'Verifica se o codigo de 6 digitos informado pelo cliente corresponde ao que foi enviado por enviar_codigo_verificacao. Use quando o cliente informar o codigo recebido.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Mesmo celular usado em enviar_codigo_verificacao' },
          codigo: { type: 'string', description: 'Codigo de 6 digitos informado pelo cliente' },
        },
        required: ['phone', 'codigo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_agenda',
      description: 'Consulta as datas disponíveis na agenda do estabelecimento para entrega/retirada. Use APÓS o cliente informar a data desejada, para verificar se há disponibilidade naquele dia.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_pagamento',
      description: 'Registra que o cliente enviou comprovante de pagamento da reserva. Use quando o cliente enviar foto/imagem do comprovante de pagamento. Informe o valor identificado no comprovante para validação.',
      parameters: {
        type: 'object',
        properties: {
          customerPhone: { type: 'string', description: 'Celular do cliente com DDD para localizar o pedido' },
          proofAmount: { type: 'number', description: 'Valor em reais identificado no comprovante de pagamento (ex: 33.00). Analise a imagem do comprovante e extraia o valor da transação.' },
        },
        required: ['customerPhone'],
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

    // Verifica se existem combos para incluir na lista
    const comboCount = await prisma.combo.count({ where: { userId, active: true } })

    let catalog = '\n\n## CATÁLOGO DE PRODUTOS\n\n'
    catalog += 'Quando o cliente perguntar sobre produtos, apresente as categorias numeradas:\n\n'

    categories.forEach((cat, i) => {
      catalog += `${i + 1}. ${cat.name}\n`
    })

    if (comboCount > 0) {
      catalog += `${categories.length + 1}. 🎉 Combos / Promoções\n`
    }

    catalog += '\nApós o cliente escolher uma categoria de produto, você DEVE responder APENAS com o comando:\n'
    catalog += '[MOSTRAR_PRODUTOS:NomeDaCategoria]\n\n'
    catalog += 'O sistema vai enviar uma LISTA EM TEXTO (sem fotos) com nome e preço de cada produto da categoria.\n'
    catalog += '\nQuando o cliente pedir a DESCRIÇÃO, FOTO, DETALHES de um produto OU ESCOLHER um produto específico, responda APENAS com:\n'
    catalog += '[MOSTRAR_PRODUTO:NomeDoProduto]\n'
    catalog += 'O sistema vai enviar a FOTO do produto junto com nome, preço, mínimo/máximo de pedido e descrição completa. Depois disso, pergunte a quantidade desejada (caso ainda não tenha sido informada).\n\n'
    catalog += 'Se o cliente escolher Combos/Promoções, responda APENAS com o comando:\n'
    catalog += '[MOSTRAR_COMBOS]\n\n'
    catalog += 'O sistema vai enviar automaticamente as imagens dos combos com preços.\n\n'

    catalog += 'Lista completa de categorias e produtos (para referência de preços):\n\n'

    // Carrega adicionais vinculados a cada produto, em 1 query
    const productIds = categories.flatMap((c) => c.products.map((p) => p.id))
    const productAdditionals = productIds.length > 0
      ? await prisma.productAdditional.findMany({
          where: {
            productId: { in: productIds },
            additional: { active: true },
          },
          include: { additional: true },
          orderBy: { sortOrder: 'asc' },
        })
      : []
    const addonsByProduct = productAdditionals.reduce((acc, pa) => {
      const arr = acc[pa.productId] || []
      arr.push(pa.additional)
      acc[pa.productId] = arr
      return acc
    }, {})

    categories.forEach((cat) => {
      catalog += `### ${cat.name}\n`
      cat.products.forEach((prod, j) => {
        const price = Number(prod.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        catalog += `${j + 1}. *${prod.name}* - ${price}`
        if (prod.description) catalog += ` - ${prod.description}`
        if (prod.minOrder > 1) catalog += ` (mín: ${prod.minOrder})`
        if (prod.maxOrder && prod.maxOrder < 500) catalog += ` (máx: ${prod.maxOrder})`
        if (prod.allowInspirationImages) {
          catalog += ` 📷 [Aceita imagens de inspiração - máx ${prod.maxInspirationImages || 3}`
          if (prod.inspirationInstruction) catalog += ` - instrução: "${prod.inspirationInstruction}"`
          catalog += `]`
        }
        catalog += '\n'

        const addons = addonsByProduct[prod.id] || []
        if (addons.length > 0) {
          catalog += `   Adicionais disponíveis:\n`
          addons.forEach((a) => {
            const ap = Number(a.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            catalog += `   • ${a.description} - ${ap}\n`
          })
        }
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
    comboText += 'Quando o cliente perguntar sobre combos ou promoções, responda APENAS com o comando:\n'
    comboText += '[MOSTRAR_COMBOS]\n\n'
    comboText += 'O sistema vai enviar automaticamente as imagens dos combos com detalhes e preços.\n'
    comboText += 'Após enviar as imagens, pergunte qual combo o cliente deseja.\n\n'
    comboText += 'Lista de combos (para referência de preços):\n\n'

    combos.forEach((combo, i) => {
      const discount = Number(combo.discount)
      const totalItems = combo.items.reduce((sum, item) => sum + item.quantity * Number(item.product.price), 0)
      const finalPrice = totalItems - discount

      comboText += `${i + 1}. *${combo.name}*`
      if (combo.description) comboText += ` - ${combo.description}`
      comboText += '\n   Inclui: '
      comboText += combo.items.map(item => {
        const itemPrice = Number(item.product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        return `${item.quantity}x ${item.product.name} (${itemPrice})`
      }).join(', ')
      comboText += `\n   💰 Valor total: ${totalItems.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      if (discount > 0) {
        comboText += `\n   🏷️ Desconto: -${discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      }
      comboText += `\n   ✅ Valor final: *${finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*`
      comboText += '\n\n'
    })

    return comboText
  }

  // Envia indicador "digitando..." no WhatsApp
  async sendTyping(instanceName, remoteJid) {
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

  // Envia a lista de produtos de uma categoria como UMA mensagem de texto
  // (sem imagens). A imagem so e' enviada quando o cliente pedir detalhe
  // ou escolher um produto -- ai usa sendProductDetail.
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

    const lines = [`*${category.name}*`, '']
    category.products.forEach((product, i) => {
      const price = Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      lines.push(`${i + 1}. *${product.name}* — ${price}`)
    })
    lines.push('')
    lines.push('Me diga qual produto você quer pedir (ou peça a descrição/foto de algum) e a quantidade. 😊')

    await this.sendTyping(instanceName, remoteJid)
    await evolutionApi.post(`/message/sendText/${instanceName}`, {
      number,
      text: lines.join('\n'),
    })
  }

  // Envia detalhe completo de UM produto (foto + nome + preco + min/max + descricao)
  async sendProductDetail(userId, instanceName, remoteJid, productName) {
    const number = remoteJid.replace('@s.whatsapp.net', '')
    const termo = String(productName || '').trim()
    const lower = termo.toLowerCase()

    const candidates = await prisma.product.findMany({
      where: { userId, active: true },
    })
    const product =
      candidates.find((p) => p.name.toLowerCase() === lower) ||
      candidates.find((p) => p.name.toLowerCase().includes(lower)) ||
      candidates.find((p) => lower.includes(p.name.toLowerCase())) ||
      null

    if (!product) {
      await evolutionApi.post(`/message/sendText/${instanceName}`, {
        number,
        text: `Não encontrei um produto com o nome "${termo}". Me diga o nome exato.`,
      })
      return
    }

    const price = Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    let caption = `*${product.name}*\n${price}`
    if (product.minOrder > 1) caption += `\n📦 Pedido mínimo: ${product.minOrder} unidades`
    if (product.maxOrder && product.maxOrder < 500) caption += `\n📦 Pedido máximo: ${product.maxOrder} unidades`
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
        text: `${caption}\n\n_(sem foto cadastrada)_`,
      })
    }
  }

  // Envia a foto de exemplo de um adicional pelo WhatsApp
  async sendAdditionalImage(userId, instanceName, remoteJid, additionalName) {
    const number = remoteJid.replace('@s.whatsapp.net', '')
    const termo = String(additionalName || '').trim()

    const candidates = await prisma.additional.findMany({
      where: { userId, active: true },
    })
    const lower = termo.toLowerCase()
    const additional =
      candidates.find((a) => a.description.toLowerCase() === lower) ||
      candidates.find((a) => a.description.toLowerCase().includes(lower)) ||
      candidates.find((a) => lower.includes(a.description.toLowerCase())) ||
      null

    if (!additional) {
      await evolutionApi.post(`/message/sendText/${instanceName}`, {
        number,
        text: `Não encontrei um adicional com o nome "${termo}". Me diga o nome exato que eu mostro.`,
      })
      return
    }

    const price = Number(additional.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const caption = `*${additional.description}*\n+ ${price}`

    await this.sendTyping(instanceName, remoteJid)

    if (additional.imageUrl) {
      try {
        await evolutionApi.post(`/message/sendMedia/${instanceName}`, {
          number,
          mediatype: 'image',
          media: additional.imageUrl,
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
        text: `${caption}\n\n_(sem foto de exemplo cadastrada)_`,
      })
    }
  }

  // Envia combos como mensagens individuais com imagem no WhatsApp
  async sendComboImages(userId, instanceName, remoteJid) {
    const number = remoteJid.replace('@s.whatsapp.net', '')

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

    if (combos.length === 0) {
      await evolutionApi.post(`/message/sendText/${instanceName}`, {
        number,
        text: 'No momento não temos combos disponíveis.',
      })
      return
    }

    for (const combo of combos) {
      const discount = Number(combo.discount)
      const totalItems = combo.items.reduce((sum, item) => sum + item.quantity * Number(item.product.price), 0)
      const finalPrice = totalItems - discount

      let caption = `*${combo.name}*\n`
      if (combo.description) caption += `${combo.description}\n`
      caption += '\n'
      caption += combo.items.map(item => {
        const itemPrice = Number(item.product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        return `• ${item.quantity}x ${item.product.name} (${itemPrice})`
      }).join('\n')
      caption += `\n\n💰 Valor total: ${totalItems.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      if (discount > 0) {
        caption += `\n🏷️ Desconto: -${discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      }
      caption += `\n✅ *Valor final: ${finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*`

      await this.sendTyping(instanceName, remoteJid)

      if (combo.imageUrl) {
        try {
          await evolutionApi.post(`/message/sendMedia/${instanceName}`, {
            number,
            mediatype: 'image',
            media: combo.imageUrl,
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
      text: 'Esses são os nossos combos! 🎉\n\nQual combo você gostaria de pedir?',
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
          mimetype: 'application/pdf',
          media: instruction.imageUrl,
          caption: instruction.title,
          fileName: `${instruction.title}.pdf`,
        })
      } else if (url.match(/\.(mp3|mpeg|ogg)(\?|$)/)) {
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
      console.error('Erro ao enviar anexo:', err.message, err?.response?.status, JSON.stringify(err?.response?.data || ''))
      console.error('Anexo URL:', instruction.imageUrl)
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
        const rawPhone = normalizePhone(args.phone)
        let customer = await prisma.customer.findFirst({
          where: {
            userId,
            phone: { contains: rawPhone },
            active: true,
          },
        })
        // Fallback: busca todos e compara normalizado
        if (!customer) {
          const allCustomers = await prisma.customer.findMany({
            where: { userId, active: true },
          })
          customer = allCustomers.find(c => normalizePhone(c.phone) === rawPhone)
        }
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

        // Busca configuração de delivery da conta
        const accountConfig = await prisma.account.findUnique({
          where: { userId },
          select: { deliveryEnabled: true },
        })

        const hasDelivery = accountConfig?.deliveryEnabled || allContent.includes('entrega') || allContent.includes('delivery') || allContent.includes('frete')
        const hasPickup = allContent.includes('retirada') || allContent.includes('retirar') || allContent.includes('buscar no local') || true

        // Busca endereço da empresa (do User)
        const user = await prisma.user.findUnique({ where: { id: userId } })
        const companyAddress = [user?.street, user?.number, user?.neighborhood, user?.city, user?.state]
          .filter(Boolean).join(', ')

        // Busca taxas de entrega do banco (DeliveryZone) + instruções (fallback)
        const dbZones = await prisma.deliveryZone.findMany({
          where: { userId, active: true },
          orderBy: { name: 'asc' },
        })
        const instructionFees = this._extractDeliveryFees(instructions)

        // Prioriza zonas do banco, usa instruções como fallback
        const allFees = dbZones.length > 0
          ? dbZones.map(z => ({ location: z.name.toLowerCase(), value: Number(z.fee) }))
          : instructionFees

        const feesInfo = allFees.length > 0
          ? allFees.map(f => `${f.location}: ${f.value === 0 ? 'Grátis' : `R$ ${f.value.toFixed(2)}`}`).join(', ')
          : null

        const result = {
          deliveryAvailable: hasDelivery,
          pickupAvailable: hasPickup,
          companyAddress: companyAddress || 'Endereço não cadastrado',
        }

        if (allFees.length > 0) {
          result.deliveryFees = feesInfo
          result.message = `Taxas de entrega por localidade: ${feesInfo}. ` +
            (hasPickup ? 'Retirada no local também disponível.' : '')
        } else if (hasDelivery && hasPickup) {
          result.message = 'Entrega e retirada no local disponíveis. Pergunte ao cliente qual prefere.'
        } else if (hasDelivery) {
          result.message = 'Apenas entrega disponível. Peça o endereço do cliente.'
        } else {
          result.message = `Apenas retirada no local. Informe o endereço: ${companyAddress || 'Endereço não cadastrado'}`
        }

        return JSON.stringify(result)
      }

      case 'criar_pedido': {
        try {
          // Verifica se o telefone do cliente esta confirmado por codigo
          // (bloqueia pedidos de numeros nao validados)
          if (args.customerPhone && isRedisReady()) {
            const normPhone = normalizePhone(args.customerPhone)
            try {
              const confirmed = await redisClient.get(`zapcakes:verify:confirmed:${userId}:${normPhone}`)
              if (!confirmed) {
                return JSON.stringify({
                  success: false,
                  needsVerification: true,
                  error: 'O numero do cliente ainda nao foi verificado. ANTES de criar o pedido, chame enviar_codigo_verificacao(phone) e peca ao cliente o codigo de 6 digitos, depois chame verificar_codigo(phone, codigo). So apos codigo correto, volte a chamar criar_pedido.',
                })
              }
            } catch { /* noop — se Redis cair, permite */ }
          }

          // Verifica disponibilidade na agenda antes de criar o pedido
          if (args.estimatedDeliveryDate) {
            const parsedDate = this._parseDeliveryDate(args.estimatedDeliveryDate)
            console.log('[criar_pedido] estimatedDeliveryDate:', args.estimatedDeliveryDate, '-> parsedDate:', parsedDate?.toISOString())
            if (parsedDate) {
              const hasAnySlot = await prisma.agendaSlot.count({ where: { userId } })
              if (hasAnySlot > 0) {
                const slot = await prisma.agendaSlot.findUnique({
                  where: { userId_date: { userId, date: parsedDate } },
                })
                if (!slot || !slot.active) {
                  return JSON.stringify({ success: false, error: `Não há disponibilidade na agenda para a data ${args.estimatedDeliveryDate}. Peça ao cliente para escolher outra data. Use consultar_agenda para ver as datas disponíveis.` })
                }
                if (slot.currentOrders >= slot.maxOrders) {
                  return JSON.stringify({ success: false, error: `A agenda para ${args.estimatedDeliveryDate} está lotada (${slot.maxOrders}/${slot.maxOrders} pedidos). Peça ao cliente para escolher outra data. Use consultar_agenda para ver as datas disponíveis.` })
                }
              }
            }
          }

          // itemsTotal será calculado após resolver adicionais abaixo
          let itemsTotal = 0

          // Busca instruções de pedidos para reserva e taxa de entrega
          const orderInstructions = await prisma.agentInstruction.findMany({
            where: { userId, active: true, category: 'ORDERS' },
          })

          // Taxa de entrega — prioriza DeliveryZone do banco, fallback para instruções
          let deliveryFee = args.deliveryFee || 0
          if (args.deliveryType === 'ENTREGA' && !deliveryFee) {
            const dbZones = await prisma.deliveryZone.findMany({
              where: { userId, active: true },
            })
            if (dbZones.length > 0) {
              const zoneFees = dbZones.map(z => ({ location: z.name.toLowerCase(), value: Number(z.fee) }))
              deliveryFee = this._findDeliveryFee(zoneFees, args.neighborhood, args.city)
            } else {
              const fees = this._extractDeliveryFees(orderInstructions)
              deliveryFee = this._findDeliveryFee(fees, args.neighborhood, args.city)
            }
          }

          // Busca config de reserva (sera aplicada apos somar itensTotal)
          const accountRes = await prisma.account.findUnique({
            where: { userId },
            select: { useReservation: true, reservationPercent: true },
          })
          const hasRes = accountRes?.useReservation || this._hasReservation(orderInstructions)
          const resPercent = hasRes
            ? (accountRes?.reservationPercent || this._extractReservationPercent(orderInstructions) || 30)
            : null

          // Busca IDs dos produtos pelo nome e valida min/max
          const orderItems = []
          for (const item of args.items) {
            const product = await prisma.product.findFirst({
              where: {
                userId,
                active: true,
                name: { contains: item.productName },
              },
            })
            if (product) {
              // Valida pedido mínimo
              if (product.minOrder && item.quantity < product.minOrder) {
                return JSON.stringify({ success: false, error: `O produto "${product.name}" tem pedido mínimo de ${product.minOrder} unidades. O cliente pediu apenas ${item.quantity}. Peça ao cliente para ajustar a quantidade.` })
              }
              // Valida pedido máximo
              if (product.maxOrder && item.quantity > product.maxOrder) {
                return JSON.stringify({ success: false, error: `O produto "${product.name}" tem pedido máximo de ${product.maxOrder} unidades. O cliente pediu ${item.quantity}. Peça ao cliente para ajustar a quantidade.` })
              }

              // Resolve adicionais por nome (restritos aos vinculados a este produto)
              const resolvedAddons = []
              let addonUnitTotal = 0
              if (Array.isArray(item.additionals) && item.additionals.length > 0) {
                const productAddons = await prisma.productAdditional.findMany({
                  where: { productId: product.id, additional: { active: true } },
                  include: { additional: true },
                })
                if (productAddons.length === 0) {
                  return JSON.stringify({ success: false, error: `O produto "${product.name}" não possui adicionais disponíveis.` })
                }
                for (const a of item.additionals) {
                  const requestedName = String(a.additionalName || '').toLowerCase().trim()
                  const match = productAddons.find((pa) => pa.additional.description.toLowerCase().includes(requestedName) || requestedName.includes(pa.additional.description.toLowerCase()))
                  if (!match) {
                    const options = productAddons.map((pa) => pa.additional.description).join(', ')
                    return JSON.stringify({ success: false, error: `Adicional "${a.additionalName}" não está disponível para "${product.name}". Opções: ${options}.` })
                  }
                  const qty = Math.max(1, Number(a.quantity) || 1)
                  resolvedAddons.push({
                    additionalId: match.additional.id,
                    description: match.additional.description,
                    price: match.additional.price,
                    quantity: qty,
                  })
                  addonUnitTotal += Number(match.additional.price) * qty
                }
              }

              const lineTotal = (Number(item.price) + addonUnitTotal) * item.quantity
              itemsTotal += lineTotal

              orderItems.push({
                productId: product.id,
                quantity: item.quantity,
                price: item.price,
                _addons: resolvedAddons,
              })
            }
          }

          // Agora que itemsTotal esta calculado, finaliza total e reserva
          const total = itemsTotal + deliveryFee
          const reservation = resPercent ? Math.round(itemsTotal * (resPercent / 100) * 100) / 100 : null

          // Valida limites por categoria na agenda (se configurada)
          if (args.estimatedDeliveryDate) {
            const parsedDateCat = this._parseDeliveryDate(args.estimatedDeliveryDate)
            if (parsedDateCat) {
              const slotCat = await prisma.agendaSlot.findUnique({
                where: { userId_date: { userId, date: parsedDateCat } },
                include: { categorySlots: { include: { category: true } } },
              })
              if (slotCat && slotCat.categorySlots.length > 0) {
                // Agrupa quantidades por categoria
                for (const oi of orderItems) {
                  const prod = await prisma.product.findUnique({ where: { id: oi.productId }, select: { categoryId: true, name: true } })
                  if (!prod) continue
                  const catSlot = slotCat.categorySlots.find(cs => cs.categoryId === prod.categoryId)
                  if (catSlot && (catSlot.currentUnits + oi.quantity) > catSlot.maxUnits) {
                    const remaining = catSlot.maxUnits - catSlot.currentUnits
                    return JSON.stringify({ success: false, error: `A capacidade de produção de "${catSlot.category.name}" para ${args.estimatedDeliveryDate} é de ${catSlot.maxUnits} unidades e já temos ${catSlot.currentUnits} reservadas. Restam ${remaining} vagas. O cliente pediu ${oi.quantity}x ${prod.name}. Peça para ajustar a quantidade ou escolher outra data.` })
                  }
                }
              }
            }
          }

          const lastOrder = await prisma.order.findFirst({
            where: { userId },
            orderBy: { orderNumber: 'desc' },
            select: { orderNumber: true },
          })
          const nextOrderNumber = (lastOrder?.orderNumber || 0) + 1

          const order = await prisma.order.create({
            data: {
              userId,
              publicId: randomUUID(),
              orderNumber: nextOrderNumber,
              customerId: args.customerId,
              customerName: args.customerName,
              customerPhone: args.customerPhone.replace(/\D/g, ''),
              remoteJid: this._currentRemoteJid || null,
              deliveryType: args.deliveryType,
              deliveryAddress: args.deliveryAddress,
              deliveryFee: deliveryFee || null,
              estimatedDeliveryDate: args.estimatedDeliveryDate || null,
              notes: args.notes || null,
              total,
              reservation,
              status: 'PENDING',
              items: {
                create: orderItems.map(({ _addons, ...it }) => it),
              },
            },
            include: { items: { include: { product: true } } },
          })

          // Persistir adicionais por item (snapshot de preço/descrição)
          const addonPayload = []
          for (const oi of order.items) {
            const original = orderItems.find((x) => x.productId === oi.productId)
            for (const a of original?._addons || []) {
              addonPayload.push({
                orderItemId: oi.id,
                additionalId: a.additionalId,
                description: a.description,
                price: a.price,
                quantity: a.quantity,
              })
            }
          }
          if (addonPayload.length > 0) {
            await prisma.orderItemAdditional.createMany({ data: addonPayload })
          }

          // Associa imagens de inspiracao enviadas pelo cliente no WhatsApp
          // Sao consumidas em ordem, respeitando o maxInspirationImages de cada produto
          if (this._currentRemoteJid && isRedisReady()) {
            try {
              const key = INSPIRATION_KEY(this._currentRemoteJid)
              const raw = await redisClient.lrange(key, 0, -1)
              if (raw && raw.length > 0) {
                const images = raw.map((r) => { try { return JSON.parse(r) } catch { return null } }).filter(Boolean)
                const attachmentPayload = []
                let imgIdx = 0
                for (const oi of order.items) {
                  if (imgIdx >= images.length) break
                  const prod = await prisma.product.findUnique({
                    where: { id: oi.productId },
                    select: { allowInspirationImages: true, maxInspirationImages: true },
                  })
                  if (!prod?.allowInspirationImages) continue
                  const maxForProduct = prod.maxInspirationImages || 3
                  const slotsForItem = Math.min(maxForProduct, images.length - imgIdx)
                  for (let s = 0; s < slotsForItem; s++) {
                    attachmentPayload.push({
                      orderItemId: oi.id,
                      imageUrl: images[imgIdx].url,
                    })
                    imgIdx++
                  }
                }
                if (attachmentPayload.length > 0) {
                  await prisma.orderItemAttachment.createMany({ data: attachmentPayload })
                }
                // Limpa a lista apos associar (evita reuso em pedido futuro)
                await redisClient.del(key)
              }
            } catch (attErr) {
              console.error('[inspiracao/criar_pedido] erro ao associar imagens:', attErr.message)
            }
          }

          // Incrementa contador na agenda se a data prevista existe
          if (args.estimatedDeliveryDate) {
            const parsedDate = this._parseDeliveryDate(args.estimatedDeliveryDate)
            if (parsedDate) {
              const slotForUpdate = await prisma.agendaSlot.findUnique({
                where: { userId_date: { userId, date: parsedDate } },
              })
              if (slotForUpdate) {
                await prisma.agendaSlot.update({
                  where: { id: slotForUpdate.id },
                  data: { currentOrders: { increment: 1 } },
                })
                // Incrementa currentUnits por categoria
                for (const oi of orderItems) {
                  const prod = await prisma.product.findUnique({ where: { id: oi.productId }, select: { categoryId: true } })
                  if (prod) {
                    await prisma.agendaCategorySlot.updateMany({
                      where: { agendaSlotId: slotForUpdate.id, categoryId: prod.categoryId },
                      data: { currentUnits: { increment: oi.quantity } },
                    })
                  }
                }
              }
            }
          }

          let message = `Pedido #${String(order.orderNumber).padStart(5, '0')} criado com sucesso! Subtotal: R$ ${itemsTotal.toFixed(2)}.`
          if (deliveryFee > 0) message += ` Taxa de entrega: R$ ${deliveryFee.toFixed(2)}.`
          message += ` Total: R$ ${total.toFixed(2)}.`
          if (reservation) message += ` Reserva (${resPercent}%): R$ ${reservation.toFixed(2)}.`

          const result = {
            success: true,
            orderId: order.id,
            subtotal: itemsTotal.toFixed(2),
            deliveryFee: deliveryFee > 0 ? deliveryFee.toFixed(2) : null,
            total: total.toFixed(2),
            itemCount: order.items.length,
            message,
          }
          if (reservation) {
            result.reservation = reservation.toFixed(2)
            result.reservationPercent = resPercent
            result.hasReservation = true
          } else {
            result.hasReservation = false
          }

          return JSON.stringify(result)
        } catch (err) {
          console.error('Erro ao criar pedido:', err.message)
          return JSON.stringify({ success: false, error: 'Erro ao criar pedido. Tente novamente.' })
        }
      }

      case 'consultar_pedido': {
        try {
          let order = null
          // Prioridade: orderNumber (numero visivel ao cliente). Mantem orderId
          // por compatibilidade caso o modelo envie esse campo legado.
          if (args.orderNumber) {
            order = await prisma.order.findFirst({
              where: { orderNumber: Number(args.orderNumber), userId },
              include: { items: { include: { product: true } } },
            })
            // Se nao achou por orderNumber + customerPhone (cliente tem mais de
            // um pedido com esse numero entre contas distintas — improvavel) e
            // passou telefone, tenta narrow
            if (!order && args.customerPhone) {
              const phone = normalizePhone(args.customerPhone)
              const candidates = await prisma.order.findMany({
                where: { userId, orderNumber: Number(args.orderNumber) },
                include: { items: { include: { product: true } } },
              })
              order = candidates.find((o) => normalizePhone(o.customerPhone) === phone)
            }
          } else if (args.orderId) {
            // Deprecated: aceita orderId antigo mas prefere orderNumber
            order = await prisma.order.findFirst({
              where: { id: Number(args.orderId), userId },
              include: { items: { include: { product: true } } },
            })
          } else if (args.customerPhone) {
            const phone = normalizePhone(args.customerPhone)
            order = await prisma.order.findFirst({
              where: { userId, customerPhone: { contains: phone } },
              orderBy: { createdAt: 'desc' },
              include: { items: { include: { product: true } } },
            })
            // Fallback: busca com variações do telefone
            if (!order) {
              const allOrders = await prisma.order.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                include: { items: { include: { product: true } } },
                take: 100,
              })
              order = allOrders.find(o => normalizePhone(o.customerPhone) === phone)
            }
          }

          if (!order) {
            return JSON.stringify({ found: false, message: 'Pedido não encontrado.' })
          }

          const statusLabels = {
            PENDING: 'Pendente',
            RESERVATION: 'Reserva (aguardando verificação)',
            CONFIRMED: 'Confirmado',
            PREPARING: 'Preparando',
            READY: 'Pronto para retirada/entrega',
            DELIVERED: 'Entregue',
            CANCELLED: 'Cancelado',
          }

          const items = order.items.map(i =>
            `${i.quantity}x ${i.product.name} - R$ ${(i.quantity * Number(i.price)).toFixed(2)}`
          )

          const orderNumberPadded = String(order.orderNumber).padStart(5, '0')
          return JSON.stringify({
            found: true,
            // orderNumber e' o UNICO numero que deve ser mostrado ao cliente
            orderNumber: order.orderNumber,
            orderNumberFormatted: `#${orderNumberPadded}`,
            status: statusLabels[order.status] || order.status,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            total: Number(order.total).toFixed(2),
            reservation: order.reservation ? Number(order.reservation).toFixed(2) : null,
            deliveryFee: order.deliveryFee ? Number(order.deliveryFee).toFixed(2) : null,
            deliveryType: order.deliveryType === 'ENTREGA' ? 'Entrega' : 'Retirada',
            deliveryAddress: order.deliveryAddress || null,
            proofVerified: order.proofVerified,
            paymentConfirmed: order.paymentConfirmed,
            items,
            notes: order.notes || null,
            estimatedDeliveryDate: order.estimatedDeliveryDate || null,
            createdAt: new Date(order.createdAt).toLocaleString('pt-BR'),
            // NAO inclua orderId no retorno — e' id interno do banco e o
            // modelo costumava confundir com o numero visivel do pedido
          })
        } catch (err) {
          console.error('Erro ao consultar pedido:', err.message)
          return JSON.stringify({ found: false, message: 'Erro ao consultar pedido.' })
        }
      }

      case 'enviar_codigo_verificacao': {
        const phone = normalizePhone(args.phone)
        if (!phone || phone.length < 10) {
          return JSON.stringify({ success: false, error: 'Numero invalido. Peca ao cliente o telefone com DDD.' })
        }
        // Ja verificado nos ultimos 30 dias?
        if (isRedisReady()) {
          try {
            const confirmed = await redisClient.get(`zapcakes:verify:confirmed:${userId}:${phone}`)
            if (confirmed) {
              return JSON.stringify({
                success: true,
                alreadyVerified: true,
                message: 'Numero ja verificado anteriormente. Nao precisa reenviar codigo. Pode seguir com o pedido.',
              })
            }
          } catch { /* noop */ }
        }
        const code = String(Math.floor(100000 + Math.random() * 900000))
        if (isRedisReady()) {
          try {
            await redisClient.set(`zapcakes:verify:pending:${userId}:${phone}`, code, 'EX', 600)
          } catch { /* noop */ }
        }
        // Codigo SEMPRE enviado pela instancia do sistema (ZapCakes-System)
        // para unificar a origem e nao depender da loja ter WhatsApp proprio.
        const systemInstance = await prisma.instance.findFirst({
          where: { instanceName: 'ZapCakes-System', status: 'CONNECTED' },
        })

        // No simulador ou quando sistema nao tem instance, retorna o codigo
        // para facilitar teste
        if (!systemInstance) {
          console.log(`[verify] codigo para ${phone}: ${code}`)
          return JSON.stringify({
            success: true,
            sent: false,
            simulator: true,
            code,
            message: `Modo simulador/sistema sem WhatsApp: o codigo seria ${code}. Peca ao cliente para informar este codigo.`,
          })
        }

        try {
          const formatted = phone.startsWith('55') ? phone : `55${phone}`
          await evolutionApi.post(`/message/sendText/${systemInstance.instanceName}`, {
            number: formatted,
            text: `🔐 *ZapCakes — Código de verificação*\n\nSeu código é: *${code}*\n\nInforme este código aqui no chat para confirmar seu número.\nVálido por 10 minutos.\n\n_Este código foi enviado pelo sistema ZapCakes para garantir a segurança do seu pedido._`,
          })
          return JSON.stringify({
            success: true,
            message: 'Codigo de 6 digitos enviado por WhatsApp (pelo ZapCakes) ao cliente. Peca ao cliente para informar o codigo recebido.',
          })
        } catch (err) {
          return JSON.stringify({
            success: false,
            error: 'Falha ao enviar codigo por WhatsApp pelo ZapCakes. Verifique o numero e tente novamente.',
            details: err.response?.data?.message || err.message,
          })
        }
      }

      case 'verificar_codigo': {
        const phone = normalizePhone(args.phone)
        const codigo = String(args.codigo || '').replace(/\D/g, '')
        if (!phone || !codigo || codigo.length !== 6) {
          return JSON.stringify({ success: false, error: 'Numero ou codigo invalido. O codigo tem 6 digitos.' })
        }
        if (!isRedisReady()) {
          // Fallback: sem Redis, marca como verificado (melhor esforco)
          return JSON.stringify({ success: true, message: 'Verificado (modo sem cache).' })
        }
        try {
          const stored = await redisClient.get(`zapcakes:verify:pending:${userId}:${phone}`)
          if (!stored) {
            return JSON.stringify({
              success: false,
              expired: true,
              error: 'Codigo expirado ou nao enviado. Peca um novo codigo usando enviar_codigo_verificacao.',
            })
          }
          if (stored !== codigo) {
            return JSON.stringify({
              success: false,
              incorrect: true,
              error: 'Codigo incorreto. Peca ao cliente para conferir. Se esqueceu, chame enviar_codigo_verificacao novamente.',
            })
          }
          // OK — marca confirmado por 30 dias
          await redisClient.set(`zapcakes:verify:confirmed:${userId}:${phone}`, '1', 'EX', 30 * 24 * 60 * 60)
          await redisClient.del(`zapcakes:verify:pending:${userId}:${phone}`)
          return JSON.stringify({ success: true, message: 'Numero verificado com sucesso! Pode prosseguir com o pedido.' })
        } catch (err) {
          return JSON.stringify({ success: false, error: 'Erro ao verificar codigo.', details: err.message })
        }
      }

      case 'consultar_agenda': {
        try {
          const today = new Date()
          today.setUTCHours(0, 0, 0, 0)
          const endDate = new Date(today)
          endDate.setDate(endDate.getDate() + 60)

          // Verifica se o operador tem algum slot configurado
          const totalSlots = await prisma.agendaSlot.count({ where: { userId } })
          if (totalSlots === 0) {
            return JSON.stringify({
              agendaConfigured: false,
              available: true,
              message: 'O estabelecimento ainda não configurou a agenda de disponibilidade. Qualquer data pode ser aceita.',
            })
          }

          const slots = await prisma.agendaSlot.findMany({
            where: {
              userId,
              active: true,
              date: { gte: today, lte: endDate },
            },
            include: { categorySlots: { include: { category: true } } },
            orderBy: { date: 'asc' },
          })

          const available = slots.filter(s => s.currentOrders < s.maxOrders)

          if (available.length === 0) {
            return JSON.stringify({
              agendaConfigured: true,
              available: false,
              message: 'Não há datas disponíveis na agenda no momento. Informe ao cliente que todas as datas estão lotadas e peça para entrar em contato diretamente com o estabelecimento.',
            })
          }

          const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
          const structuredDates = available.map(s => {
            const d = new Date(s.date)
            const day = String(d.getUTCDate()).padStart(2, '0')
            const month = String(d.getUTCMonth() + 1).padStart(2, '0')
            const year = d.getUTCFullYear()
            const weekday = WEEKDAYS[d.getUTCDay()]
            const categories = s.categorySlots.map(cs => ({
              name: cs.category.name,
              available: cs.maxUnits - cs.currentUnits,
            }))
            return {
              date: `${day}/${month}/${year}`,
              weekday,
              totalAvailable: s.maxOrders - s.currentOrders,
              categories,
            }
          })

          const humanLines = structuredDates.map(d => {
            const cats = d.categories.length > 0
              ? d.categories.map(c => `${c.name}=${c.available}`).join(', ')
              : `total=${d.totalAvailable}`
            return `${d.date} (${d.weekday}) — ${cats}`
          })

          return JSON.stringify({
            agendaConfigured: true,
            available: true,
            dates: structuredDates,
            message: `DATAS DISPONIVEIS NA AGENDA (use apenas estas informacoes, NAO invente):\n${humanLines.join('\n')}\n\nRegra: uma data so esta INDISPONIVEL se NAO aparecer acima. Uma categoria so esta indisponivel se o valor for 0. Se uma data e categoria aparecem com valor >= 1, elas ESTAO disponiveis.`,
          })
        } catch (err) {
          console.error('Erro ao consultar agenda:', err.message)
          return JSON.stringify({ available: true, message: 'Erro ao consultar agenda. Aceite qualquer data.' })
        }
      }

      case 'registrar_pagamento': {
        try {
          const phone = normalizePhone(args.customerPhone)
          // Busca o pedido mais recente PENDING desse cliente
          let order = await prisma.order.findFirst({
            where: {
              userId,
              customerPhone: { contains: phone },
              status: 'PENDING',
            },
            orderBy: { createdAt: 'desc' },
            include: { items: { include: { product: true } } },
          })
          // Fallback normalizado
          if (!order) {
            const pendingOrders = await prisma.order.findMany({
              where: { userId, status: 'PENDING' },
              orderBy: { createdAt: 'desc' },
              include: { items: { include: { product: true } } },
              take: 50,
            })
            order = pendingOrders.find(o => normalizePhone(o.customerPhone) === phone)
          }

          if (!order) {
            return JSON.stringify({
              success: false,
              message: 'Não encontrei nenhum pedido pendente para este número. Verifique o número ou se o pedido já foi confirmado.',
            })
          }

          // Tenta salvar o comprovante (imagem do cache)
          let paymentProofUrl = null
          const cachedImage = lastImageCache.get(this._currentRemoteJid)
          if (cachedImage) {
            try {
              // cachedImage é data:image/jpeg;base64,... - extrai o base64
              const matches = cachedImage.match(/^data:(.+?);base64,(.+)$/)
              if (matches) {
                const mimeType = matches[1]
                const base64Data = matches[2]
                const buffer = Buffer.from(base64Data, 'base64')
                const ext = mimeType.includes('pdf') ? '.pdf' : '.jpg'
                const key = `comprovantes/${randomUUID()}${ext}`

                await s3Client.send(
                  new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: key,
                    Body: buffer,
                    ContentType: mimeType,
                  })
                )

                paymentProofUrl = `${process.env.S3_ENDPOINT}/${S3_BUCKET}/${key}`
              }
            } catch (uploadErr) {
              console.error('Erro ao salvar comprovante:', uploadErr.message)
            }
            lastImageCache.delete(this._currentRemoteJid)
          }

          // Remove a ultima imagem da lista de inspiracao (era o comprovante,
          // nao inspiracao). Evita que o comprovante vire anexo de pedido futuro.
          if (this._currentRemoteJid && isRedisReady()) {
            try {
              await redisClient.rpop(INSPIRATION_KEY(this._currentRemoteJid))
            } catch { /* silencioso */ }
          }

          // Verifica divergência de valor do comprovante
          const expectedAmount = order.reservation ? Number(order.reservation) : Number(order.total)
          const proofAmount = args.proofAmount || null
          let valueDivergent = false
          let divergenceMessage = ''

          if (proofAmount !== null && expectedAmount > 0) {
            // Considera divergente se o valor do comprovante for diferente do esperado
            const diff = Math.abs(proofAmount - expectedAmount)
            if (diff > 0.50) { // tolerância de R$ 0,50
              valueDivergent = true
              if (proofAmount > expectedAmount) {
                divergenceMessage = `Parece que seu comprovante de pagamento tem o valor diferente do esperado (R$ ${expectedAmount.toFixed(2)}), mas fique tranquilo, nossa equipe irá verificar e responder.`
              } else {
                divergenceMessage = `O valor do comprovante (R$ ${proofAmount.toFixed(2)}) parece diferente do valor esperado (R$ ${expectedAmount.toFixed(2)}). Fique tranquilo, nossa equipe irá verificar e responder.`
              }
            }
          }

          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'RESERVATION',
              ...(paymentProofUrl ? { paymentProof: paymentProofUrl } : {}),
              ...(proofAmount !== null ? { depositAmount: proofAmount } : {}),
              ...(valueDivergent ? { depositDivergence: true } : {}),
            },
          })

          // Notifica o lojista via WhatsApp (mesmo padrão do site)
          try {
            const owner = await prisma.user.findUnique({
              where: { id: userId },
              select: { phone: true, name: true },
            })
            if (owner?.phone && this._currentInstanceName) {
              const ownerPhone = owner.phone.replace(/\D/g, '')
              const whatsappNumber = ownerPhone.startsWith('55') ? ownerPhone : `55${ownerPhone}`
              const orderCode = String(order.orderNumber).padStart(5, '0')
              const depositValue = proofAmount !== null ? proofAmount : (order.reservation ? Number(order.reservation) : Number(order.total))
              const divergenceWarning = valueDivergent ? '\n*Atenção:* Valor do comprovante divergente do esperado!' : ''
              // So inclui link se FRONTEND_URL estiver configurado em env
              // (evita enviar links quebrados como http://localhost:5173/...)
              const frontendUrl = process.env.FRONTEND_URL
              const orderLinkLine = frontendUrl
                ? `\n\nAcesse o pedido: ${frontendUrl.replace(/\/$/, '')}/client/orders/${orderCode}`
                : ''

              const notifyMsg = `*Novo comprovante de reserva recebido!*\n\n` +
                `*Pedido #${orderCode}*\n` +
                `*Cliente:* ${order.customerName || 'N/A'}\n` +
                `*Celular:* ${order.customerPhone || 'N/A'}\n` +
                `*Valor da reserva:* R$ ${depositValue.toFixed(2).replace('.', ',')}\n` +
                `*Total do pedido:* R$ ${Number(order.total).toFixed(2).replace('.', ',')}` +
                `${divergenceWarning}` +
                orderLinkLine

              await evolutionApi.post(`/message/sendText/${this._currentInstanceName}`, {
                number: whatsappNumber,
                text: notifyMsg,
              })
            }
          } catch (notifyErr) {
            console.error('[Comprovante] Erro ao notificar lojista via WhatsApp:', notifyErr.message)
          }

          const itemsList = order.items.map(i =>
            `${i.quantity}x ${i.product.name} - R$ ${(i.quantity * Number(i.price)).toFixed(2)}`
          ).join(', ')

          const result = {
            success: true,
            orderId: order.id,
            total: Number(order.total).toFixed(2),
            reservation: order.reservation ? Number(order.reservation).toFixed(2) : null,
            items: itemsList,
            proofSaved: !!paymentProofUrl,
            valueDivergent,
          }

          if (valueDivergent) {
            result.message = divergenceMessage
          } else {
            result.message = `Pagamento da reserva registrado para o Pedido #${String(order.orderNumber).padStart(5, '0')}. ${paymentProofUrl ? 'Comprovante salvo.' : ''} Vamos confirmar o pagamento e iniciar a produção.`
          }

          return JSON.stringify(result)
        } catch (err) {
          console.error('Erro ao registrar pagamento:', err.message)
          return JSON.stringify({ success: false, error: 'Erro ao registrar pagamento. Tente novamente.' })
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

    // Busca configuração de reserva da conta (prioridade) + fallback instruções
    const account = await prisma.account.findUnique({
      where: { userId },
      select: { useReservation: true, reservationPercent: true },
    })
    const hasReservation = account?.useReservation || this._hasReservation(instructions)
    const reservationPercent = hasReservation
      ? (account?.reservationPercent || this._extractReservationPercent(instructions) || 30)
      : null

    // Busca zonas de entrega do banco (prioridade) + fallback instruções
    const dbZones = await prisma.deliveryZone.findMany({
      where: { userId, active: true },
      orderBy: { name: 'asc' },
    })
    const deliveryFees = dbZones.length > 0
      ? dbZones.map(z => ({ location: z.name, value: Number(z.fee) }))
      : this._extractDeliveryFees(instructions)

    const categoryLabels = {
      GREETING: 'Saudação',
      COMPANY: 'Empresa',
      ORDERS: 'Pedidos',
      PRODUCTS: 'Produtos',
      QUESTIONS: 'Dúvidas',
      CLOSING: 'Encerramento',
    }

    let prompt = 'Você é um agente de atendimento ao cliente via WhatsApp.\n\n'

    prompt += '## REGRAS GERAIS (OBRIGATÓRIAS)\n\n'
    prompt += '1. NUNCA envie, sugira ou invente URLs, links, domínios ou endereços web de qualquer tipo (ex: "app.zapcakes.com", "zapcakes.com/loja/xyz", "site da loja", "acesse nosso site"). Você SÓ pode mencionar links que apareçam literalmente nas instruções do agente abaixo (categorias GREETING, COMPANY, ORDERS, PRODUCTS, QUESTIONS, CLOSING) ou nas "TAXAS DE ENTREGA". Se nenhum link foi cadastrado, não sugira nenhum.\n'
    prompt += '2. NUNCA ofereça ao cliente "fazer o pedido pelo site" nem redirecione para outro canal. Todo atendimento deve ser feito aqui no WhatsApp, usando as tools disponíveis (buscar_cliente, criar_pedido, etc).\n'
    prompt += '3. NUNCA invente informações que não estejam explícitas no catálogo, nos adicionais, nas instruções do agente, nas zonas de entrega ou nos dados do cliente retornados pelas tools.\n'
    prompt += '4. COMPROVANTE DE PAGAMENTO: se o cliente enviar uma imagem que pareça um comprovante de PIX/transferência (valor, data, "enviado", "transferido", "comprovante", nome do beneficiário), chame OBRIGATORIAMENTE a tool "registrar_pagamento" passando o telefone do cliente (customerPhone) e o valor identificado na imagem (proofAmount). Isso funciona MESMO se você não tem memória da conversa anterior — a tool busca automaticamente o último pedido pendente do cliente pelo telefone. NÃO peça ao cliente para "mandar de novo o pedido" nem pergunte de qual pedido é o comprovante.\n\n'

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
          else if (url.match(/\.(mp3|mpeg|ogg)(\?|$)/)) tipo = 'áudio'
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
    prompt += `2. Quando ele escolher a categoria, responda APENAS com o comando [MOSTRAR_PRODUTOS:NomeDaCategoria] - o sistema vai enviar uma LISTA EM TEXTO (sem fotos) com nome e preço de cada produto da categoria\n`
    prompt += `2a. Quando o cliente pedir descrição, foto ou detalhe de um produto, OU escolher um produto específico, responda APENAS com [MOSTRAR_PRODUTO:NomeDoProduto] - o sistema vai enviar a foto + dados completos (preço, min/max, descrição). Em seguida, pergunte a quantidade se ainda não souber.\n`
    prompt += `3. Após as imagens serem enviadas, pergunte qual produto deseja e a quantidade\n`
    prompt += `4. Quando o cliente escolher um produto e quantidade, CONFIRME o item adicionado (ex: "Adicionei 2x Bolo de Chocolate - R$ 120,00")\n`
    prompt += `   - Se o produto tiver a marcação "📷 Aceita imagens de inspiração" no catálogo, pergunte ao cliente: "Você gostaria de enviar imagens de inspiração/referência para esse produto? (fotos do tema, decoração, etc)". Se o cliente quiser enviar, peça as imagens (respeitando o máximo indicado no catálogo). Se não quiser, siga normalmente. NÃO diga ao cliente que voce nao pode salvar imagens — o sistema anexa automaticamente todas as imagens enviadas durante a conversa ao pedido ao chamar criar_pedido. Apenas confirme ao cliente "recebi sua imagem!" e siga o fluxo.\n`
    prompt += `   - Se o produto listar uma seção "Adicionais disponíveis" logo abaixo dele no catálogo, PERGUNTE ao cliente se deseja incluir algum adicional, listando o nome e o preço de cada um. Se o cliente aceitar, registre os adicionais escolhidos no item (em "additionals" de criar_pedido, usando o nome exato do adicional). Se recusar ou o produto não tiver adicionais, siga normalmente.\n`
    prompt += `   - Se o cliente pedir para ver FOTO / EXEMPLO / IMAGEM de um adicional específico (ex.: "tem foto do recheio especial?", "como é a cobertura extra?"), responda APENAS com o comando [MOSTRAR_ADICIONAL:Nome do adicional] usando o nome exato do catálogo. O sistema enviará automaticamente a imagem cadastrada. NÃO escreva texto antes ou depois do comando.\n`
    prompt += `   - Depois pergunte se deseja mais algum produto\n`
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

    prompt += `### VERIFICAÇÃO DO NÚMERO DE TELEFONE (obrigatória)\n\n`
    prompt += `Depois de identificar ou cadastrar o cliente, ANTES de seguir para a verificação de entrega, CONFIRME que o número pertence a ele:\n`
    prompt += `- Chame a função "enviar_codigo_verificacao" passando o phone do cliente.\n`
    prompt += `- Se o retorno incluir "alreadyVerified": true, NÃO peça código ao cliente — o número já foi verificado recentemente. Apenas informe "Número já verificado, obrigado!" e siga para a etapa de entrega.\n`
    prompt += `- Se o retorno for success (sem alreadyVerified), diga ao cliente: "Enviei um código de 6 dígitos para o seu WhatsApp, pode me informar o código para confirmar que é você mesmo?" e aguarde o cliente responder com o código.\n`
    prompt += `- Quando o cliente enviar o código, chame "verificar_codigo" passando phone + codigo.\n`
    prompt += `  • Se success: agradeça e siga o fluxo de entrega.\n`
    prompt += `  • Se expired=true: diga "o código expirou, vou gerar um novo" e chame enviar_codigo_verificacao de novo.\n`
    prompt += `  • Se incorrect=true: diga "código incorreto, pode conferir e me enviar de novo?" (não gere novo a não ser que o cliente peça).\n`
    prompt += `- NUNCA chame criar_pedido antes de ter obtido success em verificar_codigo (ou alreadyVerified=true). Se tentar, a função retorna needsVerification=true e você DEVE voltar a este passo.\n\n`

    prompt += `### VERIFICAÇÃO DE ENTREGA\n\n`
    prompt += `e) Use a função "verificar_entrega" para checar os tipos de entrega disponíveis\n`
    prompt += `f) Se só tiver RETIRADA no local:\n`
    prompt += `   - Informe o endereço da loja e diga que o pedido será para retirada\n`
    prompt += `g) Se tiver ENTREGA disponível:\n`
    prompt += `   - Pergunte: "Você prefere entrega ou retirada?"\n`
    prompt += `   - Se RETIRADA, informe o endereço da loja\n`
    prompt += `   - Se ENTREGA, OBRIGATORIAMENTE confirme o endereço de entrega com o cliente ANTES de prosseguir:\n`
    prompt += `     1. Mostre o endereço cadastrado do cliente COMPLETO (rua, número, complemento, bairro, cidade/UF, CEP, referência)\n`
    prompt += `        Exemplo: "A entrega será neste endereço?\n`
    prompt += `        📍 Rua das Flores, 123 - Apto 2\n`
    prompt += `        Bairro Centro, Niterói/RJ - CEP 24020-000\n`
    prompt += `        Ref: próximo ao mercado"\n`
    prompt += `     2. Pergunte EXPLICITAMENTE: "Confirma entrega neste endereço ou prefere outro local?"\n`
    prompt += `     3. Se o cliente confirmar o endereço cadastrado, use-o como "deliveryAddress" no criar_pedido\n`
    prompt += `     4. Se o cliente quiser um ENDEREÇO DIFERENTE (ex: presente, trabalho, outra casa):\n`
    prompt += `        - NÃO altere o cadastro do cliente\n`
    prompt += `        - Colete o endereço completo do novo local: CEP, rua, número, complemento, bairro, cidade/UF, ponto de referência\n`
    prompt += `        - Se o cliente informar o CEP, use "consultar_cep" para preencher rua/bairro/cidade/UF automaticamente e peça apenas número e complemento\n`
    prompt += `        - Use esse novo endereço como "deliveryAddress" no criar_pedido (apenas para este pedido, sem alterar o cadastro)\n`
    prompt += `        - Importante: use os campos "neighborhood" e "city" do endereço INFORMADO para este pedido ao calcular a taxa de entrega, não os do cadastro\n`
    prompt += `     5. Se o cliente não souber o endereço exato, peça para confirmar depois e siga para coletar os dados que ele tiver\n`
    prompt += `     6. Se o cliente COMPARTILHAR A LOCALIZAÇÃO pelo WhatsApp (a mensagem chega com o marcador "[LOCALIZAÇÃO COMPARTILHADA PELO CLIENTE via WhatsApp]"):\n`
    prompt += `        - Use o "Endereço resolvido" fornecido no marcador como "deliveryAddress" do pedido\n`
    prompt += `        - Use "Bairro" e "Cidade" do marcador nos campos "neighborhood" e "city" para calcular a taxa de entrega\n`
    prompt += `        - Inclua OBRIGATORIAMENTE no campo "notes" (observações) do pedido:\n`
    prompt += `          • O link do Google Maps\n`
    prompt += `          • As coordenadas (latitude, longitude)\n`
    prompt += `          • O endereço compartilhado completo conforme recebido\n`
    prompt += `          Isso ajuda o entregador a encontrar o local exato.\n`
    prompt += `        - Confirme com o cliente: "Vou entregar neste endereço: (endereço resolvido). Está correto? Tem número ou complemento?" antes de criar o pedido\n`
    prompt += `        - NÃO altere o cadastro do cliente\n`

    if (deliveryFees.length > 0) {
      prompt += `\n### TAXAS DE ENTREGA\n\n`
      prompt += `As taxas de entrega por localidade são:\n`
      deliveryFees.forEach(f => {
        prompt += `- ${f.location}: ${f.value === 0 ? 'Grátis' : `R$ ${f.value.toFixed(2)}`}\n`
      })
      prompt += `\nInforme a taxa de entrega ao cliente com base no bairro/cidade. Inclua a taxa no total do pedido.\n`
      prompt += `Se o bairro/cidade não estiver na lista, informe que não há entrega disponível para a localidade e ofereça retirada no local.\n`
      prompt += `Ao criar o pedido, passe o campo "deliveryFee" com o valor da taxa e os campos "neighborhood" e "city".\n\n`
    }

    prompt += '\n'

    prompt += `### DATA PREVISTA PARA ENTREGA\n\n`
    prompt += `h) Pergunte ao cliente: "Para qual data você gostaria que o pedido fosse entregue/retirado?"\n`
    prompt += `   - O cliente pode responder com data e horário (ex: "Sábado dia 22 às 14h", "25/03 às 10h", "próxima sexta")\n`
    prompt += `   - Após o cliente informar a data desejada, você DEVE OBRIGATORIAMENTE chamar a função "consultar_agenda" para verificar se há disponibilidade. NÃO pule esta etapa.\n`
    prompt += `   - SEMPRE que o cliente mencionar UMA NOVA DATA (mesmo que você já tenha dito antes que não havia disponibilidade), CHAME "consultar_agenda" NOVAMENTE. A agenda é atualizada em tempo real pelo operador — nunca confie em uma resposta antiga sua. CADA NOVA DATA = NOVA CHAMADA a consultar_agenda.\n`
    prompt += `   - A função "consultar_agenda" retorna um array "dates" onde cada item tem { date, weekday, totalAvailable, categories:[{name, available}] }. Use APENAS os valores retornados — NÃO invente o dia da semana nem invente se está disponível.\n`
    prompt += `   - Regra OBRIGATÓRIA de interpretação:\n`
    prompt += `     • Se a data informada pelo cliente APARECE no array "dates", ela ESTÁ disponível. Ponto final.\n`
    prompt += `     • Se a categoria do produto tem "available" >= 1 naquela data, ela ESTÁ disponível para aquele produto.\n`
    prompt += `     • Uma categoria só está INDISPONÍVEL se "available" for exatamente 0, ou se a data inteira não aparecer no array.\n`
    prompt += `     • NUNCA diga "não há disponibilidade" se a função retornou a data com categorias >= 1.\n`
    prompt += `   - NÃO reformate o dia da semana — copie exatamente o valor de "weekday" retornado (ex: se retornou "Segunda", escreva "Segunda", nunca invente "Sábado").\n`
    prompt += `   - Se a agenda NÃO estiver configurada (agendaConfigured=false): aceite qualquer data que o cliente informar\n`
    prompt += `   - Se a data informada pelo cliente estiver DISPONÍVEL na lista: confirme dizendo "Temos disponibilidade para esse dia!" e pergunte o HORÁRIO de preferência (ex: "Qual horário você prefere?")\n`
    prompt += `   - Se a data informada pelo cliente NÃO estiver na lista: informe que aquela data não está disponível e mostre as datas disponíveis como alternativas\n`
    prompt += `   - Após confirmar a data e o horário, salve essa informação no campo "estimatedDeliveryDate" ao criar o pedido (formato: dd/mm/yyyy seguido do horário)\n`
    prompt += `   - Inclua a data e horário previstos no resumo do pedido\n\n`

    prompt += `### CONFIRMAÇÃO E CRIAÇÃO DO PEDIDO\n\n`
    prompt += `i) Apresente o resumo completo do pedido ANTES de criar. ATENÇÃO: você DEVE listar TODOS os itens que o cliente pediu durante a conversa, com os nomes reais dos produtos, quantidades e preços do catálogo. NÃO use placeholders como "[Itens e quantidades do pedido a serem listados]" ou "R$ ValorTotal". Calcule os valores reais.\n\n`
    prompt += `Formato obrigatório do resumo (preencha com os dados REAIS):\n\n`
    prompt += `---\n`
    prompt += `📋 *Resumo do Pedido*\n\n`
    prompt += `👤 *Cliente:* (nome real do cliente)\n`
    prompt += `📱 *Celular:* (celular real formatado)\n\n`
    prompt += `*Itens:*\n`
    prompt += `(liste CADA item que o cliente pediu, ex:)\n`
    prompt += `- 2x Bolo de Chocolate - R$ 120,00\n`
    prompt += `- 1x Brigadeiro (cento) - R$ 80,00\n\n`
    prompt += `💰 *Subtotal: R$ (soma dos itens)*\n`
    if (deliveryFees.length > 0) {
      prompt += `🚚 *Taxa de entrega: R$ (taxa conforme localidade)* (se for entrega)\n`
    }
    prompt += `💰 *Total: R$ (subtotal + taxa de entrega)*\n`
    if (hasReservation) {
      prompt += `💳 *Reserva (${reservationPercent}%): R$ (${reservationPercent}% do subtotal)*\n`
    }
    prompt += `\n📍 *Entrega:* (endereço real do cliente) OU *Retirada no local:* (endereço real da loja)\n`
    prompt += `📅 *Previsão de entrega:* (data e horário informado pelo cliente)\n\n`
    prompt += `Posso confirmar este pedido?\n`
    prompt += `---\n\n`

    prompt += `j) Após o cliente CONFIRMAR o resumo, use a função "criar_pedido" para gravar o pedido no sistema. Passe TODOS os dados:\n`
    prompt += `   - customerId: ID do cliente (obtido na busca/cadastro)\n`
    prompt += `   - customerName: nome do cliente\n`
    prompt += `   - customerPhone: celular com DDD\n`
    prompt += `   - deliveryType: "ENTREGA" ou "RETIRADA"\n`
    prompt += `   - deliveryAddress: endereço de entrega ou da loja\n`
    prompt += `   - estimatedDeliveryDate: data e horário previsto para entrega informado pelo cliente\n`
    prompt += `   - notes: observações (sabores, decoração, etc)\n`
    prompt += `   - items: lista com productName (nome EXATO do catálogo), quantity e price (preço unitário)\n\n`

    prompt += `k) Após o pedido ser criado com sucesso, mostre a confirmação com o número do pedido:\n\n`
    prompt += `---\n`
    prompt += `✅ *Pedido #(número retornado) Criado!*\n\n`
    prompt += `💰 *Total:* R$ (total)\n`
    if (hasReservation) {
      prompt += `💳 *Reserva (${reservationPercent}%):* R$ (reserva)\n\n`
      prompt += `Efetue o pagamento da reserva e envie o comprovante aqui.\n`
      prompt += `Assim que recebermos, vamos confirmar e iniciar a produção! 🎂\n`
    } else {
      prompt += `\nEfetue o pagamento total e envie o comprovante aqui.\n`
      prompt += `Assim que recebermos e o administrador confirmar, iniciaremos a produção! 🎂\n`
    }
    prompt += `---\n\n`

    prompt += `### RECEBIMENTO DO COMPROVANTE DE PAGAMENTO\n\n`
    prompt += `l) Quando o cliente enviar uma IMAGEM ou PDF de comprovante de pagamento (pix, transferência, depósito):\n`
    prompt += `   1. PRIMEIRO: Analise a imagem do comprovante e identifique o VALOR da transação (valor do PIX/transferência)\n`
    prompt += `   2. DEPOIS: Use a função "registrar_pagamento" passando o customerPhone E o proofAmount (valor identificado no comprovante)\n`
    prompt += `   - O sistema vai comparar automaticamente o valor do comprovante com o valor esperado da reserva\n`
    prompt += `   - Se o valor for DIVERGENTE, o sistema retornará uma mensagem para informar ao cliente que a equipe irá verificar\n`
    prompt += `   - Se o valor BATER, confirme que recebemos o comprovante normalmente\n`
    prompt += `   - O pedido será atualizado para status RESERVATION (aguardando verificação do administrador)\n`
    if (hasReservation) {
      prompt += `   - Se valor OK: "Recebemos o comprovante de pagamento da reserva do Pedido #(número)! 🎉 O administrador vai verificar o pagamento. Após a confirmação, iniciaremos a produção. Obrigado!"\n`
      prompt += `   - Se valor divergente: Use a mensagem retornada pelo sistema (sobre a equipe verificar)\n\n`
    } else {
      prompt += `   - Se valor OK: "Recebemos o comprovante de pagamento do Pedido #(número)! 🎉 O administrador vai verificar o pagamento e em breve iniciaremos a produção. Obrigado!"\n`
      prompt += `   - Se valor divergente: Use a mensagem retornada pelo sistema (sobre a equipe verificar)\n\n`
    }

    prompt += `### CONSULTA DE PEDIDO\n\n`
    prompt += `m) Quando o cliente perguntar sobre o status, valor, reserva ou qualquer dado de um pedido, use a função "consultar_pedido".\n`
    prompt += `   - Se o cliente INFORMAR O NÚMERO do pedido (ex: "pedido 9", "#00012", "meu pedido 15"), passe ESSE número em "orderNumber". NUNCA passe so customerPhone nesse caso — buscar apenas por telefone retorna o pedido MAIS RECENTE, nao o que o cliente mencionou.\n`
    prompt += `   - Se o cliente informar APENAS o telefone (sem numero do pedido), passe "customerPhone". Nesse caso, a funcao retorna o pedido mais recente — avise o cliente qual pedido voce encontrou e pergunte se e esse mesmo.\n`
    prompt += `   - Se não informar nenhum dos dois, peça o número do pedido ou o celular cadastrado\n`
    prompt += `   - Ao mostrar o pedido ao cliente, use SEMPRE o campo "orderNumberFormatted" retornado (ex: "Pedido #00009"). NUNCA use orderId (esse campo nao existe mais no retorno, era id interno do banco e causava confusao — mostrar "#27" em vez de "#00009" por exemplo).\n`
    prompt += `   - Apresente as informações do pedido de forma clara e organizada\n`
    prompt += `   - Inclua a data prevista de entrega na resposta se disponível\n\n`

    prompt += `IMPORTANTE:\n`
    prompt += `- Quando o cliente escolher uma categoria, responda SOMENTE com [MOSTRAR_PRODUTOS:NomeDaCategoria], sem nenhum texto antes ou depois (o sistema envia a lista em texto, sem fotos)\n`
    prompt += `- Quando o cliente pedir descrição/foto/detalhe de um produto OU escolher um produto, responda SOMENTE com [MOSTRAR_PRODUTO:NomeDoProduto] (no SINGULAR, sem o "S" do final). O sistema envia a foto + dados completos. Só depois pergunte a quantidade.\n`
    prompt += `- NUNCA reenvie uma lista ou foto que já foi enviada nesta conversa. Se o histórico mostrar "(Lista ... já foi enviada ...)" ou "(Foto ... já foi enviada ...)", o cliente JÁ viu. Em mensagens ambíguas ("ok", "?", "manda aí", etc.) NÃO emita [MOSTRAR_PRODUTOS:...], [MOSTRAR_PRODUTO:...] ou [MOSTRAR_COMBOS] de novo — pergunte qual produto e quantidade ele quer\n`
    prompt += `- SEMPRE peça o celular com DDD antes de fechar o pedido\n`
    prompt += `- SEMPRE busque o cliente na base antes de prosseguir\n`
    prompt += `- SEMPRE verifique o tipo de entrega disponível\n`
    prompt += `- SEMPRE pergunte a data desejada ao cliente PRIMEIRO, depois use "consultar_agenda" para verificar disponibilidade, e em seguida pergunte o horário\n`
    prompt += `- SEMPRE respeite a disponibilidade da agenda: não crie pedidos para datas lotadas ou não configuradas (se a agenda estiver ativa)\n`
    prompt += `- SEMPRE confirme os dados com o cliente antes de cadastrar\n`
    prompt += `- SEMPRE use a função "criar_pedido" para gravar o pedido após confirmação do cliente\n`
    prompt += `- SEMPRE use a função "registrar_pagamento" quando o cliente enviar comprovante, informando o valor identificado (proofAmount)\n`
    prompt += `- SEMPRE use a função "consultar_pedido" quando o cliente perguntar sobre status, valor ou dados de um pedido\n`
    prompt += `- Sempre use os preços exatos do catálogo acima\n`
    prompt += `- Calcule o total corretamente (quantidade x preço de cada item)\n`
    if (hasReservation) {
      prompt += `- A reserva é ${reservationPercent}% do subtotal dos itens\n`
    } else {
      prompt += `- Este estabelecimento NÃO trabalha com reserva. O pagamento é integral.\n`
    }
    if (deliveryFees.length > 0) {
      prompt += `- Inclua a taxa de entrega no resumo e no total do pedido quando for ENTREGA\n`
    }
    prompt += `- NUNCA use placeholders genéricos no resumo do pedido. Preencha com os dados REAIS do cliente e dos itens pedidos\n`
    prompt += `- Mantenha controle mental de TODOS os itens que o cliente pediu durante a conversa\n`
    prompt += `- Formate valores em Real brasileiro (R$ X.XXX,XX)\n`
    prompt += `- Formate celular como (XX) XXXXX-XXXX\n`
    prompt += `- Seja educado e prestativo\n`
    prompt += `- Não invente produtos que não estão no catálogo\n`

    return prompt.trim()
  }

  // Extrai porcentagem de reserva das instruções da categoria ORDERS (null se não houver)
  _extractReservationPercent(instructions) {
    const orderInstructions = instructions.filter((i) => i.category === 'ORDERS')
    for (const inst of orderInstructions) {
      const match = inst.content.match(/reserva[:\s]*(\d+)\s*%/i)
        || inst.content.match(/(\d+)\s*%\s*(?:de\s+)?reserva/i)
        || inst.content.match(/porcentagem[:\s]*(\d+)/i)
      if (match) return Number(match[1])
    }
    return null // sem reserva configurada
  }

  // Verifica se o sistema de reserva está habilitado nas instruções
  _hasReservation(instructions) {
    const orderInstructions = instructions.filter((i) => i.category === 'ORDERS')
    const content = orderInstructions.map(i => i.content).join(' ').toLowerCase()
    return content.includes('reserva') || content.includes('sinal')
  }

  // Extrai taxas de entrega por bairro/cidade das instruções ORDERS
  _extractDeliveryFees(instructions) {
    const orderInstructions = instructions.filter((i) => i.category === 'ORDERS')
    const fees = []
    for (const inst of orderInstructions) {
      // Padrões: "Bairro Centro: R$ 5,00" ou "Centro - R$ 5" ou "Centro: 5,00" ou "Centro = R$ 5,00"
      const lines = inst.content.split('\n')
      for (const line of lines) {
        const match = line.match(/(.+?)[\s]*[-:=][\s]*R?\$?\s*(\d+(?:[.,]\d{1,2})?)/i)
        if (match) {
          const location = match[1].trim().replace(/^[-•*]\s*/, '').trim()
          const value = Number(match[2].replace(',', '.'))
          // Ignora se a linha parece ser sobre reserva/porcentagem
          if (location.toLowerCase().includes('reserva') || location.toLowerCase().includes('porcentagem')) continue
          // Ignora se o valor parece ser porcentagem
          if (line.includes('%')) continue
          // Só adiciona se parecer um bairro/cidade (não muito longo)
          if (location.length > 0 && location.length < 60 && value > 0) {
            fees.push({ location: location.toLowerCase(), value })
          }
        }
      }
    }
    return fees
  }

  // Parseia string de data de entrega (ex: "25/03/2026 às 14h", "2026-03-25") para Date UTC
  _parseDeliveryDate(dateStr) {
    if (!dateStr) return null
    try {
      const currentYear = new Date().getFullYear()

      // Tenta formato dd/mm/yyyy
      const brMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
      if (brMatch) {
        let [, day, month, year] = brMatch
        year = Number(year)
        // Corrige ano passado (ex: IA manda 2023 em vez de 2026)
        if (year < currentYear) year = currentYear
        return new Date(Date.UTC(year, Number(month) - 1, Number(day)))
      }
      // Tenta formato yyyy-mm-dd
      const isoMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
      if (isoMatch) {
        let [, year, month, day] = isoMatch
        year = Number(year)
        if (year < currentYear) year = currentYear
        return new Date(Date.UTC(year, Number(month) - 1, Number(day)))
      }
      // Tenta formato dd/mm (sem ano - assume ano atual)
      const shortMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})/)
      if (shortMatch) {
        const [, day, month] = shortMatch
        return new Date(Date.UTC(currentYear, Number(month) - 1, Number(day)))
      }
      // Tenta extrair apenas o dia (ex: "dia 28", "Sábado dia 28")
      const dayMatch = dateStr.match(/dia\s+(\d{1,2})/i)
      if (dayMatch) {
        const day = Number(dayMatch[1])
        const now = new Date()
        let month = now.getUTCMonth()
        let year = now.getUTCFullYear()
        // Se o dia já passou neste mês, assume próximo mês
        if (day < now.getUTCDate()) {
          month += 1
          if (month > 11) { month = 0; year += 1 }
        }
        return new Date(Date.UTC(year, month, day))
      }
      return null
    } catch {
      return null
    }
  }

  // Busca taxa de entrega para um bairro/cidade específico
  _findDeliveryFee(fees, neighborhood, city) {
    if (!fees.length) return 0
    const nb = (neighborhood || '').toLowerCase().trim()
    const ct = (city || '').toLowerCase().trim()
    // Tenta encontrar por bairro
    for (const fee of fees) {
      if (nb && (nb.includes(fee.location) || fee.location.includes(nb))) return fee.value
    }
    // Tenta encontrar por cidade
    for (const fee of fees) {
      if (ct && (ct.includes(fee.location) || fee.location.includes(ct))) return fee.value
    }
    return 0
  }

  // Define manualmente a ultima imagem recebida (usado pelo simulador para
  // popular o cache que o registrar_pagamento le ao salvar o comprovante).
  // Em producao isso e' feito automaticamente no chatWithImage.
  setLastImage(remoteJid, dataUrl) {
    if (dataUrl) lastImageCache.set(remoteJid, dataUrl)
    else lastImageCache.delete(remoteJid)
  }

  // Limpa o histórico de uma conversa específica (usado pelo simulador)
  async resetConversation(remoteJid) {
    conversationCache.delete(remoteJid)
    if (isRedisReady()) {
      try { await redisClient.del(REDIS_KEY(remoteJid)) } catch { /* fallback silencioso */ }
    }
  }

  // Obtém contexto de conversa (array de messages). Redis primeiro, fallback Map.
  async getConversation(remoteJid) {
    if (isRedisReady()) {
      try {
        const raw = await redisClient.get(REDIS_KEY(remoteJid))
        if (raw) {
          // Renova TTL ao ler (atividade recente)
          await redisClient.expire(REDIS_KEY(remoteJid), CONVERSATION_TTL_SEC)
          return JSON.parse(raw)
        }
        return []
      } catch { /* cai para fallback */ }
    }
    const existing = conversationCache.get(remoteJid)
    if (existing && Date.now() - existing.lastActivity < CONVERSATION_TTL) {
      existing.lastActivity = Date.now()
      return existing.messages
    }
    conversationCache.set(remoteJid, { messages: [], lastActivity: Date.now() })
    return []
  }

  // Persiste o array de mensagens (trunca em MAX_MESSAGES)
  async _saveConversation(remoteJid, messages) {
    const trimmed = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages
    if (isRedisReady()) {
      try {
        await redisClient.set(REDIS_KEY(remoteJid), JSON.stringify(trimmed), 'EX', CONVERSATION_TTL_SEC)
        return
      } catch { /* fallback */ }
    }
    conversationCache.set(remoteJid, { messages: trimmed, lastActivity: Date.now() })
  }

  // Adiciona mensagem ao contexto
  async addMessage(remoteJid, role, content) {
    const conv = await this.getConversation(remoteJid)
    conv.push({ role, content })
    await this._saveConversation(remoteJid, conv)
  }

  // Adiciona mensagem de tool call ao contexto
  async addToolMessages(remoteJid, assistantMessage, toolResults) {
    const conv = await this.getConversation(remoteJid)
    conv.push(assistantMessage)
    for (const result of toolResults) {
      conv.push(result)
    }
    await this._saveConversation(remoteJid, conv)
  }

  // Limpa conversas expiradas do fallback em memoria
  // (Redis expira automaticamente via TTL, nao precisa)
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
    this._lastUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
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

      // Acumula tokens para tracking
      if (completion.usage) {
        this._lastUsage = this._lastUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        this._lastUsage.prompt_tokens += completion.usage.prompt_tokens || 0
        this._lastUsage.completion_tokens += completion.usage.completion_tokens || 0
        this._lastUsage.total_tokens += completion.usage.total_tokens || 0
      }

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
      await this.addToolMessages(remoteJid, assistantMessage, toolResults)

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

  // Processa comandos especiais na resposta do GPT e retorna { reply, handled, historyReply }
  // historyReply: o que deve ser persistido no historico do assistente.
  //   Quando o marker e' detectado, salvamos uma nota em linguagem natural
  //   (sem colchetes) para que (a) o modelo nao re-emita o marker no proximo
  //   turno por imitacao, e (b) se o modelo copiar a nota como texto, ela seja
  //   factual e nao quebre a UX.
  async processCommands(reply, userId, instanceName, remoteJid) {
    if (!instanceName) return { reply, handled: false, historyReply: reply }

    // Comando: detalhe de UM produto (foto + nome + preco + min/max + descricao)
    // Checado ANTES do plural para evitar ambiguidade na ordem (regexes nao
    // colidem porque "_PRODUTO:" e "_PRODUTOS:" sao distintos, mas seguranca extra).
    const productDetailMatch = reply.match(/\[MOSTRAR_PRODUTO:(.+?)\]/)
    if (productDetailMatch) {
      const productName = productDetailMatch[1].trim()
      await this.sendProductDetail(userId, instanceName, remoteJid, productName)
      return {
        reply: `[Detalhe do produto "${productName}" enviado ao cliente]`,
        handled: true,
        historyReply: `(Foto e descrição completa do produto "${productName}" já foram enviadas ao cliente. Aguardo a quantidade — NÃO reenviar.)`,
      }
    }

    // Comando: mostrar lista (texto) de produtos de uma categoria
    const productMatch = reply.match(/\[MOSTRAR_PRODUTOS:(.+?)\]/)
    if (productMatch) {
      const categoryName = productMatch[1].trim()
      await this.sendProductImages(userId, instanceName, remoteJid, categoryName)
      return {
        reply: `[Lista de produtos de ${categoryName} enviada ao cliente]`,
        handled: true,
        historyReply: `(Lista (em texto, sem fotos) da categoria "${categoryName}" já foi enviada ao cliente, com nome e preço de cada produto. Se o cliente pedir descrição/foto de algum, emita [MOSTRAR_PRODUTO:NomeDoProduto]. NÃO reenviar esta lista.)`,
      }
    }

    // Comando: mostrar combos
    if (reply.includes('[MOSTRAR_COMBOS]')) {
      await this.sendComboImages(userId, instanceName, remoteJid)
      return {
        reply: '[Imagens dos combos enviadas ao cliente]',
        handled: true,
        historyReply: '(Catálogo de combos/promoções já foi enviado ao cliente em fotos. Agora aguardo a escolha — NÃO reenviar.)',
      }
    }

    // Comando: mostrar foto de exemplo de um adicional
    const additionalMatch = reply.match(/\[MOSTRAR_ADICIONAL:(.+?)\]/)
    if (additionalMatch) {
      const additionalName = additionalMatch[1].trim()
      await this.sendAdditionalImage(userId, instanceName, remoteJid, additionalName)
      return {
        reply: `[Foto do adicional "${additionalName}" enviada ao cliente]`,
        handled: true,
        historyReply: `(Foto do adicional "${additionalName}" já foi enviada ao cliente — NÃO reenviar.)`,
      }
    }

    // Comando: enviar anexo de instrução (pode ter texto junto)
    const attachmentMatches = reply.matchAll(/\[ENVIAR_ANEXO:(\d+)\]/g)
    let hasAttachment = false
    let textReply = reply
    const attachmentIds = []

    for (const match of attachmentMatches) {
      hasAttachment = true
      const instructionId = match[1]
      attachmentIds.push(instructionId)
      textReply = textReply.replace(match[0], '').trim()
      await this.sendAttachment(userId, instanceName, remoteJid, instructionId)
    }

    if (hasAttachment) {
      const note = `(Anexo${attachmentIds.length > 1 ? 's' : ''} já enviado${attachmentIds.length > 1 ? 's' : ''} ao cliente — NÃO reenviar.)`
      if (textReply) {
        return { reply: textReply, handled: false, historyReply: `${textReply}\n${note}` }
      }
      return { reply: '[Anexo enviado ao cliente]', handled: true, historyReply: note }
    }

    return { reply, handled: false, historyReply: reply }
  }

  // Processa mensagem e retorna resposta da OpenAI
  async chat(userId, remoteJid, userMessage, instanceName = null) {
    this._currentRemoteJid = remoteJid
    this._currentInstanceName = instanceName
    const systemPrompt = await this.buildSystemPrompt(userId)

    await this.addMessage(remoteJid, 'user', userMessage)

    const history = await this.getConversation(remoteJid)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
    ]

    const rawReply = await this.processWithTools(messages, userId, remoteJid, instanceName)

    const { reply: processedReply, handled, historyReply } = await this.processCommands(rawReply, userId, instanceName, remoteJid)

    // Persiste no historico a versao "history-friendly": markers como
    // [MOSTRAR_PRODUTOS:X] sao trocados por uma nota em linguagem natural
    // para que o modelo nao re-emita o marker em turnos seguintes (loop) nem
    // copie um placeholder estranho para o cliente.
    await this.addMessage(remoteJid, 'assistant', historyReply || rawReply)
    this.clearExpired()

    return handled ? null : processedReply
  }

  // Processa mensagem com imagem (multimodal)
  async chatWithImage(userId, remoteJid, userMessage, imageUrl, instanceName = null) {
    this._currentRemoteJid = remoteJid
    this._currentInstanceName = instanceName
    // Salva a imagem no cache para uso em registrar_pagamento (comprovante)
    lastImageCache.set(remoteJid, imageUrl)
    const systemPrompt = await this.buildSystemPrompt(userId)

    const content = []
    if (userMessage) {
      content.push({ type: 'text', text: userMessage })
    }
    content.push({ type: 'image_url', image_url: { url: imageUrl } })

    await this.addMessage(remoteJid, 'user', content)

    const history = await this.getConversation(remoteJid)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
    ]

    const rawReply = await this.processWithTools(messages, userId, remoteJid, instanceName)

    const { reply: processedReply, handled, historyReply } = await this.processCommands(rawReply, userId, instanceName, remoteJid)

    // Markers no historico viram nota em linguagem natural (mesma logica do chat).
    await this.addMessage(remoteJid, 'assistant', historyReply || rawReply)
    this.clearExpired()

    return handled ? null : processedReply
  }
}
