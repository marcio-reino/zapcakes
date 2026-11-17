import sharp from 'sharp'

const OPTIMIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp'])

export const IMAGE_PRESETS = {
  default: { maxDimension: 1600, quality: 82 },
  // Comprovantes precisam de números legíveis para a loja conferir
  document: { maxDimension: 2000, quality: 88 },
}

// WebP já leve e no tamanho certo (ex: recorte feito no painel) não é recomprimido
const ALREADY_OPTIMIZED_BYTES = 300 * 1024

// Reduz e converte para WebP. GIF (pode ser animado), PDF e áudio passam sem alteração.
// Em caso de falha devolve o original para não bloquear o upload.
export async function optimizeImage(buffer, mimetype, preset = IMAGE_PRESETS.default) {
  const original = { buffer, mimetype }
  if (!OPTIMIZABLE.has(mimetype) || !buffer?.length) return original

  try {
    const meta = await sharp(buffer).metadata()
    const fitsSize = (meta.width || 0) <= preset.maxDimension && (meta.height || 0) <= preset.maxDimension
    // orientation > 1 significa foto de celular girada via EXIF: precisa reprocessar
    const needsRotation = (meta.orientation || 1) > 1

    if (mimetype === 'image/webp' && fitsSize && !needsRotation && buffer.length <= ALREADY_OPTIMIZED_BYTES) {
      return original
    }

    const output = await sharp(buffer)
      .rotate()
      .resize({
        width: preset.maxDimension,
        height: preset.maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: preset.quality, effort: 4 })
      .toBuffer()

    if (output.length >= buffer.length && fitsSize && !needsRotation) return original
    return { buffer: output, mimetype: 'image/webp' }
  } catch (err) {
    console.error('[ImageOptimizer] Falha ao otimizar imagem, mantendo original:', err.message)
    return original
  }
}
