import { OrderController } from '../controllers/order.controller.js'

export async function orderRoutes(app) {
  const controller = new OrderController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.list)
  app.post('/', controller.create)
  app.get('/:id', controller.getById)
  app.put('/:id/status', controller.updateStatus)
  app.put('/:id/verify-proof', controller.verifyProof)
  app.put('/:id/confirm-payment', controller.confirmPayment)
  app.put('/:id/cancel', controller.cancelOrder)
}
