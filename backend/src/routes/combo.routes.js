import { ComboController } from '../controllers/combo.controller.js'

export async function comboRoutes(app) {
  const controller = new ComboController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.list)
  app.post('/', controller.create)
  app.get('/:id', controller.getById)
  app.put('/:id', controller.update)
  app.delete('/:id', controller.delete)
}
