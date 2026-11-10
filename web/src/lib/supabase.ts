import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Company,
  ConstructionSite,
  EmployeeProfile,
  EntryStatus,
  EntryType,
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
  const payload = {
    ...emp,
    company_id: emp.company_id || companyId || null,
  };

  if (supabase) {
    if (emp.id) {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', emp.id)
        .select('*')
        .single();
      if (!error && data) return data as EmployeeProfile;
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .insert(payload)
        .select('*')
        .single();
      if (!error && data) return data as EmployeeProfile;
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
