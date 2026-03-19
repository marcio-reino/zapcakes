import prisma from '../config/database.js'

export class ProductController {
  async list(request, reply) {
    const { categoryId, active } = request.query
    const where = { userId: request.user.id }
    if (categoryId) where.categoryId = Number(categoryId)
    if (active !== undefined) where.active = active === 'true'

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    })
    return products
  }

  async create(request, reply) {
    const { categoryId, name, description, price, imageUrl } = request.body

    const product = await prisma.product.create({
      data: { userId: request.user.id, categoryId, name, description, price, imageUrl },
    })

    return reply.status(201).send(product)
  }

  async getById(request, reply) {
    const { id } = request.params
    const product = await prisma.product.findFirst({
      where: { id: Number(id), userId: request.user.id },
      include: { category: true },
    })

    if (!product) {
      return reply.status(404).send({ error: 'Produto não encontrado' })
    }

    return product
  }

  async update(request, reply) {
    const { id } = request.params
    const { categoryId, name, description, price, imageUrl, active } = request.body

    const product = await prisma.product.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!product) {
      return reply.status(404).send({ error: 'Produto não encontrado' })
    }

    const updated = await prisma.product.update({
      where: { id: Number(id) },
      data: { categoryId, name, description, price, imageUrl, active },
    })

    return updated
  }

  async delete(request, reply) {
    const product = await prisma.product.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })
    if (!product) {
      return reply.status(404).send({ error: 'Produto não encontrado' })
    }

    await prisma.product.delete({ where: { id: product.id } })
    return { message: 'Produto removido com sucesso' }
  }
}
