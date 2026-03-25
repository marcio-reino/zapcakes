import { ShoppingListController } from '../controllers/shopping-list.controller.js'

export async function shoppingListRoutes(app) {
  const controller = new ShoppingListController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.list)
  app.post('/', controller.create)
  app.get('/:id', controller.getById)
  app.put('/:id', controller.update)
  app.delete('/:id', controller.delete)
  app.post('/:id/duplicate', controller.duplicate)

  // Itens
  app.post('/:id/items', controller.addItem)
  app.post('/:id/items/batch', controller.addItems)
  app.put('/:id/items/:itemId', controller.updateItem)
  app.delete('/:id/items/:itemId', controller.removeItem)
}
