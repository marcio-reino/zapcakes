import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import prisma from '../config/database.js'
import { AccountService } from '../services/account.service.js'
import { sendMail } from '../services/mail.service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resetTemplate = readFileSync(join(__dirname, '../templates/reset-password.html'), 'utf-8')
const activationTemplate = readFileSync(join(__dirname, '../templates/activation-code.html'), 'utf-8')

// Armazena tokens temporários: { token: { userId, expiresAt } }
const resetTokens = new Map()
// Armazena códigos de ativação: { visitorKey: { userId, code, expiresAt, name, email } }
const activationCodes = new Map()

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function sendActivationEmail(name, email, code) {
  const html = activationTemplate
    .replace(/\{\{NAME\}\}/g, name)
    .replace(/\{\{CODE\}\}/g, code)
    .replace(/\{\{EXPIRY\}\}/g, '10 minutos')
    .replace(/\{\{YEAR\}\}/g, String(new Date().getFullYear()))

  return sendMail({
    to: email,
    subject: 'Código de ativação - ZapCakes',
    html,
    text: `Olá ${name}, seu código de ativação é: ${code} (expira em 10 minutos)`,
  })
}

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
      // Reenvia código de ativação automaticamente
      const code = generateCode()
      const expiresAt = Date.now() + 10 * 60 * 1000
      activationCodes.set(user.email, { userId: user.id, code, expiresAt, name: user.name })
      await sendActivationEmail(user.name, user.email, code)
      return reply.status(403).send({ error: 'Conta não ativada', pendingActivation: true, email: user.email })
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
      data: { name, email, password: hashedPassword, phone, active: false },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    })

    await AccountService.createAccount(user.id)

    // Gera código de ativação de 6 dígitos
    const code = generateCode()
    const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutos
    activationCodes.set(email, { userId: user.id, code, expiresAt, name })

    await sendActivationEmail(name, email, code)

    return reply.status(201).send({ pendingActivation: true, email })
  }

  async verifyCode(request, reply) {
    const { email, code } = request.body
    if (!email || !code) {
      return reply.status(400).send({ error: 'E-mail e código são obrigatórios' })
    }

    const entry = activationCodes.get(email)
    if (!entry) {
      return reply.status(400).send({ error: 'Código não encontrado. Solicite um novo.' })
    }

    if (entry.expiresAt < Date.now()) {
      activationCodes.delete(email)
      return reply.status(400).send({ error: 'Código expirado. Solicite um novo.' })
    }

    if (entry.code !== code) {
      return reply.status(400).send({ error: 'Código inválido' })
    }

    // Ativa a conta
    const user = await prisma.user.update({
      where: { id: entry.userId },
      data: { active: true },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    })

    activationCodes.delete(email)

    const token = request.server.jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: '7d' }
    )

    return { token, user }
  }

  async resendCode(request, reply) {
    const { email } = request.body
    if (!email) return reply.status(400).send({ error: 'E-mail obrigatório' })

    // Busca usuário inativo
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.active) {
      return reply.status(400).send({ error: 'Conta não encontrada ou já ativa' })
    }

    const code = generateCode()
    const expiresAt = Date.now() + 10 * 60 * 1000
    activationCodes.set(email, { userId: user.id, code, expiresAt, name: user.name })

    await sendActivationEmail(user.name, email, code)

    return { success: true }
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

  async forgotPassword(request, reply) {
    const { email } = request.body
    if (!email) return reply.status(400).send({ error: 'E-mail obrigatório' })

    const user = await prisma.user.findUnique({ where: { email } })

    // Sempre retorna sucesso para não revelar se o e-mail existe
    if (!user) return { success: true }

    // Gera token de 6 dígitos + hash seguro
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + 30 * 60 * 1000 // 30 minutos

    resetTokens.set(token, { userId: user.id, expiresAt })

    // Limpa tokens expirados
    for (const [t, v] of resetTokens) {
      if (v.expiresAt < Date.now()) resetTokens.delete(t)
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`

    const html = resetTemplate
      .replace(/\{\{NAME\}\}/g, user.name)
      .replace(/\{\{RESET_URL\}\}/g, resetUrl)
      .replace(/\{\{EXPIRY\}\}/g, '30 minutos')
      .replace(/\{\{YEAR\}\}/g, String(new Date().getFullYear()))

    await sendMail({
      to: user.email,
      subject: 'Recuperar senha - ZapCakes',
      html,
      text: `Olá ${user.name}, acesse o link para redefinir sua senha: ${resetUrl} (expira em 30 minutos)`,
    })

    return { success: true }
  }

  async resetPassword(request, reply) {
    const { token, password } = request.body
    if (!token || !password) {
      return reply.status(400).send({ error: 'Token e nova senha são obrigatórios' })
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: 'A senha deve ter no mínimo 6 caracteres' })
    }

    const entry = resetTokens.get(token)
    if (!entry || entry.expiresAt < Date.now()) {
      resetTokens.delete(token)
      return reply.status(400).send({ error: 'Token inválido ou expirado' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: entry.userId },
      data: { password: hashedPassword },
    })

    resetTokens.delete(token)

    return { success: true }
  }
}
