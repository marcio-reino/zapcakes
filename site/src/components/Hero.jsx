import { useState, useEffect } from 'react'
import { HiPhone } from 'react-icons/hi'
import { HiCheckCircle } from 'react-icons/hi2'
import celularImg from '../assets/images/celular.png'

const LOGIN_URL = import.meta.env.VITE_LOGIN_URL || '/login'
const REGISTER_URL = `${LOGIN_URL}?mode=register`
const API_URL = import.meta.env.VITE_API_URL || '/api'

function trackRegister() {
  fetch(`${API_URL}/public/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: 'register' }),
  }).catch(() => {})
}

export default function Hero() {
  const [siteData, setSiteData] = useState({})

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/public/site-config`)
      .then(r => r.json())
      .then(setSiteData)
      .catch(() => {})
  }, [])

  const confeitarias = siteData.site_confeitarias || '50'
  const pedidos = siteData.site_pedidos || '+340'
  const satisfacao = siteData.site_satisfacao || '4.9'

  return (
    <section className="relative pt-36 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-gradient-to-br from-primary-50 via-emerald-50 to-green-50">
      {/* Background shapes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 w-[500px] h-[500px] rounded-full bg-primary-300/15 animate-float-slow" />
        <div className="absolute bottom-12 -left-20 w-[300px] h-[300px] rounded-full bg-primary-400/15 animate-float" />
        <div className="absolute top-48 left-[40%] w-[200px] h-[200px] rounded-full bg-yellow-300/15 animate-float-slower" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Text */}
        <div className="text-center md:text-left">
          <span className="inline-block px-4 py-2 text-sm font-semibold text-primary-700 bg-white border border-primary-200 rounded-full mb-6 opacity-0 animate-fade-in">
            Novo! Inteligência Artificial no WhatsApp
          </span>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6 opacity-0 animate-fade-in-delay">
            Você faz os <span className="text-primary-600">doces</span>,<br />
            o ZapCakes faz <span className="text-primary-600">o resto</span>.
          </h1>

          <p className="text-lg text-gray-500 max-w-xl mb-8 opacity-0 animate-fade-in-delay-2 mx-auto md:mx-0">
            Atenda seus clientes 24h pelo site e WhatsApp com inteligência artificial. Pedidos, entregas, agendamentos e financeiro — tudo automatizado em um só lugar.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start opacity-0 animate-fade-in-delay-2">
            <a href={REGISTER_URL} target="_blank" rel="noopener noreferrer" onClick={trackRegister} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-all hover:-translate-y-0.5 shadow-lg shadow-green-600/30 text-base">
              <HiPhone className="text-lg" />
              Quero Experimentar Grátis
            </a>
            <a href="#como-funciona" className="inline-flex items-center justify-center px-8 py-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-primary-500 hover:text-primary-700 hover:bg-primary-50 transition-all text-base">
              Saiba mais
            </a>
          </div>

          <div className="flex items-center gap-3 mt-10 justify-center md:justify-start opacity-0 animate-fade-in-delay-2">
            <div className="flex -space-x-2">
              {['bg-pink-400', 'bg-blue-400', 'bg-yellow-400', 'bg-purple-400'].map((bg, i) => (
                <span key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-white flex items-center justify-center text-xs font-bold text-white`}>
                  {['M', 'A', 'C', 'R'][i]}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              Mais de <strong className="text-gray-700">{confeitarias} confeitarias</strong> já automatizaram seus pedidos
            </p>
          </div>
        </div>

        {/* Phone image */}
        <div className="relative flex justify-center opacity-0 animate-fade-in-delay order-first md:order-last">
          <div className="max-w-[320px] md:max-w-[360px] transition-transform duration-500 hover:-translate-y-2 hover:rotate-1 drop-shadow-2xl">
            <img src={celularImg} alt="ZapCakes no WhatsApp" className="rounded-[28px]" />
          </div>

          {/* Floating cards */}
          <div className="hidden md:flex absolute bottom-20 -left-4 items-center gap-2 px-4 py-3 bg-white rounded-xl shadow-xl text-sm font-medium opacity-0 animate-slide-up">
            <HiCheckCircle className="text-primary-500 text-xl" />
            <span><strong>{pedidos}</strong> pedidos hoje</span>
          </div>
          <div className="hidden md:flex absolute top-20 -right-2 items-center gap-2 px-4 py-3 bg-white rounded-xl shadow-xl text-sm font-medium opacity-0 animate-slide-up">
            <span className="text-yellow-400 text-base">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
            <span>{satisfacao} satisfação</span>
          </div>
        </div>
      </div>

      {/* Wave */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="block w-full h-auto">
          <path d="M0,64 C360,120 720,0 1080,64 C1260,96 1380,80 1440,64 L1440,120 L0,120 Z" fill="#fff" />
        </svg>
      </div>
    </section>
  )
}
