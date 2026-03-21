const testimonials = [
  {
    text: '"Antes eu passava horas no WhatsApp respondendo mensagens. Agora o ZapCakes faz isso por mim e eu consigo produzir o dobro de encomendas!"',
    name: 'Marina Silva',
    role: 'Mari Cupcakes - SP',
    avatar: 'M',
    avatarBg: 'bg-pink-400',
    featured: false,
  },
  {
    text: '"O financeiro sempre foi meu pesadelo. Com o ZapCakes, tudo fica organizado automaticamente. Sei exatamente quanto vendi, quanto recebi e quanto tenho a receber."',
    name: 'Carla Mendes',
    role: 'Doce Carla - RJ',
    avatar: 'C',
    avatarBg: 'bg-blue-400',
    featured: true,
  },
  {
    text: '"Meus clientes adoram poder fazer pedidos a qualquer hora. Minha confeitaria cresceu 40% nos primeiros 3 meses usando o ZapCakes!"',
    name: 'Patrícia Oliveira',
    role: 'Pati Bolos - MG',
    avatar: 'P',
    avatarBg: 'bg-purple-400',
    featured: false,
  },
]

export default function Testimonials() {
  return (
    <section id="depoimentos" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-xl mx-auto mb-14">
          <span className="inline-block px-4 py-1.5 text-sm font-semibold text-primary-700 bg-primary-100 rounded-full mb-4">
            Quem usa, ama
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            O que nossas confeiteiras dizem
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className={`reveal reveal-delay-${i + 1} p-8 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                t.featured
                  ? 'bg-gradient-to-br from-primary-50 to-white border-2 border-primary-300 shadow-lg'
                  : 'bg-white border border-gray-100'
              }`}
            >
              <div className="text-yellow-400 text-lg mb-4 tracking-wider">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <p className="text-gray-600 text-sm italic leading-relaxed mb-6">{t.text}</p>
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded-full ${t.avatarBg} flex items-center justify-center text-white font-bold text-sm`}>
                  {t.avatar}
                </span>
                <div>
                  <strong className="block text-gray-900 text-sm">{t.name}</strong>
                  <span className="text-xs text-gray-400">{t.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
