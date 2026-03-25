import { HiChatAlt2, HiCreditCard, HiCalendar, HiUserAdd, HiChartBar, HiLocationMarker } from 'react-icons/hi'

const features = [
  {
    icon: <HiChatAlt2 className="text-2xl text-green-600" />,
    bg: 'bg-green-100',
    title: 'Agente IA no WhatsApp',
    desc: 'Inteligência artificial que conversa naturalmente com seus clientes, mostra o cardápio, tira dúvidas e fecha pedidos.',
  },
  {
    icon: <HiCreditCard className="text-2xl text-blue-600" />,
    bg: 'bg-blue-100',
    title: 'Pagamento por PIX',
    desc: 'Gere cobranças PIX automáticas. O cliente paga e o pedido é confirmado instantaneamente.',
  },
  {
    icon: <HiCalendar className="text-2xl text-amber-600" />,
    bg: 'bg-amber-100',
    title: 'Agendamento',
    desc: 'Seus clientes agendam encomendas para datas especiais direto pelo WhatsApp. Sem confusão!',
  },
  {
    icon: <HiUserAdd className="text-2xl text-pink-600" />,
    bg: 'bg-pink-100',
    title: 'Gestão de Clientes',
    desc: 'Base de clientes organizada com histórico de pedidos, preferências e contatos salvos.',
  },
  {
    icon: <HiChartBar className="text-2xl text-violet-600" />,
    bg: 'bg-violet-100',
    title: 'Relatórios e Dashboards',
    desc: 'Veja suas vendas, produtos mais pedidos, faturamento e muito mais em gráficos intuitivos.',
  },
  {
    icon: <HiLocationMarker className="text-2xl text-sky-600" />,
    bg: 'bg-sky-100',
    title: 'Entrega Inteligente',
    desc: 'Calcule taxas de entrega, organize rotas e notifique clientes sobre o status do pedido.',
  },
]

export default function Features() {
  return (
    <section id="recursos" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-xl mx-auto mb-14">
          <span className="inline-block px-4 py-1.5 text-sm font-semibold text-primary-700 bg-primary-100 rounded-full mb-4">
            Tudo o que você precisa
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Recursos poderosos, interface simples
          </h2>
          <p className="text-gray-500 text-lg">
            O ZapCakes tem tudo para sua confeitaria vender mais e trabalhar menos.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className={`reveal reveal-delay-${(i % 3) + 1} p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-xl hover:border-primary-200 hover:-translate-y-1 transition-all duration-300`}
            >
              <div className={`w-12 h-12 rounded-lg ${f.bg} flex items-center justify-center mb-5`}>
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
