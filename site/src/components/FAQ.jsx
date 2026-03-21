import { useState } from 'react'
import { HiPlus } from 'react-icons/hi'

const faqs = [
  {
    q: 'Preciso de conhecimento técnico para usar?',
    a: 'Não! O ZapCakes foi feito para confeiteiras, não para programadores. Se você sabe usar o WhatsApp, já sabe usar o ZapCakes. Nosso time te ajuda em toda a configuração inicial.',
  },
  {
    q: 'O ZapCakes funciona com meu WhatsApp pessoal?',
    a: 'Sim! O ZapCakes se conecta ao seu WhatsApp existente. Seus clientes continuam mandando mensagem para o mesmo número de sempre.',
  },
  {
    q: 'E se o cliente quiser falar com uma pessoa de verdade?',
    a: 'O agente IA é inteligente o suficiente para identificar quando o cliente precisa de atendimento humano e te notifica. Você pode intervir a qualquer momento.',
  },
  {
    q: 'Posso personalizar o cardápio e os preços?',
    a: 'Claro! Você tem controle total sobre categorias, produtos, preços, fotos, combos e promoções. Atualize quando quiser pelo painel administrativo.',
  },
  {
    q: 'Quanto tempo leva para começar a usar?',
    a: 'Em menos de 30 minutos você já pode ter sua confeitaria funcionando no ZapCakes. Cadastre seus produtos, conecte o WhatsApp e pronto!',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Perguntas Frequentes</h2>
        </div>

        <div className="max-w-2xl mx-auto space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={i}
                className={`reveal reveal-delay-${(i % 3) + 1} rounded-xl border overflow-hidden transition-all duration-300 ${
                  isOpen ? 'border-primary-400 shadow-md bg-white' : 'border-gray-200 bg-white hover:border-primary-300'
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left text-gray-800 font-semibold text-sm md:text-base"
                >
                  {faq.q}
                  <HiPlus className={`text-primary-500 text-xl flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="px-6 pb-5 text-gray-500 text-sm leading-relaxed">{faq.a}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
