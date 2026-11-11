import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Company,
  ConstructionSite,
  EmployeeProfile,
  EntryStatus,
  EntryType,
  FinancialCategory,
  FinancialRecord,
  FinancialStatus,
  FinancialType,
  SiteDailyLog,
  SiteTask,
  TaskStatus,
  TimeEntry,
} from '../types';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://kkygvorgxehkadaqfqrx.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_JwCC3MlUbGCfgWFWSbkxmw_zBHdsKFX';

export const isSupabaseConfigured =
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) &&
  !SUPABASE_URL.includes('seu-projeto.supabase.co');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const CURRENT_COMPANY_KEY = 'castello_active_company_session';

// ============================================================================
// SESSÃO DA FIRMA / PATRÃO
// ============================================================================
export function getActiveCompanySession(): Company | null {
  const raw = localStorage.getItem(CURRENT_COMPANY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setActiveCompanySession(company: Company | null) {
  if (company) {
    localStorage.setItem(CURRENT_COMPANY_KEY, JSON.stringify(company));
  } else {
    localStorage.removeItem(CURRENT_COMPANY_KEY);
  }
}

export async function registerCompany(
  name: string,
  ownerEmail: string,
  password: string,
  phone?: string,
  taxId?: string
): Promise<Company> {
  const cleanEmail = ownerEmail.trim().toLowerCase();
  if (supabase) {
    const { data: existing } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_email', cleanEmail)
      .maybeSingle();

    if (existing) {
      throw new Error('Já existe uma firma registada com este e-mail.');
    }

    const { data, error } = await supabase
      .from('companies')
      .insert({
        name: name.trim(),
        owner_email: cleanEmail,
        password_hash: password,
        phone: phone?.trim() || null,
        tax_id: taxId?.trim() || null,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Falha ao criar firma.');
    }

    setActiveCompanySession(data as Company);
    return data as Company;
  }

  const mockCompany: Company = {
    id: crypto.randomUUID(),
    name,
    owner_email: cleanEmail,
    password_hash: password,
    phone,
    tax_id: taxId,
  };
  setActiveCompanySession(mockCompany);
  return mockCompany;
}

export async function loginCompany(
  ownerEmail: string,
  password: string
): Promise<Company> {
  const cleanEmail = ownerEmail.trim().toLowerCase();
  if (supabase) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_email', cleanEmail)
      .eq('password_hash', password)
      .maybeSingle();

    if (error || !data) {
      throw new Error('E-mail ou senha da firma incorretos.');
    }

    setActiveCompanySession(data as Company);
    return data as Company;
  }
  throw new Error('Serviço indisponível.');
}

export async function updateCompanyProfile(
  companyId: string,
  updates: Partial<Company>
): Promise<Company> {
  const current = getActiveCompanySession();
  const merged: Company = {
    ...(current || ({} as Company)),
    ...updates,
    id: companyId,
  };

  if (supabase) {
    try {
      // Tenta atualizar no Supabase com os campos fornecidos
      const payload: Record<string, any> = {
        name: merged.name,
        tax_id: merged.tax_id || null,
        phone: merged.phone || null,
      };
      if (updates.logo_url !== undefined) payload.logo_url = updates.logo_url;
      if (updates.currency !== undefined) payload.currency = updates.currency;
      if (updates.address !== undefined) payload.address = updates.address;

      const { data, error } = await supabase
        .from('companies')
        .update(payload)
        .eq('id', companyId)
        .select('*')
        .maybeSingle();

      if (error) {
        console.warn('Aviso ao atualizar firma no Supabase (aplicando fallback local):', error.message);
        // Fallback para colunas essenciais
        await supabase
          .from('companies')
          .update({
            name: merged.name,
            tax_id: merged.tax_id || null,
            phone: merged.phone || null,
          })
          .eq('id', companyId);
      } else if (data) {
        const full = { ...merged, ...data } as Company;
        setActiveCompanySession(full);
        return full;
      }
    } catch (err) {
      console.warn('Erro ao atualizar empresa no Supabase:', err);
    }
  }

  setActiveCompanySession(merged);
  return merged;
}

export async function changeCompanyPassword(
  companyId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const current = getActiveCompanySession();
  if (current && current.password_hash !== currentPassword) {
    throw new Error('A senha atual fornecida está incorreta.');
  }

  if (supabase) {
    const { error } = await supabase
      .from('companies')
      .update({ password_hash: newPassword })
      .eq('id', companyId)
      .eq('password_hash', currentPassword);

    if (error) {
      throw new Error('Falha ao atualizar senha: ' + error.message);
    }
  }

  if (current) {
    current.password_hash = newPassword;
    setActiveCompanySession(current);
  }
}

export async function deleteCompanyAccount(companyId: string): Promise<void> {
  if (supabase) {
    try {
      // Remove vínculos dependentes se existirem
      await supabase.from('time_entries').delete().eq('company_id', companyId);
      await supabase.from('site_tasks').delete().eq('company_id', companyId);
      await supabase.from('construction_sites').delete().eq('company_id', companyId);
      await supabase.from('profiles').delete().eq('company_id', companyId);
      await supabase.from('companies').delete().eq('id', companyId);
    } catch (err) {
      console.warn('Erro ao apagar empresa do Supabase:', err);
    }
  }

  // Remove do localStorage dados da empresa
  localStorage.removeItem(CURRENT_COMPANY_KEY);
  localStorage.removeItem(`castello_financial_${companyId}`);
}

// ============================================================================
// OBRAS
// ============================================================================
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'CST-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function getSites(companyId?: string): Promise<ConstructionSite[]> {
  if (supabase) {
    try {
      let query = supabase.from('construction_sites').select('*').order('created_at', { ascending: false });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) return data as ConstructionSite[];
    } catch (e) {
      console.warn('Erro ao carregar obras:', e);
    }
  }
  return [];
}

