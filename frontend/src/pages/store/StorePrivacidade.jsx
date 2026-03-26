import { Link, useParams } from 'react-router-dom'

export default function StorePrivacidade() {
  const { slug } = useParams()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
      <p className="text-xs text-gray-500 mb-8">Ultima atualização: 25 de março de 2026</p>

      <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">1. Introdução</h2>
          <p>
            Esta Política de Privacidade descreve como coletamos, utilizamos e protegemos seus dados pessoais
            ao utilizar esta loja online, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">2. Dados Coletados</h2>
          <p>Coletamos os seguintes dados:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Nome completo</li>
            <li>Número de telefone/WhatsApp</li>
            <li>Endereço de entrega (quando aplicável)</li>
            <li>Histórico de pedidos realizados</li>
            <li>Dados de acesso (data, hora e IP)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">3. Finalidade do Tratamento</h2>
          <p>Seus dados são utilizados para:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Processamento e acompanhamento de pedidos</li>
            <li>Comunicação sobre status de encomendas</li>
            <li>Manutenção do histórico de pedidos em sua conta</li>
            <li>Atendimento automatizado via WhatsApp</li>
            <li>Segurança e prevenção contra fraudes</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">4. Compartilhamento de Dados</h2>
          <p>
            Seus dados são compartilhados com o estabelecimento responsável por esta loja para fins de
            processamento e entrega dos pedidos. A plataforma ZapCakes atua como intermediadora tecnológica
            e pode acessar dados para fins de suporte técnico e manutenção do sistema.
          </p>
          <p className="mt-2">
            Não vendemos, alugamos ou comercializamos seus dados pessoais com terceiros para fins de marketing.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">5. Armazenamento e Segurança</h2>
          <p>
            Seus dados são armazenados em servidores seguros com criptografia em trânsito (HTTPS/TLS).
            Senhas são armazenadas de forma criptografada e nunca em texto simples.
            Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">6. Seus Direitos (LGPD)</h2>
          <p>Você tem direito a:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Acessar seus dados pessoais</li>
            <li>Corrigir dados incompletos ou desatualizados</li>
            <li>Solicitar a exclusão de seus dados</li>
            <li>Revogar o consentimento a qualquer momento</li>
            <li>Solicitar a portabilidade de seus dados</li>
          </ul>
          <p className="mt-2">
            Para exercer seus direitos, entre em contato com o estabelecimento ou com a ZapCakes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">7. Cookies</h2>
          <p>
            Utilizamos cookies essenciais para manter sua sessão autenticada e o carrinho de compras funcionando.
            Esses cookies são necessários para o funcionamento básico da loja.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">8. Alterações nesta Política</h2>
          <p>
            Esta Política pode ser atualizada periodicamente. O uso continuado da loja após alterações
            constitui aceitação da nova política.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">9. Contato</h2>
          <p>
            Para questões sobre privacidade, entre em contato com o estabelecimento pelos canais
            de atendimento disponíveis ou acesse{' '}
            <a href="https://www.zapcakes.com" className="text-green-600 hover:underline" target="_blank" rel="noopener noreferrer">
              zapcakes.com
            </a>.
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
