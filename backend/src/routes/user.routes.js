import { UserController } from '../controllers/user.controller.js'

export async function userRoutes(app) {
  const controller = new UserController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', { onRequest: [app.isAdmin] }, controller.list)
  app.post('/', { onRequest: [app.isAdmin] }, controller.create)
  app.get('/:id', controller.getById)
  app.put('/:id', controller.update)
  app.delete('/:id', { onRequest: [app.isAdmin] }, controller.delete)
}
