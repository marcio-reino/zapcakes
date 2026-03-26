import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/images/Logo.svg'

export default function Footer() {
  const [config, setConfig] = useState({})

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/public/site-config`)
      .then(r => r.json())
      .then(setConfig)
      .catch(() => {})
  }, [])

  const phone = config.company_phone || ''
  const phoneDigits = phone.replace(/\D/g, '')
  const email = config.company_email || ''

  const links = {
    Produto: [
      { label: 'Recursos', href: '#recursos' },
      { label: 'Preços', href: '#preco' },
      { label: 'Como Funciona', href: '#como-funciona' },
    ],
    Suporte: [
      ...(email ? [{ label: email, href: `mailto:${email}` }] : [{ label: 'Contato', href: '#' }]),
      ...(phoneDigits ? [{ label: phone, href: `https://wa.me/55${phoneDigits}` }] : [{ label: 'WhatsApp', href: '#' }]),
    ],
    Legal: [
      { label: 'Termos de Uso', to: '/termos-de-uso' },
      { label: 'Privacidade', to: '/privacidade' },
    ],
  }
  return (
    <footer className="bg-gray-900 text-gray-400 pt-16">
      <div className="max-w-7xl mx-auto px-6 pb-12 grid md:grid-cols-[1.5fr_2fr] gap-12 md:gap-16">
        <div>
          <img src={logo} alt="ZapCakes" className="h-20 brightness-0 invert opacity-80" />
          <p className="mt-4 text-sm max-w-xs">
            Automatize sua confeitaria com inteligência artificial no WhatsApp.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
          {Object.entries(links).map(([title, items]) => (
            <div key={title} className={title === 'Suporte' ? 'col-span-2 md:col-span-1' : ''}>
              <h4 className="text-white text-sm font-semibold mb-4">{title}</h4>
              <div className="flex flex-col gap-2">
                {items.map((l) => (
                  l.to ? (
                    <Link key={l.label} to={l.to} className="text-sm hover:text-primary-400 transition-colors">
                      {l.label}
                    </Link>
                  ) : (
                    <a key={l.label} href={l.href} className="text-sm hover:text-primary-400 transition-colors">
                      {l.label}
                    </a>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 py-6 text-center text-xs max-w-7xl mx-auto px-6">
        &copy; {new Date().getFullYear()} ZapCakes. Todos os direitos reservados.
      </div>
    </footer>
  )
}
