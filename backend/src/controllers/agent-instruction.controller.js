import prisma from '../config/database.js'

export class AgentInstructionController {
  async list(request, reply) {
    const instructions = await prisma.agentInstruction.findMany({
      where: { userId: request.user.id },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })
    return instructions
  }

  async create(request, reply) {
    const { category, title, content, imageUrl } = request.body

    if (!category || !title || !content) {
      return reply.status(400).send({ error: 'Categoria, título e conteúdo são obrigatórios' })
    }

    const maxSort = await prisma.agentInstruction.aggregate({
      where: { userId: request.user.id, category },
      _max: { sortOrder: true },
    })

    const instruction = await prisma.agentInstruction.create({
      data: {
        userId: request.user.id,
        category,
        title,
        content,
        imageUrl,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    })

    return reply.status(201).send(instruction)
  }

  async getById(request, reply) {
    const instruction = await prisma.agentInstruction.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })

    if (!instruction) {
      return reply.status(404).send({ error: 'Instrução não encontrada' })
    }

    return instruction
  }

  async update(request, reply) {
    const { id } = request.params
    const { category, title, content, imageUrl, active, sortOrder } = request.body

    const instruction = await prisma.agentInstruction.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!instruction) {
      return reply.status(404).send({ error: 'Instrução não encontrada' })
    }

    const updated = await prisma.agentInstruction.update({
      where: { id: Number(id) },
      data: { category, title, content, imageUrl, active, sortOrder },
    })

    return updated
  }

  async delete(request, reply) {
    const instruction = await prisma.agentInstruction.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })
    if (!instruction) {
      return reply.status(404).send({ error: 'Instrução não encontrada' })
    }

    await prisma.agentInstruction.delete({ where: { id: instruction.id } })
    return { message: 'Instrução removida com sucesso' }
  }
}
