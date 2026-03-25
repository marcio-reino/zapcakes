import { useState, useEffect } from 'react'
import { FaWhatsapp } from 'react-icons/fa'

export default function WhatsAppButton() {
  const [phone, setPhone] = useState('')

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/public/site-config`)
      .then(r => r.json())
      .then(data => {
        const digits = (data.company_phone || '').replace(/\D/g, '')
        if (digits) setPhone(digits)
      })
      .catch(() => {})
  }, [])

  if (!phone) return null

  return (
    <a
      href={`https://wa.me/55${phone}`}
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
