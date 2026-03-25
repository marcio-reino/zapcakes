import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const CartContext = createContext()

function getKey(slug) {
  return `zapcakes_cart_${slug}`
}

export function CartProvider({ slug, children }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(getKey(slug))
      if (saved) setItems(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [slug])

  function persist(newItems) {
    setItems(newItems)
    localStorage.setItem(getKey(slug), JSON.stringify(newItems))
  }

  const addItem = useCallback((product, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      let next
      if (existing) {
        next = prev.map(i =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i,
        )
      } else {
        next = [...prev, { product, quantity }]
      }
      localStorage.setItem(getKey(slug), JSON.stringify(next))
      return next
    })
  }, [slug])

  const removeItem = useCallback((productId) => {
    setItems(prev => {
      const next = prev.filter(i => i.product.id !== productId)
      localStorage.setItem(getKey(slug), JSON.stringify(next))
      return next
    })
  }, [slug])

  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) return removeItem(productId)
    setItems(prev => {
      const next = prev.map(i =>
        i.product.id === productId ? { ...i, quantity } : i,
      )
      localStorage.setItem(getKey(slug), JSON.stringify(next))
      return next
    })
  }, [slug, removeItem])

  const clearCart = useCallback(() => {
    persist([])
  }, [slug])

  const updateAttachments = useCallback((productId, attachments) => {
    setItems(prev => {
      const next = prev.map(i =>
        i.product.id === productId ? { ...i, attachments } : i,
      )
      localStorage.setItem(getKey(slug), JSON.stringify(next))
      return next
    })
  }, [slug])

  const total = items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0)
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, updateAttachments, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
