import { FaWhatsapp } from 'react-icons/fa'
import { HiCurrencyDollar, HiLocationMarker, HiDesktopComputer } from 'react-icons/hi'

const items = [
  { icon: <FaWhatsapp className="text-4xl text-green-500" />, label: 'WhatsApp' },
  { icon: <HiCurrencyDollar className="text-4xl text-indigo-500" />, label: 'PIX' },
  { icon: <HiLocationMarker className="text-4xl text-red-400" />, label: 'Entregas' },
  { icon: <HiDesktopComputer className="text-4xl text-sky-500" />, label: 'Painel Admin' },
]

export default function SocialProof() {
  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-base text-gray-400 uppercase tracking-wider font-medium mb-6">
          Integrado com as ferramentas que você já usa
        </p>
        <div className="flex justify-center flex-wrap gap-10 md:gap-16">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3 text-gray-500 text-lg font-semibold opacity-70 hover:opacity-100 transition-opacity">
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
