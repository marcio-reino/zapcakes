import logo from '../assets/images/Logo.svg'

const links = {
  Produto: [
    { label: 'Recursos', href: '#recursos' },
    { label: 'Preços', href: '#preco' },
    { label: 'Como Funciona', href: '#como-funciona' },
  ],
  Suporte: [
    { label: 'Central de Ajuda', href: '#' },
    { label: 'Contato', href: '#' },
    { label: 'WhatsApp', href: '#' },
  ],
  Legal: [
    { label: 'Termos de Uso', href: '#' },
    { label: 'Privacidade', href: '#' },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 pt-16">
      <div className="max-w-7xl mx-auto px-6 pb-12 grid md:grid-cols-[1.5fr_2fr] gap-12 md:gap-16">
        <div>
          <img src={logo} alt="ZapCakes" className="h-20 brightness-0 invert opacity-80" />
          <p className="mt-4 text-sm max-w-xs">
            Automatize sua confeitaria com inteligência artificial no WhatsApp.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8">
          {Object.entries(links).map(([title, items]) => (
            <div key={title}>
              <h4 className="text-white text-sm font-semibold mb-4">{title}</h4>
              <div className="flex flex-col gap-2">
                {items.map((l) => (
                  <a key={l.label} href={l.href} className="text-sm hover:text-primary-400 transition-colors">
                    {l.label}
                  </a>
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
