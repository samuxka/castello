#!/usr/bin/env python3
"""
Gerador do Relatório de Auditoria de Segurança — Projeto Castello
Uso (em ambiente isolado):
  python -m venv .venv
  .venv/Scripts/pip install -r docs/security-audit/requirements.txt
  .venv/Scripts/python docs/security-audit/generate_report.py
"""

import os
from pathlib import Path
import re
import shutil
import xml.sax.saxutils as saxutils

BASE_DIR = Path(__file__).resolve().parent
CHARTS_DIR = BASE_DIR / "_charts_tmp"
CHARTS_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(CHARTS_DIR))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# =============================================================================
# CONFIGURAÇÕES & PALETA OFICIAL
# =============================================================================
OUTPUT_PDF = BASE_DIR / "relatorio-auditoria-seguranca.pdf"

COLOR_CRITICA = "#B91C1C"
COLOR_ALTA = "#EA580C"
COLOR_MEDIA = "#D97706"
COLOR_BAIXA = "#2563EB"
COLOR_FORTE = "#059669"

BG_CRITICA = "#FEE2E2"
BG_ALTA = "#FFEDD5"
BG_MEDIA = "#FEF3C7"
BG_BAIXA = "#DBEAFE"
BG_FORTE = "#D1FAE5"

SLATE_900 = "#0F172A"
SLATE_800 = "#1E293B"
SLATE_700 = "#334155"
SLATE_600 = "#475569"
SLATE_400 = "#94A3B8"
SLATE_200 = "#E2E8F0"
SLATE_100 = "#F1F5F9"
SLATE_50 = "#F8FAFC"

SEV_META = {
    "Crítica": (COLOR_CRITICA, BG_CRITICA),
    "Alta": (COLOR_ALTA, BG_ALTA),
    "Média": (COLOR_MEDIA, BG_MEDIA),
    "Baixa": (COLOR_BAIXA, BG_BAIXA),
}

REPORT_TITLE = "Relatório de Auditoria de Segurança — Castello"
AUDIT_DATE = "22/11/2026"
AUDIT_COMMIT = "main @ fc0c082"

# =============================================================================
# DADOS DA AUDITORIA (100% VERIFICADOS NO CÓDIGO REAL)
# =============================================================================
SEVERITY_COUNTS = {
    "Crítica": 5,
    "Alta": 5,
    "Média": 4,
    "Baixa": 1,
}

CATEGORY_BREAKDOWN = [
    # (Label curto, Crítica, Alta, Média, Baixa)
    ("1. Banco sem\nTranca (RLS)", 2, 1, 0, 0),
    ("2. Permissão no\nNavegador", 1, 2, 0, 0),
    ("3. IDOR", 1, 0, 1, 0),
    ("4. Chaves\nExpostas", 1, 1, 1, 0),
    ("5. Inputs / XSS\ne Hardening", 0, 1, 2, 1),
]

STRENGTHS = [
    (
        "Ausência de sinks clássicos de XSS em DOM/eval",
        "web/src/*, mobile/src/*, api/*",
        "Varredura completa confirmou zero ocorrências de dangerouslySetInnerHTML, innerHTML, outerHTML, eval() ou new Function. Todo texto renderizado em JSX recebe escape automático do React.",
    ),
    (
        "Escape HTML/XML nos relatórios financeiros",
        "web/src/lib/financialReports.ts:36-43, 394-536",
        "A função escapeXml() neutraliza &, <, >, \" e ' em todos os cabeçalhos, metadados e células de texto antes da geração de planilhas XML (.xlsx) e do HTML de impressão PDF.",
    ),
    (
        "Consultas parametrizadas contra SQL Injection",
        "web/src/lib/supabase.ts, mobile/src/lib/supabase.ts",
        "Todas as interações com PostgreSQL utilizam o cliente oficial @supabase/supabase-js (PostgREST parametrizado), sem concatenação de SQL bruto.",
    ),
    (
        "Validação de entrada estruturada com Zod no Web",
        "web/src/lib/validation.ts:7-205",
        "9 schemas Zod (login, cadastro, colaboradores, obras, financeiro, equipas, tarefas, viaturas, inventário) validam formatos e tipos antes do envio ao banco.",
    ),
    (
        "Arquivos .env fora do Git e segredo fora do bundle JS",
        ".gitignore:7-11 e web/dist/assets/*.js",
        "Arquivos .env* constam no .gitignore e nunca foram commitados no histórico Git. Auditoria do bundle compilado confirmou ausência do CLOUDINARY_API_SECRET.",
    ),
    (
        "Sanitização de folder e search_path na RPC SQL",
        "supabase/migrations/20261117_security_rls_hardening.sql:22, 34",
        "A função sign_cloudinary_upload fixa set search_path = public, extensions (mitiga search_path hijacking) e sanitiza o nome da pasta via regexp_replace.",
    ),
    (
        "Proteção contra reverse tabnabbing em links externos",
        "web/src/pages/CalendarPage.tsx:953, 1075; SiteDetailPage.tsx:934",
        "Chamadas window.open para Google Calendar e links de documentos de obra utilizam noopener,noreferrer.",
    ),
    (
        "Cabeçalhos HTTP de proteção básica na raiz Vercel",
        "vercel.json:8-13",
        "Configura X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN e Referrer-Policy: strict-origin-when-cross-origin.",
    ),
    (
        "Limpeza de cache em memória na troca de sessão",
        "web/src/lib/supabase.ts:300-307",
        "setActiveCompanySession() chama invalidateCache() imediatamente no login/logout, evitando vazamento de dados em memória entre sessões no mesmo navegador.",
    ),
    (
        "Dependências legítimas e fixadas por lockfile",
        "web/package-lock.json, mobile/package-lock.json",
        "Pacotes oficiais verificados (sem indícios de typosquatting) e versões travadas em lockfiles.",
    ),
]

WEAKNESSES_SUMMARY = [
    (
        "Ausência total de isolamento multi-tenant no banco (RLS por anon)",
        "Todas as tabelas aceitam leitura/escrita via chave pública anon com políticas using (true) ou using (company_id is not null), sem qualquer vínculo com auth.uid() ou JWT.",
    ),
    (
        "Autenticação customizada sem sessão real no servidor",
        "O painel Web valida senha no cliente e confia num JSON em localStorage; o Mobile autentica por email + PIN em texto puro na tabela pública profiles.",
    ),
    (
        "IDOR generalizado e autorização apenas na interface",
        "Operações de escrita/exclusão por ID (incluindo aprovações administrativas e alteração de senha) não verificam posse nem papel no backend.",
    ),
    (
        "Segredo Cloudinary hardcoded e exposto no histórico Git",
        "CLOUDINARY_API_SECRET continua literal em 3 arquivos ativos (api/sign-cloudinary.js, web/vite.config.ts, migração SQL) e no commit inicial f9a04cc, além de endpoint de assinatura público sem auth.",
    ),
    (
        "Riscos de XSS via href dinâmico, CSV Injection e falta de CSP/HSTS",
        "URLs receipt_url e file_url são inseridas em href sem validar protocolo https:; relatórios CSV não escapam fórmulas (=,+,-,@); falta CSP/HSTS e headers em web/vercel.json.",
    ),
]

