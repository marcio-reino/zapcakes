import { AdditionalController } from '../controllers/additional.controller.js'

export async function additionalRoutes(app) {
  const controller = new AdditionalController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.list.bind(controller))
  app.post('/', controller.create.bind(controller))
  app.put('/:id', controller.update.bind(controller))
  app.delete('/:id', controller.delete.bind(controller))
}
