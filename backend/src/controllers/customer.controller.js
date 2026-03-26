import prisma from '../config/database.js'
import bcrypt from 'bcryptjs'

export class CustomerController {
  async list(request, reply) {
    const customers = await prisma.customer.findMany({
      where: { userId: request.user.id },
      orderBy: { name: 'asc' },
    })
    return customers
  }

  async getById(request, reply) {
    const customer = await prisma.customer.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })
    if (!customer) {
      return reply.status(404).send({ error: 'Cliente não encontrado' })
    }
    return customer
  }

  async create(request, reply) {
    const { name, phone, email, password, notes, street, number, complement, neighborhood, city, state, zipCode, reference } = request.body

    if (!name) {
      return reply.status(400).send({ error: 'Nome é obrigatório' })
    }

    const data = {
      userId: request.user.id,
      name, phone: phone ? phone.replace(/\D/g, '') : phone, email, notes,
      street, number, complement, neighborhood, city, state, zipCode, reference,
    }

    if (password) {
      data.password = await bcrypt.hash(password, 10)
    }

    const customer = await prisma.customer.create({ data })
    return reply.status(201).send(customer)
  }

  async update(request, reply) {
    const customer = await prisma.customer.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })
    if (!customer) {
      return reply.status(404).send({ error: 'Cliente não encontrado' })
    }

    const { name, phone, email, password, notes, street, number, complement, neighborhood, city, state, zipCode, reference, active } = request.body

    const data = { name, phone: phone ? phone.replace(/\D/g, '') : phone, email, notes, street, number, complement, neighborhood, city, state, zipCode, reference, active }

    if (password) {
      data.password = await bcrypt.hash(password, 10)
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data,
    })

    return updated
  }

  async delete(request, reply) {
    const customer = await prisma.customer.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })
    if (!customer) {
      return reply.status(404).send({ error: 'Cliente não encontrado' })
    }

    await prisma.customer.delete({ where: { id: customer.id } })
    return { message: 'Cliente removido com sucesso' }
  }
}