FINDINGS_BY_CATEGORY = [
    {
        "category": "Categoria 1 — Banco sem Tranca (Isolamento de Inquilino / RLS)",
        "intro": (
            "Mecanismo identificado: o projeto utiliza Supabase (PostgreSQL + PostgREST) acessado diretamente "
            "pelos clientes Web e Mobile com a chave pública anon/publishable. O isolamento de inquilino deveria "
            "ser garantido por Row Level Security (RLS) vinculado a um JWT autenticado (auth.uid() / company_id), "
            "porém hoje depende apenas de filtros opcionais no cliente."
        ),
        "items": [
            {
                "id": "C1-01",
                "severity": "Crítica",
                "location": (
                    "supabase/schema.sql:167-192, 410-455;\n"
                    "supabase/schema_carrinhas_and_modules.sql:263-320;\n"
                    "supabase/migrations/20261115_site_accidents.sql:44-47;\n"
                    "supabase/migrations/20261115_financial_module_expansion.sql:102-120;\n"
                    "supabase/migrations/20261117_security_rls_hardening.sql:64-216"
                ),
                "title": "Políticas RLS permissivas (using true / is not null) para role anon em todas as tabelas",
                "snippet": (
                    'create policy "companies_select_policy" on public.companies\n'
                    '  for select to anon, authenticated using (true);\n'
                    'create policy "financial_select_policy" on public.financial_transactions\n'
                    '  for select to anon, authenticated using (company_id is not null);'
                ),
                "why": (
                    "Como a chave anon é pública no bundle Web e no APK Mobile e as políticas não verificam identidade "
                    "autenticada (auth.uid() ou claim JWT), qualquer cliente externo pode consultar, alterar ou excluir "
                    "registros de todas as empresas via PostgREST. Além disso, 12 tabelas secundárias (site_tasks, teams, "
                    "inventory_items, calendar_events, site_documents, etc.) mantiveram as políticas open_policy com using (true). "
                    "Condição: explorável diretamente em produção sem autenticação."
                ),
            },
            {
                "id": "C1-02",
                "severity": "Crítica",
                "location": (
                    "web/src/lib/supabase.ts:467-471, 762-764, 1591-1593, 2508-2510;\n"
                    "mobile/src/lib/supabase.ts:121-125, 819-826;\n"
                    "web/src/pages/ClientPortalPage.tsx:109-118, 162, 166-171"
                ),
                "title": "Exposição de credenciais (password_hash/access_code) e vazamento cross-tenant em consultas e Portal do Cliente",
                "snippet": (
                    "// mobile/src/lib/supabase.ts:121-125 (sem filtro company_id)\n"
                    "supabase.from('profiles').select('*').eq('is_active', true)\n"
                    "// web/src/pages/ClientPortalPage.tsx:114 (Portal público puxa finanças da firma toda)\n"
                    "getFinancialRecords(foundSite.company_id || undefined)"
                ),
                "why": (
                    "1) loginCompany lê companies.select('*') via anon (expondo password_hash de todas as firmas). "
                    "2) fetchEmployees no Mobile baixa perfis ativos de TODAS as empresas (incluindo access_code em texto claro e hourly_rate) "
                    "e fetchAssignedVehicle faz fallback em vehicles.select('*').limit(1) sem company_id. "
                    "3) 14 funções usam .or('company_id.eq.X,company_id.is.null'), expondo registros com company_id nulo a todos os tenants. "
                    "4) O Portal do Cliente (?obra=CODIGO) baixa TODAS as transações financeiras e eventos da empresa e só filtra por obra no navegador."
                ),
            },
            {
                "id": "C1-03",
                "severity": "Alta",
                "location": (
                    "supabase/migrations/20261117_security_rls_hardening.sql:68-70, 105-107, 122-124, 131-133;\n"
                    "web/src/lib/supabase.ts:545, 568, 699-703"
                ),
                "title": "Colunas inconsistentes em policies/OAuth e deleção em cascata anônima permitida em tabelas filhas",
                "snippet": (
                    "-- 20261117_security_rls_hardening.sql:70 (coluna real é owner_email)\n"
                    "with check (name is not null and email is not null and password_hash is not null);\n"
                    "-- web/src/lib/supabase.ts:699-702\n"
                    "await supabase.from('profiles').delete().eq('company_id', companyId);"
                ),
                "why": (
                    "A migração de endurecimento bloqueia DELETE apenas em companies (using false), mas mantém DELETE aberto "
                    "para anon em construction_sites, profiles, financial_transactions, site_accidents, site_work_sessions, "
                    "time_entries e vehicles (exigindo só company_id/site_id is not null), permitindo a qualquer anônimo apagar "
                    "todos os dados operacionais de qualquer empresa. Adicionalmente, handleGoogleAuthRedirect consulta admin_email "
                    "em vez de owner_email, e a policy referencia email/name inexistentes (falhando ao aplicar a migração)."
                ),
            },
        ],
    },
    {
        "category": "Categoria 2 — Permissão Definida no Navegador (Client-Side AuthZ)",
        "intro": (
            "Foram cruzados todos os controles de acesso e papéis da UI Web e Mobile (sessão de firma, patrao, "
            "encarregado, líder de equipa e geração de assinaturas de upload) com as verificações equivalentes "
            "no backend (PostgreSQL/RLS e Vercel Serverless)."
        ),
        "items": [
            {
                "id": "C2-01",
                "severity": "Crítica",
                "location": (
                    "web/src/lib/supabase.ts:211-229, 451-509, 661-693;\n"
                    "web/src/App.tsx:135-136"
                ),
                "title": "Sessão administrativa confiada a localStorage sem JWT e troca de senha validada no navegador",
                "snippet": (
                    "// web/src/lib/supabase.ts:666-682\n"
                    "const current = getActiveCompanySession();\n"
                    "if (current && current.password_hash !== hashedCurrent ...) throw ...;\n"
                    "await supabase.from('companies').update({ password_hash: hashedNew }).eq('id', companyId);"
                ),
                "why": (
                    "O login por e-mail/senha não cria sessão autenticada no Supabase Auth (nenhum JWT é emitido). "
                    "A identidade da empresa ativa existe somente em localStorage (castello_active_company_session). "
                    "Alterar o id no localStorage dá acesso imediato ao painel de outra empresa, e a troca de senha "
                    "valida a senha atual apenas no navegador antes de executar um UPDATE irrestrito na tabela companies."
                ),
            },
            {
                "id": "C2-02",
                "severity": "Alta",
                "location": (
                    "mobile/src/screens/SiteDetailScreen.tsx:139-172, 219-241;\n"
                    "mobile/src/screens/HomeScreen.tsx:208-213;\n"
                    "mobile/src/lib/supabase.ts:449-472, 1229-1286, 1525-1656;\n"
                    "web/src/lib/supabase.ts:1158-1189, 2104-2141, 2390-2400, 4784-4818"
                ),
                "title": "Papéis (patrao, encarregado, líder) e fluxos de aprovação validados apenas na UI",
                "snippet": (
                    "// mobile/src/screens/SiteDetailScreen.tsx:171-172\n"
                    "const isAutoApproved = isPatrao || isSiteManager;\n"
                    "const sessionStatus = isAutoApproved ? 'aprovado' : 'pendente';"
                ),
                "why": (
                    "Regras de negócio críticas — quem pode registrar horas de equipa, autoaprovar sessões, aprovar pontos "
                    "(time_entries.status = 'aprovado'), aprovar faltas, validar tarefas (confirmada_chefe), alocar equipas "
                    "ou ver tarefas privadas — existem apenas em condicionais React/React Native. Nenhuma policy RLS ou RPC "
                    "verifica o papel do chamador no servidor, permitindo escalada de privilégio (inclusive alterar o próprio "
                    "profiles.role para 'patrao' ou hourly_rate via REST)."
                ),
            },
            {
                "id": "C2-03",
                "severity": "Alta",
                "location": (
                    "api/sign-cloudinary.js:3-40;\n"
                    "supabase/migrations/20261117_security_rls_hardening.sql:18-51"
                ),
                "title": "Endpoint /api/sign-cloudinary e RPC SQL sem autenticação, CORS wildcard e injeção de parâmetros",
                "snippet": (
                    "res.setHeader('Access-Control-Allow-Credentials', 'true');\n"
                    "res.setHeader('Access-Control-Allow-Origin', '*');\n"
                    "const folder = (req.body && req.body.folder) || (req.query && req.query.folder) || ...;\n"
                    "const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;"
                ),
                "why": (
                    "Nem /api/sign-cloudinary nem a RPC security definer sign_cloudinary_upload exigem autenticação. "
                    "Qualquer agente externo pode gerar assinaturas válidas de upload na conta Cloudinary da empresa. "
                    "Além disso, api/sign-cloudinary.js não sanitiza o parâmetro folder (ao contrário da RPC SQL): "
                    "caracteres '&' em folder permitem injetar parâmetros extras assinados na requisição do Cloudinary "
                    "(ex.: overwrite, public_id, resource_type). Também combina CORS '*' com Allow-Credentials: true."
                ),
            },
        ],
    },
    {
        "category": "Categoria 3 — IDOR (Insecure Direct Object Reference)",
        "intro": (
            "Foram percorridos sistematicamente todos os 38 pontos de leitura/escrita por ID em web/src/lib/supabase.ts "
            "e mobile/src/lib/supabase.ts, bem como a resolução de obras por share_code no Portal do Cliente."
        ),
        "items": [
            {
                "id": "C3-01",
                "severity": "Crítica",
                "location": (
                    "web/src/lib/supabase.ts:620-637, 679-682, 1119, 1166-1182, 1447, 1476-1492, 1542,\n"
                    "1634-1648, 1708, 2069, 2129, 2200, 2395-2398, 2757, 2853, 3000, 3014, 3213, 3240,\n"
                    "3365, 3389, 3504, 3524, 3625, 3708, 4096, 4196, 4792-4816, 5233, 5678;\n"
                    "mobile/src/lib/supabase.ts:143-147, 168-172, 256-261, 385-388, 464-467, 905-912, 1540"
                ),
                "title": "Operações de leitura, edição e exclusão direta por ID sem validação de posse/inquilino",
                "snippet": (
                    "// Exemplos representativos de mutações diretas apenas por id:\n"
                    "await supabase.from('construction_sites').delete().eq('id', id);\n"
                    "await supabase.from('time_entries').update({ status, validated_at }).eq('id', id);\n"
                    "await supabase.from('time_entries').update(...).like('notes', `%${id}%`);"
                ),
                "why": (
                    "Nenhuma das operações CRUD verifica posse no servidor (RLS ausente) e a maioria sequer inclui "
                    ".eq('company_id', ...) na query. Especialmente crítico em time_entries (ID inteiro sequencial bigint "
                    "facilmente enumerável) e em tabelas com IDs baseados em timestamp (veh-17..., team-17..., doc-17...). "
                    "Adicionalmente, updateAbsenceJustificationStatus usa .like('notes', '%id%'), permitindo atualização "
                    "acidental ou intencional de múltiplos registros caso id contenha wildcards ou substrings comuns."
                ),
            },
            {
                "id": "C3-02",
                "severity": "Média",
                "location": (
                    "web/src/lib/supabase.ts:717-724, 784-791"
                ),
                "title": "share_code do Portal do Cliente com baixa entropia (4 chars) e busca via ILIKE",
                "snippet": (
                    "let result = 'CST-';\n"
                    "for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));\n"
                    "// Consulta:\n"
                    "supabase.from('construction_sites').select(SITES_COLS).ilike('share_code', shareCode.trim())"
                ),
                "why": (
                    "O código de acesso público do cliente possui apenas 4 caracteres (32^4 ≈ 1,04 milhão de combinações) "
                    "gerados com Math.random() (PRNG não criptográfico). Além disso, o operador .ilike() trata '%' e '_' "
                    "como wildcards SQL, facilitando enumeração por prefixo (ex.: ?obra=CST-A%) na ausência de rate limiting "
                    "e expondo dados da obra, documentos e resumo financeiro."
                ),
            },
        ],
    },
    {
        "category": "Categoria 4 — Chaves Expostas (Hardcode, Defaults & Histórico Git)",
        "intro": (
            "Foram auditados todos os arquivos-fonte, configs de build/deploy (vite.config.ts, vercel.json, app.json, "
            "eas.json), migrações SQL, histórico completo do Git e o bundle JavaScript compilado em web/dist/assets/."
        ),
        "items": [
            {
                "id": "C4-01",
                "severity": "Crítica",
                "location": (
                    "api/sign-cloudinary.js:24-26;\n"
                    "web/vite.config.ts:15-17;\n"
                    "supabase/migrations/20261117_security_rls_hardening.sql:28-30;\n"
                    "Histórico Git: commit f9a04cc (web/src/lib/cloudinary.ts, mobile/src/services/cloudinary.ts)"
                ),
                "title": "CLOUDINARY_API_SECRET hardcoded em 3 arquivos ativos e vazado no histórico Git",
                "snippet": (
                    "// api/sign-cloudinary.js:24-26 (mesmo padrão em web/vite.config.ts:15-17)\n"
                    "const secret = process.env.CLOUDINARY_API_SECRET || 'trBeU...[REDIGIDO]';\n"
                    "-- 20261117_security_rls_hardening.sql:28\n"
                    "v_secret text := 'trBeU...[REDIGIDO]';"
                ),
                "why": (
                    "A chave secreta da API do Cloudinary está embutida como fallback hardcoded em 3 arquivos versionados "
                    "(sem validação de startup que rejeite env ausente) e permanece acessível no histórico Git desde o commit "
                    "inicial f9a04cc. Qualquer pessoa com acesso ao repositório pode autenticar chamadas administrativas na "
                    "conta Cloudinary (dtxa1leih), ler/sobrescrever/apagar todos os arquivos e documentos de todas as empresas."
                ),
            },
            {
                "id": "C4-02",
                "severity": "Alta",
                "location": (
                    "web/src/lib/supabase.ts:88-89, 163-206, 478;\n"
                    "supabase/schema.sql:84;\n"
                    "mobile/src/lib/supabase.ts:210-213;\n"
                    "web/src/pages/CalendarPage.tsx:305, 325"
                ),
                "title": "Hash SHA-256 caseiro com salt estático, brute-force revertendo PINs para texto puro e credenciais sem cofre",
                "snippet": (
                    "const CREDENTIAL_SALT = 'castello_sec_salt_v1:';\n"
                    "// recoverHashedEmployeePins (linhas 188-201): testa 000000..999999 e grava texto puro:\n"
                    "supabase.from('profiles').update({ access_code: recovered }).eq('id', emp.id);\n"
                    "// mobile/src/lib/supabase.ts:211-213 (AsyncStorage sem criptografia):\n"
                    "JSON.stringify({ email: cleanEmail, code: cleanCode, id: data.id })"
                ),
                "why": (
                    "1) SHA-256 simples (1 rodada, salt global estático) é inadequado para senhas e trivialmente quebrável "
                    "em GPU se combinado com C1-01/C1-02; loginCompany ainda aceita senha em texto puro (linha 478). "
                    "2) recoverHashedEmployeePins faz força bruta no navegador e regrava PINs em texto puro no banco; "
                    "o schema ainda define PIN padrão '123456'. "
                    "3) Mobile salva e-mail + PIN em AsyncStorage (não encriptado, em vez de expo-secure-store) e Web salva "
                    "googleAccessToken em texto puro no localStorage."
                ),
            },
            {
                "id": "C4-03",
                "severity": "Média",
                "location": (
                    "web/src/lib/supabase.ts:54-60;\n"
                    "mobile/src/lib/supabase.ts:23-29"
                ),
                "title": "Fallbacks hardcoded de produção para URL e chave publishable do Supabase sem fail-fast",
                "snippet": (
                    "const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ||\n"
                    "  'https://kkygvorgxehkadaqfqrx.supabase.co';\n"
                    "const SUPABASE_ANON_KEY = ... || 'sb_publishable_JwCC...[REDIGIDO]';"
                ),
                "why": (
                    "Embora a chave publishable/anon seja pública por design (quando protegida por RLS), embutir a URL e a "
                    "chave de produção como fallback silencioso viola a separação entre ambientes (dev/staging/produção): "
                    "qualquer ambiente sem .env configurado aponta silenciosamente para o banco de produção sem erro de startup."
                ),
            },
        ],
    },
    {
        "category": "Categoria 5 — Inputs sem Tratamento (XSS, Injeção e Hardening)",
        "intro": (
            "Foram inspecionados todos os sinks potenciais de HTML/JS, atributos href/src dinâmicos, geração de "
            "relatórios (CSV/XLSX/PDF), uploads de arquivos e cabeçalhos HTTP de resposta. Não há biblioteca de "
            "sanitização (como DOMPurify) instalada no projeto."
        ),
        "items": [
            {
                "id": "C5-01",
                "severity": "Alta",
                "location": (
                    "web/src/pages/FinancialPage.tsx:2345-2361, 3671-3678;\n"
                    "web/src/pages/SiteDetailPage.tsx:191, 931-947"
                ),
                "title": "Atributos href populados com URLs do banco sem allowlist de protocolo (XSS via javascript:/data:)",
                "snippet": (
                    "// FinancialPage.tsx:2345-2348\n"
                    "<a href={rec.receipt_url} target=\"_blank\" rel=\"noreferrer\">\n"
                    "// SiteDetailPage.tsx:931-934\n"
                    "<a href={doc.file_url} target=\"_blank\" rel=\"noopener noreferrer\">"
                ),
                "why": (
                    "Os valores receipt_url e file_url são lidos do banco (que aceita escrita anônima via C1-01) e injetados "
                    "diretamente em <a href={...}> sem validar se o protocolo é https://. Um valor malicioso usando esquema "
                    "javascript: ou data:text/html pode executar código no navegador do administrador ao clicar no link. "
                    "Em FinancialPage.tsx também falta 'noopener' explícito em rel."
                ),
            },
            {
                "id": "C5-02",
                "severity": "Média",
                "location": (
                    "web/src/lib/financialReports.ts:45-51, 360-377, 483-552"
                ),
                "title": "CSV/Excel Formula Injection em exportações financeiras e uso de document.write na mesma origem",
                "snippet": (
                    "// financialReports.ts:45-51 (não neutraliza =, +, -, @ no início da célula)\n"
                    "function escapeCsvCell(val: string | number): string { ... }\n"
                    "// financialReports.ts:361 (aspas internas não escapadas)\n"
                    "`\"Empresa:\";\"${ctx.company.name}\"`\n"
                    "// financialReports.ts:483, 506\n"
                    "const printWindow = window.open('', '_blank', ...); printWindow.document.write(...);"
                ),
                "why": (
                    "Campos controlados por usuário (título de lançamento, entidade, nome da empresa) iniciados por '=', '+', "
                    "'-' ou '@' não são prefixados com apóstrofo antes da exportação CSV, expondo o gestor a CSV Formula "
                    "Injection ao abrir o arquivo no Excel/LibreOffice. Além disso, o PDF de impressão usa document.write "
                    "numa janela same-origin (com acesso ao localStorage); embora hoje use escapeXml(), qualquer campo futuro "
                    "sem escape vira XSS crítico."
                ),
            },
            {
                "id": "C5-03",
                "severity": "Média",
                "location": (
                    "vercel.json:5-14;\n"
                    "web/vercel.json:6-31"
                ),
                "title": "Ausência de Content-Security-Policy (CSP) e HSTS, e headers de segurança ausentes em web/vercel.json",
                "snippet": (
                    "// vercel.json:9-12 (faltam Content-Security-Policy e Strict-Transport-Security)\n"
                    "{ \"key\": \"X-Content-Type-Options\", \"value\": \"nosniff\" },\n"
                    "// web/vercel.json:6-31 (contém apenas Cache-Control, zero security headers)"
                ),
                "why": (
                    "A ausência de CSP remove a camada de defesa em profundidade contra XSS e exfiltração de sessão em "
                    "localStorage. A falta de HSTS permite downgrade HTTP no primeiro acesso. Além disso, se o projeto na "
                    "Vercel usar Root Directory = web, web/vercel.json sobrescreve a configuração e nenhum header de "
                    "segurança (nem X-Frame-Options nem nosniff) será enviado em produção."
                ),
            },
            {
                "id": "C5-04",
                "severity": "Baixa",
                "location": (
                    "web/src/pages/SiteDetailPage.tsx:170-201;\n"
                    "web/src/pages/SettingsPage.tsx:103-146;\n"
                    "api/sign-cloudinary.js:28-32"
                ),
                "title": "Upload de documentos e imagens sem validação server-side de MIME/tamanho e fallback Base64 no banco",
                "snippet": (
                    "// SiteDetailPage.tsx:171-191 (sem limite de tamanho nem validação real de tipo)\n"
                    "const file = e.target.files?.[0]; ...\n"
                    "catch { setDocFileUrl(base64); } // grava Base64 arbitrário direto no Postgres"
                ),
                "why": (
                    "O atributo HTML accept é trivialmente contornável; handleDocFileUpload não limita file.size e, se o "
                    "Cloudinary falhar, salva o Data URI Base64 completo diretamente na coluna file_url do banco (risco de "
                    "DoS de armazenamento e XSS via data:). O backend /api/sign-cloudinary não assina restrições de formato "
                    "(allowed_formats) nem tamanho máximo."
                ),
            },
        ],
    },
]

