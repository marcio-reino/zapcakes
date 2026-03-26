import { Link } from 'react-router-dom'
import logo from '../assets/images/Logo.svg'

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header simples */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/">
            <img src={logo} alt="ZapCakes" className="h-12" />
          </Link>
          <Link to="/" className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
            Voltar ao site
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mb-10">Ultima atualização: 25 de março de 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introdução</h2>
            <p>
              A ZapCakes valoriza a privacidade de seus usuários e está comprometida com a proteção de seus dados pessoais.
              Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos suas informações,
              em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Dados Coletados</h2>
            <p>Coletamos os seguintes tipos de dados:</p>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">2.1 Dados de Cadastro</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome completo e nome da empresa</li>
              <li>Endereço de e-mail</li>
              <li>Número de telefone/WhatsApp</li>
              <li>Endereço comercial</li>
              <li>CNPJ (quando aplicável)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">2.2 Dados de Uso</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Informações de acesso (data, hora, IP)</li>
              <li>Páginas visitadas e funcionalidades utilizadas</li>
              <li>Dados de pedidos e transações realizadas na plataforma</li>
              <li>Conteúdo inserido na plataforma (produtos, categorias, receitas)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">2.3 Dados de Clientes Finais (Loja Online)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome e número de telefone dos clientes que realizam pedidos</li>
              <li>Histórico de pedidos</li>
              <li>Endereço de entrega (quando aplicável)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Finalidade do Tratamento</h2>
            <p>Utilizamos seus dados para as seguintes finalidades:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Prestação e melhoria dos serviços da plataforma</li>
              <li>Processamento de pedidos e gestão de encomendas</li>
              <li>Comunicação com o usuário sobre atualizações, suporte e notificações</li>
              <li>Funcionamento do atendimento automatizado via WhatsApp com IA</li>
              <li>Análises estatísticas e relatórios de uso (dados agregados e anonimizados)</li>
              <li>Cumprimento de obrigações legais e regulatórias</li>
              <li>Segurança e prevenção contra fraudes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Compartilhamento de Dados</h2>
            <p>Seus dados podem ser compartilhados com:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Provedores de infraestrutura:</strong> serviços de hospedagem, armazenamento em nuvem e CDN</li>
              <li><strong>Serviços de comunicação:</strong> APIs de WhatsApp para envio de mensagens automatizadas</li>
              <li><strong>Provedores de IA:</strong> para processamento de linguagem natural no atendimento automatizado (os dados são processados de forma segura e não são utilizados para treinamento de modelos)</li>
              <li><strong>Serviços de e-mail:</strong> para envio de notificações e comunicações</li>
              <li><strong>Autoridades legais:</strong> quando exigido por lei ou ordem judicial</li>
            </ul>
            <p className="mt-2">
              Não vendemos, alugamos ou comercializamos seus dados pessoais com terceiros para fins de marketing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Armazenamento e Segurança</h2>
            <p>
              Seus dados são armazenados em servidores seguros com criptografia em trânsito (HTTPS/TLS) e em repouso.
              Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado,
              alteração, divulgação ou destruição, incluindo:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Criptografia de senhas com algoritmos seguros</li>
              <li>Autenticação via tokens JWT com expiração</li>
              <li>Controle de acesso baseado em perfis (roles)</li>
              <li>Backups regulares dos dados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Seus Direitos (LGPD)</h2>
            <p>De acordo com a LGPD, você tem direito a:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e acessar as informações</li>
              <li><strong>Correção:</strong> solicitar a correção de dados incompletos, inexatos ou desatualizados</li>
              <li><strong>Anonimização, bloqueio ou eliminação:</strong> de dados desnecessários ou excessivos</li>
              <li><strong>Portabilidade:</strong> solicitar a transferência de seus dados a outro fornecedor</li>
              <li><strong>Eliminação:</strong> solicitar a exclusão de dados tratados com base em consentimento</li>
              <li><strong>Revogação do consentimento:</strong> retirar o consentimento a qualquer momento</li>
            </ul>
            <p className="mt-2">
              Para exercer seus direitos, entre em contato conosco pelos canais indicados na seção de Contato.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Cookies</h2>
            <p>
              A Plataforma utiliza cookies e tecnologias similares para melhorar a experiência do usuário,
              manter sessões autenticadas e coletar dados de uso. Os cookies utilizados são essenciais para
              o funcionamento da plataforma e para manter você conectado à sua conta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Retenção de Dados</h2>
            <p>
              Seus dados pessoais são mantidos enquanto sua conta estiver ativa ou conforme necessário para
              prestação dos serviços. Após o cancelamento da conta, os dados serão mantidos por 30 dias
              para eventual reativação e, em seguida, permanentemente excluídos, exceto quando a retenção
              for necessária para cumprimento de obrigações legais.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Menores de Idade</h2>
            <p>
              A Plataforma não é direcionada a menores de 18 anos. Não coletamos intencionalmente dados
              de menores. Caso tome conhecimento de que dados de um menor foram coletados, entre em
              contato para que possamos removê-los.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Alterações nesta Política</h2>
            <p>
              Esta Política de Privacidade pode ser atualizada periodicamente. Alterações significativas
              serão comunicadas por e-mail ou notificação na Plataforma. Recomendamos a revisão periódica
              desta página para se manter informado sobre nossas práticas de privacidade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contato</h2>
            <p>
              Para questões relacionadas à privacidade e proteção de dados, entre em contato conosco
              através dos canais disponíveis em nosso site ou pelo e-mail informado na página de contato.
            </p>
          </section>
        </div>
      </main>

      {/* Footer simples */}
      <footer className="bg-gray-900 text-gray-400 py-6 text-center text-sm mt-12">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <span>&copy; {new Date().getFullYear()} ZapCakes. Todos os direitos reservados.</span>
          <div className="flex gap-4">
            <Link to="/termos-de-uso" className="hover:text-white transition-colors">Termos de Uso</Link>
            <Link to="/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
