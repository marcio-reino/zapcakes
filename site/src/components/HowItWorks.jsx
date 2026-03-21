import { HiPencil, HiChatAlt2, HiCheckCircle } from 'react-icons/hi'

const steps = [
  {
    num: 1,
    icon: <HiPencil className="text-6xl text-primary-500" />,
    title: 'Cadastre seu Cardápio',
    desc: 'Adicione seus bolos, cupcakes, doces e combos com fotos, preços e descrições. Leva menos de 10 minutos!',
  },
  {
    num: 2,
    icon: <HiChatAlt2 className="text-6xl text-primary-500" />,
    title: 'Conecte ao WhatsApp',
    desc: 'Em poucos cliques, o ZapCakes se conecta ao seu WhatsApp e começa a atender seus clientes automaticamente.',
  },
  {
    num: 3,
    icon: <HiCheckCircle className="text-6xl text-primary-500" />,
    title: 'Relaxe e Produza',
    desc: 'Enquanto você cria suas delícias, o ZapCakes cuida dos pedidos, pagamentos, entregas e atendimento.',
  },
]

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-xl mx-auto mb-14">
          <span className="inline-block px-4 py-1.5 text-sm font-semibold text-primary-700 bg-primary-100 rounded-full mb-4">
            Simples assim
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Como o ZapCakes funciona?
          </h2>
          <p className="text-gray-500 text-lg">
            Em 3 passos simples, sua confeitaria estará funcionando no piloto automático.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((s, i) => (
            <div
              key={s.num}
              className={`reveal reveal-delay-${i + 1} relative text-center p-8 pt-10 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-xl hover:border-primary-200 hover:-translate-y-1.5 transition-all duration-300`}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center shadow-md shadow-green-500/30">
                {s.num}
              </div>
              <div className="flex justify-center mb-5">{s.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{s.title}</h3>
              <p className="text-gray-500 text-base leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
