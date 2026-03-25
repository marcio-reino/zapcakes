import prisma from '../config/database.js'

const recipeInclude = {
  items: {
    include: { material: { select: { id: true, name: true, unit: true, brand: true, basePrice: true } } },
  },
  products: { select: { id: true, name: true, price: true, imageUrl: true } },
}

export class RecipeController {
  async list(request, reply) {
    const recipes = await prisma.recipe.findMany({
      where: { userId: request.user.id },
      include: recipeInclude,
      orderBy: { name: 'asc' },
    })
    return recipes
  }

  async getById(request, reply) {
    const recipe = await prisma.recipe.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
      include: recipeInclude,
    })
    if (!recipe) {
      return reply.status(404).send({ error: 'Receita não encontrada' })
    }
    return recipe
  }

  async create(request, reply) {
    const { name, description, prepTime, items } = request.body

    // Verificar materiais
    if (items && items.length > 0) {
      const materialIds = items.map((i) => i.materialId)
      const materials = await prisma.material.findMany({
        where: { id: { in: materialIds }, userId: request.user.id },
      })
      if (materials.length !== materialIds.length) {
        return reply.status(400).send({ error: 'Um ou mais materiais não encontrados' })
      }
    }

    const recipe = await prisma.recipe.create({
      data: {
        userId: request.user.id,
        name,
        description,
        prepTime: prepTime || 0,
        items: items && items.length > 0 ? {
          create: items.map((i) => ({
            materialId: i.materialId,
            quantity: i.quantity || 1,
          })),
        } : undefined,
      },
      include: recipeInclude,
    })

    return reply.status(201).send(recipe)
  }

  async update(request, reply) {
    const { id } = request.params
    const { name, description, prepTime, active, items } = request.body

    const recipe = await prisma.recipe.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!recipe) {
      return reply.status(404).send({ error: 'Receita não encontrada' })
    }

    // Verificar materiais se items enviados
    if (items) {
      const materialIds = items.map((i) => i.materialId)
      const materials = await prisma.material.findMany({
        where: { id: { in: materialIds }, userId: request.user.id },
      })
      if (materials.length !== materialIds.length) {
        return reply.status(400).send({ error: 'Um ou mais materiais não encontrados' })
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.recipeItem.deleteMany({ where: { recipeId: Number(id) } })
        if (items.length > 0) {
          await tx.recipeItem.createMany({
            data: items.map((i) => ({
              recipeId: Number(id),
              materialId: i.materialId,
              quantity: i.quantity || 1,
            })),
          })
        }
      }

      return tx.recipe.update({
        where: { id: Number(id) },
        data: {
          name,
          description,
          prepTime,
          active,
        },
        include: recipeInclude,
      })
    })

    return updated
  }

  async delete(request, reply) {
    const recipe = await prisma.recipe.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })
    if (!recipe) {
      return reply.status(404).send({ error: 'Receita não encontrada' })
    }

    await prisma.recipe.delete({ where: { id: recipe.id } })
    return { message: 'Receita removida com sucesso' }
  }
}
