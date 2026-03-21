import { HiCheck } from 'react-icons/hi'

const features = [
  'Agente IA no WhatsApp 24h',
  'Cardápio digital completo',
  'Pagamento PIX automático',
  'Agendamento de encomendas',
  'Gestão de entregas com taxa',
  'Dashboard e relatórios',
  'Gestão de clientes',
  'Suporte prioritário',
]

export default function Pricing() {
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
            Sem fidelidade. Cancele quando quiser. Comece grátis por 7 dias.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="reveal relative w-full max-w-md p-10 md:p-12 rounded-2xl bg-white border-2 border-primary-500 shadow-2xl text-center">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1 text-xs font-bold uppercase tracking-wider text-white bg-primary-600 rounded-full">
              Mais popular
            </div>

            <h3 className="text-xl font-bold text-gray-900 mt-2 mb-6">ZapCakes Pro</h3>

            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-2xl font-bold text-gray-500">R$</span>
              <span className="text-6xl font-black text-gray-900 leading-none">189</span>
              <span className="text-lg text-gray-400 font-medium">/mês</span>
            </div>
            <p className="text-gray-500 mb-8">Tudo que você precisa para automatizar sua confeitaria</p>

            <ul className="text-left space-y-3.5 mb-8">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                  <HiCheck className="text-primary-500 text-lg flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <a href="#" className="block w-full py-4 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-all hover:-translate-y-0.5 shadow-lg shadow-green-600/30 text-base">
              Começar 7 dias grátis
            </a>
            <p className="mt-4 text-xs text-gray-400">Sem cartão de crédito. Cancele a qualquer momento.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
