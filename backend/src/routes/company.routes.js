import { CompanyController } from '../controllers/company.controller.js'

export async function companyRoutes(app) {
  const controller = new CompanyController()

  app.addHook('onRequest', app.authenticate)

  app.get('/', controller.get)
  app.put('/', controller.update)
}
