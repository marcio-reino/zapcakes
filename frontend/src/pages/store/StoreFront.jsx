import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { FiPlus, FiMinus, FiSearch, FiX } from 'react-icons/fi'
import storeApi from '../../services/storeApi.js'
import { useCart } from '../../hooks/useCart.jsx'
import toast from 'react-hot-toast'

function fmtBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Modal de detalhes do produto
function ProductModal({ product, onClose }) {
  const { addItem, items, updateQuantity, removeItem } = useCart()
  const inCart = items.find(i => i.product.id === product.id)
  const [qty, setQty] = useState(inCart ? inCart.quantity : product.minOrder || 1)
  const [obs, setObs] = useState('')
  const [closing, setClosing] = useState(false)

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 280)
  }

  function handleAdd() {
    if (inCart) {
      updateQuantity(product.id, qty)
    } else {
      addItem({ ...product, obs: obs || undefined }, qty)
    }
    toast.success('Adicionado!', { duration: 1500, icon: '🛒' })
    handleClose()
  }

  return (
    <>
      <style>{`
        @keyframes store-overlay-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes store-overlay-out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes store-slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes store-slide-down { from { transform: translateY(0) } to { transform: translateY(100%) } }
      `}</style>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={handleClose}>
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black/50"
          style={{ animation: `${closing ? 'store-overlay-out' : 'store-overlay-in'} 0.25s ease-out forwards` }}
        />

        {/* Modal */}
        <div
          className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
          style={{ animation: `${closing ? 'store-slide-down' : 'store-slide-up'} 0.3s ease-out forwards` }}
          onClick={e => e.stopPropagation()}
        >
        {/* Imagem */}
        {product.imageUrl ? (
          <div className="relative">
            <img src={product.imageUrl} alt={product.name} className="w-full h-56 object-cover" />
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
            >
              <FiX size={18} className="text-gray-600" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-5xl">🧁</div>
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
            >
              <FiX size={18} className="text-gray-600" />
            </button>
          </div>
        )}

        {/* Conteúdo */}
        <div className="p-5">
          <h2 className="text-lg font-bold text-gray-800">{product.name}</h2>
          {product.description && (
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">{product.description}</p>
          )}
          <p className="text-green-600 font-bold text-xl mt-3">{fmtBRL(product.price)}</p>
          {product.minOrder > 1 && (
            <p className="text-sm text-amber-600 font-medium mt-1">Pedido mínimo: {product.minOrder} un.</p>
          )}

          {/* Observação */}
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Alguma observação?</label>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Ex: sem cobertura, mais recheio, com granulado..."
              maxLength={140}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{obs.length} / 140</p>
          </div>
        </div>

        {/* Barra inferior: quantidade + adicionar */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQty(q => Math.max((product.minOrder || 1), q - 1))}
              className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <FiMinus size={16} />
            </button>
            <span className="text-lg font-bold text-gray-800 w-6 text-center">{qty}</span>
            <button
              onClick={() => setQty(q => q + 1)}
              className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <FiPlus size={16} />
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="flex-1 flex items-center justify-between bg-green-600 text-white py-3 px-5 rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            <span>Adicionar</span>
            <span>{fmtBRL(Number(product.price) * qty)}</span>
          </button>
        </div>
      </div>
    </div>
    </>
  )
}

function ProductCard({ product, onOpen }) {
  return (
    <div
      onClick={() => onOpen(product)}
      className="flex gap-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
    >
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-800 text-sm leading-tight">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        )}
        <p className="text-green-600 font-bold text-base mt-2">
          {fmtBRL(product.price)}
        </p>
        {product.minOrder > 1 && (
          <p className="text-xs text-amber-600 font-medium mt-0.5">Pedido mínimo: {product.minOrder} un.</p>
        )}
      </div>
      <div className="flex flex-col items-center flex-shrink-0">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-20 h-20 rounded-lg object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">🧁</div>
        )}
      </div>
    </div>
  )
}

