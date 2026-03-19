import { InstanceController } from '../controllers/instance.controller.js'

export async function instanceRoutes(app) {
  const controller = new InstanceController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.list)
  app.post('/', controller.create)
  app.get('/:id', controller.getById)
  app.delete('/:id', controller.delete)
  app.post('/:id/connect', controller.connect)
  app.get('/:id/qrcode', controller.getQrCode)
  app.post('/:id/disconnect', controller.disconnect)
  app.get('/:id/status', controller.getStatus)
}
