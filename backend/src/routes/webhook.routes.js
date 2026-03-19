import { WebhookController } from '../controllers/webhook.controller.js'

export async function webhookRoutes(app) {
  const controller = new WebhookController()

  // Webhook global da Evolution API (WEBHOOK_GLOBAL_URL)
  app.post('/evolution', controller.handleEvolutionGlobal.bind(controller))

  // Webhook por instância (fallback)
  app.post('/evolution/:instanceName', controller.handleEvolution.bind(controller))
}
