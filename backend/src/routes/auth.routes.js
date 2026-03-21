import { AuthController } from '../controllers/auth.controller.js'

export async function authRoutes(app) {
  const controller = new AuthController()

  app.post('/login', controller.login)
  app.post('/register', controller.register)
  app.post('/verify-code', controller.verifyCode)
  app.post('/resend-code', controller.resendCode)
  app.post('/forgot-password', controller.forgotPassword)
  app.post('/reset-password', controller.resetPassword)
  app.get('/me', { onRequest: [app.authenticate] }, controller.me)
}
