import { S3Client, PutBucketPolicyCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
})

export const S3_BUCKET = process.env.S3_BUCKET || 'zapcakes'

export async function ensureBucketPublicRead() {
  try {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicRead',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${S3_BUCKET}/*`],
        },
      ],
    }

    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: S3_BUCKET,
      Policy: JSON.stringify(policy),
    }))
  } catch (err) {
    console.warn('Aviso: não foi possível configurar policy do bucket:', err.message)
  }
}

export default s3Client
