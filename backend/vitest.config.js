import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node',
    testTimeout: 10000,
    // Não precisa de ambiente com DB real — todos os testes mockam Prisma
  },
})
