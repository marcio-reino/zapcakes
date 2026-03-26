import openai from '../config/openai.js'
import prisma from '../config/database.js'
import evolutionApi from '../config/evolution.js'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import s3Client, { S3_BUCKET } from '../config/s3.js'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

// Normaliza telefone: remove não-dígitos e prefixo 55 se necessário
function normalizePhone(p) {
  const digits = (p || '').replace(/\D/g, '')
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
}

// Cache de conversas em memória (remoteJid -> messages[])
const conversationCache = new Map()
const CONVERSATION_TTL = 30 * 60 * 1000 // 30 minutos

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
      description: 'Consulta dados de um pedido pelo número do pedido ou pelo telefone do cliente. Use quando o cliente perguntar sobre status, valor, reserva ou qualquer informação do pedido.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'number', description: 'Número do pedido (ex: 123)' },
          customerPhone: { type: 'string', description: 'Celular do cliente com DDD, apenas números (ex: 22998524209)' },
        },
        required: [],
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
    catalog += 'Se o cliente escolher Combos/Promoções, responda APENAS com o comando:\n'
    catalog += '[MOSTRAR_COMBOS]\n\n'
    catalog += 'O sistema vai enviar automaticamente as imagens dos produtos/combos com preços.\n'
    catalog += 'Após enviar as imagens, pergunte qual produto o cliente deseja e a quantidade.\n\n'

    catalog += 'Lista completa de categorias e produtos (para referência de preços):\n\n'
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

          const itemsTotal = args.items.reduce((sum, item) => sum + item.quantity * item.price, 0)

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

          const total = itemsTotal + deliveryFee

          // Reserva condicional - só se configurada nas instruções
          const hasRes = this._hasReservation(orderInstructions)
          const resPercent = hasRes ? (this._extractReservationPercent(orderInstructions) || 30) : null
          const reservation = resPercent ? Math.round(itemsTotal * (resPercent / 100) * 100) / 100 : null

          // Busca IDs dos produtos pelo nome
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
              orderItems.push({
                productId: product.id,
                quantity: item.quantity,
                price: item.price,
              })
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
                create: orderItems,
              },
            },
            include: { items: { include: { product: true } } },
          })

          // Incrementa contador na agenda se a data prevista existe
          if (args.estimatedDeliveryDate) {
            const parsedDate = this._parseDeliveryDate(args.estimatedDeliveryDate)
            if (parsedDate) {
              await prisma.agendaSlot.updateMany({
                where: { userId, date: parsedDate, active: true },
                data: { currentOrders: { increment: 1 } },
              })
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
          if (args.orderId) {
            order = await prisma.order.findFirst({
              where: { id: args.orderId, userId },
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

          return JSON.stringify({
            found: true,
            orderId: order.id,
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
          })
        } catch (err) {
          console.error('Erro ao consultar pedido:', err.message)
          return JSON.stringify({ found: false, message: 'Erro ao consultar pedido.' })
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
          const dates = available.map(s => {
            const d = new Date(s.date)
            const day = String(d.getUTCDate()).padStart(2, '0')
            const month = String(d.getUTCMonth() + 1).padStart(2, '0')
            const weekday = WEEKDAYS[d.getUTCDay()]
            return `${day}/${month} (${weekday})`
          })

          return JSON.stringify({
            agendaConfigured: true,
            available: true,
            dates,
            message: `Datas disponíveis para entrega/retirada:\n${dates.join('\n')}`,
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

    // Extrai configurações de reserva e taxa de entrega das instruções
    const hasReservation = this._hasReservation(instructions)
    const reservationPercent = hasReservation ? (this._extractReservationPercent(instructions) || 30) : null

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
    prompt += `2. Quando ele escolher a categoria, responda APENAS com o comando [MOSTRAR_PRODUTOS:NomeDaCategoria] - o sistema vai enviar as fotos dos produtos automaticamente\n`
    prompt += `3. Após as imagens serem enviadas, pergunte qual produto deseja e a quantidade\n`
    prompt += `4. Quando o cliente escolher um produto e quantidade, CONFIRME o item adicionado (ex: "Adicionei 2x Bolo de Chocolate - R$ 120,00")\n`
    prompt += `   - Se o produto tiver a marcação "📷 Aceita imagens de inspiração" no catálogo, pergunte ao cliente: "Você gostaria de enviar imagens de inspiração/referência para esse produto? (fotos do tema, decoração, etc)". Se o cliente quiser enviar, peça as imagens (respeitando o máximo indicado no catálogo). Se não quiser, siga normalmente.\n`
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

    prompt += `### VERIFICAÇÃO DE ENTREGA\n\n`
    prompt += `e) Use a função "verificar_entrega" para checar os tipos de entrega disponíveis\n`
    prompt += `f) Se só tiver RETIRADA no local:\n`
    prompt += `   - Informe o endereço da loja e diga que o pedido será para retirada\n`
    prompt += `g) Se tiver ENTREGA disponível:\n`
    prompt += `   - Pergunte se prefere entrega ou retirada\n`
    prompt += `   - Se entrega, use o endereço cadastrado do cliente\n`
    prompt += `   - Se retirada, informe o endereço da loja\n`

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
    prompt += `   - A função "consultar_agenda" retorna uma lista de datas com vagas. Para verificar disponibilidade, basta checar se o DIA informado pelo cliente está presente nessa lista.\n`
    prompt += `   - Exemplo: se o cliente diz "dia 28" e a agenda retorna ["26/03 (Quinta)", "27/03 (Sexta)", "28/03 (Sábado)"], então 28/03 ESTÁ disponível. Confirme!\n`
    prompt += `   - IMPORTANTE: NÃO diga que a data está indisponível se ela aparece na lista retornada pela função. Confie no resultado da função.\n`
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
    prompt += `   - O cliente pode fornecer o número do pedido e/ou o número de celular\n`
    prompt += `   - Se o cliente informar o número do pedido, passe "orderId"\n`
    prompt += `   - Se informar o telefone, passe "customerPhone"\n`
    prompt += `   - Se não informar nenhum dos dois, peça o número do pedido ou o celular cadastrado\n`
    prompt += `   - Apresente as informações do pedido de forma clara e organizada\n`
    prompt += `   - Inclua a data prevista de entrega na resposta se disponível\n\n`

    prompt += `IMPORTANTE:\n`
    prompt += `- Quando o cliente escolher uma categoria, responda SOMENTE com [MOSTRAR_PRODUTOS:NomeDaCategoria], sem nenhum texto antes ou depois\n`
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
      // Tenta formato dd/mm/yyyy
      const brMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
      if (brMatch) {
        const [, day, month, year] = brMatch
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
      }
      // Tenta formato yyyy-mm-dd
      const isoMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
      if (isoMatch) {
        const [, year, month, day] = isoMatch
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
      }
      // Tenta formato dd/mm (sem ano - assume ano atual)
      const shortMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})/)
      if (shortMatch) {
        const [, day, month] = shortMatch
        const year = new Date().getFullYear()
        return new Date(Date.UTC(year, Number(month) - 1, Number(day)))
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

    // Comando: mostrar combos
    if (reply.includes('[MOSTRAR_COMBOS]')) {
      await this.sendComboImages(userId, instanceName, remoteJid)
      return { reply: '[Imagens dos combos enviadas ao cliente]', handled: true }
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
    this._currentRemoteJid = remoteJid
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
    this._currentRemoteJid = remoteJid
    // Salva a imagem no cache para uso em registrar_pagamento (comprovante)
    lastImageCache.set(remoteJid, imageUrl)
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
