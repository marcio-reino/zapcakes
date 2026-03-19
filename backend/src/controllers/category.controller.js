import prisma from '../config/database.js'

export class CategoryController {
  async list(request, reply) {
    const categories = await prisma.category.findMany({
      where: { userId: request.user.id },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    })
    return categories
  }

  async create(request, reply) {
    const { name } = request.body
    const category = await prisma.category.create({
      data: { name, userId: request.user.id },
    })
    return reply.status(201).send(category)
  }

  async update(request, reply) {
    const { id } = request.params
    const { name, active } = request.body

    const category = await prisma.category.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!category) {
      return reply.status(404).send({ error: 'Categoria não encontrada' })
    }

    const updated = await prisma.category.update({
      where: { id: Number(id) },
      data: { name, active },
    })
    return updated
  }

  async delete(request, reply) {
    const category = await prisma.category.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })
    if (!category) {
      return reply.status(404).send({ error: 'Categoria não encontrada' })
    }

    await prisma.category.delete({ where: { id: category.id } })
    return { message: 'Categoria removida com sucesso' }
  }
}
