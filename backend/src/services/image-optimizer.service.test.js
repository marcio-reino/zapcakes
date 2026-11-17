import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { optimizeImage, IMAGE_PRESETS } from './image-optimizer.service.js'

// Imagem com ruído para o tamanho em bytes ser realista (cor sólida comprime demais)
async function noisyImage(width, height, format, options = {}) {
  const channels = 3
  const raw = Buffer.alloc(width * height * channels)
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 256
  return sharp(raw, { raw: { width, height, channels } })[format](options).toBuffer()
}

describe('optimizeImage', () => {
  it('reduz foto grande para no máximo 1600px e converte para WebP', async () => {
    const jpeg = await noisyImage(4000, 3000, 'jpeg', { quality: 95 })
    const result = await optimizeImage(jpeg, 'image/jpeg')

    expect(result.mimetype).toBe('image/webp')
    const meta = await sharp(result.buffer).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(1600)
    expect(meta.height).toBe(1200)
    expect(result.buffer.length).toBeLessThan(jpeg.length)
  })

  it('não amplia imagem pequena', async () => {
    const png = await noisyImage(300, 200, 'png')
    const result = await optimizeImage(png, 'image/png')
    const meta = await sharp(result.buffer).metadata()
    expect(meta.width).toBe(300)
    expect(meta.height).toBe(200)
  })

  it('mantém WebP leve já recortado no painel (600x400)', async () => {
    const webp = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#c0392b' } }).webp({ quality: 90 }).toBuffer()
    const result = await optimizeImage(webp, 'image/webp')
    expect(result.buffer).toBe(webp)
    expect(result.mimetype).toBe('image/webp')
  })

  it('corrige rotação de foto de celular (EXIF)', async () => {
    // orientation 6 = girar 90°: 400x200 armazenado vira 200x400 na tela
    const jpeg = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#2980b9' } })
      .withMetadata({ orientation: 6 }).jpeg().toBuffer()
    const result = await optimizeImage(jpeg, 'image/jpeg')
    const meta = await sharp(result.buffer).metadata()
    expect(meta.width).toBe(200)
    expect(meta.height).toBe(400)
    expect(meta.orientation ?? 1).toBe(1)
  })

  it('preset de documento permite resolução maior', async () => {
    const jpeg = await noisyImage(3000, 1500, 'jpeg')
    const result = await optimizeImage(jpeg, 'image/jpeg', IMAGE_PRESETS.document)
    const meta = await sharp(result.buffer).metadata()
    expect(meta.width).toBe(2000)
  })

  it('não altera GIF, PDF e áudio', async () => {
    const gif = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#000' } }).gif().toBuffer()
    expect((await optimizeImage(gif, 'image/gif')).buffer).toBe(gif)

    const pdf = Buffer.from('%PDF-1.4 teste')
    expect(await optimizeImage(pdf, 'application/pdf')).toEqual({ buffer: pdf, mimetype: 'application/pdf' })
  })

  it('devolve o original quando a imagem está corrompida', async () => {
    const broken = Buffer.from('isto não é uma imagem')
    const result = await optimizeImage(broken, 'image/jpeg')
    expect(result).toEqual({ buffer: broken, mimetype: 'image/jpeg' })
  })
})
