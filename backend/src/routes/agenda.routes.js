import { AgendaController } from '../controllers/agenda.controller.js'

export async function agendaRoutes(app) {
  const controller = new AgendaController()

  // Rota pública (usada pelo agente IA)
  app.get('/availability', controller.availability)

  // Rotas autenticadas
  app.register(async (authenticated) => {
    authenticated.addHook('onRequest', app.authenticate)

    authenticated.get('/', controller.list)
    authenticated.post('/', controller.upsert)
    authenticated.post('/bulk', controller.bulkUpsert)
    authenticated.delete('/:id', controller.remove)
  })
}
