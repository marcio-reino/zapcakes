import { ProductController } from '../controllers/product.controller.js'

export async function productRoutes(app) {
  const controller = new ProductController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.list)
  app.post('/', controller.create)
  app.get('/:id', controller.getById)
  app.put('/:id', controller.update)
  app.delete('/:id', controller.delete)
}
