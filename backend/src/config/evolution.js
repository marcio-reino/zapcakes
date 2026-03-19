import axios from 'axios'

const evolutionApi = axios.create({
  baseURL: process.env.EVOLUTION_API_URL,
  headers: {
    'Content-Type': 'application/json',
    apikey: process.env.EVOLUTION_API_KEY,
  },
})

export default evolutionApi
