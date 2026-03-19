import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Admin padrão
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@zapcakes.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@zapcakes.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  })

  // Categorias padrão
  const categorias = ['Bolos', 'Cupcakes', 'Doces', 'Salgados', 'Bebidas']
  for (const nome of categorias) {
    await prisma.category.upsert({
      where: { id: categorias.indexOf(nome) + 1 },
      update: {},
      create: { name: nome, userId: admin.id },
    })
  }

  console.log('Seed executado com sucesso!')
  console.log('Admin:', admin.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
