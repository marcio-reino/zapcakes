import { StoreController } from '../controllers/store.controller.js'

export async function storeRoutes(app) {
  const controller = new StoreController()

  // Públicos (sem auth)
  app.get('/:slug', controller.getStore)
  app.get('/:slug/categories', controller.getCategories)
  app.get('/:slug/products', controller.getProducts)
  app.get('/:slug/combos', controller.getCombos)
  app.get('/:slug/availability', controller.getAvailability)
  app.get('/:slug/delivery-zones', controller.getDeliveryZones)
  app.post('/:slug/customer/login', controller.customerLogin)
  app.post('/:slug/customer/register', controller.customerRegister)

  // Requer auth de customer
  app.get('/:slug/customer/me', { preHandler: [app.authenticateCustomer] }, controller.customerMe)
  app.put('/:slug/customer/me', { preHandler: [app.authenticateCustomer] }, controller.customerUpdateProfile)
  app.put('/:slug/customer/password', { preHandler: [app.authenticateCustomer] }, controller.customerChangePassword)
  app.post('/:slug/orders', { preHandler: [app.authenticateCustomer] }, controller.createOrder)
  app.get('/:slug/customer/orders', { preHandler: [app.authenticateCustomer] }, controller.listMyOrders)
  app.post('/:slug/upload', { preHandler: [app.authenticateCustomer] }, controller.uploadInspirationImage)
  app.post('/:slug/validate-images', { preHandler: [app.authenticateCustomer] }, controller.validateInspirationImages)
  app.post('/:slug/orders/:orderId/payment-proof', { preHandler: [app.authenticateCustomer] }, controller.uploadPaymentProof)
}
