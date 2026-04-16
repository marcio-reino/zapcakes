import Redis from 'ioredis'

// Cliente Redis com fallback gracioso: se REDIS_URL não estiver setada
// ou se Redis estiver offline, exportamos null e quem usa faz fallback
// para cache em memória (comportamento pré-Redis).

let client = null
let connected = false

if (process.env.REDIS_URL) {
  try {
    client = new Redis(process.env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 500, 5000),
      reconnectOnError: () => true,
    })

    client.on('connect', () => {
      connected = true
      console.log('[redis] conectado em', process.env.REDIS_URL.replace(/:[^:@]+@/, ':***@'))
    })
    client.on('ready', () => {
      connected = true
    })
    client.on('error', (err) => {
      if (connected) {
        console.warn('[redis] erro:', err.message)
      }
      connected = false
    })
    client.on('end', () => {
      connected = false
    })
  } catch (err) {
    console.warn('[redis] falha ao inicializar:', err.message)
    client = null
  }
} else {
  console.log('[redis] REDIS_URL não configurada — usando cache em memória')
}

export function isRedisReady() {
  return !!(client && connected && client.status === 'ready')
}

export default client
