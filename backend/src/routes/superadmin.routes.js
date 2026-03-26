import { SuperadminController } from '../controllers/superadmin.controller.js'

export async function superadminRoutes(app) {
  const controller = new SuperadminController()

  // Todas as rotas requerem autenticação + SUPERADMIN
  app.addHook('onRequest', app.authenticate)
  app.addHook('onRequest', async (request, reply) => {
    if (request.user.role !== 'SUPERADMIN') {
      return reply.status(403).send({ error: 'Acesso negado. Apenas superadmin.' })
    }
  })

  // Dashboard
  app.get('/stats', controller.stats)

  // Contas de clientes
  app.get('/accounts', controller.listAccounts)
  app.get('/accounts/:id', controller.getAccount)
  app.put('/accounts/:id', controller.updateAccount)

  // Planos
  app.get('/plans', controller.listPlans)
  app.post('/plans', controller.createPlan)
  app.put('/plans/:id', controller.updatePlan)
  app.delete('/plans/:id', controller.deletePlan)

  // Serviços
  app.post('/instances/:instanceId/disconnect', controller.disconnectInstance)

  // Financeiro
  app.post('/billings/generate', controller.generateBillings)
  app.get('/billings', controller.listPayments)
  app.put('/billings/:id/confirm', controller.confirmPayment)
  app.put('/billings/:id/cancel', controller.cancelPayment)
  app.put('/billings/:id/revert', controller.revertPayment)

  // Relatório do cliente
  app.get('/accounts/:id/report', controller.clientReport)

  // Notificações
  app.post('/notifications/send', controller.sendNotification)
  app.get('/notifications', controller.listNotifications)

  // WhatsApp do Sistema
  app.get('/whatsapp/status', controller.getWhatsappStatus)
  app.post('/whatsapp/connect', controller.connectWhatsapp)
  app.post('/whatsapp/disconnect', controller.disconnectWhatsapp)

  // IA / OpenAI
  app.get('/ai/status', controller.aiStatus)

  // Analytics do site
  app.get('/site-analytics', controller.siteAnalytics)

  // Config
  app.get('/config', controller.getConfig)
  app.put('/config', controller.updateConfig)
}