PRIORITIZED_ROADMAP = [
    (
        "P1 — Imediato (0 a 24 horas)",
        COLOR_CRITICA,
        BG_CRITICA,
        [
            "Rotacionar imediatamente a chave CLOUDINARY_API_SECRET na conta dtxa1leih e remover os valores literais de api/sign-cloudinary.js, web/vite.config.ts e da migração SQL (exigir env vars obrigatórias com fail-fast).",
            "Reescrever o histórico Git (git filter-repo / BFG Repo-Cleaner) para purgar o segredo exposto no commit f9a04cc e forçar rotação.",
            "Exigir validação de JWT (Supabase Auth) em /api/sign-cloudinary, restringir CORS ao domínio oficial (nunca '*' com credentials), aplicar allowlist estrita em folder e revogar GRANT EXECUTE de anon na RPC sign_cloudinary_upload.",
        ],
    ),
    (
        "P2 — Curto Prazo (1 a 7 dias)",
        COLOR_ALTA,
        BG_ALTA,
        [
            "Migrar login Web (patrão) e Mobile (colaborador) para Supabase Auth (JWT real com bcrypt/scrypt gerenciado pelo servidor), vinculando auth.users.id às tabelas companies e profiles.",
            "Reescrever TODAS as políticas RLS removendo acesso da role anon e exigindo company_id = public.current_user_company_id() baseado em auth.uid() para SELECT, INSERT, UPDATE e DELETE em todas as 19 tabelas.",
            "Substituir o acesso direto do Portal do Cliente (?obra=) por uma RPC security definer dedicada (get_public_site_portal(p_share_code text)) que retorne SOMENTE dados públicos daquela obra específica (nunca finanças ou agenda da empresa inteira).",
            "Remover recoverHashedEmployeePins(), sha256HexSync(), o fallback de comparação em texto puro e o PIN padrão '123456'; eliminar a cláusula .or('...,company_id.is.null') de todas as queries.",
        ],
    ),
    (
        "P3 — Médio Prazo (1 a 2 semanas)",
        COLOR_MEDIA,
        BG_MEDIA,
        [
            "Mover toda verificação de papel (patrao, encarregado, lider) para políticas RLS e RPCs dedicadas no PostgreSQL (ex.: approve_time_entry, approve_work_session, update_team_allocation), impedindo autoaprovação ou alteração de role/hourly_rate por colaboradores.",
            "Criar helper sanitizeSafeUrl(url) que aceite apenas https:// (e / relativo confiável) em todos os atributos href (receipt_url, file_url) e remover fallback Base64 no banco.",
            "Fortalecer share_code para no mínimo 12 caracteres gerados via crypto.getRandomValues() e substituir .ilike() por .eq() exato.",
            "Neutralizar CSV Formula Injection prefixando células iniciadas por =, +, -, @, \\t ou \\r em financialReports.ts e escapar aspas em metaLines.",
        ],
    ),
    (
        "P4 — Hardening Contínuo",
        COLOR_BAIXA,
        BG_BAIXA,
        [
            "Adicionar Content-Security-Policy (CSP) e Strict-Transport-Security (HSTS) tanto em vercel.json quanto em web/vercel.json.",
            "Substituir AsyncStorage por expo-secure-store para credenciais biométricas no Mobile e migrar o token do Google Calendar para fluxo OAuth server-side (nunca em localStorage).",
            "Remover fallbacks de URL/chave de produção em web/src/lib/supabase.ts e mobile/src/lib/supabase.ts (validar env no startup) e incluir npm audit + testes automatizados de isolamento multi-tenant no CI/CD.",
        ],
    ),
]

