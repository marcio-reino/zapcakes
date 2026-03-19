import { EvoAgentController } from '../controllers/evo-agent.controller.js'

export async function evoAgentRoutes(app) {
  const controller = new EvoAgentController()

  app.addHook('onRequest', app.authenticate)

  app.get('/status', controller.status)
  app.post('/whatsapp/connect', controller.connectWhatsApp)
  app.post('/whatsapp/disconnect', controller.disconnectWhatsApp)
}
