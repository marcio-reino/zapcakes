import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api.js'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Busca token em localStorage ou sessionStorage
  function getStorage() {
    if (localStorage.getItem('zapcakes_token')) return localStorage
    if (sessionStorage.getItem('zapcakes_token')) return sessionStorage
    return null
  }

  useEffect(() => {
    const storage = getStorage()
    const token = storage?.getItem('zapcakes_token')
    const savedUser = storage?.getItem('zapcakes_user')

    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data)
          storage.setItem('zapcakes_user', JSON.stringify(res.data))
        })
        .catch(() => {
          logout()
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email, password, stayLogged = true) {
    const { data } = await api.post('/auth/login', { email, password })
    const storage = stayLogged ? localStorage : sessionStorage
    storage.setItem('zapcakes_token', data.token)
    storage.setItem('zapcakes_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  async function register(name, email, password, phone) {
    const { data } = await api.post('/auth/register', { name, email, password, phone })
    // Conta criada mas pendente de ativação (não faz login)
    return data
  }

  function loginWithToken(token, userData) {
    localStorage.setItem('zapcakes_token', token)
    localStorage.setItem('zapcakes_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }

  function logout() {
    localStorage.removeItem('zapcakes_token')
    localStorage.removeItem('zapcakes_user')
    sessionStorage.removeItem('zapcakes_token')
    sessionStorage.removeItem('zapcakes_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithToken, logout, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
