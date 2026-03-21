import { HiClock, HiCurrencyDollar, HiEye, HiLocationMarker } from 'react-icons/hi'
import cupcakesImg from '../assets/images/cupcakes.png'

const benefits = [
  {
    icon: <HiClock className="text-xl text-primary-500" />,
    title: 'Atendimento 24 horas',
    desc: 'Seu cliente faz pedido a qualquer hora, mesmo quando você está dormindo ou com as mãos na massa.',
  },
  {
    icon: <HiCurrencyDollar className="text-xl text-primary-500" />,
    title: 'Financeiro sempre em dia',
    desc: 'Controle de pagamentos, PIX automático, relatórios de vendas — tudo organizado no painel.',
  },
  {
    icon: <HiEye className="text-xl text-primary-500" />,
    title: 'Zero pedidos perdidos',
    desc: 'Nenhuma mensagem fica sem resposta. Cada cliente é atendido com atenção e rapidez.',
  },
  {
    icon: <HiLocationMarker className="text-xl text-primary-500" />,
    title: 'Gestão de entregas',
    desc: 'Taxa de entrega automática, rastreamento de pedidos e notificações via WhatsApp.',
  },
]

export default function Benefits() {
  return (
    <section id="beneficios" className="py-24 bg-primary-50">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        {/* Image */}
        <div className="reveal relative">
          <img src={cupcakesImg} alt="Cupcakes coloridos" className="rounded-2xl shadow-2xl" />
          <div className="absolute -bottom-6 -right-4 md:-right-6 bg-white px-6 py-4 rounded-xl shadow-xl text-center">
            <span className="block text-3xl font-extrabold text-primary-600">87%</span>
            <span className="text-xs text-gray-500 max-w-[140px] block">menos tempo gasto com atendimento</span>
          </div>
        </div>

        {/* Text */}
        <div className="reveal reveal-delay-2">
          <span className="inline-block px-4 py-1.5 text-sm font-semibold text-primary-700 bg-primary-100 rounded-full mb-4">
            Por que ZapCakes?
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-5">
            Foque no que você ama: <span className="text-primary-600">criar doces incríveis</span>
          </h2>
          <p className="text-gray-600 text-xl font-medium mb-8">
            Sabemos que seu talento está na confeitaria, não em ficar o dia todo no celular respondendo mensagens. O ZapCakes assume toda a parte chata para você.
          </p>

          <ul className="space-y-6">
            {benefits.map((b, i) => (
              <li key={i} className="flex gap-4">
                <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-primary-100 flex items-center justify-center">
                  {b.icon}
                </div>
                <div>
                  <strong className="block text-gray-900 mb-1">{b.title}</strong>
                  <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
