import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const CartContext = createContext()

function getKey(slug) {
  return `zapcakes_cart_${slug}`
}

function addonsTotal(additionals) {
  if (!Array.isArray(additionals)) return 0
  return additionals.reduce((s, a) => s + Number(a.price) * (a.quantity || 1), 0)
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

  const addItem = useCallback((product, quantity = 1, additionals = null, extras = null) => {
    // extras opcionais: { attachments, comboAttachments } — usados pelo
    // handleLoadForEdit para preencher o item em um unico setItems atomico
    // (evita race onde updateAttachments roda antes do item existir)
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      let next
      if (existing) {
        next = prev.map(i =>
          i.product.id === product.id
            ? {
                ...i,
                quantity: i.quantity + quantity,
                ...(additionals !== null ? { additionals } : {}),
                ...(extras?.attachments ? { attachments: extras.attachments } : {}),
                ...(extras?.comboAttachments ? { comboAttachments: extras.comboAttachments } : {}),
              }
            : i,
        )
      } else {
        next = [...prev, {
          product,
          quantity,
          ...(additionals ? { additionals } : {}),
          ...(extras?.attachments ? { attachments: extras.attachments } : {}),
          ...(extras?.comboAttachments ? { comboAttachments: extras.comboAttachments } : {}),
        }]
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

  const updateAdditionals = useCallback((productId, additionals) => {
    setItems(prev => {
      const next = prev.map(i =>
        i.product.id === productId ? { ...i, additionals } : i,
      )
      localStorage.setItem(getKey(slug), JSON.stringify(next))
      return next
    })
  }, [slug])

  // Para combos: cada produto interno pode ter sua propria lista de
  // imagens de inspiracao. Estrutura: item.comboAttachments[innerProductId] = []
  const updateComboAttachments = useCallback((comboProductId, innerProductId, attachments) => {
    setItems(prev => {
      const next = prev.map(i => {
        if (i.product.id !== comboProductId) return i
        const map = { ...(i.comboAttachments || {}) }
        if (!attachments || attachments.length === 0) {
          delete map[innerProductId]
        } else {
          map[innerProductId] = attachments
        }
        return { ...i, comboAttachments: map }
      })
      localStorage.setItem(getKey(slug), JSON.stringify(next))
      return next
    })
  }, [slug])

  const total = items.reduce(
    (sum, i) => sum + (Number(i.product.price) + addonsTotal(i.additionals)) * i.quantity,
    0,
  )
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, updateAttachments, updateAdditionals, updateComboAttachments, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