export async function getSiteByShareCode(shareCode: string): Promise<ConstructionSite | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('construction_sites')
        .select('*')
        .ilike('share_code', shareCode.trim())
        .maybeSingle();
      if (!error && data) return data as ConstructionSite;
    } catch (e) {
      console.warn('Erro ao buscar obra por código:', e);
    }
  }
  return null;
}

export async function saveSite(
  site: Omit<ConstructionSite, 'id' | 'share_code'> & { id?: string; share_code?: string },
  companyId?: string
): Promise<ConstructionSite> {
  const payload = {
    ...site,
    share_code: site.share_code || generateShareCode(),
    company_id: site.company_id || companyId || null,
  };

  if (supabase) {
    if (site.id) {
      const { data, error } = await supabase
        .from('construction_sites')
        .update(payload)
        .eq('id', site.id)
        .select('*')
        .single();
      if (!error && data) return data as ConstructionSite;
    } else {
      const { data, error } = await supabase
        .from('construction_sites')
        .insert(payload)
        .select('*')
        .single();
      if (!error && data) return data as ConstructionSite;
    }
  }
  throw new Error('Falha ao gravar obra.');
}

export async function deleteSite(id: string): Promise<void> {
  if (supabase) {
    await supabase.from('construction_sites').delete().eq('id', id);
  }
}

// ============================================================================
// FUNCIONÁRIOS (Sem alocação a obra)
// ============================================================================
export async function getEmployees(companyId?: string): Promise<EmployeeProfile[]> {
  if (supabase) {
    try {
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) return data as EmployeeProfile[];
    } catch (e) {
      console.warn('Erro ao carregar colaboradores:', e);
    }
  }
  return [];
}

export async function saveEmployee(
  emp: Omit<EmployeeProfile, 'id'> & { id?: string },
  companyId?: string
): Promise<EmployeeProfile> {
  const payload: any = {
    ...emp,
    company_id: emp.company_id || companyId || null,
  };

  if (supabase) {
    if (emp.id) {
      const { id, ...updateFields } = payload;
      let { data, error } = await supabase
        .from('profiles')
        .update(updateFields)
        .eq('id', emp.id)
        .select('*')
        .single();

      // Fallback resiliente: se a coluna admission_date ainda não foi criada no banco
      if (error && (error.code === 'PGRST204' || error.message?.includes('admission_date'))) {
        delete updateFields.admission_date;
        const retry = await supabase
          .from('profiles')
          .update(updateFields)
          .eq('id', emp.id)
          .select('*')
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Erro ao atualizar colaborador:', error);
        throw new Error(error.message || 'Falha ao atualizar colaborador.');
      }
      if (data) return data as EmployeeProfile;
    } else {
      const { id, ...insertFields } = payload;
      let { data, error } = await supabase
        .from('profiles')
        .insert(insertFields)
        .select('*')
        .single();

      // Fallback resiliente: se a coluna admission_date ainda não foi criada no banco
      if (error && (error.code === 'PGRST204' || error.message?.includes('admission_date'))) {
        delete insertFields.admission_date;
        const retry = await supabase
          .from('profiles')
          .insert(insertFields)
          .select('*')
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Erro ao criar colaborador:', error);
        throw new Error(error.message || 'Falha ao criar colaborador.');
      }
      if (data) return data as EmployeeProfile;
    }
  }
  throw new Error('Falha ao salvar colaborador.');
}

