import { useState, useEffect } from 'react'
import { HiMenu, HiX } from 'react-icons/hi'
import logo from '../assets/images/Logo.svg'

const LOGIN_URL = import.meta.env.VITE_LOGIN_URL || '/login'
const REGISTER_URL = `${LOGIN_URL}?mode=register`

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '#como-funciona', label: 'Como Funciona' },
    { href: '#beneficios', label: 'Benefícios' },
    { href: '#recursos', label: 'Recursos' },
    { href: '#depoimentos', label: 'Depoimentos' },
    { href: '#preco', label: 'Preço' },
  ]

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-md' : 'bg-white/80 backdrop-blur-sm'}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-[96px]">
        <a href="#">
          <img src={logo} alt="ZapCakes" className="h-20" />
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center h-full gap-1">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="h-full flex items-center px-4 text-sm font-medium text-gray-600 hover:text-primary-600 hover:bg-primary-50 transition-all">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a href={LOGIN_URL} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 text-sm font-semibold text-primary-700 border-2 border-primary-600 rounded-lg hover:bg-primary-50 transition-all">
            Login
          </a>
          <a href={REGISTER_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-all hover:-translate-y-0.5 shadow-md shadow-green-600/30">
            Começar Agora
          </a>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-gray-700 p-1" aria-label="Menu">
          {menuOpen ? <HiX size={26} /> : <HiMenu size={26} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden bg-white border-t border-gray-100 shadow-lg px-6 py-4 flex flex-col gap-3 animate-fade-in">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="text-base font-medium text-gray-700 hover:text-primary-600 py-2">
              {l.label}
            </a>
          ))}
          <a href={LOGIN_URL} onClick={() => setMenuOpen(false)} className="mt-2 text-center px-6 py-3 border-2 border-primary-600 text-primary-700 font-semibold rounded-lg">
            Login
          </a>
          <a href={REGISTER_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className="text-center px-6 py-3 bg-primary-600 text-white font-semibold rounded-lg">
            Começar Agora
          </a>
        </nav>
      )}
    </header>
  )
}
