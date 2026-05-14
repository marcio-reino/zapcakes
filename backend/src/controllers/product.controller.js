import prisma from '../config/database.js'

const productAdditionalsInclude = {
  productAdditionals: {
    where: { additional: { active: true } },
    include: { additional: true },
    orderBy: { sortOrder: 'asc' },
  },
}

function mapAdditionals(product) {
  if (!product) return product
  const additionals = (product.productAdditionals || []).map((pa) => ({
    id: pa.additional.id,
    description: pa.additional.description,
    imageUrl: pa.additional.imageUrl,
    price: pa.additional.price,
  }))
  const { productAdditionals, ...rest } = product
  return { ...rest, additionals }
}

async function syncProductAdditionals(userId, productId, additionalIds) {
  if (!Array.isArray(additionalIds)) return
  const unique = [...new Set(additionalIds.map((x) => Number(x)).filter((x) => !isNaN(x)))]
  if (unique.length > 0) {
    const owned = await prisma.additional.findMany({
      where: { id: { in: unique }, userId, active: true },
      select: { id: true },
    })
    if (owned.length !== unique.length) {
      const err = new Error('Um ou mais adicionais inválidos')
      err.statusCode = 400
      throw err
    }
  }
  await prisma.$transaction([
    prisma.productAdditional.deleteMany({ where: { productId } }),
    ...(unique.length > 0
      ? [
          prisma.productAdditional.createMany({
            data: unique.map((additionalId, idx) => ({ productId, additionalId, sortOrder: idx })),
          }),
        ]
      : []),
  ])
}

export class ProductController {
  async list(request, reply) {
    const { categoryId, active } = request.query
    const where = { userId: request.user.id }
    if (categoryId) where.categoryId = Number(categoryId)
    if (active !== undefined) where.active = active === 'true'

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        recipe: {
          include: {
            items: { include: { material: { select: { id: true, name: true, unit: true, basePrice: true } } } },
          },
        },
        ...productAdditionalsInclude,
      },
      orderBy: { name: 'asc' },
    })
    return products.map(mapAdditionals)
  }

  async create(request, reply) {
    const { categoryId, name, description, price, imageUrl, minOrder, maxOrder, allowInspirationImages, inspirationInstruction, maxInspirationImages, recipeId, additionalIds } = request.body

    const product = await prisma.product.create({
      data: {
        userId: request.user.id, categoryId, name, description, price, imageUrl,
        minOrder: minOrder || 1,
        maxOrder: maxOrder || 500,
        allowInspirationImages: allowInspirationImages || false,
        inspirationInstruction: inspirationInstruction || null,
        maxInspirationImages: maxInspirationImages || 3,
        recipeId: recipeId || null,
      },
    })

    if (Array.isArray(additionalIds)) {
      try {
        await syncProductAdditionals(request.user.id, product.id, additionalIds)
      } catch (err) {
        return reply.status(err.statusCode || 500).send({ error: err.message })
      }
    }

    const created = await prisma.product.findUnique({
      where: { id: product.id },
      include: { category: true, ...productAdditionalsInclude },
    })
    return reply.status(201).send(mapAdditionals(created))
  }

  async getById(request, reply) {
    const { id } = request.params
    const product = await prisma.product.findFirst({
      where: { id: Number(id), userId: request.user.id },
      include: {
        category: true,
        recipe: {
          include: {
            items: { include: { material: { select: { id: true, name: true, unit: true, basePrice: true } } } },
          },
        },
        ...productAdditionalsInclude,
      },
    })

    if (!product) {
      return reply.status(404).send({ error: 'Produto não encontrado' })
    }

    return mapAdditionals(product)
  }

  async update(request, reply) {
    const { id } = request.params
    const { categoryId, name, description, price, imageUrl, active, minOrder, maxOrder, allowInspirationImages, inspirationInstruction, maxInspirationImages, recipeId, additionalIds } = request.body

    const product = await prisma.product.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!product) {
      return reply.status(404).send({ error: 'Produto não encontrado' })
    }

    await prisma.product.update({
      where: { id: Number(id) },
      data: { categoryId, name, description, price, imageUrl, active, minOrder, maxOrder, allowInspirationImages, inspirationInstruction, maxInspirationImages, recipeId: recipeId !== undefined ? (recipeId || null) : undefined },
    })

    if (Array.isArray(additionalIds)) {
      try {
        await syncProductAdditionals(request.user.id, product.id, additionalIds)
      } catch (err) {
        return reply.status(err.statusCode || 500).send({ error: err.message })
      }
    }

    const updated = await prisma.product.findUnique({
      where: { id: product.id },
      include: { category: true, ...productAdditionalsInclude },
    })
    return mapAdditionals(updated)
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