export async function deleteEmployee(id: string): Promise<void> {
  if (supabase) {
    await supabase.from('profiles').delete().eq('id', id);
  }
}

// ============================================================================
// TAREFAS DA OBRA (site_tasks)
// ============================================================================
export async function getSiteTasks(siteId: string): Promise<SiteTask[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_tasks')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (!error && data) return data as SiteTask[];
    } catch (e) {
      console.warn('Erro ao carregar tarefas da obra:', e);
    }
  }
  return [];
}

export async function createSiteTask(
  siteId: string,
  title: string,
  description?: string,
  assignedToName?: string,
  dueDate?: string,
  companyId?: string
): Promise<SiteTask> {
  if (supabase) {
    const { data, error } = await supabase
      .from('site_tasks')
      .insert({
        site_id: siteId,
        company_id: companyId || null,
        title: title.trim(),
        description: description?.trim() || null,
        assigned_to_name: assignedToName || null,
        status: 'pendente',
        due_date: dueDate || null,
      })
      .select('*')
      .single();
    if (!error && data) return data as SiteTask;
  }
  throw new Error('Falha ao criar tarefa.');
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  operatorName: string
): Promise<void> {
  if (supabase) {
    const patch: any = { status };
    if (status === 'concluida_funcionario') {
      patch.completed_by_name = operatorName;
      patch.completed_at = new Date().toISOString();
    } else if (status === 'confirmada_chefe') {
      patch.confirmed_by_name = operatorName;
      patch.confirmed_at = new Date().toISOString();
    }
    await supabase.from('site_tasks').update(patch).eq('id', taskId);
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  if (supabase) {
    await supabase.from('site_tasks').delete().eq('id', taskId);
  }
}

// ============================================================================
// DIÁRIO DE BORDO DA OBRA (site_daily_logs)
// ============================================================================
export async function getSiteDailyLogs(siteId: string): Promise<SiteDailyLog[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_daily_logs')
        .select('*')
        .eq('site_id', siteId)
        .order('log_date', { ascending: false });
      if (!error && data) return data as SiteDailyLog[];
    } catch (e) {
      console.warn('Erro ao carregar diário de bordo:', e);
    }
  }
  return [];
}

export async function addSiteDailyLog(
  siteId: string,
  summary: string,
  workersCount: number = 1,
  weather?: string,
  notes?: string
): Promise<SiteDailyLog> {
  if (supabase) {
    const { data, error } = await supabase
      .from('site_daily_logs')
      .insert({
        site_id: siteId,
        log_date: new Date().toISOString().slice(0, 10),
        summary: summary.trim(),
        workers_count: workersCount,
        weather: weather || 'Bom tempo',
        notes: notes?.trim() || null,
      })
      .select('*')
      .single();
    if (!error && data) return data as SiteDailyLog;
  }
  throw new Error('Falha ao adicionar registo diário.');
}

// ============================================================================
// PICAGENS DE PONTO
// ============================================================================
export async function getAllTimeEntries(companyId?: string): Promise<TimeEntry[]> {
  if (supabase) {
    try {
      let query = supabase.from('time_entries').select('*').order('recorded_at', { ascending: false });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map((d: any) => ({
          ...d,
          status: d.status || 'pendente',
        })) as TimeEntry[];
      }
    } catch (e) {
      console.warn('Erro ao carregar picagens:', e);
    }
  }
  return [];
}

export async function updateEntryStatus(
  id: number,
  status: EntryStatus
): Promise<void> {
  if (supabase) {
    await supabase
      .from('time_entries')
      .update({ status, validated_at: new Date().toISOString() })
      .eq('id', id);
  }
}

// ============================================================================
// GESTÃO FINANCEIRA DE OBRAS
// ============================================================================
const getFinStorageKey = (companyId?: string) =>
  `castello_financial_${companyId || 'default'}`;

