import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { FiHome, FiUsers, FiCreditCard, FiDollarSign, FiSettings, FiLogOut, FiMoon, FiSun, FiMenu, FiX, FiCpu, FiMessageSquare } from 'react-icons/fi'
import logo from '../assets/logo.svg'

const PREFIX = '/admin-cwxp15'

const menuItems = [
  { path: PREFIX, icon: FiHome, label: 'Dashboard' },
  { path: `${PREFIX}/accounts`, icon: FiUsers, label: 'Contas' },
  { path: `${PREFIX}/plans`, icon: FiCreditCard, label: 'Planos' },
  { path: `${PREFIX}/financial`, icon: FiDollarSign, label: 'Financeiro' },
  { path: `${PREFIX}/ai`, icon: FiCpu, label: 'IA' },
  { path: `${PREFIX}/simulator`, icon: FiMessageSquare, label: 'Agente Teste' },
  { path: `${PREFIX}/config`, icon: FiSettings, label: 'Configurações' },
]

export default function SuperadminLayout() {
  const { user, logout } = useAuth()
  const { dark, toggleTheme } = useTheme()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (path) => {
    if (path === PREFIX) return location.pathname === PREFIX
    return location.pathname.startsWith(path)
  }

  const sidebar = (
    <>
      <div className="p-6 border-b border-green-700 dark:border-gray-700">
        <img src={logo} alt="ZapCakes" className="h-9 mb-1 brightness-0 invert dark:brightness-100 dark:invert-0" />
        <p className="text-green-300 dark:text-gray-400 text-sm">Painel do Sistema</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active ? 'bg-green-700 dark:bg-gray-700 text-white' : 'text-green-200 dark:text-gray-300 hover:bg-green-700/50 dark:hover:bg-gray-700/50'
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
    </>
  )

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 bg-green-800 dark:bg-gray-800 text-white flex-col">
        {sidebar}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-green-800 dark:bg-gray-800 text-white flex items-center justify-between px-4 py-3">
        <img src={logo} alt="ZapCakes" className="h-8 brightness-0 invert dark:brightness-100 dark:invert-0" />
        <button onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-green-800 dark:bg-gray-800 text-white flex flex-col">
            {sidebar}
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 mt-14 md:mt-0">
        <Outlet />
      </main>
    </div>
  )
}
