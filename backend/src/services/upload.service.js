import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import s3Client, { S3_BUCKET } from '../config/s3.js'
import { randomUUID } from 'crypto'
import path from 'path'

export class UploadService {
  static async uploadFile(file, folder = 'uploads') {
    const ext = path.extname(file.filename)
    const key = `${folder}/${randomUUID()}${ext}`

    const buffer = await file.toBuffer()

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.mimetype,
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
