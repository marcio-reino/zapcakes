import { AuthController } from '../controllers/auth.controller.js'

export async function authRoutes(app) {
  const controller = new AuthController()

  app.post('/login', controller.login)
  app.post('/register', controller.register)
  app.get('/me', { onRequest: [app.authenticate] }, controller.me)
}
