import React from 'react';
import { Star, Quote } from 'lucide-react';

export const LandingTestimonials: React.FC = () => {
  return (
    <section className="landing-section">
      <div className="landing-container">
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: 740, margin: '0 auto 60px auto' }}>
          <div className="glass-badge" style={{ marginBottom: 16 }}>
            <span>Resultados Comprovados</span>
          </div>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: 16,
          }}>
            O que dizem os <span className="gradient-text-vibrant">profissionais do terreno.</span>
          </h2>
          <p style={{ fontSize: 16, color: '#94A3B8', lineHeight: 1.6 }}>
            De pequenos empreiteiros a grandes construtoras com dezenas de estaleiros em simultâneo.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 28,
        }}>
          {/* Testimonial 1 */}
          <div className="bento-card">
            <div style={{ display: 'flex', gap: 4, color: '#F59E0B', marginBottom: 16 }}>
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} fill="#F59E0B" />
              ))}
            </div>
            <p style={{ fontSize: 15, color: '#DCE4FF', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 20 }}>
              "Antes perdíamos quase 2 dias no fim de cada mês a decifrar papéis rasurados dos
              encarregados. Com o Castello, clico num botão e o Excel vai direto para a contabilidade.
              Só nisso já pagou a mensalidade."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0015D4, #5C7FFB)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 700,
              }}>
                AR
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF' }}>Eng. António Ramos</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Diretor de Operações • Ramos & Filhos Construtora</div>
              </div>
            </div>
          </div>

          {/* Testimonial 2 */}
          <div className="bento-card">
            <div style={{ display: 'flex', gap: 4, color: '#F59E0B', marginBottom: 16 }}>
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} fill="#F59E0B" />
              ))}
            </div>
            <p style={{ fontSize: 15, color: '#DCE4FF', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 20 }}>
              "O Geofencing com foto foi a melhor coisa. Tínhamos casos de pessoas que batiam ponto
              a caminho do café. Agora o trabalhador sabe que precisa estar mesmo na obra para o ponto
              ser validado. Acabou qualquer discussão."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #059669, #10B981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 700,
              }}>
                MC
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF' }}>Manuel Carvalho</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Encarregado Geral • Construções do Norte</div>
              </div>
            </div>
          </div>

          {/* Testimonial 3 */}
          <div className="bento-card">
            <div style={{ display: 'flex', gap: 4, color: '#F59E0B', marginBottom: 16 }}>
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} fill="#F59E0B" />
              ))}
            </div>
            <p style={{ fontSize: 15, color: '#DCE4FF', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 20 }}>
              "Ter as carrinhas, o inventário e os custos da obra no mesmo sítio do ponto de pessoal
              mudou a nossa rentabilidade. Consigo saber em tempo real se a margem de uma obra está
              a ser cumprida."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 700,
              }}>
                SF
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF' }}>Sofia Ferreira</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Sócia-Gerente • Reabilita Urbana Lda</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
