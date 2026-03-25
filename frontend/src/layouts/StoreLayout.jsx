import { useState, useEffect, useRef } from 'react'
import { Outlet, useParams, Link, useNavigate } from 'react-router-dom'
import { FiShoppingCart, FiUser, FiLogOut, FiClock, FiKey, FiChevronRight } from 'react-icons/fi'
import storeApi from '../services/storeApi.js'
import { StoreAuthProvider, useStoreAuth } from '../contexts/StoreAuthContext.jsx'
import { CartProvider, useCart } from '../hooks/useCart.jsx'

function StoreHeader({ store }) {
  const { slug } = useParams()
  const { customer, logout } = useStoreAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // Fechar menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <Link to={`/loja/${slug}`} className="flex items-center gap-3 min-w-0">
          {store.logoUrl ? (
            <img src={store.logoUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="text-green-600 font-bold text-lg">{store.companyName?.[0] || 'Z'}</span>
            </div>
          )}
          <span className="font-bold text-gray-800 truncate">{store.companyName}</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Ícone do usuário com menu dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => customer ? setMenuOpen(!menuOpen) : navigate(`/loja/${slug}/login`)}
              className={`p-2 transition-colors ${menuOpen ? 'text-green-600' : 'text-gray-500 hover:text-green-600'}`}
              title={customer ? customer.name : 'Entrar'}
            >
              <FiUser size={26} />
            </button>

            {/* Dropdown menu */}
            {menuOpen && customer && (
              <>
                <style>{`
                  @keyframes menu-in {
                    from { opacity: 0; transform: translateY(-8px) scale(0.95) }
                    to { opacity: 1; transform: translateY(0) scale(1) }
                  }
                `}</style>
                <div
                  className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
                  style={{ animation: 'menu-in 0.2s ease-out forwards' }}
                >
                  {/* Nome do cliente */}
                  <div className="px-5 py-4 bg-green-50 border-b border-green-100">
                    <p className="text-base font-bold text-gray-800 truncate">{customer.name}</p>
                    <p className="text-sm text-gray-500 truncate">{customer.phone?.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</p>
                  </div>

                  <div className="py-1">
                    {/* Minha conta */}
                    <Link
                      to={`/loja/${slug}/minha-conta`}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FiUser size={18} className="text-green-600" />
                        <span className="text-base font-medium text-gray-700">Minha conta</span>
                      </div>
                      <FiChevronRight size={16} className="text-gray-400" />
                    </Link>

                    {/* Meus pedidos */}
                    <Link
                      to={`/loja/${slug}/meus-pedidos`}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FiClock size={18} className="text-green-600" />
                        <span className="text-base font-medium text-gray-700">Meus pedidos</span>
                      </div>
                      <FiChevronRight size={16} className="text-gray-400" />
                    </Link>

                    {/* Alterar senha */}
                    <Link
                      to={`/loja/${slug}/alterar-senha`}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FiKey size={18} className="text-green-600" />
                        <span className="text-base font-medium text-gray-700">Alterar senha</span>
                      </div>
                      <FiChevronRight size={16} className="text-gray-400" />
                    </Link>
                  </div>

                  {/* Sair */}
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => { setMenuOpen(false); logout(); navigate(`/loja/${slug}`) }}
                      className="flex items-center gap-3 w-full px-5 py-3.5 hover:bg-red-50 transition-colors"
                    >
                      <FiLogOut size={18} className="text-red-500" />
                      <span className="text-base font-medium text-red-500">Sair da conta</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Carrinho */}
          <Link
            to={`/loja/${slug}/carrinho`}
            className="relative p-2 text-gray-500 hover:text-green-600 transition-colors"
          >
            <FiShoppingCart size={26} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-green-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}

function StoreContent() {
  const { slug } = useParams()
  const [store, setStore] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    storeApi.get(`/store/${slug}`)
      .then(({ data }) => setStore(data))
      .catch(() => setNotFound(true))
  }, [slug])

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-6xl mb-4">🔍</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Loja não encontrada</h1>
          <p className="text-gray-500">Verifique o endereço e tente novamente.</p>
        </div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StoreHeader store={store} />
      <main className="flex-1">
        <Outlet context={{ store, slug }} />
      </main>
      <footer className="py-4 text-center text-xs text-gray-400 border-t bg-white">
        Powered by <a href="https://www.zapcakes.com" className="text-green-600 font-medium hover:underline" target="_blank" rel="noopener noreferrer">ZapCakes</a>
      </footer>
    </div>
  )
}

export default function StoreLayout() {
  const { slug } = useParams()

  return (
    <StoreAuthProvider slug={slug}>
      <CartProvider slug={slug}>
        <StoreContent />
      </CartProvider>
    </StoreAuthProvider>
  )
}
