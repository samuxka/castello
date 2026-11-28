import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: 'A app mobile funciona sem internet dentro do estaleiro de obra?',
    answer:
      'Sim! Desenvolvemos o sistema a pensar em caves, túneis e obras afastadas. Quando o trabalhador bate o ponto sem rede, a app armazena a hora exata, as coordenadas de GPS e a selfie de forma encriptada no telemóvel. Assim que o dispositivo apanha sinal Wi-Fi ou 4G/5G, sincroniza automaticamente com o painel web da empresa.',
  },
  {
    question: 'Como é que o GPS garante que o trabalhador está mesmo na obra?',
    answer:
      'Ao registar a obra no painel web, o gestor define a localização exata e um raio de tolerância (geofencing, ex: 100 metros). A app só permite a confirmação do ponto se o GPS do telemóvel estiver comprovadamente dentro deste perímetro. Além disso, uma fotografia de selfie no momento garante a identidade.',
  },
  {
    question: 'É necessário instalar algum programa nos computadores do escritório?',
    answer:
      'Não. O painel web do Castello é 100% em nuvem (cloud). Basta abrir o navegador em qualquer computador, tablet ou portátil e aceder a app.erpcastle.com. Todas as atualizações são automáticas e os dados são guardados com encriptação bancária.',
  },
  {
    question: 'Os relatórios de ponto são aceites para efeitos legais e pela ACT?',
    answer:
      'Sim. O Castello gera relatórios de assiduidade detalhados com carimbos temporais, tempos de pausa, horas extraordinárias e identificação do trabalhador, em conformidade com as normas legais de registo de tempos de trabalho e com o RGPD.',
  },
  {
    question: 'Como funciona o controlo de carrinhas e materiais?',
    answer:
      'O sistema inclui módulos para registar as viaturas da empresa, associar que carrinha está atribuída a que equipa ou encarregado, registar despesas de combustível e gerir o inventário de ferramentas e máquinas distribuídas pelos estaleiros.',
  },
  {
    question: 'Posso testar gratuitamente antes de contratar?',
    answer:
      'Sim! Pode criar a sua conta em app.erpcastle.com e começar a utilizar de imediato, sem necessidade de introduzir cartão de crédito. A configuração inicial demora menos de 5 minutos.',
  },
];

export const LandingFaq: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="landing-section">
      <div className="landing-container">
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: 740, margin: '0 auto 60px auto' }}>
          <div className="glass-badge" style={{ marginBottom: 16 }}>
            <span>Tire as suas Dúvidas</span>
          </div>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: 16,
          }}>
            Perguntas <span className="gradient-text-vibrant">Frequentes</span>
          </h2>
          <p style={{ fontSize: 16, color: '#94A3B8', lineHeight: 1.6 }}>
            Respostas diretas às principais questões de construtoras e encarregados de obra.
          </p>
        </div>

        {/* Accordion */}
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="glass-panel"
                style={{
                  borderRadius: 16,
                  border: isOpen ? '1px solid rgba(92, 127, 251, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                  overflow: 'hidden',
                  transition: 'all 0.25s ease',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  style={{
                    width: '100%',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    background: 'transparent',
                    border: 'none',
                    color: '#FFFFFF',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  <span style={{ color: isOpen ? '#5C7FFB' : '#FFFFFF', transition: 'color 0.2s' }}>
                    {faq.question}
                  </span>
                  <ChevronDown
                    size={20}
                    color={isOpen ? '#5C7FFB' : '#94A3B8'}
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.25s ease',
                      flexShrink: 0,
                    }}
                  />
                </button>

                {isOpen && (
                  <div style={{
                    padding: '0 24px 22px 24px',
                    color: '#94A3B8',
                    fontSize: 15,
                    lineHeight: 1.6,
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    paddingTop: 16,
                  }}>
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
