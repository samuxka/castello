# Castelo Ponto — App Mobile (Expo) + Painel Web do Patrão + Supabase

Sistema completo de picagem de ponto para construção civil e equipes externas, composto por:
1. **App Mobile (`/mobile`)** feito em **React Native + Expo**
2. **Painel Web do Patrão (`/web`)** feito em **React + Vite + TypeScript**
3. **Banco de Dados (`/supabase`)** estruturado para **Supabase Postgres** com RLS e índices otimizados

---

## 📱 Funcionalidades do App Mobile (`/mobile`)

- **Aba Início**:
  - **Card de Horas no Mês**: Mostra o total de horas trabalhadas no mês atual, meta mensal em barra de progresso e obra vinculada.
  - **Relógio Digital em Tempo Real**: Exibe a hora exata (`HH:MM:SS`) e a data por extenso abaixo do card.
  - **Botão "Registrar Ponto"**: Abre um Dialog com as opções **Entrada**, **Almoço** e **Saída**.
  - **Timer de 1h no Almoço + Alarme em Segundo Plano**: Ao selecionar **Almoço**, o relógio digital se transforma automaticamente em um **Timer Regressivo de 1 hora (`01:00:00`)**. Mesmo que o aplicativo vá para segundo plano, o horário alvo fica persistido e uma notificação de alarme de máxima prioridade (`expo-notifications`) + som sintetizado contínuo (`expo-av`) e vibração são disparados quando o tempo termina. Inclui também um botão *"Simular Alarme (5s)"* para testar o toque imediatamente.
- **Aba Obras**: Lista informativa das obras da empresa com filtro por status (*Ativas*, *Pausadas*, *Concluídas*), endereço, engenheiro responsável e destaque para a obra do funcionário.
- **Aba Calendário**: Grade mensal interativa + relatório dia a dia mostrando os horários de Entrada, Almoço, Saída e o total de horas trabalhadas em cada dia.
- **Aba Perfil**: Dados do funcionário, estimativa de valores a receber no mês e login com o e-mail e código de acesso criados pelo patrão no Painel Web.

---

## 💻 Funcionalidades do Painel Web do Patrão (`/web`)

- **Perfis de Funcionários**: Criar, editar e remover perfis de funcionários (nome, cargo, e-mail, senha/PIN de acesso ao app, telefone, valor/hora, meta mensal e obra alocada).
- **Gestão de Obras**: Cadastrar e atualizar canteiros de obras (nome, endereço, responsável, status e etapa atual).
- **Espelho de Ponto e Folha Mensal**: Relatório consolidado de horas trabalhadas por funcionário no mês, cálculo automático de folha e lançamento manual de ponto.

---

## 🗄️ Como Configurar o Supabase

1. Crie um projeto no [Supabase](https://supabase.com).
2. Abra o **SQL Editor** do Supabase, cole o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql) e clique em **Run**.
3. Copie a **Project URL** e a **anon public key** em *Project Settings > API*:
   - Em `/mobile`, copie `.env.example` para `.env` e preencha `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   - Em `/web`, copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

> **Modo Demonstração Automático**: Caso ainda não tenha configurado o `.env`, tanto o App Mobile quanto o Painel Web funcionam imediatamente com dados locais de demonstração.

---

## 🚀 Como Executar

### 1. Painel Web do Patrão
```bash
cd web
npm install
npm run dev
```

### 2. Aplicativo Mobile (Expo)
```bash
cd mobile
npm install
npx expo start
```

