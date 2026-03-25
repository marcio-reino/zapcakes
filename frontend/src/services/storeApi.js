import axios from 'axios'

const storeApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

storeApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('zapcakes_store_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

storeApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('zapcakes_store_token')
      localStorage.removeItem('zapcakes_store_customer')
    }
    return Promise.reject(error)
  },
)

export default storeApi
