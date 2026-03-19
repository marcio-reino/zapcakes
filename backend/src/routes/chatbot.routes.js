import { ChatbotController } from '../controllers/chatbot.controller.js'

export async function chatbotRoutes(app) {
  const controller = new ChatbotController()

  app.addHook('onRequest', app.authenticate)

  app.get('/instance/:instanceId', controller.getByInstance)
  app.post('/', controller.create)
  app.put('/:id', controller.update)
}
