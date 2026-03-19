import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { FiHome, FiUsers, FiPackage, FiGrid, FiShoppingCart, FiLogOut, FiMoon, FiSun, FiLayers, FiCpu } from 'react-icons/fi'

const menuItems = [
  { path: '/admin', icon: FiHome, label: 'Dashboard' },
  { path: '/admin/clients', icon: FiUsers, label: 'Clientes' },
  { path: '/admin/categories', icon: FiGrid, label: 'Categorias' },
  { path: '/admin/products', icon: FiPackage, label: 'Produtos' },
  { path: '/admin/combos', icon: FiLayers, label: 'Combos' },
  { path: '/admin/agent', icon: FiCpu, label: 'Agente' },
  { path: '/admin/orders', icon: FiShoppingCart, label: 'Pedidos' },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { dark, toggleTheme } = useTheme()
  const location = useLocation()

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-green-800 dark:bg-gray-800 text-white flex flex-col">
        <div className="p-6 border-b border-green-700 dark:border-gray-700">
          <h1 className="text-xl font-bold">ZapCakes</h1>
          <p className="text-green-300 dark:text-gray-400 text-sm">Agente de atendimento</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? 'bg-green-700 dark:bg-gray-700 text-white' : 'text-green-200 dark:text-gray-300 hover:bg-green-700/50 dark:hover:bg-gray-700/50'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-green-700 dark:border-gray-700">
          <div className="text-sm text-green-300 dark:text-gray-400 mb-3">{user?.name}</div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-green-300 dark:text-gray-400 text-sm">
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
            className="flex items-center gap-2 text-green-300 dark:text-gray-400 hover:text-white transition-colors"
          >
            <FiLogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
