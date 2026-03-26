import { createContext, useContext, useState, useEffect } from 'react'
import storeApi from '../services/storeApi.js'

const StoreAuthContext = createContext()

export function StoreAuthProvider({ slug, children }) {
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('zapcakes_store_token')
    const saved = localStorage.getItem('zapcakes_store_customer')
    if (token && saved) {
      try {
        setCustomer(JSON.parse(saved))
      } catch { /* ignore */ }
      // Verify token
      storeApi.get(`/store/${slug}/customer/me`)
        .then(({ data }) => {
          setCustomer(data)
          localStorage.setItem('zapcakes_store_customer', JSON.stringify(data))
        })
        .catch(() => {
          setCustomer(null)
          localStorage.removeItem('zapcakes_store_token')
          localStorage.removeItem('zapcakes_store_customer')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [slug])

  async function login(phone, password) {
    const { data } = await storeApi.post(`/store/${slug}/customer/login`, { phone, password })
    localStorage.setItem('zapcakes_store_token', data.token)
    localStorage.setItem('zapcakes_store_customer', JSON.stringify(data.customer))
    setCustomer(data.customer)
    return data
  }

  async function register(name, phone, password) {
    const { data } = await storeApi.post(`/store/${slug}/customer/register`, { name, phone, password })
    localStorage.setItem('zapcakes_store_token', data.token)
    localStorage.setItem('zapcakes_store_customer', JSON.stringify(data.customer))
    setCustomer(data.customer)
    return data
  }

  function loginWithToken(token, customerData) {
    localStorage.setItem('zapcakes_store_token', token)
    localStorage.setItem('zapcakes_store_customer', JSON.stringify(customerData))
    setCustomer(customerData)
  }

  function logout() {
    localStorage.removeItem('zapcakes_store_token')
    localStorage.removeItem('zapcakes_store_customer')
    setCustomer(null)
  }

  return (
    <StoreAuthContext.Provider value={{ customer, loading, login, register, loginWithToken, logout, slug }}>
      {children}
    </StoreAuthContext.Provider>
  )
}

export function useStoreAuth() {
  return useContext(StoreAuthContext)
}