GITHUB_ISSUES = [
    {
        "num": 1,
        "title": "[Segurança] Substituir autenticação em localStorage por Supabase Auth (JWT) e implementar RLS real por inquilino",
        "labels": "security, critical, backend, database",
        "body": """### Descrição do problema e por que é explorável
Atualmente, todas as tabelas do PostgreSQL/Supabase possuem políticas RLS abertas para a role `anon` com `using (true)` ou `using (company_id is not null)` sem verificar `auth.uid()` nem claims JWT. Paralelamente, o login administrativo Web não cria sessão no Supabase Auth — apenas grava um objeto JSON em `localStorage` (`castello_active_company_session`) e valida a troca de senha no próprio navegador.

Como a chave pública `SUPABASE_ANON_KEY` está exposta no frontend e no APK, qualquer pessoa na internet pode ler, modificar ou deletar dados de **todas as empresas** (incluindo obras, perfis, pontos, transações financeiras e `password_hash`), ou assumir o painel de qualquer firma alterando o `id` no `localStorage`. Adicionalmente, `20261117_security_rls_hardening.sql` referencia colunas inexistentes (`email` em vez de `owner_email`; `name` em vez de `full_name`) e `handleGoogleAuthRedirect` consulta `admin_email` em vez de `owner_email`.

### Evidência
- `supabase/schema.sql:167-192, 410-455` (`using (true) with check (true)` para `anon, authenticated`)
- `supabase/schema_carrinhas_and_modules.sql:263-320` (`open_policy` em 14 tabelas)
- `supabase/migrations/20261117_security_rls_hardening.sql:64-216` (`using (company_id is not null)` e colunas `email`/`name` inválidas)
- `web/src/lib/supabase.ts:211-229, 451-509, 545, 568, 661-693` (sessão em `localStorage`, troca de senha validada no cliente)
```sql
-- supabase/migrations/20261117_security_rls_hardening.sql:144-146
create policy "financial_select_policy" on public.financial_transactions
  for select to anon, authenticated
  using (company_id is not null);
```

### Impacto
Comprometimento total da confidencialidade, integridade e disponibilidade de todos os clientes (tenants) do SaaS, incluindo vazamento financeiro/LGPD, takeover de contas de administradores e exclusão em massa de dados operacionais.

### Sugestão de correção
1. Migrar o cadastro e login de gestores (Web) e colaboradores (Mobile) para o **Supabase Auth** (`supabase.auth.signUp` / `signInWithPassword` / OAuth), vinculando `auth.users.id` a uma tabela de vínculo `company_memberships (user_id, company_id, role)`.
2. Criar função auxiliar `public.current_company_id()` (estável, `security definer` com `search_path` fixo) que retorna o `company_id` associado a `auth.uid()`.
3. Remover todas as políticas concedidas à role `anon` e aplicar em todas as 19 tabelas políticas restritas à role `authenticated` exigindo `company_id = public.current_company_id()`.
4. Corrigir `handleGoogleAuthRedirect` para usar `owner_email` (ou `auth_user_id`) e realizar troca de senha exclusivamente via `supabase.auth.updateUser({ password })`.

### Critérios de aceite
- [ ] Nenhuma tabela operacional possui política RLS ativa para a role `anon` (exceto via RPC pública restrita do Portal do Cliente).
- [ ] Login Web e Mobile autenticam via JWT do Supabase Auth (sem confiar em `localStorage` para autorização).
- [ ] Teste automatizado confirma que um token JWT do Tenant A recebe `0 linhas` ou `403` ao tentar ler/alterar/deletar dados do Tenant B em todas as tabelas.
- [ ] Alteração de senha exige reautenticação no servidor via Supabase Auth.""",
    },
    {
        "num": 2,
        "title": "[Segurança] Eliminar vazamento cross-tenant em consultas, Portal do Cliente e exposição de password_hash/access_code",
        "labels": "security, critical, privacy, multi-tenant",
        "body": """### Descrição do problema e por que é explorável
Várias consultas nos clientes Web e Mobile vazam dados entre empresas ou expõem credenciais sensíveis na resposta de rede:
1. `loginCompany` executa `companies.select('*')` no navegador, trafegando `password_hash` pela rede.
2. `fetchEmployees` (Mobile) consulta `profiles.select('*').eq('is_active', true)` **sem filtro de `company_id`**, baixando perfis, telefones, salários (`hourly_rate`) e PINs (`access_code`) de todas as firmas.
3. `fetchAssignedVehicle` (Mobile) possui fallback `vehicles.select('*').limit(1)` sem filtro de empresa.
4. O Portal do Cliente (`ClientPortalPage.tsx`), aberto sem login via `?obra=CODIGO`, chama `getFinancialRecords(foundSite.company_id)` e `getCalendarEvents(foundSite.company_id)`, baixando **todas as finanças e agenda de todas as obras da empresa** e filtrando apenas na memória do navegador.
5. 14 funções usam `.or('company_id.eq.${companyId},company_id.is.null')`, expondo qualquer registro órfão a todos os inquilinos.

### Evidência
- `web/src/lib/supabase.ts:467-471, 762-764, 1591-1593, 2508-2510`
- `mobile/src/lib/supabase.ts:121-125, 819-826`
- `web/src/pages/ClientPortalPage.tsx:109-118, 162, 166-171`
```ts
// web/src/pages/ClientPortalPage.tsx:114-116
getFinancialRecords(foundSite.company_id || undefined),
getSiteDocuments(foundSite.id),
getCalendarEvents(foundSite.company_id || undefined),
```

### Impacto
Qualquer cliente final com o link público de sua obra pode inspecionar no DevTools (aba Network) todo o faturamento, despesas, fornecedores e agenda interna de outras obras da construtora. Colaboradores no app mobile recebem dados pessoais e PINs de funcionários de outras empresas.

### Sugestão de correção
1. Criar uma função RPC `public.get_public_site_portal(p_share_code text)` que retorne em um único JSON estritamente os campos públicos daquela obra (nome, progresso, tarefas com `show_to_client = true`, diários não-SST, marcos visíveis e apenas o somatório pago/contratado daquela obra).
2. Exigir `company_id NOT NULL` no schema (migrar órfãos antes) e remover `.or('...,company_id.is.null')` de todas as queries.
3. Filtrar obrigatoriamente por `company_id` em `fetchEmployees` e remover o fallback global `limit(1)` em `fetchAssignedVehicle`.
4. Nunca selecionar `password_hash` nem `access_code` em consultas de listagem.

### Critérios de aceite
- [ ] Ao abrir `?obra=CODIGO`, a aba Network não recebe nenhum registro de outras obras nem receitas/despesas individuais da empresa.
- [ ] `fetchEmployees` e `fetchAssignedVehicle` no Mobile filtram estritamente pela empresa do usuário autenticado.
- [ ] Nenhuma query utiliza `.or('company_id.eq.X,company_id.is.null')`.
- [ ] As colunas `password_hash` e `access_code` nunca são retornadas ao frontend.""",
    },
    {
        "num": 3,
        "title": "[Segurança] Corrigir IDOR generalizado nas operações de leitura, atualização e exclusão por ID",
        "labels": "security, critical, idor",
        "body": """### Descrição do problema e por que é explorável
Todas as mutações diretas (UPDATE/DELETE/UPSERT) nos arquivos `web/src/lib/supabase.ts` e `mobile/src/lib/supabase.ts` filtram exclusivamente por `.eq('id', ...)` sem validação de propriedade no banco (RLS) nem escopo de `company_id`. Em `time_entries`, a chave primária é um inteiro sequencial (`bigint generated always as identity`), permitindo enumeração trivial; outras tabelas usam IDs previsíveis baseados em timestamp (`veh-17...`, `team-17...`). Em `updateAbsenceJustificationStatus`, o fallback utiliza `.like('notes', '%${id}%')`, ampliando o risco de modificação indevida em lote.

### Evidência
- `web/src/lib/supabase.ts:620-637, 1119, 1447, 1542, 1708, 2200, 2395-2398, 2853, 3014, 3240, 3389, 4196, 4792-4816, 5678`
- `mobile/src/lib/supabase.ts:143-147, 385-388, 464-467, 905-912, 1025, 1118-1121, 1540, 1645`
```ts
// web/src/lib/supabase.ts:1542, 2395-2398, 4812-4815
await supabase.from('construction_sites').delete().eq('id', id);
await supabase.from('time_entries').update({ status, validated_at }).eq('id', id);
await supabase.from('time_entries').update({ status: dbStatus }).like('notes', `%${id}%`);
```

### Impacto
Qualquer atacante ou usuário autenticado de outra empresa pode ler, alterar ou apagar obras, colaboradores, lançamentos financeiros, documentos, tarefas, viaturas e registros de ponto de terceiros fornecendo o ID do objeto.

### Sugestão de correção
1. Impor RLS por `company_id = public.current_company_id()` em todas as tabelas (defesa primária no banco).
2. Como defesa em profundidade, incluir `.eq('company_id', activeCompanyId)` em todas as chamadas `.update()` e `.delete()` no cliente.
3. Substituir IDs baseados em timestamp/inteiros sequenciais expostos externamente por UUID v4 quando possível e eliminar o update baseado em `.like('notes', '%id%')` (usar chave estrangeira dedicada).

### Critérios de aceite
- [ ] Todas as políticas RLS validam `USING` e `WITH CHECK` com `company_id = public.current_company_id()`.
- [ ] Tentativas de `UPDATE`/`DELETE` passando IDs de outro tenant retornam 0 linhas afetadas ou erro de autorização.
- [ ] O fallback `.like('notes', '%id%')` em `updateAbsenceJustificationStatus` foi removido.""",
    },
    {
        "num": 4,
        "title": "[Segurança] Rotacionar CLOUDINARY_API_SECRET e remover credenciais hardcoded do código e histórico Git",
        "labels": "security, critical, secrets",
        "body": """### Descrição do problema e por que é explorável
A chave secreta `CLOUDINARY_API_SECRET` da conta `dtxa1leih` está hardcoded como fallback em 3 arquivos ativos no repositório (sem verificação fail-fast na inicialização) e foi commitada no histórico Git no commit inicial `f9a04cc`. Além disso, a URL e a chave publishable do Supabase de produção estão embutidas como fallback silencioso em `web/src/lib/supabase.ts` e `mobile/src/lib/supabase.ts`.

### Evidência
- `api/sign-cloudinary.js:24-26` (`process.env.CLOUDINARY_API_SECRET || 'trBeU...[REDIGIDO]'`)
- `web/vite.config.ts:15-17` (mesmo fallback hardcoded)
- `supabase/migrations/20261117_security_rls_hardening.sql:28-30` (`v_secret text := 'trBeU...[REDIGIDO]'`)
- Histórico Git: commit `f9a04cc` (`web/src/lib/cloudinary.ts` e `mobile/src/services/cloudinary.ts`)
- `web/src/lib/supabase.ts:54-60` e `mobile/src/lib/supabase.ts:23-29` (fallbacks de produção)

### Impacto
Qualquer pessoa com acesso ao código ou ao histórico Git obtém controle administrativo sobre a conta Cloudinary (`dtxa1leih`), podendo excluir/substituir todos os documentos, fotos de obras, recibos e avatares de todas as empresas, além de gerar custos indevidos.

### Sugestão de correção
1. **Rotacionar imediatamente** o par `API Key / API Secret` no painel do Cloudinary.
2. Configurar as novas chaves exclusivamente via variáveis de ambiente na Vercel (`CLOUDINARY_API_SECRET`, `CLOUDINARY_API_KEY`, `CLOUDINARY_CLOUD_NAME`) e no **Supabase Vault** (nunca em arquivos `.sql` versionados).
3. Remover todos os defaults literais em `api/sign-cloudinary.js` e `web/vite.config.ts`, lançando erro `500` / falha de startup se a variável de ambiente não estiver definida.
4. Remover fallbacks literais de produção para `SUPABASE_URL` e `SUPABASE_ANON_KEY`, validando variáveis de ambiente na inicialização.
5. Limpar o segredo antigo do histórico Git com `git filter-repo` e configurar secret scanning (ex.: gitleaks/GitHub Secret Scanning).

### Critérios de aceite
- [ ] A chave secreta antiga do Cloudinary foi revogada e substituída por uma nova.
- [ ] Busca no repositório por chaves secretas retorna zero resultados em código-fonte, configs e migrações SQL.
- [ ] `api/sign-cloudinary.js` falha explicitamente se `CLOUDINARY_API_SECRET` não estiver definida no ambiente.
- [ ] Histórico Git purgado e GitHub Secret Scanning / Push Protection ativados.""",
    },
    {
        "num": 5,
        "title": "[Segurança] Proteger endpoint /api/sign-cloudinary e RPC sign_cloudinary_upload com autenticação, CORS restrito e validação de upload",
        "labels": "security, high, api, upload",
        "body": """### Descrição do problema e por que é explorável
O endpoint serverless `api/sign-cloudinary.js` e a função RPC `public.sign_cloudinary_upload` geram assinaturas válidas de upload Cloudinary para qualquer usuário anônimo na internet. Além disso:
1. `api/sign-cloudinary.js` define `Access-Control-Allow-Origin: *` combinado com `Access-Control-Allow-Credentials: true`.
2. O parâmetro `folder` em `api/sign-cloudinary.js` não é sanitizado nem restrito por allowlist, permitindo injeção de parâmetros assinados via `&` na string `paramsToSign`.
3. Não há validação server-side de `allowed_formats` nem limite de tamanho de arquivo, e `SiteDetailPage.tsx` faz fallback salvando Base64 completo diretamente no Postgres.

### Evidência
- `api/sign-cloudinary.js:5-6, 18-32`
- `supabase/migrations/20261117_security_rls_hardening.sql:18-51` (`grant execute ... to anon`)
- `web/src/pages/SiteDetailPage.tsx:170-201` (sem checagem de `file.size` e fallback `setDocFileUrl(base64)`)
```js
// api/sign-cloudinary.js:18-31
const folder = (req.body && req.body.folder) || (req.query && req.query.folder) || 'castello_profiles';
const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
```

### Impacto
Abuso irrestrito da cota e armazenamento do Cloudinary por terceiros, hospedagem de conteúdo malicioso sob o domínio da conta, sobrescrita de arquivos via injeção de parâmetros na assinatura e degradação do banco por payloads Base64 grandes.

### Sugestão de correção
1. Exigir cabeçalho `Authorization: Bearer <supabase_jwt>` em `/api/sign-cloudinary` e validá-lo via `supabase.auth.getUser(token)` antes de assinar.
2. Restringir `Access-Control-Allow-Origin` a uma allowlist explícita de domínios do Castello.
3. Validar `folder` contra uma allowlist fechada (`['castello_profiles', 'castello_company', 'castello_docs', 'castello_sites', 'castello_vehicles', 'castello_receipts']`) e incluir prefixo do `company_id` do usuário autenticado.
4. Assinar parâmetros de restrição do Cloudinary (`allowed_formats`, `max_file_size`) e aplicar rate limiting no endpoint.
5. Revogar `EXECUTE` da role `anon` na RPC `sign_cloudinary_upload` (ou removê-la em favor do endpoint autenticado) e eliminar o fallback Base64 no Postgres em `SiteDetailPage.tsx`.

### Critérios de aceite
- [ ] Requisições sem JWT válido para `/api/sign-cloudinary` retornam `401 Unauthorized`.
- [ ] Valores fora da allowlist em `folder` retornam `400 Bad Request`.
- [ ] CORS responde apenas para origens autorizadas.
- [ ] Uploads têm limite de tamanho e formatos permitidos validados no servidor, sem gravar Base64 no banco.""",
    },
    {
        "num": 6,
        "title": "[Segurança] Mover validação de papéis (patrao/encarregado/lider) e fluxos de aprovação para o servidor",
        "labels": "security, high, authorization",
        "body": """### Descrição do problema e por que é explorável
Todas as verificações de permissão por papel (`isPatrao`, `isSiteManager`, `isAssignedTeamLeader`, `isSiteEncarregado`, `isTeamLeader`) acontecem apenas na camada de interface do Mobile e Web. Funções administrativas como aprovar picagens de ponto (`updateEntryStatus`), aprovar horas de equipa (`updateWorkSessionStatus`), aprovar faltas (`updateAbsenceJustificationStatus`), validar tarefas como chefe (`updateTaskStatus`) e autoaprovar sessões (`SiteDetailScreen.tsx:171-172`) gravam diretamente nas tabelas sem nenhuma validação de papel no banco.

### Evidência
- `mobile/src/screens/SiteDetailScreen.tsx:139-172, 219-241`
- `mobile/src/screens/HomeScreen.tsx:208-213`
- `mobile/src/lib/supabase.ts:1229-1286, 1525-1656`
- `web/src/lib/supabase.ts:1158-1189, 2104-2141, 2390-2400, 4784-4818`
```ts
// mobile/src/screens/SiteDetailScreen.tsx:171-172
const isAutoApproved = isPatrao || isSiteManager;
const sessionStatus: 'pendente' | 'aprovado' = isAutoApproved ? 'aprovado' : 'pendente';
```

### Impacto
Um colaborador comum pode manipular requisições para aprovar os próprios pontos e horas extras, aprovar faltas injustificadas, realocar equipas ou promover seu próprio registro na tabela `profiles` para `role = 'patrao'` e alterar `hourly_rate`.

### Sugestão de correção
1. Criar colunas/triggers ou políticas RLS diferenciadas por papel (`patrao` vs `funcionario`) obtido a partir de `auth.uid()` no servidor.
2. Impedir que `funcionario` altere colunas sensíveis (`status`, `validated_at`, `role`, `hourly_rate`, `is_active`, `confirmed_by_name`).
3. Encapsular aprovações (`approve_time_entry`, `approve_work_session`, `approve_absence`, `confirm_site_task`) e registros de sessão de equipa em funções RPC PostgreSQL que verifiquem no banco se `auth.uid()` é `patrao`, `manager_id` da obra ou `leader_id` da equipa.

### Critérios de aceite
- [ ] Um usuário com papel `funcionario` recebe erro de permissão ao tentar alterar `time_entries.status`, `profiles.role`, `profiles.hourly_rate` ou `site_tasks.status = 'confirmada_chefe'`.
- [ ] Sessões inseridas por não-gestores são forçadas para `status = 'pendente'` via trigger/RPC no servidor.
- [ ] Apenas o líder designado (`teams.leader_id`) ou `patrao` consegue atualizar a alocação de uma equipa.""",
    },
    {
        "num": 7,
        "title": "[Segurança] Eliminar hash SHA-256 caseiro, rotina de brute-force de PINs e credenciais em texto puro no cliente",
        "labels": "security, high, cryptography, auth",
        "body": """### Descrição do problema e por que é explorável
O projeto implementa criptografia de senha manualmente no frontend (`sha256HexSync`) com uma única iteração SHA-256 e salt global fixo (`castello_sec_salt_v1:`), aceita comparação em texto plano no login (`storedHash === password.trim()`), e contém uma função `recoverHashedEmployeePins` que executa força bruta no navegador (0000–9999 e 000000–999999) para reverter PINs e salvá-los novamente em texto puro na tabela `profiles`. No Mobile, e-mail e PIN são armazenados em texto puro no `AsyncStorage`, e na Web o `googleAccessToken` é salvo em texto puro no `localStorage`.

### Evidência
- `web/src/lib/supabase.ts:88-206, 478`
- `supabase/schema.sql:84` (`access_code text not null default '123456'`)
- `mobile/src/lib/supabase.ts:210-213` (`AsyncStorage.setItem(BIOMETRIC_SAVED_CREDS_KEY, ...)`)
- `web/src/pages/CalendarPage.tsx:305, 325` (`googleAccessToken` em `localStorage`)
```ts
// web/src/lib/supabase.ts:89, 198-201
const CREDENTIAL_SALT = 'castello_sec_salt_v1:';
const recovered = resolved.get(emp.access_code) || '123456';
supabase.from('profiles').update({ access_code: recovered }).eq('id', emp.id);
```

### Impacto
Hashes SHA-256 sem fator de custo e com salt público podem ser quebrados em segundos por GPU; PINs ficam permanentemente expostos em texto claro no banco e no dispositivo móvel; qualquer XSS ou extensão maliciosa rouba o token do Google Calendar no `localStorage`.

### Sugestão de correção
1. Remover completamente `sha256HexSync`, `CREDENTIAL_SALT`, `recoverHashedEmployeePins` e a comparação em texto puro, delegando toda autenticação/hashing ao Supabase Auth (bcrypt/scrypt com salt único por usuário).
2. Remover o default `'123456'` de `profiles.access_code` e exigir redefinição de senha/PIN no primeiro acesso.
3. No Mobile, armazenar tokens de sessão biométrica exclusivamente via **`expo-secure-store`** (Keychain iOS / Android Keystore) em vez de `AsyncStorage`.
4. Mover a integração OAuth do Google Calendar para backend serverless (Edge Function/Vercel API) armazenando refresh tokens cifrados no servidor.

### Critérios de aceite
- [ ] Código de hashing SHA-256 manual e `recoverHashedEmployeePins` removidos do repositório.
- [ ] Nenhuma credencial ou PIN é armazenada em texto claro no banco ou em `AsyncStorage`.
- [ ] `googleAccessToken` não é mais persistido em `localStorage`.""",
    },
    {
        "num": 8,
        "title": "[Segurança] Validar protocolo de URLs dinâmicas (https:) em links href para prevenir XSS via javascript:/data:",
        "labels": "security, high, xss, frontend",
        "body": """### Descrição do problema e por que é explorável
Links renderizados com `<a href={...}>` nos módulos Financeiro e Documentos da Obra recebem diretamente valores provenientes do banco de dados (`rec.receipt_url`, `formReceiptUrl`, `doc.file_url`) sem validação de protocolo (allowlist `https:`). Em `SiteDetailPage.tsx`, `doc.file_url` também aceita strings `data:` em fallback. Como o projeto não usa biblioteca de sanitização de URLs nem CSP, URLs contendo `javascript:` ou `data:text/html` podem disparar execução arbitrária de código ao clique do usuário.

### Evidência
- `web/src/pages/FinancialPage.tsx:2345-2361, 3671-3678` (`href={rec.receipt_url}`, `href={formReceiptUrl}`, `rel="noreferrer"` sem `noopener` explícito)
- `web/src/pages/SiteDetailPage.tsx:191, 931-947` (`href={doc.file_url}`)
```tsx
// web/src/pages/FinancialPage.tsx:2345-2348
<a href={rec.receipt_url} target="_blank" rel="noreferrer">
```

### Impacto
Execução de JavaScript no contexto da sessão do administrador (Stored XSS), possibilitando roubo de sessão, alteração de lançamentos financeiros ou ações administrativas não autorizadas.

### Sugestão de correção
1. Criar utilitário centralizado `toSafeExternalUrl(raw?: string | null): string | null` que faça parse com `new URL(raw)` e só aceite protocolos `https:` (e, opcionalmente, hostnames permitidos como `res.cloudinary.com`).
2. Aplicar `toSafeExternalUrl()` antes de renderizar qualquer `href` ou `src` vindo do banco e na validação Zod ao salvar (`z.string().url().startsWith('https://')`).
3. Padronizar `rel="noopener noreferrer"` em todos os links com `target="_blank"`.

### Critérios de aceite
- [ ] URLs com `javascript:`, `vbscript:` ou `data:` são rejeitadas tanto na validação Zod quanto na renderização da UI.
- [ ] Todos os links externos (`FinancialPage.tsx`, `SiteDetailPage.tsx`, etc.) utilizam `toSafeExternalUrl` e `rel="noopener noreferrer"`.""",
    },
    {
        "num": 9,
        "title": "[Segurança] Fortalecer entropia do share_code do Portal do Cliente e substituir consulta ILIKE por igualdade exata",
        "labels": "security, medium, idor",
        "body": """### Descrição do problema e por que é explorável
A função `generateShareCode()` gera códigos de acesso ao Portal do Cliente no formato `CST-XXXX` com apenas 4 caracteres aleatórios (`32^4 = 1.048.576` combinações) utilizando `Math.random()`. Na consulta `getSiteByShareCode`, o código é pesquisado com `.ilike('share_code', shareCode.trim())`, que interpreta `%` e `_` como wildcards SQL, permitindo enumeração acelerada por prefixo sem rate limiting.

### Evidência
- `web/src/lib/supabase.ts:717-724` (`generateShareCode` com 4 chars e `Math.random()`)
- `web/src/lib/supabase.ts:784-791` (`.ilike('share_code', shareCode.trim())`)
```ts
// web/src/lib/supabase.ts:787-791
const { data, error } = await supabase
  .from('construction_sites')
  .select(SITES_COLS)
  .ilike('share_code', shareCode.trim())
  .maybeSingle();
```

### Impacto
Facilidade de descoberta não autorizada de códigos de obras de clientes, expondo endereço, orçamento, cronograma, fotos e documentos da obra.

### Sugestão de correção
1. Gerar `share_code` com no mínimo 12 caracteres alfanuméricos usando `crypto.getRandomValues()` (ou UUID v4/token de >= 72 bits de entropia) no servidor.
2. Normalizar para maiúsculas (`shareCode.trim().toUpperCase()`) e usar igualdade exata (`.eq('share_code', normalized)`) em vez de `.ilike()`.
3. Adicionar rate limiting na RPC/endpoint do Portal do Cliente e opção de expiração ou revogação do link pelo gestor.

### Critérios de aceite
- [ ] Novos códigos `share_code` têm >= 12 caracteres gerados com CSPRNG (`crypto.getRandomValues` ou `gen_random_bytes` no Postgres).
- [ ] A busca utiliza `.eq()` (wildcards `%` e `_` não retornam resultados).
- [ ] Endpoint/RPC do Portal do Cliente possui proteção contra enumeração em massa.""",
    },
    {
        "num": 10,
        "title": "[Segurança] Prevenir CSV Formula Injection nos relatórios financeiros e adicionar CSP/HSTS em vercel.json e web/vercel.json",
        "labels": "security, medium, hardening, headers",
        "body": """### Descrição do problema e por que é explorável
1. Em `web/src/lib/financialReports.ts`, `escapeCsvCell()` não neutraliza células iniciadas por caracteres de fórmula (`=`, `+`, `-`, `@`, `\\t`, `\\r`), e `metaLines` interpola campos como `ctx.company.name` sem escapar aspas internas. Adicionalmente, a exportação PDF usa `printWindow.document.write(...)` numa janela same-origin.
2. Os cabeçalhos HTTP de segurança em `vercel.json` não incluem `Content-Security-Policy` (CSP) nem `Strict-Transport-Security` (HSTS), e o arquivo `web/vercel.json` omite completamente todos os cabeçalhos de segurança (contendo apenas `Cache-Control`).

### Evidência
- `web/src/lib/financialReports.ts:45-51, 360-377, 483-552`
- `vercel.json:5-14` (faltam CSP e HSTS)
- `web/vercel.json:6-31` (nenhum security header configurado)
```ts
// web/src/lib/financialReports.ts:361
`"Empresa:";"${ctx.company.name}"`,
```

### Impacto
Planilhas CSV exportadas contendo entradas maliciosas podem executar fórmulas perigosas no Excel/LibreOffice do gestor financeiro (CSV/DDE Injection). A falta de CSP/HSTS (e a possível omissão de todos os security headers se a Vercel usar `web/vercel.json`) reduz a resiliência contra XSS, clickjacking e downgrade de conexão.

### Sugestão de correção
1. Em `escapeCsvCell()`, prefixar com apóstrofo (`'`) qualquer string que comece com `=`, `+`, `-`, `@`, `\\t` ou `\\r` (exceto números negativos puros formatados), e aplicar `escapeCsvCell()` também às `metaLines`.
2. Na geração de PDF, preferir `Blob` + `URL.createObjectURL` ou biblioteca dedicada (ou manter sandbox/escape estrito sem acesso à janela mãe).
3. Adicionar `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` e `Content-Security-Policy` restritiva tanto em `vercel.json` quanto em `web/vercel.json` (mantendo ambos sincronizados).

### Critérios de aceite
- [ ] Células CSV iniciadas por `=`, `+`, `-` ou `@` são neutralizadas com `'` na exportação.
- [ ] Resposta HTTP em produção inclui `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` e `Referrer-Policy`.
- [ ] `vercel.json` e `web/vercel.json` possuem exatamente o mesmo conjunto de cabeçalhos de segurança.""",
    },
]


