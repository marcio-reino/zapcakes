import bcrypt from 'bcryptjs'
import prisma from '../config/database.js'
import { AccountService } from '../services/account.service.js'

export class AuthController {
  async login(request, reply) {
    const { email, password } = request.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return reply.status(401).send({ error: 'Credenciais inválidas' })
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return reply.status(401).send({ error: 'Credenciais inválidas' })
    }

    if (!user.active) {
      return reply.status(403).send({ error: 'Conta desativada' })
    }

    const token = request.server.jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: '7d' }
    )

    const { password: _, ...userWithoutPassword } = user

    return { token, user: userWithoutPassword }
  }

  async register(request, reply) {
    const { name, email, password, phone } = request.body

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return reply.status(409).send({ error: 'Email já cadastrado' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, phone },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    })

    await AccountService.createAccount(user.id)

    const token = request.server.jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: '7d' }
    )

    return reply.status(201).send({ token, user })
  }

  async me(request, reply) {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    })

    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado' })
    }

    return user
  }
}
