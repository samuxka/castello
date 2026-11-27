import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  Building2,
  Users,
  CheckCircle2,
  Lock,
  Share2,
  AlertTriangle,
  Scale,
  Sun,
  Moon,
} from 'lucide-react';
import { applyTheme, getSavedTheme, saveTheme } from '../lib/supabase';

interface TermsOfServicePageProps {
  onBack?: () => void;
  onOpenPrivacy?: () => void;
}

export const TermsOfServicePage: React.FC<TermsOfServicePageProps> = ({
  onBack,
  onOpenPrivacy,
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getSavedTheme().mode);
  const themeColor = getSavedTheme().color;

  useEffect(() => {
    applyTheme(themeColor, theme);
  }, [theme, themeColor]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    saveTheme(themeColor, next);
  };

  const handleGoBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleGoPrivacy = () => {
    if (onOpenPrivacy) {
      onOpenPrivacy();
      return;
    }
    window.history.pushState({}, '', '/privacidade');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="client-portal-wrap" style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px 64px' }}>
        {/* Barra Superior Pública */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            paddingBottom: 20,
            marginBottom: 28,
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src="/logo.webp"
              alt="Castello"
              width={42}
              height={42}
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                objectFit: 'contain',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
              }}
            />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>
                Castello
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Sistema de Gestão de Obras e Registo de Ponto
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-flat-secondary"
              onClick={handleGoPrivacy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
            >
              <ShieldCheck size={14} />
              <span>Política de Privacidade</span>
            </button>

            <button
              type="button"
              className="btn-flat-secondary"
              onClick={toggleTheme}
              title="Alternar Tema"
              style={{ padding: '8px 10px' }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              type="button"
              className="btn-flat-primary"
              onClick={handleGoBack}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
            >
              <ArrowLeft size={14} />
              <span>Voltar ao Sistema</span>
            </button>
          </div>
        </header>

        {/* Cabeçalho do Documento */}
        <div
          className="content-panel"
          style={{
            padding: '28px 32px',
            borderRadius: 14,
            marginBottom: 20,
            borderLeft: '4px solid var(--primary)',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span className="badge-flat primary" style={{ fontSize: 11, fontWeight: 700 }}>
              DOCUMENTO PÚBLICO OFICIAL • CONDIÇÕES GERAIS DE UTILIZAÇÃO
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px', letterSpacing: -0.5 }}>
            Termos de Serviço
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            Última atualização: 27 de novembro de 2026 • Aplicável ao painel Web{' '}
            <strong>Castello ERP</strong> (<code>erpcastle.com</code>) e à aplicação móvel{' '}
            <strong>Castello Mobile</strong>.
          </p>
        </div>

        {/* Corpo dos Termos de Serviço */}
        <div
          className="content-panel"
          style={{
            padding: '32px',
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 26,
            lineHeight: 1.7,
            fontSize: 14,
          }}
        >
          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={19} color="var(--primary)" />
              1. Objeto e Aceitação dos Termos
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Os presentes Termos de Serviço regulam o acesso e a utilização da plataforma{' '}
              <strong>Castello</strong> (painel de administração Web e aplicação móvel para
              colaboradores). Ao criar uma conta de firma, aceder ao painel administrativo ou
              iniciar sessão na aplicação móvel, o utilizador declara ter lido, compreendido e
              aceite integralmente estas condições.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={19} color="var(--primary)" />
              2. Contas de Firma e Administração (Painel Web)
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              A firma registada no painel Web é a titular e responsável pelos dados operacionais
              inseridos no seu ambiente, incluindo o cadastro de obras, tarefas, registos
              financeiros, viaturas, inventário e perfis de colaboradores. O administrador da firma
              compromete-se a fornecer informações verídicas e a manter a confidencialidade das suas
              credenciais de acesso.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={19} color="var(--primary)" />
              3. Acesso de Colaboradores e Registo de Ponto (App Mobile)
            </h2>
            <p style={{ margin: '0 0 10px', color: 'var(--text-muted)' }}>
              Os colaboradores acedem à aplicação móvel através do e-mail corporativo e do código
              PIN único gerado pela sua firma empregadora:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>
                O código PIN é pessoal, intransmissível e bloqueado contra alterações não
                autorizadas após a sua atribuição.
              </li>
              <li>
                Os registos de entrada, pausa para almoço, saída, sessões em obra e justificações de
                falta devem refletir fielmente a jornada real realizada pelo trabalhador, ficando
                sujeitos à validação da gerência da firma.
              </li>
              <li>
                É estritamente proibido efetuar picagens de ponto em nome de terceiros ou submeter
                comprovativos falsos.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Share2 size={19} color="var(--primary)" />
              4. Portal Público de Acompanhamento do Cliente
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              O Castello permite que a firma partilhe um código ou link específico de acompanhamento
              de obra (<code>share_code</code>) com o seu cliente final. Esse portal exibe
              exclusivamente o progresso físico, diários de obra, documentos autorizados e marcos da
              respetiva obra, mantendo o isolamento total em relação às demais obras e despesas
              internas da construtora.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={19} color="var(--primary)" />
              5. Propriedade Intelectual e Propriedade dos Dados
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Todo o software, interface, logótipos e arquitetura da plataforma Castello constituem
              propriedade intelectual reservada. Todos os dados de obras, documentos, fotografias e
              registos financeiros introduzidos por cada firma permanecem de propriedade exclusiva
              dessa firma.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={19} color="var(--primary)" />
              6. Uso Aceitável, Disponibilidade e Limitação de Responsabilidade
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              É vedada qualquer tentativa de contornar mecanismos de autenticação, explorar falhas
              de segurança ou interferir na disponibilidade da plataforma. O Castello emprega as
              melhores práticas de segurança e alta disponibilidade em nuvem, funcionando como
              ferramenta de apoio à gestão operacional, cabendo à firma utilizadora a conferência
              final de folhas salariais, obrigações fiscais e conformidade legal trabalhista.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scale size={19} color="var(--primary)" />
              7. Encerramento de Conta, Alterações e Contacto
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              A firma pode encerrar a sua conta e solicitar a remoção dos seus dados a qualquer
              momento através da página de Configurações. O Castello poderá atualizar estes Termos
              para refletir melhorias funcionais ou exigências legais. Dúvidas ou solicitações
              contratuais podem ser enviadas para{' '}
              <strong style={{ color: 'var(--text-main)' }}>suporte@erpcastle.com</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