export function getInitialSampleFinancials(companyId?: string): FinancialRecord[] {
  const today = new Date();
  const formatIso = (d: Date) => d.toISOString().slice(0, 10);
  const dMinus15 = new Date(today.getTime() - 15 * 86400000);
  const dMinus5 = new Date(today.getTime() - 5 * 86400000);
  const dPlus7 = new Date(today.getTime() + 7 * 86400000);
  const dPlus18 = new Date(today.getTime() + 18 * 86400000);

  return [
    {
      id: 'fin-01',
      company_id: companyId || null,
      type: 'receita',
      category: 'adiantamento_cliente',
      title: 'Adiantamento Inicial de Contrato',
      entity_name: 'Família Moreira / Investimentos',
      amount: 75000,
      due_date: formatIso(dMinus15),
      payment_date: formatIso(dMinus15),
      status: 'pago',
      invoice_number: 'FAT-2026-001',
      description: 'Sinal de 25% para mobilização da obra e aquisição de estrutura.',
      created_at: formatIso(dMinus15),
    },
    {
      id: 'fin-02',
      company_id: companyId || null,
      type: 'receita',
      category: 'receita_medicao',
      title: 'Medição 01 - Fundações e Estrutura de Betão',
      entity_name: 'Engenharia & Fiscalização Geral',
      amount: 45000,
      due_date: formatIso(dMinus5),
      payment_date: formatIso(dMinus5),
      status: 'pago',
      invoice_number: 'MED-01-2026',
      description: 'Aprovação de medição mensal de alvenaria e pilares.',
      created_at: formatIso(dMinus5),
    },
    {
      id: 'fin-03',
      company_id: companyId || null,
      type: 'despesa',
      category: 'custo_materiais',
      title: 'Aquisição de Aço CA-50 e Betão Pronto B25',
      entity_name: 'Cimpor Fornecimentos de Betão Lda',
      amount: 18500,
      due_date: formatIso(dMinus15),
      payment_date: formatIso(dMinus15),
      status: 'pago',
      invoice_number: 'NC-89321',
      description: 'Betão estrutural para laje e vigas principais.',
      created_at: formatIso(dMinus15),
    },
    {
      id: 'fin-04',
      company_id: companyId || null,
      type: 'despesa',
      category: 'custo_mao_de_obra',
      title: 'Mão de Obra Especializada - Equipe de Cofragem',
      entity_name: 'Folha de Produção da Equipe',
      amount: 12400,
      due_date: formatIso(dMinus5),
      payment_date: formatIso(dMinus5),
      status: 'pago',
      invoice_number: 'RH-2026-02',
      description: 'Horas trabalhadas e diárias de encarregados e oficiais.',
      created_at: formatIso(dMinus5),
    },
    {
      id: 'fin-05',
      company_id: companyId || null,
      type: 'despesa',
      category: 'custo_equipamentos',
      title: 'Locação Mensal de Grua de Torre e Andaimes',
      entity_name: 'Gruas & Máquinas Ibérica',
      amount: 4800,
      due_date: formatIso(dMinus5),
      payment_date: formatIso(dMinus5),
      status: 'pago',
      invoice_number: 'LOC-4412',
      description: 'Locação operacional incluindo montagem e seguro.',
      created_at: formatIso(dMinus5),
    },
    {
      id: 'fin-06',
      company_id: companyId || null,
      type: 'despesa',
      category: 'custo_subempreitadas',
      title: 'Subempreitada de Instalações Especiais e AVAC',
      entity_name: 'ClimaTech Climatização e Redes',
      amount: 14200,
      due_date: formatIso(dPlus7),
      payment_date: null,
      status: 'pendente',
      invoice_number: 'FAT-SUB-109',
      description: 'Primeira fase de tubagens de ventilação e ar condicionado.',
      created_at: formatIso(today),
    },
    {
      id: 'fin-07',
      company_id: companyId || null,
      type: 'despesa',
      category: 'pagamento_fornecedor',
      title: 'Fornecimento de Tijolos Térmicos e Cimento',
      entity_name: 'Materiais de Construção Castelo do Norte',
      amount: 6750,
      due_date: formatIso(dPlus7),
      payment_date: null,
      status: 'pendente',
      invoice_number: 'FAT-8902',
      description: 'Entrega de material cerâmico para fechamentos de alvenaria.',
      created_at: formatIso(today),
    },
    {
      id: 'fin-08',
      company_id: companyId || null,
      type: 'receita',
      category: 'receita_medicao',
      title: 'Medição 02 - Conclusão de Alvenarias e Cobertura',
      entity_name: 'Cliente Privado / Fiscalização',
      amount: 52000,
      due_date: formatIso(dPlus18),
      payment_date: null,
      status: 'pendente',
      invoice_number: 'MED-02-2026',
      description: 'Previsão de faturamento da 2ª medição contratual.',
      created_at: formatIso(today),
    },
  ];
}

