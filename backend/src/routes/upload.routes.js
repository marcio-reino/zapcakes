import { UploadService } from '../services/upload.service.js'
import { AccountService } from '../services/account.service.js'
import prisma from '../config/database.js'

export async function uploadRoutes(app) {
  app.addHook('onRequest', app.authenticate)

  app.post('/', async (request, reply) => {
    const file = await request.file()

    if (!file) {
      return reply.status(400).send({ error: 'Nenhum arquivo enviado' })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.mimetype)) {
      return reply.status(400).send({ error: 'Tipo de arquivo não permitido. Use: JPEG, PNG, WebP ou GIF' })
    }

    const account = await prisma.account.findUnique({ where: { userId: request.user.id } })
    if (!account) {
      return reply.status(400).send({ error: 'Conta não encontrada' })
    }

    const subfolder = request.query.folder || 'uploads'
    const folder = AccountService.getUploadFolder(account.id, subfolder)
    const result = await UploadService.uploadFile(file, folder)
    return reply.status(201).send(result)
  })

  app.delete('/', async (request, reply) => {
    const { key } = request.body

    if (!key) {
      return reply.status(400).send({ error: 'Key do arquivo é obrigatória' })
    }

    await UploadService.deleteFile(key)
    return { message: 'Arquivo removido com sucesso' }
  })
}
