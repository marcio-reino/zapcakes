import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { FiHome, FiBriefcase, FiUsers, FiGrid, FiPackage, FiLayers, FiCpu, FiShoppingCart, FiLogOut, FiMoon, FiSun, FiMenu, FiX, FiBox, FiClipboard, FiBookOpen, FiGlobe } from 'react-icons/fi'
import logo from '../assets/logo.svg'

const menuItems = [
  { path: '/client', icon: FiHome, label: 'Dashboard' },
  { path: '/client/company', icon: FiBriefcase, label: 'Empresa' },
  { path: '/client/customers', icon: FiUsers, label: 'Clientes' },
  { path: '/client/categories', icon: FiGrid, label: 'Categorias' },
  { path: '/client/products', icon: FiPackage, label: 'Produtos' },
  { path: '/client/combos', icon: FiLayers, label: 'Combos' },
  { path: '/client/agent', icon: FiCpu, label: 'Agente' },
  { path: '/client/orders', icon: FiShoppingCart, label: 'Pedidos' },
  { path: '/client/store-site', icon: FiGlobe, label: 'Site' },
  { path: '/client/materials', icon: FiBox, label: 'Materiais' },
  { path: '/client/shopping-lists', icon: FiClipboard, label: 'Lista de Compras' },
  { path: '/client/recipes', icon: FiBookOpen, label: 'Receitas' },
]

export default function ClientLayout() {
  const { user, logout } = useAuth()
  const { dark, toggleTheme } = useTheme()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-green-700 dark:bg-gray-800 text-white px-4 py-3 md:hidden">
        <img src={logo} alt="ZapCakes" className="h-8 brightness-0 invert dark:brightness-100 dark:invert-0" />
        <button onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
      </div>

      {/* Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-green-700 dark:bg-gray-800 text-white flex flex-col transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-green-600 dark:border-gray-700 flex items-center justify-between">
          <div>
            <img src={logo} alt="ZapCakes" className="h-9 mb-1 brightness-0 invert dark:brightness-100 dark:invert-0" />
            <p className="text-green-200 dark:text-gray-400 text-sm">Painel do Cliente</p>
          </div>
          <button className="md:hidden" onClick={() => setMenuOpen(false)}>
            <FiX size={22} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? 'bg-green-600 dark:bg-gray-700 text-white' : 'text-green-100 dark:text-gray-300 hover:bg-green-600/50 dark:hover:bg-gray-700/50'
                }`}
              >
                <Icon size={20} />
                <span className="text-lg md:text-sm">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-green-600 dark:border-gray-700">
          <div className="text-lg md:text-sm text-green-200 dark:text-gray-400 mb-3">{user?.name}</div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-green-200 dark:text-gray-400 text-sm">
              {dark ? <FiMoon size={16} /> : <FiSun size={16} />}
              <span>{dark ? 'Escuro' : 'Claro'}</span>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-11 h-6 rounded-full transition-colors ${dark ? 'bg-green-500' : 'bg-green-600/40'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${dark ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 text-green-200 dark:text-gray-400 hover:text-white transition-colors"
          >
            <FiLogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 pt-16 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
