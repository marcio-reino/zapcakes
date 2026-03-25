import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'

import { authRoutes } from './routes/auth.routes.js'
import { userRoutes } from './routes/user.routes.js'
import { instanceRoutes } from './routes/instance.routes.js'
import { chatbotRoutes } from './routes/chatbot.routes.js'
import { productRoutes } from './routes/product.routes.js'
import { categoryRoutes } from './routes/category.routes.js'
import { orderRoutes } from './routes/order.routes.js'
import { webhookRoutes } from './routes/webhook.routes.js'
import { comboRoutes } from './routes/combo.routes.js'
import { uploadRoutes } from './routes/upload.routes.js'
import { agentInstructionRoutes } from './routes/agent-instruction.routes.js'
import { evoAgentRoutes } from './routes/evo-agent.routes.js'
import { customerRoutes } from './routes/customer.routes.js'
import { agendaRoutes } from './routes/agenda.routes.js'
import { companyRoutes } from './routes/company.routes.js'
import { materialRoutes } from './routes/material.routes.js'
import { shoppingListRoutes } from './routes/shopping-list.routes.js'
import { recipeRoutes } from './routes/recipe.routes.js'
import { dashboardRoutes } from './routes/dashboard.routes.js'
import { superadminRoutes } from './routes/superadmin.routes.js'
import { storeRoutes } from './routes/store.routes.js'
import { ensureBucketPublicRead } from './config/s3.js'

const app = Fastify({ logger: true, bodyLimit: 20 * 1024 * 1024 })

// Plugins
await app.register(cors, { origin: true })
await app.register(jwt, { secret: process.env.JWT_SECRET })
await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } })

// Decorator de autenticação
app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Token inválido ou expirado' })
  }
})

// Decorator de verificação de admin (ADMIN ou SUPERADMIN)
app.decorate('isAdmin', async (request, reply) => {
  if (request.user.role !== 'ADMIN' && request.user.role !== 'SUPERADMIN') {
    reply.status(403).send({ error: 'Acesso negado. Apenas administradores.' })
  }
})

// Decorator de autenticação de customer (loja pública)
app.decorate('authenticateCustomer', async (request, reply) => {
  try {
    await request.jwtVerify()
    if (request.user.type !== 'customer') {
      return reply.status(401).send({ error: 'Token inválido' })
    }
    request.customer = { customerId: request.user.customerId, userId: request.user.userId }
  } catch (err) {
    reply.status(401).send({ error: 'Token inválido ou expirado' })
  }
})

// Rotas
await app.register(authRoutes, { prefix: '/api/auth' })
await app.register(userRoutes, { prefix: '/api/users' })
await app.register(instanceRoutes, { prefix: '/api/instances' })
await app.register(chatbotRoutes, { prefix: '/api/chatbots' })
await app.register(productRoutes, { prefix: '/api/products' })
await app.register(categoryRoutes, { prefix: '/api/categories' })
await app.register(orderRoutes, { prefix: '/api/orders' })
await app.register(comboRoutes, { prefix: '/api/combos' })
await app.register(webhookRoutes, { prefix: '/api/webhooks' })
await app.register(uploadRoutes, { prefix: '/api/uploads' })
await app.register(agentInstructionRoutes, { prefix: '/api/agent-instructions' })
await app.register(evoAgentRoutes, { prefix: '/api/evo-agent' })
await app.register(customerRoutes, { prefix: '/api/customers' })
await app.register(agendaRoutes, { prefix: '/api/agenda' })
await app.register(companyRoutes, { prefix: '/api/company' })
await app.register(materialRoutes, { prefix: '/api/materials' })
await app.register(shoppingListRoutes, { prefix: '/api/shopping-lists' })
await app.register(recipeRoutes, { prefix: '/api/recipes' })
await app.register(dashboardRoutes, { prefix: '/api/dashboard' })
await app.register(superadminRoutes, { prefix: '/api/superadmin' })
await app.register(storeRoutes, { prefix: '/api/store' })

// Versão e health check
const VERSION = '1.7.0'
app.get('/', async () => ({ name: 'ZapCakes API', version: VERSION }))
app.get('/api/health', async () => ({ status: 'ok', version: VERSION, timestamp: new Date().toISOString() }))

// Rotas públicas — dados para o site
import prisma from './config/database.js'

app.get('/api/public/site-config', async () => {
  const configs = await prisma.systemConfig.findMany({
    where: { key: { in: ['company_phone', 'company_email', 'site_confeitarias', 'site_pedidos', 'site_satisfacao'] } },
  })
  const result = {}
  for (const c of configs) result[c.key] = c.value
  return result
})

app.get('/api/public/plans', async () => {
  const plans = await prisma.plan.findMany({
    where: { active: true },
    select: { id: true, title: true, description: true, price: true, features: true, trialDays: true, popular: true },
    orderBy: { price: 'asc' },
  })
  return plans
})

// Start
const start = async () => {
  try {
    const port = process.env.PORT || 3333
    const host = process.env.HOST || '0.0.0.0'
    await ensureBucketPublicRead()
    await app.listen({ port: Number(port), host })
    console.log(`Server running on http://${host}:${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