# =============================================================================
# GERAÇÃO DOS GRÁFICOS MATPLOTLIB (300 DPI)
# =============================================================================
def generate_charts() -> tuple[Path, Path]:
    CHARTS_DIR.mkdir(parents=True, exist_ok=True)
    plt.rcParams["font.family"] = "DejaVu Sans"

    # 1. Gráfico de Rosca — Achados por Severidade
    donut_path = CHARTS_DIR / "chart_severity_donut.png"
    labels = ["Crítica", "Alta", "Média", "Baixa"]
    values = [SEVERITY_COUNTS[k] for k in labels]
    chart_colors = [COLOR_CRITICA, COLOR_ALTA, COLOR_MEDIA, COLOR_BAIXA]
    total = sum(values)

    fig, ax = plt.subplots(figsize=(4.4, 3.3), dpi=300)
    wedges, texts, autotexts = ax.pie(
        values,
        labels=None,
        colors=chart_colors,
        startangle=135,
        counterclock=False,
        wedgeprops=dict(width=0.38, edgecolor="white", linewidth=2.2),
        autopct=lambda pct: f"{int(round(pct * total / 100.0))}" if pct > 0 else "",
        pctdistance=0.80,
    )
    for t in autotexts:
        t.set_color("white")
        t.set_fontsize(10)
        t.set_fontweight("bold")

    ax.text(0, 0.08, str(total), ha="center", va="center", fontsize=22, fontweight="bold", color=SLATE_900)
    ax.text(0, -0.18, "Achados", ha="center", va="center", fontsize=9.5, color=SLATE_600)

    legend_labels = [f"{lbl}: {val} ({val/total*100:.0f}%)" for lbl, val in zip(labels, values)]
    ax.legend(
        wedges,
        legend_labels,
        loc="lower center",
        bbox_to_anchor=(0.5, -0.18),
        ncol=2,
        frameon=False,
        fontsize=8.5,
        handlelength=1.1,
        columnspacing=1.2,
    )
    ax.set_title("Distribuição por Severidade", fontsize=11, fontweight="bold", color=SLATE_900, pad=10)
    ax.axis("equal")
    plt.tight_layout()
    fig.savefig(donut_path, dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)

    # 2. Gráfico de Barras Empilhadas — Achados por Categoria
    bar_path = CHARTS_DIR / "chart_category_bars.png"
    cat_labels = [c[0] for c in CATEGORY_BREAKDOWN]
    crit_vals = np.array([c[1] for c in CATEGORY_BREAKDOWN])
    alta_vals = np.array([c[2] for c in CATEGORY_BREAKDOWN])
    med_vals = np.array([c[3] for c in CATEGORY_BREAKDOWN])
    baixa_vals = np.array([c[4] for c in CATEGORY_BREAKDOWN])
    totals = crit_vals + alta_vals + med_vals + baixa_vals

    x = np.arange(len(cat_labels))
    width = 0.56

    fig, ax = plt.subplots(figsize=(5.3, 3.3), dpi=300)
    ax.bar(x, crit_vals, width, label="Crítica", color=COLOR_CRITICA, edgecolor="white", linewidth=0.8)
    ax.bar(x, alta_vals, width, bottom=crit_vals, label="Alta", color=COLOR_ALTA, edgecolor="white", linewidth=0.8)
    ax.bar(x, med_vals, width, bottom=crit_vals + alta_vals, label="Média", color=COLOR_MEDIA, edgecolor="white", linewidth=0.8)
    ax.bar(
        x,
        baixa_vals,
        width,
        bottom=crit_vals + alta_vals + med_vals,
        label="Baixa",
        color=COLOR_BAIXA,
        edgecolor="white",
        linewidth=0.8,
    )

    for idx, tot in enumerate(totals):
        ax.text(idx, tot + 0.14, str(int(tot)), ha="center", va="bottom", fontsize=9.5, fontweight="bold", color=SLATE_900)

    ax.set_xticks(x)
    ax.set_xticklabels(cat_labels, fontsize=7.6, color=SLATE_700)
    ax.set_yticks(range(0, int(max(totals)) + 2))
    ax.set_ylim(0, int(max(totals)) + 1.1)
    ax.set_ylabel("Nº de Achados", fontsize=8.5, color=SLATE_600)
    ax.set_title("Achados por Categoria e Severidade", fontsize=11, fontweight="bold", color=SLATE_900, pad=10)
    ax.yaxis.grid(True, linestyle="--", alpha=0.45, color="#CBD5E1")
    ax.set_axisbelow(True)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#CBD5E1")
    ax.spines["bottom"].set_color("#CBD5E1")
    ax.tick_params(axis="y", labelsize=8, colors=SLATE_600)
    ax.legend(
        loc="upper center",
        bbox_to_anchor=(0.5, -0.22),
        ncol=4,
        frameon=False,
        fontsize=8,
        handlelength=1.1,
    )
    plt.tight_layout()
    fig.savefig(bar_path, dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)

    return donut_path, bar_path


