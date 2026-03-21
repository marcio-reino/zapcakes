import { FaWhatsapp } from 'react-icons/fa'

export default function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/5522998524209"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco no WhatsApp"
      className="fixed bottom-6 right-6 z-50 group"
    >
      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
      {/* Button */}
      <span className="relative w-16 h-16 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg shadow-green-500/40 group-hover:scale-110 transition-transform duration-300">
        <FaWhatsapp className="text-white text-3xl" />
      </span>
    </a>
  )
}
