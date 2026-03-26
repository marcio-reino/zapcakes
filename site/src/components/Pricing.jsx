import { useState, useEffect } from 'react'
import { HiCheck } from 'react-icons/hi'

const LOGIN_URL = import.meta.env.VITE_LOGIN_URL || '/login'
const API_URL = import.meta.env.VITE_API_URL || '/api'
const REGISTER_URL = `${LOGIN_URL}?mode=register`

function trackRegister() {
  fetch(`${API_URL}/public/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: 'register' }),
  }).catch(() => {})
}

function parseFeatures(raw) {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export default function Pricing() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/public/plans`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPlans(data) })
      .catch((err) => console.error('Erro ao carregar planos:', err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section id="preco" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-xl mx-auto mb-14">
          <span className="inline-block px-4 py-1.5 text-sm font-semibold text-primary-700 bg-primary-100 rounded-full mb-4">
            Comece hoje
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Invista no crescimento da sua confeitaria
          </h2>
          <p className="text-gray-500 text-lg">
            Sem fidelidade. Cancele quando quiser. Comece grátis agora mesmo.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className={`flex flex-wrap justify-center gap-8 ${plans.length === 1 ? 'max-w-md mx-auto' : ''}`}>
            {plans.map((plan) => {
              const features = parseFeatures(plan.features)
              const isPopular = plan.popular
              const priceInt = Math.floor(Number(plan.price))
              const priceDec = (Number(plan.price) % 1).toFixed(2).slice(2)

              return (
                <div
                  key={plan.id}
                  className={`relative w-full max-w-md p-10 md:p-12 rounded-2xl bg-white text-center border-2 transition-all ${
                    isPopular
                      ? 'border-primary-500 shadow-2xl'
                      : 'border-gray-200 shadow-lg hover:border-primary-500'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1 text-xs font-bold uppercase tracking-wider text-white bg-primary-600 rounded-full">
                      Mais popular
                    </div>
                  )}

                  <h3 className="text-xl font-bold text-gray-900 mt-2 mb-6">{plan.title}</h3>

                  <div className="flex items-baseline justify-center gap-1 mb-2">
                    <span className="text-2xl font-bold text-gray-500">R$</span>
                    <span className="text-6xl font-black text-gray-900 leading-none">{priceInt}</span>
                    {priceDec !== '00' && (
                      <span className="text-2xl font-bold text-gray-900">,{priceDec}</span>
                    )}
                    <span className="text-lg text-gray-400 font-medium">/mês</span>
                  </div>

                  {plan.description && (
                    <p className="text-gray-500 mb-8">{plan.description}</p>
                  )}

                  {features.length > 0 && (
                    <ul className="text-left space-y-3.5 mb-8">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                          <HiCheck className="text-primary-500 text-lg flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  <a
                    href={REGISTER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={trackRegister}
                    className="block w-full py-4 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-all hover:-translate-y-0.5 shadow-lg shadow-green-600/30 text-base text-center"
                  >
                    Começar {plan.trialDays || 15} dias grátis
                  </a>
                  <p className="mt-4 text-xs text-gray-400">Sem cartão de crédito. Cancele a qualquer momento.</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