# =============================================================================
# CANVAS NUMERADO COM CABEÇALHO E RODAPÉ (PÁGINAS 2+)
# =============================================================================
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count: int):
        page_num = self._pageNumber
        width, height = A4
        margin = 2.0 * cm

        if page_num == 1:
            # Rodapé discreto na capa
            self.saveState()
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor(SLATE_400))
            self.drawString(margin, 1.15 * cm, f"{REPORT_TITLE}  •  {AUDIT_COMMIT}")
            self.drawRightString(width - margin, 1.15 * cm, f"Página {page_num} de {page_count}")
            self.restoreState()
            return

        self.saveState()
        # Cabeçalho
        self.setStrokeColor(colors.HexColor(SLATE_200))
        self.setLineWidth(0.7)
        self.line(margin, height - 1.55 * cm, width - margin, height - 1.55 * cm)

        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor(SLATE_700))
        self.drawString(margin, height - 1.32 * cm, REPORT_TITLE)

        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor(SLATE_400))
        self.drawRightString(width - margin, height - 1.32 * cm, f"Auditoria de Código  •  {AUDIT_DATE}")

        # Rodapé
        self.line(margin, 1.55 * cm, width - margin, 1.55 * cm)
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor(SLATE_600))
        self.drawString(margin, 1.15 * cm, "Documento Confidencial — Uso Interno (Castello)")
        self.drawRightString(width - margin, 1.15 * cm, f"Página {page_num} de {page_count}")
        self.restoreState()


# =============================================================================
# ESTILOS E HELPERS PLATYPUS
# =============================================================================
def esc(text: str) -> str:
    return saxutils.escape(str(text))


def esc_preserve_indent(line: str) -> str:
    """Escapa HTML preservando apenas espaços iniciais de indentação para quebrar linhas em espaços."""
    if not line.strip():
        return "&nbsp;"
    match = re.match(r"^( +)", line)
    if match:
        lead = "&nbsp;" * len(match.group(1))
        return lead + esc(line[len(match.group(1)) :])
    return esc(line)


