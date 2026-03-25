import { CompanyController } from '../controllers/company.controller.js'

export async function companyRoutes(app) {
  const controller = new CompanyController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.get)
  app.put('/', controller.update)
  app.get('/store', controller.getStoreSettings)
  app.put('/store', controller.updateStoreSettings)
  app.get('/payments', controller.payments)
  app.get('/pending-payment', controller.pendingPayment)
  app.put('/payments/:id/proof', controller.attachProof)
  app.get('/delivery-zones', controller.listDeliveryZones)
  app.post('/delivery-zones', controller.createDeliveryZone)
  app.put('/delivery-zones/:id', controller.updateDeliveryZone)
  app.delete('/delivery-zones/:id', controller.deleteDeliveryZone)
}