export async function getFinancialRecords(companyId?: string): Promise<FinancialRecord[]> {
  const localKey = getFinStorageKey(companyId);

  if (supabase) {
    try {
      let query = supabase.from('financial_transactions').select('*').order('due_date', { ascending: false });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        localStorage.setItem(localKey, JSON.stringify(data));
        return data as FinancialRecord[];
      }
    } catch (e) {
      console.warn('Erro ao carregar transações financeiras do Supabase:', e);
    }
  }

  // Fallback LocalStorage
  const stored = localStorage.getItem(localKey);
  if (stored) {
    try {
      return JSON.parse(stored) as FinancialRecord[];
    } catch {
      // ignore
    }
  }

  // Gera dados iniciais caso ainda não existam registros
  const initial = getInitialSampleFinancials(companyId);
  localStorage.setItem(localKey, JSON.stringify(initial));
  return initial;
}

export async function saveFinancialRecord(
  record: Partial<FinancialRecord>,
  companyId?: string
): Promise<FinancialRecord> {
  const localKey = getFinStorageKey(companyId);
  const now = new Date().toISOString();
  const id = record.id || `fin-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const newRecord: FinancialRecord = {
    id,
    company_id: record.company_id || companyId || null,
    site_id: record.site_id || null,
    site_name: record.site_name || null,
    type: record.type || 'despesa',
    category: record.category || 'custo_materiais',
    title: (record.title || 'Lançamento sem título').trim(),
    description: record.description?.trim() || null,
    entity_name: record.entity_name?.trim() || null,
    invoice_number: record.invoice_number?.trim() || null,
    amount: typeof record.amount === 'number' ? record.amount : parseFloat(String(record.amount || 0)) || 0,
    due_date: record.due_date || now.slice(0, 10),
    payment_date: record.status === 'pago' ? (record.payment_date || now.slice(0, 10)) : null,
    status: record.status || 'pendente',
    created_at: record.created_at || now.slice(0, 10),
  };

  // Salva no Supabase se disponível
  if (supabase) {
    try {
      if (record.id) {
        await supabase
          .from('financial_transactions')
          .update(newRecord)
          .eq('id', record.id);
      } else {
        await supabase.from('financial_transactions').insert(newRecord);
      }
    } catch (err) {
      console.warn('Aviso: gravando transação em armazenamento local persistente:', err);
    }
  }

  // Sempre sincroniza no LocalStorage
  const current = await getFinancialRecords(companyId);
  const exists = current.some((r) => r.id === newRecord.id);
  const updated = exists
    ? current.map((r) => (r.id === newRecord.id ? newRecord : r))
    : [newRecord, ...current];

  localStorage.setItem(localKey, JSON.stringify(updated));
  return newRecord;
}

export async function deleteFinancialRecord(
  recordId: string,
  companyId?: string
): Promise<void> {
  const localKey = getFinStorageKey(companyId);

  if (supabase) {
    try {
      await supabase.from('financial_transactions').delete().eq('id', recordId);
    } catch (err) {
      console.warn('Erro ao remover no Supabase:', err);
    }
  }

  const current = await getFinancialRecords(companyId);
  const filtered = current.filter((r) => r.id !== recordId);
  localStorage.setItem(localKey, JSON.stringify(filtered));
}

export async function updateFinancialStatus(
  recordId: string,
  status: FinancialStatus,
  paymentDate?: string,
  companyId?: string
): Promise<void> {
  const current = await getFinancialRecords(companyId);
  const target = current.find((r) => r.id === recordId);
  if (!target) return;

  const updated: FinancialRecord = {
    ...target,
    status,
    payment_date: status === 'pago' ? (paymentDate || new Date().toISOString().slice(0, 10)) : null,
  };

  await saveFinancialRecord(updated, companyId);
}
