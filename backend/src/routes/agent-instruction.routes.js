import { AgentInstructionController } from '../controllers/agent-instruction.controller.js'

export async function agentInstructionRoutes(app) {
  const controller = new AgentInstructionController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.list)
  app.post('/', controller.create)
  app.get('/:id', controller.getById)
  app.put('/:id', controller.update)
  app.delete('/:id', controller.delete)
}
