import { Link, useParams } from 'react-router-dom'

export default function StoreTermos() {
  const { slug } = useParams()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Termos de Uso</h1>
      <p className="text-xs text-gray-500 mb-8">Ultima atualização: 25 de março de 2026</p>

      <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">1. Aceitação dos Termos</h2>
          <p>
            Ao acessar e utilizar esta loja online, você concorda integralmente com estes Termos de Uso.
            Caso não concorde com qualquer disposição, solicitamos que não utilize nossos serviços.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">2. Descrição do Serviço</h2>
          <p>
            Esta loja online é uma plataforma de encomendas que permite a visualização de produtos,
            realização de pedidos e acompanhamento de encomendas. Os pedidos realizados estão sujeitos
            à disponibilidade e confirmação pelo estabelecimento.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">3. Cadastro e Conta</h2>
          <p>
            Para realizar pedidos, é necessário criar uma conta fornecendo seu nome e número de telefone.
            Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas
            as atividades realizadas em sua conta.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">4. Pedidos e Pagamentos</h2>
          <p>
            Os pedidos realizados através da loja estão sujeitos à confirmação pelo estabelecimento.
            Os preços exibidos podem sofrer alterações sem aviso prévio. As condições de pagamento
            e entrega são definidas pelo estabelecimento e informadas durante o processo de compra.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">5. Cancelamento e Devoluções</h2>
          <p>
            Pedidos podem ser cancelados conforme as políticas do estabelecimento. Em caso de problemas
            com o pedido, entre em contato diretamente com o estabelecimento pelos canais de atendimento disponíveis.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">6. Uso Aceitável</h2>
          <p>Ao utilizar a loja, você concorda em:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Fornecer informações verdadeiras e completas</li>
            <li>Não utilizar o serviço para fins ilegais</li>
            <li>Não tentar acessar áreas restritas do sistema</li>
            <li>Respeitar a legislação vigente, incluindo o Código de Defesa do Consumidor</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">7. Limitação de Responsabilidade</h2>
          <p>
            Esta plataforma é fornecida pela ZapCakes como intermediadora tecnológica. A responsabilidade
            pelos produtos, preços, qualidade e entrega é do estabelecimento. A ZapCakes não se responsabiliza
            por questões comerciais entre o cliente e o estabelecimento.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">8. Alterações nos Termos</h2>
          <p>
            Estes Termos podem ser modificados a qualquer momento. O uso continuado da loja após alterações
            constitui aceitação dos novos termos.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">9. Legislação Aplicável</h2>
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-4 border-t">
        <Link to={`/loja/${slug}`} className="text-green-600 font-medium text-sm hover:underline">
          ← Voltar para a loja
        </Link>
      </div>
    </div>
  )
}
