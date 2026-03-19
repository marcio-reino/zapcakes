import bcrypt from 'bcryptjs'
import prisma from '../config/database.js'
import { AccountService } from '../services/account.service.js'

const userSelect = {
  id: true, name: true, email: true, phone: true, role: true, active: true,
  street: true, number: true, complement: true, neighborhood: true,
  city: true, state: true, zipCode: true, reference: true, createdAt: true,
}

export class UserController {
  async list(request, reply) {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    })
    return users
  }

  async getById(request, reply) {
    const { id } = request.params
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: userSelect,
    })

    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado' })
    }

    return user
  }

  async create(request, reply) {
    const { name, email, password, phone } = request.body

    if (!name || !email || !password) {
      return reply.status(400).send({ error: 'Nome, email e senha são obrigatórios' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return reply.status(409).send({ error: 'Email já cadastrado' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, phone },
      select: userSelect,
    })

    await AccountService.createAccount(user.id)

    return reply.status(201).send(user)
  }

  async update(request, reply) {
    const { id } = request.params
    const { name, email, phone, password, active, role, street, number, complement, neighborhood, city, state, zipCode, reference } = request.body

    const data = {}
    if (name) data.name = name
    if (email) data.email = email
    if (phone !== undefined) data.phone = phone
    if (active !== undefined) data.active = active
    if (role && request.user.role === 'ADMIN') data.role = role
    if (password) data.password = await bcrypt.hash(password, 10)
    if (street !== undefined) data.street = street
    if (number !== undefined) data.number = number
    if (complement !== undefined) data.complement = complement
    if (neighborhood !== undefined) data.neighborhood = neighborhood
    if (city !== undefined) data.city = city
    if (state !== undefined) data.state = state
    if (zipCode !== undefined) data.zipCode = zipCode
    if (reference !== undefined) data.reference = reference

    const user = await prisma.user.update({
      where: { id: Number(id) },
      select: userSelect,
      data,
    })

    return user
  }

  async delete(request, reply) {
    const { id } = request.params
    await prisma.user.delete({ where: { id: Number(id) } })
    return { message: 'Usuário removido com sucesso' }
  }
}
