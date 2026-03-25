import { DashboardController } from '../controllers/dashboard.controller.js'

export async function dashboardRoutes(app) {
  const controller = new DashboardController()

  app.addHook('onRequest', app.authenticate)

  app.get('/chart', controller.chart)
}