function ComboCard({ combo, onOpen }) {
  const comboProduct = {
    id: `combo_${combo.id}`,
    name: combo.name,
    description: combo.items.map(i => `${i.quantity}x ${i.product.name}`).join(' + '),
    price: combo.totalPrice,
    imageUrl: combo.imageUrl || combo.items[0]?.product?.imageUrl,
    isCombo: true,
    comboId: combo.id,
    comboItems: combo.items,
    comboDiscount: Number(combo.discount || 0),
  }

  return (
    <div
      onClick={() => onOpen(comboProduct)}
      className="flex gap-3 bg-white rounded-xl p-3 shadow-sm border border-green-100 hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-800 text-sm leading-tight">{combo.name}</h3>
          <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">COMBO</span>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2">{comboProduct.description}</p>
        <div className="flex items-center gap-2 mt-2">
          {Number(combo.discount) > 0 && (
            <span className="text-xs text-gray-400 line-through">
              {fmtBRL(combo.items.reduce((s, i) => s + Number(i.product.price) * i.quantity, 0))}
            </span>
          )}
          <span className="text-green-600 font-bold text-base">{fmtBRL(combo.totalPrice)}</span>
        </div>
      </div>
      <div className="flex flex-col items-center flex-shrink-0">
        {comboProduct.imageUrl ? (
          <img src={comboProduct.imageUrl} alt={combo.name} className="w-20 h-20 rounded-lg object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-green-50 flex items-center justify-center text-2xl">🎁</div>
        )}
      </div>
    </div>
  )
}

export default function StoreFront() {
  const { store, slug } = useOutletContext()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [combos, setCombos] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const { count, total } = useCart()

  useEffect(() => {
    Promise.all([
      storeApi.get(`/store/${slug}/categories`).then(r => setCategories(r.data)),
      storeApi.get(`/store/${slug}/products`).then(r => setProducts(r.data)),
      storeApi.get(`/store/${slug}/combos`).then(r => setCombos(r.data)),
    ]).finally(() => setLoading(false))
  }, [slug])

  const filtered = products.filter(p => {
    if (selectedCategory && p.categoryId !== selectedCategory) return false
    if (search) {
      const s = search.toLowerCase()
      return p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s)
    }
    return true
  })

  // Agrupar produtos por categoria
  const grouped = {}
  for (const p of filtered) {
    const catName = p.category?.name || 'Outros'
    if (!grouped[catName]) grouped[catName] = []
    grouped[catName].push(p)
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl p-3 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-24">
      {/* Store info */}
      <div className="text-center py-5">
        {store.logoUrl ? (
          <img src={store.logoUrl} alt="" className="w-20 h-20 rounded-full object-cover mx-auto mb-3 shadow-md" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-green-100 mx-auto mb-3 flex items-center justify-center shadow-md">
            <span className="text-green-600 font-bold text-3xl">{store.companyName?.[0] || 'Z'}</span>
          </div>
        )}
        <h1 className="text-xl font-bold text-gray-800">{store.companyName}</h1>
        {store.city && (
          <p className="text-sm text-gray-500 mt-1">📍 {store.city}{store.state ? ` - ${store.state}` : ''}</p>
        )}
      </div>

      {/* Search + category filter */}
      <div className="sticky top-[60px] z-40 bg-gray-50 pb-3 pt-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produtos..."
              className="w-full pl-9 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
        </div>
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${
                !selectedCategory ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              Todos
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === c.id ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Combos section */}
      {!selectedCategory && !search && combos.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            🎁 Combos
          </h2>
          <div className="space-y-3">
            {combos.map(c => <ComboCard key={c.id} combo={c} onOpen={setSelectedProduct} />)}
          </div>
        </section>
      )}

      {/* Products by category */}
      {Object.entries(grouped).length > 0 ? (
        Object.entries(grouped).map(([catName, prods]) => (
          <section key={catName} className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3 uppercase tracking-wide">{catName}</h2>
            <div className="space-y-3">
              {prods.map(p => <ProductCard key={p.id} product={p} onOpen={setSelectedProduct} />)}
            </div>
          </section>
        ))
      ) : (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🧁</p>
          <p>Nenhum produto encontrado</p>
        </div>
      )}

      {/* Floating cart bar */}
      {count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
          <a
            href={`/loja/${slug}/carrinho`}
            className="max-w-lg mx-auto flex items-center justify-between bg-green-600 text-white rounded-xl px-5 py-3.5 shadow-lg hover:bg-green-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="bg-green-700 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">{count}</span>
              <span className="font-semibold">Ver carrinho</span>
            </div>
            <span className="font-bold">{fmtBRL(total)}</span>
          </a>
        </div>
      )}

      {/* Product detail modal */}
      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  )
}
