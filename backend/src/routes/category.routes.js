import { CategoryController } from '../controllers/category.controller.js'

export async function categoryRoutes(app) {
  const controller = new CategoryController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.list)
  app.post('/', controller.create)
  app.put('/:id', controller.update)
  app.delete('/:id', controller.delete)
}
