import { PutObjectCommand } from '@aws-sdk/client-s3'
import s3Client, { S3_BUCKET } from '../config/s3.js'
import prisma from '../config/database.js'

const ACCOUNT_FOLDERS = [
  'produtos',
  'categorias',
  'perfil',
  'documentos',
]

export class AccountService {
  static accountPath(accountId) {
    return `contas/${accountId}`
  }

  static async createFolders(accountId) {
    const basePath = this.accountPath(accountId)

    for (const folder of ACCOUNT_FOLDERS) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: `${basePath}/${folder}/.keep`,
          Body: Buffer.alloc(0),
          ContentLength: 0,
          ContentType: 'application/octet-stream',
        })
      )
    }
  }

  static async createAccount(userId) {
    const account = await prisma.account.create({
      data: {
        userId,
        status: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
      },
    })

    await this.createFolders(account.id)

    return account
  }

  static getUploadFolder(accountId, folder) {
    return `${this.accountPath(accountId)}/${folder}`
  }
}
