import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api.js'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('zapcakes_token')
    const savedUser = localStorage.getItem('zapcakes_user')

    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data)
          localStorage.setItem('zapcakes_user', JSON.stringify(res.data))
        })
        .catch(() => {
          logout()
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('zapcakes_token', data.token)
    localStorage.setItem('zapcakes_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  async function register(name, email, password, phone) {
    const { data } = await api.post('/auth/register', { name, email, password, phone })
    localStorage.setItem('zapcakes_token', data.token)
    localStorage.setItem('zapcakes_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  function logout() {
    localStorage.removeItem('zapcakes_token')
    localStorage.removeItem('zapcakes_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
