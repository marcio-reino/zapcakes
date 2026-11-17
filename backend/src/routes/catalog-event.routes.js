import { CatalogEventController } from '../controllers/catalog-event.controller.js'

export async function catalogEventRoutes(app) {
  const controller = new CatalogEventController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.list)
  app.post('/', controller.create)
  app.put('/:id', controller.update)
  app.delete('/:id', controller.delete)
}
