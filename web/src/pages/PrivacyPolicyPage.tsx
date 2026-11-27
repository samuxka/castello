import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  Lock,
  Database,
  Smartphone,
  Globe,
  UserCheck,
  Mail,
  Sun,
  Moon,
} from 'lucide-react';
import { applyTheme, getSavedTheme, saveTheme } from '../lib/supabase';

interface PrivacyPolicyPageProps {
  onBack?: () => void;
  onOpenTerms?: () => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({
  onBack,
  onOpenTerms,
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

  const handleGoTerms = () => {
    if (onOpenTerms) {
      onOpenTerms();
      return;
    }
    window.history.pushState({}, '', '/termos');
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
              onClick={handleGoTerms}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
            >
              <FileText size={14} />
              <span>Termos de Serviço</span>
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
              DOCUMENTO PÚBLICO OFICIAL • RGPD / GDPR & LGPD
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px', letterSpacing: -0.5 }}>
            Política de Privacidade
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            Última atualização: 27 de novembro de 2026 • Aplicável à plataforma Web{' '}
            <strong>Castello ERP</strong> (<code>erpcastle.com</code>) e à aplicação móvel{' '}
            <strong>Castello Mobile</strong> (Android & iOS).
          </p>
        </div>

        {/* Corpo da Política de Privacidade */}
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
              <ShieldCheck size={19} color="var(--primary)" />
              1. Compromisso com a Privacidade e Âmbito
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              A plataforma <strong>Castello</strong> é um sistema corporativo de gestão de obras,
              controlo de assiduidade (picagem de ponto), frotas, inventário e gestão financeira
              para empresas de construção civil. Esta Política de Privacidade descreve de forma
              transparente como recolhemos, utilizamos, armazenamos e protegemos os dados pessoais
              dos administradores de firmas, colaboradores no terreno e clientes finais que
              consultam o Portal de Acompanhamento de Obra.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={19} color="var(--primary)" />
              2. Dados Recolhidos e Tratados
            </h2>
            <p style={{ margin: '0 0 10px', color: 'var(--text-muted)' }}>
              Recolhemos estritamente os dados necessários para a operação contratual e laboral da
              empresa utilizadora:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>
                <strong style={{ color: 'var(--text-main)' }}>Dados da Firma (Painel Web):</strong>{' '}
                nome da empresa, NIF / identificação fiscal, e-mail corporativo do responsável,
                telefone de contacto, logotipo e registos operacionais de obras e finanças.
              </li>
              <li>
                <strong style={{ color: 'var(--text-main)' }}>Dados de Colaboradores:</strong>{' '}
                nome completo, e-mail de trabalho, código PIN de acesso, cargo/função, telefone,
                data de admissão, taxa horária contratual e foto de perfil opcional.
              </li>
              <li>
                <strong style={{ color: 'var(--text-main)' }}>Registos de Ponto e Assiduidade:</strong>{' '}
                data e hora de entrada, início/fim de pausa para almoço, saída, obra associada,
                histórico de turnos e justificações de ausência (incluindo anexos ou atestados
                submetidos pelo colaborador).
              </li>
              <li>
                <strong style={{ color: 'var(--text-main)' }}>Fotografias de Obra, Frotas e Perfil:</strong>{' '}
                imagens capturadas pela câmara ou selecionadas da galeria exclusivamente quando o
                utilizador aciona o envio de foto de perfil, comprovativo de falta, registo
                fotográfico de obra ou relatório de avaria de viatura.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Smartphone size={19} color="var(--primary)" />
              3. Permissões da Aplicação Móvel (Android e iOS)
            </h2>
            <p style={{ margin: '0 0 10px', color: 'var(--text-muted)' }}>
              A aplicação <strong>Castello Mobile</strong> solicita apenas permissões técnicas
              indispensáveis ao funcionamento das ferramentas do trabalhador:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>
                <strong style={{ color: 'var(--text-main)' }}>Biometria / Face ID (Processamento 100% Local):</strong>{' '}
                utilizada apenas para desbloquear a sessão JWT segura no próprio telemóvel através
                da API nativa do sistema operativo. O Castello nunca recolhe, lê nem transmite
                dados biométricos ou impressões digitais para qualquer servidor.
              </li>
              <li>
                <strong style={{ color: 'var(--text-main)' }}>Câmara e Galeria de Fotos:</strong>{' '}
                utilizadas somente mediante ação explícita do colaborador para anexar comprovativos
                de ausência, fotos de evolução de obra, ocorrências de viaturas ou atualização de
                avatar.
              </li>
              <li>
                <strong style={{ color: 'var(--text-main)' }}>Notificações e Alarme de Almoço:</strong>{' '}
                utilizadas localmente no aparelho para avisar o colaborador sobre o término do
                intervalo de almoço (1 hora) e comunicados internos da sua firma.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={19} color="var(--primary)" />
              4. Isolamento Multi-Tenant e Segurança da Informação
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              O Castello aplica políticas rigorosas de <strong>Row-Level Security (RLS)</strong> ao
              nível do banco de dados PostgreSQL e autenticação criptográfica JWT. Cada firma opera
              num espaço lógico estritamente isolado (<em>multi-tenant isolation</em>): nenhuma
              empresa ou colaborador consegue consultar dados pertencentes a outra organização.
              Todas as comunicações são cifradas em trânsito via HTTPS/TLS 1.2+ e os uploads de
              mídia utilizam assinatura criptográfica autenticada no servidor.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={19} color="var(--primary)" />
              5. Partilha de Dados e Subprocessadores Tecnológicos
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              O Castello <strong>não vende, não aluga nem partilha</strong> dados pessoais para fins
              publicitários. Recorremos apenas a fornecedores de infraestrutura de nuvem de padrão
              empresarial para alojamento e entrega do serviço: <strong>Supabase</strong> (base de
              dados PostgreSQL e autenticação segura), <strong>Cloudinary</strong> (armazenamento
              seguro de imagens e documentos de obra) e <strong>Vercel</strong> (hospedagem da
              aplicação Web e API serverless).
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCheck size={19} color="var(--primary)" />
              6. Direitos dos Titulares dos Dados (RGPD / LGPD)
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Nos termos do Regulamento Geral sobre a Proteção de Dados (UE 2016/679 - RGPD) e da
              Lei Geral de Proteção de Dados (Lei n.º 13.709/2018 - LGPD), os utilizadores têm o
              direito de solicitar o acesso, retificação, atualização, portabilidade ou eliminação
              dos seus dados pessoais. Os colaboradores podem solicitar a atualização dos seus dados
              cadastrais diretamente junto à administração da sua firma empregadora (Controladora
              dos dados laborais), e os administradores de firmas podem eliminar colaboradores,
              obras ou encerrar integralmente a conta da empresa nas Configurações do sistema.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={19} color="var(--primary)" />
              7. Retenção de Dados e Contacto
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Os dados permanecem armazenados apenas enquanto a conta da firma estiver ativa ou pelo
              período exigido pela legislação laboral e fiscal aplicável. Para qualquer questão
              relacionada com proteção de dados, privacidade ou exercício de direitos, entre em
              contacto através do canal oficial de suporte da plataforma em{' '}
              <strong style={{ color: 'var(--text-main)' }}>suporte@erpcastle.com</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
