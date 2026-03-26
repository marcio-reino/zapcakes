import { Link } from 'react-router-dom'
import logo from '../assets/images/Logo.svg'

export default function TermosDeUso() {
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
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Termos de Uso</h1>
        <p className="text-sm text-gray-500 mb-10">Ultima atualização: 25 de março de 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar a plataforma ZapCakes ("Plataforma"), você concorda integralmente com estes Termos de Uso.
              Caso não concorde com qualquer disposição, solicitamos que não utilize nossos serviços.
              A utilização continuada da Plataforma constitui aceitação de eventuais atualizações destes Termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Descrição do Serviço</h2>
            <p>
              A ZapCakes é uma plataforma SaaS (Software as a Service) que oferece ferramentas de automação para
              confeitarias e estabelecimentos do ramo alimentício, incluindo:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Atendimento automatizado via WhatsApp com inteligência artificial</li>
              <li>Gestão de pedidos, produtos, categorias e combos</li>
              <li>Loja online personalizada para recebimento de encomendas</li>
              <li>Gestão de clientes, materiais, receitas e listas de compras</li>
              <li>Painel administrativo para acompanhamento de métricas e operações</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Cadastro e Conta</h2>
            <p>
              Para utilizar a Plataforma, é necessário criar uma conta fornecendo informações verdadeiras, completas e
              atualizadas. Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas
              as atividades realizadas em sua conta. Notifique-nos imediatamente caso suspeite de uso não autorizado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Planos e Pagamentos</h2>
            <p>
              A Plataforma oferece diferentes planos de assinatura com funcionalidades específicas. Os valores,
              condições de pagamento e funcionalidades de cada plano estão descritos na página de preços.
              Reservamo-nos o direito de alterar os valores com aviso prévio de 30 dias. A falta de pagamento
              poderá resultar na suspensão ou cancelamento da conta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Uso Aceitável</h2>
            <p>Ao utilizar a Plataforma, você concorda em:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Não utilizar o serviço para fins ilegais ou não autorizados</li>
              <li>Não enviar mensagens de spam ou conteúdo abusivo através do sistema de WhatsApp</li>
              <li>Não tentar acessar áreas restritas da Plataforma sem autorização</li>
              <li>Não reproduzir, duplicar ou revender qualquer parte do serviço</li>
              <li>Respeitar a legislação vigente, incluindo o Código de Defesa do Consumidor e a LGPD</li>
              <li>Não utilizar a Plataforma de forma que possa prejudicar, desabilitar ou sobrecarregar nossos servidores</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo da Plataforma, incluindo mas não se limitando a textos, gráficos, logos, ícones,
              imagens, código-fonte e software, é de propriedade exclusiva da ZapCakes ou de seus licenciadores
              e está protegido pelas leis de propriedade intelectual aplicáveis.
              O conteúdo inserido pelos usuários (produtos, imagens, textos) permanece de propriedade do respectivo usuário.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Disponibilidade do Serviço</h2>
            <p>
              Nos empenhamos para manter a Plataforma disponível 24 horas por dia, 7 dias por semana.
              Contudo, não garantimos disponibilidade ininterrupta, podendo ocorrer períodos de manutenção,
              atualizações ou circunstâncias fora de nosso controle. Não seremos responsáveis por eventuais
              prejuízos decorrentes da indisponibilidade temporária do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitação de Responsabilidade</h2>
            <p>
              A ZapCakes não se responsabiliza por danos indiretos, incidentais, especiais ou consequentes
              resultantes do uso ou da impossibilidade de uso da Plataforma. Nossa responsabilidade total
              será limitada ao valor pago pelo usuário nos últimos 12 meses de uso do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Cancelamento</h2>
            <p>
              Você pode cancelar sua conta a qualquer momento. Após o cancelamento, seus dados serão mantidos
              por 30 dias para eventual reativação, sendo permanentemente excluídos após esse período.
              A ZapCakes também reserva o direito de suspender ou cancelar contas que violem estes Termos de Uso.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Alterações nos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento.
              Alterações significativas serão comunicadas por e-mail ou por notificação na Plataforma.
              O uso continuado após a publicação das alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Legislação Aplicável</h2>
            <p>
              Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil.
              Qualquer litígio será submetido ao foro da comarca da sede da ZapCakes, com exclusão de
              qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contato</h2>
            <p>
              Em caso de dúvidas sobre estes Termos de Uso, entre em contato conosco através
              dos canais disponíveis em nosso site ou pelo e-mail informado na página de contato.
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
