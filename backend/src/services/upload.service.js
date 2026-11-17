import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import s3Client, { S3_BUCKET } from '../config/s3.js'
import { randomUUID } from 'crypto'
import path from 'path'
import { optimizeImage, IMAGE_PRESETS } from './image-optimizer.service.js'

const EXT_BY_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf' }

export class UploadService {
  static async uploadFile(file, folder = 'uploads', preset = IMAGE_PRESETS.default) {
    const raw = await file.toBuffer()
    const { buffer, mimetype } = await optimizeImage(raw, file.mimetype, preset)
    const ext = mimetype === file.mimetype ? path.extname(file.filename) : EXT_BY_MIME[mimetype]
    return UploadService.#put(buffer, mimetype, `${folder}/${randomUUID()}${ext}`)
  }

  static async uploadBuffer(rawBuffer, rawMimetype, folder = 'uploads', preset = IMAGE_PRESETS.default) {
    const { buffer, mimetype } = await optimizeImage(rawBuffer, rawMimetype, preset)
    const ext = EXT_BY_MIME[mimetype] || '.bin'
    return UploadService.#put(buffer, mimetype, `${folder}/${randomUUID()}${ext}`)
  }

  static async #put(buffer, mimetype, key) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    )

    const url = `${process.env.S3_ENDPOINT}/${S3_BUCKET}/${key}`
    return { url, key }
  }

  static async deleteFile(key) {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    )
  }

  static getKeyFromUrl(url) {
    if (!url) return null
    const bucketUrl = `${process.env.S3_ENDPOINT}/${S3_BUCKET}/`
    if (url.startsWith(bucketUrl)) {
      return url.replace(bucketUrl, '')
    }
    return null
  }
}
