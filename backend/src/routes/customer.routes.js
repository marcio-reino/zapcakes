import { CustomerController } from '../controllers/customer.controller.js'

export async function customerRoutes(app) {
  const controller = new CustomerController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.list)
  app.get('/:id', controller.getById)
  app.post('/', controller.create)
  app.put('/:id', controller.update)
  app.delete('/:id', controller.delete)
}
