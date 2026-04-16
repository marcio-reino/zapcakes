import { OpenAiService } from './openai.service.js'

// Singleton compartilhado entre webhook (produção) e simulador (superadmin).
// Garante que o histórico de conversa por remoteJid é o mesmo em ambos.
const openAiService = new OpenAiService()

export default openAiService
