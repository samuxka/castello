# Castello ERP & Ponto — Landing Page Oficial (Web & Mobile)

Esta pasta (`landing/` e `web/src/landing/`) contém a Landing Page oficial do sistema **Castello** (Painel Web ERP + App Mobile), desenhada com a estrutura, animações de scroll parallax, setas SVG com loop e blocos visuais do vídeo de referência, aplicando o **Castello Design System v1.0** e **capturas reais do sistema Castello Web & Mobile**.

## Ficheiros da Landing Page
- `web/src/landing/LandingPage.tsx` (e cópia em `landing/LandingPage.tsx`): Página completa com:
  1. **Navbar Flutuante**: Logo Castello com círculo de destaque (`#5C7FFB`), links de âncora e botões `Entrar` e `Web & App`.
  2. **Hero Card Arredondado**: Tipografia `Outfit`, estrela `✦` animada, seta curva com loop (`stroke-dashoffset` draw animation) apontando para o botão principal e **2 dispositivos 3D inclinados** com parallax em direções opostas no scroll exibindo as telas reais da **App Mobile Castello** e do **Painel Web ERP Castello**.
  3. **2 Bento Cards ("Tire o Máximo Proveito")**: Card do Painel Web Administrativo (com formas geométricas `#010106` e `#7E9DFF` + linha em loop) e Card da App Mobile no Terreno (com anel tripartido `#0015D4`, `#5C7FFB`, `#010106` e seta ascendente).
  4. **Secção "Vantagens"**: Coluna esquerda fixa + grelha 2x2 com divisórias finas, ícones circulares e botões pill.
  5. **Ecossistema de Módulos**: 8 medalhões circulares interativos (`Obras`, `Ponto GPS`, `Equipas`, `Financeiro`, `Calendário`, `Carrinhas`, `SST & Tarefas`, `RGPD & PIN`).
  6. **Banner Escuro Obsidian ("Mantenha o Pulso de Todas as Obras")**: Fundo `#010106` → `#010F6B` com linhas de onda em perspetiva, onda branca à esquerda e telemóvel flutuante com parallax exibindo o orçamento real (`€ 150.000,00`) e horas validadas (`14.5h`).
  7. **Operação em Tempo Real**: Cartão escuro inclinado (`-2deg`) com cartão Royal Blue (`-5deg`) por trás, seletor interativo entre 3 telas reais do Painel Web ERP (`Dashboard`, `Calendário`, `Equipa & PIN`) e curva de tendência na base.
  8. **100% da Sua Firma no Web e na App + Linha Sinuosa até ao CTA Final**: 3 cartões horizontais flutuantes sobre o orbe circular `#5C7FFB` e linha contínua desenhada até ao título centralizado de conversão e Footer Obsidian.

## Design System Aplicado
- **Fonte**: `Outfit` (Google Fonts)
- **Paleta Oficial**:
  - Royal Blue: `#0015D4`
  - Deep Navy: `#010F6B`
  - Sky Blue: `#5C7FFB` / `#DCE4FF` / `#EEF1FF`
  - Obsidian Dark: `#010106`
  - Surface Light: `#F5F7FB` & `#FFFFFF`
  - Steel Gray Border: `#D2D8E4`
