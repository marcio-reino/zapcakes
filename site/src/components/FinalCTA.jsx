import { HiArrowRight } from 'react-icons/hi'

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

export default function FinalCTA() {
  return (
    <section className="py-24 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-center relative overflow-hidden">
      <div className="absolute top-[-50%] left-[-20%] w-[60%] h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_70%)] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <h2 className="reveal text-3xl md:text-4xl font-bold text-white mb-4">
          Pronta para transformar sua confeitaria?
        </h2>
        <p className="reveal reveal-delay-1 text-white/80 text-lg max-w-xl mx-auto mb-9">
          Junte-se a dezenas de confeiteiras que já trabalham com mais tranquilidade e vendem mais todos os dias.
        </p>
        <a
          href={REGISTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={trackRegister}
          className="reveal reveal-delay-2 inline-flex items-center gap-2 px-10 py-4 bg-white text-primary-700 font-bold rounded-xl shadow-xl hover:-translate-y-0.5 hover:shadow-2xl transition-all text-base"
        >
          Começar Grátis Agora
          <HiArrowRight className="text-lg" />
        </a>
      </div>
    </section>
  )
}
