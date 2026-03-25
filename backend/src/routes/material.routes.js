import { MaterialController } from '../controllers/material.controller.js'

export async function materialRoutes(app) {
  const controller = new MaterialController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.list)
  app.post('/', controller.create)
  app.put('/:id', controller.update)
  app.put('/:id/stock', controller.updateStock)
  app.post('/stock-from-list', controller.stockFromShoppingList)
  app.post('/stock-revert-list', controller.revertStockFromShoppingList)
  app.get('/:id/stock-history', controller.stockHistory)
  app.delete('/:id', controller.delete)
}