def build_styles():
    base = getSampleStyleSheet()
    styles = {}
    styles["body"] = ParagraphStyle(
        "Body",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=9.2,
        leading=13.2,
        textColor=colors.HexColor(SLATE_800),
        alignment=TA_JUSTIFY,
        spaceAfter=5,
    )
    styles["body_left"] = ParagraphStyle(
        "BodyLeft",
        parent=styles["body"],
        alignment=TA_LEFT,
    )
    styles["h1"] = ParagraphStyle(
        "H1",
        parent=base["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=colors.HexColor(SLATE_900),
        spaceBefore=12,
        spaceAfter=6,
    )
    styles["h2"] = ParagraphStyle(
        "H2",
        parent=base["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11.5,
        leading=15,
        textColor=colors.HexColor(SLATE_900),
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True,
    )
    styles["small_muted"] = ParagraphStyle(
        "SmallMuted",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=11.2,
        textColor=colors.HexColor(SLATE_600),
        spaceAfter=5,
        keepWithNext=True,
    )
    styles["cell"] = ParagraphStyle(
        "Cell",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=8.1,
        leading=11.2,
        textColor=colors.HexColor(SLATE_800),
        alignment=TA_LEFT,
    )
    styles["cell_mono"] = ParagraphStyle(
        "CellMono",
        parent=base["Normal"],
        fontName="Courier",
        fontSize=7.2,
        leading=9.6,
        textColor=colors.HexColor(SLATE_700),
        alignment=TA_LEFT,
    )
    styles["code_inline"] = ParagraphStyle(
        "CodeBlock",
        parent=base["Normal"],
        fontName="Courier",
        fontSize=7.1,
        leading=9.5,
        textColor=colors.HexColor(SLATE_900),
        backColor=colors.HexColor(SLATE_100),
        borderPadding=(3, 4, 3, 4),
        spaceBefore=3,
        spaceAfter=3,
    )
    styles["issue_mono"] = ParagraphStyle(
        "IssueMono",
        parent=base["Normal"],
        fontName="Courier",
        fontSize=7.5,
        leading=10.3,
        textColor=colors.HexColor(SLATE_900),
        alignment=TA_LEFT,
        spaceAfter=2,
    )
    styles["th"] = ParagraphStyle(
        "TH",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.3,
        leading=11,
        textColor=colors.white,
        alignment=TA_LEFT,
    )
    return styles


def make_severity_chip(severity: str, finding_id: str) -> Table:
    fg_hex, bg_hex = SEV_META[severity]
    chip_style = ParagraphStyle(
        f"chip_{severity}",
        fontName="Helvetica-Bold",
        fontSize=7.6,
        leading=9.5,
        textColor=colors.HexColor(fg_hex),
        alignment=TA_CENTER,
    )
    id_style = ParagraphStyle(
        "id_lbl",
        fontName="Helvetica-Bold",
        fontSize=7.8,
        leading=10,
        textColor=colors.HexColor(SLATE_700),
        alignment=TA_CENTER,
    )
    tbl = Table(
        [
            [Paragraph(esc(finding_id), id_style)],
            [Paragraph(esc(severity.upper()), chip_style)],
        ],
        colWidths=[2.0 * cm],
    )
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), colors.white),
                ("BACKGROUND", (0, 1), (0, 1), colors.HexColor(bg_hex)),
                ("BOX", (0, 1), (0, 1), 0.7, colors.HexColor(fg_hex)),
                ("TOPPADDING", (0, 0), (0, 0), 1),
                ("BOTTOMPADDING", (0, 0), (0, 0), 3),
                ("TOPPADDING", (0, 1), (0, 1), 3),
                ("BOTTOMPADDING", (0, 1), (0, 1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    return tbl


def section_banner(title: str, styles, accent: str = SLATE_900):
    bar = Table([[Paragraph(f"<font color='#FFFFFF'><b>{esc(title)}</b></font>", ParagraphStyle(
        "sec_bar", fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=colors.white
    ))]], colWidths=[17.0 * cm])
    bar.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(accent)),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return bar


# =============================================================================
# CONSTRUÇÃO DO PDF
# =============================================================================
def build_pdf():
    donut_path, bar_path = generate_charts()
    styles = build_styles()
    content_width = 17.0 * cm  # A4 (21cm) - 2*2cm margins

    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=A4,
        leftMargin=2.0 * cm,
        rightMargin=2.0 * cm,
        topMargin=2.1 * cm,
        bottomMargin=2.0 * cm,
        title=REPORT_TITLE,
        author="Auditoria Automatizada de Segurança",
    )

    story = []

    # =========================================================================
    # A) CAPA
    # =========================================================================
    cover_title = ParagraphStyle(
        "CoverTitle",
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=27,
        textColor=colors.white,
    )
    cover_sub = ParagraphStyle(
        "CoverSub",
        fontName="Helvetica",
        fontSize=10.5,
        leading=14.5,
        textColor=colors.HexColor("#CBD5E1"),
    )
    cover_tag = ParagraphStyle(
        "CoverTag",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#FCA5A5"),
    )

    hero = Table(
        [
            [Paragraph("AUDITORIA DE SEGURANÇA DE APLICAÇÃO (SAST & ARQUITETURA)", cover_tag)],
            [Paragraph("Relatório de Auditoria de Segurança<br/>Projeto Castello", cover_title)],
            [
                Paragraph(
                    "Revisão completa de código-fonte, isolamento multi-tenant (Supabase/RLS), "
                    "controle de acesso, proteção contra IDOR, gestão de segredos e sanitização de inputs.",
                    cover_sub,
                )
            ],
        ],
        colWidths=[content_width],
    )
    hero.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(SLATE_900)),
                ("LINEABOVE", (0, 0), (-1, 0), 4, colors.HexColor(COLOR_CRITICA)),
                ("TOPPADDING", (0, 0), (0, 0), 18),
                ("BOTTOMPADDING", (0, 0), (0, 0), 6),
                ("TOPPADDING", (0, 1), (0, 1), 2),
                ("BOTTOMPADDING", (0, 1), (0, 1), 10),
                ("TOPPADDING", (0, 2), (0, 2), 0),
                ("BOTTOMPADDING", (0, 2), (0, 2), 18),
                ("LEFTPADDING", (0, 0), (-1, -1), 18),
                ("RIGHTPADDING", (0, 0), (-1, -1), 18),
            ]
        )
    )
    story.append(hero)
    story.append(Spacer(1, 0.55 * cm))

    # Bloco de Metadados da Auditoria
    meta_rows = [
        ["Projeto Auditado", "Castello — Sistema de Gestão de Obras, Equipas, Frota, Financeiro e Ponto"],
        ["Data da Auditoria", f"{AUDIT_DATE}   •   Revisão Git: {AUDIT_COMMIT}"],
        [
            "Stack Detectada",
            "Web: React 18 + TypeScript + Vite 6 + Zod 4 (Vercel) | "
            "Mobile: React Native 0.88 + Expo 58 (EAS) | "
            "Backend/DB: Supabase (PostgreSQL + PostgREST + RLS + RPC PL/pgSQL) + Vercel Serverless (api/sign-cloudinary.js) | "
            "Mídia: Cloudinary",
        ],
        [
            "Escopo Auditado",
            "web/src/**, web/vite.config.ts, web/vercel.json, web/dist/assets/*.js, mobile/App.tsx, "
            "mobile/src/**, mobile/app.json, api/sign-cloudinary.js, supabase/schema*.sql, "
            "supabase/migrations/*.sql, vercel.json, .gitignore e histórico completo do Git.",
        ],
        [
            "Classificação de Risco",
            "<font color='#B91C1C'><b>RISCO CRÍTICO</b></font> — 5 falhas Críticas, 5 Altas, 4 Médias e 1 Baixa "
            "(exposição multi-tenant e segredo hardcoded exigem ação imediata antes de escala em produção).",
        ],
    ]
    meta_table = Table(
        [
            [
                Paragraph(f"<b>{esc(k)}</b>", styles["cell"]),
                Paragraph(v if "<font" in v else esc(v), styles["cell"]),
            ]
            for k, v in meta_rows
        ],
        colWidths=[3.8 * cm, content_width - 3.8 * cm],
    )
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor(SLATE_100)),
                ("BACKGROUND", (1, 0), (1, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(SLATE_200)),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 0.5 * cm))

    # Nota Metodológica
    story.append(Paragraph("Nota Metodológica — Mapeamento das 5 Categorias para a Stack Castello", styles["h2"]))
    story.append(
        Paragraph(
            "Esta auditoria baseou-se exclusivamente em evidências verificadas diretamente no código-fonte, "
            "nas migrações SQL, nos arquivos de deploy e no histórico Git do repositório (zero especulação). "
            "Como o Castello adota arquitetura BaaS (Supabase acessado diretamente pelos clientes Web e Mobile "
            "somado a uma função serverless Vercel), cada categoria foi adaptada conforme a tabela abaixo:",
            styles["body"],
        )
    )

    method_rows = [
        [
            Paragraph("<b>Categoria</b>", styles["th"]),
            Paragraph("<b>Mapeamento Técnico na Stack Castello</b>", styles["th"]),
        ],
        [
            Paragraph("<b>1. Banco sem Tranca</b>", styles["cell"]),
            Paragraph(
                "Auditoria das políticas RLS em todas as 19 tabelas do PostgreSQL (schema.sql e migrations), "
                "grants para role anon, isolamento por company_id em queries Web/Mobile e exposição de dados no Portal do Cliente.",
                styles["cell"],
            ),
        ],
        [
            Paragraph("<b>2. Permissão no Navegador</b>", styles["cell"]),
            Paragraph(
                "Cruzamento entre sessão em localStorage, verificações de papel na UI (patrao, encarregado, lider) "
                "e controle real no servidor (RLS, RPCs e endpoint serverless /api/sign-cloudinary).",
                styles["cell"],
            ),
        ],
        [
            Paragraph("<b>3. IDOR</b>", styles["cell"]),
            Paragraph(
                "Revisão exaustiva dos 38 handlers de leitura, atualização e exclusão por ID em web/src/lib/supabase.ts "
                "e mobile/src/lib/supabase.ts, além da resolução pública por share_code.",
                styles["cell"],
            ),
        ],
        [
            Paragraph("<b>4. Chaves Expostas</b>", styles["cell"]),
            Paragraph(
                "Varredura por credenciais hardcoded, defaults inseguros (process.env.X || ...), histórico Git, "
                "arquivos .env, armazenamento local (localStorage/AsyncStorage) e inspeção do bundle web/dist/.",
                styles["cell"],
            ),
        ],
        [
            Paragraph("<b>5. Inputs sem Tratamento</b>", styles["cell"]),
            Paragraph(
                "Inspeção de sinks XSS (dangerouslySetInnerHTML, innerHTML, document.write, eval), URLs dinâmicas em "
                "href/src, exportação CSV/XLSX/PDF, validação de uploads e cabeçalhos HTTP (CSP/HSTS) em vercel.json.",
                styles["cell"],
            ),
        ],
    ]
    method_table = Table(method_rows, colWidths=[4.2 * cm, content_width - 4.2 * cm], repeatRows=1)
    method_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(SLATE_800)),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor(SLATE_50)]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(SLATE_200)),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(method_table)
    story.append(PageBreak())

    # =========================================================================
    # B) RESUMO EXECUTIVO + GRÁFICOS
    # =========================================================================
    story.append(section_banner("1. Resumo Executivo", styles, SLATE_900))
    story.append(Spacer(1, 0.35 * cm))

    # Cards de KPI
    kpis = [
        ("TOTAL", "15", SLATE_900, SLATE_100),
        ("CRÍTICA", "5", COLOR_CRITICA, BG_CRITICA),
        ("ALTA", "5", COLOR_ALTA, BG_ALTA),
        ("MÉDIA", "4", COLOR_MEDIA, BG_MEDIA),
        ("BAIXA", "1", COLOR_BAIXA, BG_BAIXA),
        ("PONTOS FORTES", "10", COLOR_FORTE, BG_FORTE),
    ]
    kpi_cells = []
    for label, num, fg, bg in kpis:
        c = Table(
            [
                [Paragraph(f"<font color='{fg}'><b>{num}</b></font>", ParagraphStyle("kn", fontName="Helvetica-Bold", fontSize=18, leading=20, alignment=TA_CENTER))],
                [Paragraph(f"<font color='{fg}'><b>{label}</b></font>", ParagraphStyle("kl", fontName="Helvetica-Bold", fontSize=6.8, leading=8.5, alignment=TA_CENTER))],
            ],
            colWidths=[2.65 * cm],
        )
        c.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bg)),
                    ("BOX", (0, 0), (-1, -1), 0.9, colors.HexColor(fg)),
                    ("TOPPADDING", (0, 0), (-1, 0), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
                    ("TOPPADDING", (0, 1), (-1, 1), 1),
                    ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
                ]
            )
        )
        kpi_cells.append(c)

    kpi_row = Table([kpi_cells], colWidths=[content_width / 6.0] * 6)
    kpi_row.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(kpi_row)
    story.append(Spacer(1, 0.45 * cm))

    # Gráficos lado a lado
    img_donut = Image(str(donut_path), width=7.6 * cm, height=5.7 * cm)
    img_bars = Image(str(bar_path), width=9.1 * cm, height=5.7 * cm)
    charts_tbl = Table([[img_donut, img_bars]], colWidths=[7.7 * cm, 9.3 * cm])
    charts_tbl.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor(SLATE_200)),
                ("BOX", (1, 0), (1, 0), 0.5, colors.HexColor(SLATE_200)),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(charts_tbl)
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("Diagnóstico Geral", styles["h2"]))
    story.append(
        Paragraph(
            "A auditoria identificou <b>15 falhas verificadas</b> distribuídas nas 5 categorias avaliadas, sendo "
            "<b>5 de severidade Crítica</b> e <b>5 de severidade Alta</b>. O risco estrutural mais urgente do "
            "Castello decorre da combinação de três fatores arquiteturais: (1) o banco Supabase está exposto à role "
            "pública <i>anon</i> com políticas RLS permissivas (<i>using true</i> ou <i>company_id is not null</i>), "
            "(2) a autenticação por e-mail/senha (Web) e e-mail/PIN (Mobile) é realizada diretamente pelo cliente sem "
            "emissão de sessão JWT no Supabase Auth, e (3) as operações CRUD por ID e validações de papel ocorrem "
            "exclusivamente na interface. Adicionalmente, a chave secreta <b>CLOUDINARY_API_SECRET</b> permanece "
            "hardcoded em 3 arquivos ativos e no histórico Git (commit <i>f9a04cc</i>), exigindo rotação imediata.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            "Por outro lado, o projeto apresenta bases positivas relevantes na camada de frontend e validação: "
            "<b>zero ocorrências</b> de <i>dangerouslySetInnerHTML</i>/<i>innerHTML</i>/<i>eval</i>, adoção consistente "
            "de <b>Zod</b> nos formulários Web, uso exclusivo de queries parametrizadas do PostgREST (sem SQL Injection), "
            "escape XML/HTML em relatórios financeiros e segregação correta de arquivos <i>.env</i> fora do Git.",
            styles["body"],
        )
    )

    # =========================================================================
    # C) PONTOS FORTES E PONTOS FRACOS
    # =========================================================================
    story.append(Spacer(1, 0.3 * cm))
    story.append(section_banner("2. Pontos Fortes e Pontos Fracos", styles, SLATE_900))
    story.append(Spacer(1, 0.3 * cm))

    story.append(
        Paragraph(
            f"<font color='{COLOR_FORTE}'><b>Pontos Fortes Verificados (10 controles corretos)</b></font>",
            styles["h2"],
        )
    )
    strength_rows = [
        [
            Paragraph("<b>Controle Verificado</b>", styles["th"]),
            Paragraph("<b>Evidência no Código</b>", styles["th"]),
            Paragraph("<b>Proteção Confirmada</b>", styles["th"]),
        ]
    ]
    for title, loc, desc in STRENGTHS:
        strength_rows.append(
            [
                Paragraph(f"<font color='{COLOR_FORTE}'><b>✓</b></font> <b>{esc(title)}</b>", styles["cell"]),
                Paragraph(esc(loc), styles["cell_mono"]),
                Paragraph(esc(desc), styles["cell"]),
            ]
        )

    strength_tbl = Table(strength_rows, colWidths=[4.2 * cm, 4.3 * cm, 8.5 * cm], repeatRows=1)
    strength_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(COLOR_FORTE)),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F0FDF4")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#BBF7D0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(strength_tbl)
    story.append(Spacer(1, 0.4 * cm))

    story.append(
        Paragraph(
            f"<font color='{COLOR_CRITICA}'><b>Pontos Fracos Centrais (Riscos Arquiteturais)</b></font>",
            styles["h2"],
        )
    )
    weak_rows = [
        [
            Paragraph("<b>Risco Central</b>", styles["th"]),
            Paragraph("<b>Resumo do Impacto</b>", styles["th"]),
        ]
    ]
    for title, desc in WEAKNESSES_SUMMARY:
        weak_rows.append(
            [
                Paragraph(f"<font color='{COLOR_CRITICA}'><b>!</b></font> <b>{esc(title)}</b>", styles["cell"]),
                Paragraph(esc(desc), styles["cell"]),
            ]
        )
    weak_tbl = Table(weak_rows, colWidths=[5.6 * cm, 11.4 * cm], repeatRows=1)
    weak_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(COLOR_CRITICA)),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FEF2F2")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#FECACA")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(weak_tbl)
    story.append(PageBreak())

    # =========================================================================
    # D) TABELA DE ACHADOS DETALHADOS POR CATEGORIA
    # =========================================================================
    story.append(section_banner("3. Achados Detalhados por Categoria", styles, SLATE_900))
    story.append(Spacer(1, 0.25 * cm))

    for cat in FINDINGS_BY_CATEGORY:
        story.append(Paragraph(esc(cat["category"]), styles["h2"]))
        story.append(Paragraph(esc(cat["intro"]), styles["small_muted"]))

        rows = [
            [
                Paragraph("<b>Severidade</b>", styles["th"]),
                Paragraph("<b>Arquivo : Linha</b>", styles["th"]),
                Paragraph("<b>Descrição, Evidência e Explorabilidade</b>", styles["th"]),
            ]
        ]

        for item in cat["items"]:
            chip = make_severity_chip(item["severity"], item["id"])
            loc_html = esc(item["location"]).replace("\n", "<br/>")
            snip_html = "<br/>".join(esc_preserve_indent(ln) for ln in item["snippet"].split("\n"))

            desc_flow = [
                Paragraph(f"<b>{esc(item['title'])}</b>", styles["cell"]),
                Spacer(1, 3),
                Paragraph(f"<font name='Courier' size='6.9'>{snip_html}</font>", styles["code_inline"]),
                Spacer(1, 2),
                Paragraph(f"<b>Por que é explorável:</b> {esc(item['why'])}", styles["cell"]),
            ]

            rows.append([chip, Paragraph(loc_html, styles["cell_mono"]), desc_flow])

        tbl = Table(rows, colWidths=[2.3 * cm, 4.4 * cm, 10.3 * cm], repeatRows=1)
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(SLATE_800)),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor(SLATE_50)]),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(SLATE_200)),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (0, 1), (0, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(tbl)
        story.append(Spacer(1, 0.35 * cm))

    story.append(PageBreak())

    # =========================================================================
    # E) RECOMENDAÇÕES PRIORIZADAS (P1, P2, P3, P4)
    # =========================================================================
    story.append(section_banner("4. Plano de Remediação Priorizado (P1 a P4)", styles, SLATE_900))
    story.append(Spacer(1, 0.3 * cm))

    for prio_title, fg, bg, actions in PRIORITIZED_ROADMAP:
        block_rows = [
            [
                Paragraph(
                    f"<font color='{fg}'><b>{esc(prio_title)}</b></font>",
                    ParagraphStyle("pr_h", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=colors.HexColor(fg)),
                )
            ]
        ]
        bullet_html = "<br/>".join([f"• {esc(a)}" for a in actions])
        block_rows.append([Paragraph(bullet_html, styles["cell"])])

        card = Table(block_rows, colWidths=[content_width])
        card.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, 0), colors.HexColor(bg)),
                    ("BACKGROUND", (0, 1), (0, 1), colors.white),
                    ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor(fg)),
                    ("LINEBELOW", (0, 0), (0, 0), 0.6, colors.HexColor(fg)),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 9),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ]
            )
        )
        story.append(KeepTogether([card, Spacer(1, 0.3 * cm)]))

    story.append(PageBreak())

    # =========================================================================
    # F) ISSUES PARA O GITHUB (PRONTAS PARA COPIAR E COLAR)
    # =========================================================================
    story.append(section_banner("5. ISSUES PARA O GITHUB", styles, SLATE_900))
    story.append(Spacer(1, 0.2 * cm))
    story.append(
        Paragraph(
            "Os blocos abaixo contêm <b>10 issues completas em Markdown</b> (agrupando achados relacionados "
            "para evitar spam), prontas para copiar e colar diretamente no GitHub Issues do repositório.",
            styles["body"],
        )
    )
    story.append(Spacer(1, 0.2 * cm))

    issue_header_style = ParagraphStyle(
        "IssHdr",
        fontName="Helvetica-Bold",
        fontSize=9.2,
        leading=12,
        textColor=colors.white,
    )

    for iss in GITHUB_ISSUES:
        full_md = (
            f"--- ISSUE {iss['num']} ---\n"
            f"# {iss['title']}\n\n"
            f"**Labels sugeridas:** `{iss['labels']}`\n\n"
            f"{iss['body']}\n"
            f"--- FIM ISSUE {iss['num']} ---"
        )

        # Quebra por parágrafos/linhas em linhas individuais da tabela para permitir paginação limpa
        lines = full_md.split("\n")
        table_rows = [
            [
                Paragraph(
                    f"ISSUE {iss['num']} — {esc(iss['title'])}",
                    issue_header_style,
                )
            ]
        ]

        # Quebra por linhas preservando indentação mas permitindo quebra natural por palavras
        chunk_size = 12
        for i in range(0, len(lines), chunk_size):
            chunk = lines[i : i + chunk_size]
            chunk_html = "<br/>".join(esc_preserve_indent(line) for line in chunk)
            table_rows.append([Paragraph(chunk_html, styles["issue_mono"])])

        iss_tbl = Table(table_rows, colWidths=[content_width], repeatRows=1)
        iss_tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, 0), colors.HexColor(SLATE_800)),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor(SLATE_50)),
                    ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(SLATE_400)),
                    ("TOPPADDING", (0, 0), (0, 0), 5),
                    ("BOTTOMPADDING", (0, 0), (0, 0), 5),
                    ("TOPPADDING", (0, 1), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(iss_tbl)
        if iss is not GITHUB_ISSUES[-1]:
            story.append(Spacer(1, 0.35 * cm))

    doc.build(story, canvasmaker=NumberedCanvas)
    shutil.rmtree(CHARTS_DIR, ignore_errors=True)
    print(f"PDF gerado com sucesso em: {OUTPUT_PDF}")


if __name__ == "__main__":
    build_pdf()
