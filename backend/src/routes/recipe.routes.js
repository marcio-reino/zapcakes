import { RecipeController } from '../controllers/recipe.controller.js'

export async function recipeRoutes(app) {
  const controller = new RecipeController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.list)
  app.post('/', controller.create)
  app.get('/:id', controller.getById)
  app.put('/:id', controller.update)
  app.delete('/:id', controller.delete)
}
