import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AbsenceJustification,
  CalendarEvent,
  Company,
  CompanyNotification,
  ConstructionSite,
  EmployeeProfile,
  EntryStatus,
  EntryType,
  FinancialCategory,
  FinancialRecord,
  FinancialStatus,
  FinancialType,
  InventoryItem,
  SiteDailyLog,
  SiteTask,
  TaskStatus,
  ThemeColor,
  ThemeMode,
  TimeEntry,
  Vehicle,
  VehicleReport,
  VehicleWeeklyAssignment,
  VehicleInventoryItem,
  InventoryMovement,
  VehicleMaintenanceRecord,
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
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
          return await fn();
        },
      },
    })
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
const LOCAL_AVATARS_KEY = 'castello_employee_avatars_cache';

function getLocalAvatars(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_AVATARS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalAvatar(empId: string, url: string | null) {
  try {
    const map = getLocalAvatars();
    if (url) {
      map[empId] = url;
    } else {
      delete map[empId];
    }
    localStorage.setItem(LOCAL_AVATARS_KEY, JSON.stringify(map));
  } catch {}
}

export async function getEmployees(companyId?: string): Promise<EmployeeProfile[]> {
  if (supabase) {
    try {
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        const localAvatars = getLocalAvatars();
        return (data as EmployeeProfile[]).map((emp) => ({
          ...emp,
          avatar_url: emp.avatar_url || localAvatars[emp.id] || null,
        }));
      }
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

  if (emp.id && emp.avatar_url !== undefined) {
    setLocalAvatar(emp.id, emp.avatar_url);
  }

  if (supabase) {
    if (emp.id) {
      const { id, ...updateFields } = payload;
      let { data, error } = await supabase
        .from('profiles')
        .update(updateFields)
        .eq('id', emp.id)
        .select('*')
        .single();

      // Fallback resiliente: se a coluna admission_date ou avatar_url ainda não foi criada no banco
      if (error && (error.code === 'PGRST204' || error.message?.includes('admission_date') || error.message?.includes('avatar_url'))) {
        delete updateFields.admission_date;
        delete updateFields.avatar_url;
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
      if (data) {
        const localAvatars = getLocalAvatars();
        return {
          ...(data as EmployeeProfile),
          avatar_url: data.avatar_url || emp.avatar_url || localAvatars[emp.id] || null,
        };
      }
    } else {
      const { id, ...insertFields } = payload;
      let { data, error } = await supabase
        .from('profiles')
        .insert(insertFields)
        .select('*')
        .single();

      // Fallback resiliente: se a coluna admission_date ou avatar_url ainda não foi criada no banco
      if (error && (error.code === 'PGRST204' || error.message?.includes('admission_date') || error.message?.includes('avatar_url'))) {
        delete insertFields.admission_date;
        delete insertFields.avatar_url;
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
      if (data) {
        if (emp.avatar_url) {
          setLocalAvatar(data.id, emp.avatar_url);
        }
        return {
          ...(data as EmployeeProfile),
          avatar_url: data.avatar_url || emp.avatar_url || null,
        };
      }
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
const getTasksStorageKey = (siteId: string) => `castello_site_tasks_${siteId}`;

export async function getSiteTasks(siteId: string): Promise<SiteTask[]> {
  const localKey = getTasksStorageKey(siteId);
  const cached: SiteTask[] = JSON.parse(localStorage.getItem(localKey) || '[]');

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_tasks')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Une as tarefas remotas com quaisquer tarefas salvas localmente
        const supabaseIds = new Set(data.map((d: any) => d.id));
        const localOnly = cached.filter((c) => !supabaseIds.has(c.id));
        const merged = [...(data as SiteTask[]), ...localOnly];
        localStorage.setItem(localKey, JSON.stringify(merged));
        return merged;
      }
    } catch (e) {
      console.warn('Erro ao carregar tarefas da obra do Supabase:', e);
    }
  }

  return cached;
}

export async function createSiteTask(
  siteId: string,
  title: string,
  description?: string,
  assignedToName?: string,
  dueDate?: string,
  companyId?: string,
  assignedToId?: string
): Promise<SiteTask> {
  const localKey = getTasksStorageKey(siteId);
  const newTask: SiteTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    site_id: siteId,
    company_id: companyId || null,
    title: title.trim(),
    description: description?.trim() || null,
    assigned_to_id: assignedToId || null,
    assigned_to_name: assignedToName || null,
    status: 'pendente',
    due_date: dueDate || null,
    created_at: new Date().toISOString(),
  };

  // 1. Grava de imediato no cache local para NUNCA perder o dado
  const cached: SiteTask[] = JSON.parse(localStorage.getItem(localKey) || '[]');
  const updatedLocal = [newTask, ...cached.filter((t) => t.id !== newTask.id)];
  localStorage.setItem(localKey, JSON.stringify(updatedLocal));

  // 2. Se o Supabase estiver conectado, tenta persistir no banco com fallbacks
  if (supabase) {
    try {
      const payload: any = {
        site_id: siteId,
        title: title.trim(),
        description: description?.trim() || null,
        assigned_to_name: assignedToName || null,
        status: 'pendente',
        due_date: dueDate || null,
      };
      if (companyId) payload.company_id = companyId;
      if (assignedToId) payload.assigned_to_id = assignedToId;

      let { data, error } = await supabase
        .from('site_tasks')
        .insert(payload)
        .select('*')
        .single();

      // Fallback 1: se a coluna assigned_to_id não existe no banco
      if (error && (error.code === 'PGRST204' || error.message?.includes('assigned_to_id'))) {
        delete payload.assigned_to_id;
        const retry = await supabase.from('site_tasks').insert(payload).select('*').single();
        data = retry.data;
        error = retry.error;
      }

      // Fallback 2: se a coluna company_id não existe no banco
      if (error && (error.code === 'PGRST204' || error.message?.includes('company_id'))) {
        delete payload.company_id;
        const retry = await supabase.from('site_tasks').insert(payload).select('*').single();
        data = retry.data;
        error = retry.error;
      }

      if (!error && data) {
        // Substitui a chave temporária pelo ID real do Supabase
        const finalTask = { ...newTask, ...data };
        const refreshed = updatedLocal.map((t) => (t.id === newTask.id ? finalTask : t));
        localStorage.setItem(localKey, JSON.stringify(refreshed));
        return finalTask as SiteTask;
      } else if (error) {
        console.warn('Supabase não pôde inserir a tarefa (mantida localmente):', error.message);
      }
    } catch (e) {
      console.warn('Erro na inserção da tarefa no Supabase (mantida localmente):', e);
    }
  }

  return newTask;
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  operatorName: string,
  completionPhotos?: string[],
  showToClient?: boolean
): Promise<void> {
  if (supabase) {
    const patch: any = { status };
    if (status === 'concluida_funcionario') {
      patch.completed_by_name = operatorName;
      patch.completed_at = new Date().toISOString();
      if (completionPhotos && completionPhotos.length > 0) {
        patch.completion_photos = completionPhotos;
      }
    } else if (status === 'confirmada_chefe') {
      patch.confirmed_by_name = operatorName;
      patch.confirmed_at = new Date().toISOString();
      if (showToClient !== undefined) {
        patch.show_to_client = showToClient;
      }
    }

    try {
      let { error } = await supabase.from('site_tasks').update(patch).eq('id', taskId);
      if (error && (error.code === 'PGRST204' || error.message?.includes('show_to_client'))) {
        delete patch.show_to_client;
        const retry = await supabase.from('site_tasks').update(patch).eq('id', taskId);
        error = retry.error;
      }
      if (error) {
        console.warn('Erro ao atualizar status da tarefa no Supabase:', error);
      }
    } catch (e) {
      console.warn('Erro ao atualizar status da tarefa no Supabase:', e);
    }
  }

  // Atualiza também em todos os caches locais de site_tasks
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('castello_site_tasks_')) {
        const list: SiteTask[] = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = list.findIndex((t) => t.id === taskId);
        if (idx !== -1) {
          list[idx].status = status;
          if (status === 'concluida_funcionario') {
            list[idx].completed_by_name = operatorName;
            list[idx].completed_at = new Date().toISOString();
            if (completionPhotos) list[idx].completion_photos = completionPhotos;
          } else if (status === 'confirmada_chefe') {
            list[idx].confirmed_by_name = operatorName;
            list[idx].confirmed_at = new Date().toISOString();
            if (showToClient !== undefined) list[idx].show_to_client = showToClient;
          }
          localStorage.setItem(key, JSON.stringify(list));
        }
      }
    }
  } catch (e) {
    console.warn('Erro ao atualizar cache local da tarefa:', e);
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
  let entries: TimeEntry[] = [];

  // 1. Tenta carregar do Supabase
  if (supabase) {
    try {
      let query = supabase.from('time_entries').select('*').order('recorded_at', { ascending: false });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        entries = data
          .filter((d: any) => !d.notes || !d.notes.startsWith('[JUSTIFICATIVA_FALTA]'))
          .map((d: any) => ({
            ...d,
            status: d.status || 'pendente',
          })) as TimeEntry[];
      }
    } catch (e) {
      console.warn('Erro ao carregar picagens:', e);
    }
  }

  // 2. Mescla com entradas manuais locais para garantir persistência offline
  try {
    const rawManual = localStorage.getItem('castello_time_entries_manual');
    if (rawManual) {
      const manualList: TimeEntry[] = JSON.parse(rawManual);
      const existingIds = new Set(entries.map((e) => e.id));
      const notInRemote = manualList.filter((m) => !existingIds.has(m.id));
      entries = [...notInRemote, ...entries];
    }
  } catch {}

  return entries;
}

export async function createManualTimeEntry(entry: {
  employee_id: string;
  company_id?: string | null;
  site_id?: string | null;
  entry_type: EntryType;
  work_date: string; // YYYY-MM-DD
  recorded_at: string; // ISO string
  notes?: string | null;
  status?: EntryStatus;
}): Promise<TimeEntry> {
  const newEntry: TimeEntry = {
    id: Date.now(),
    employee_id: entry.employee_id,
    company_id: entry.company_id || null,
    site_id: entry.site_id || null,
    entry_type: entry.entry_type,
    status: entry.status || 'aprovado',
    work_date: entry.work_date,
    recorded_at: entry.recorded_at,
    notes: entry.notes || null,
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          employee_id: entry.employee_id,
          company_id: entry.company_id || null,
          site_id: entry.site_id || null,
          entry_type: entry.entry_type,
          status: newEntry.status,
          work_date: entry.work_date,
          recorded_at: entry.recorded_at,
          notes: entry.notes || null,
        })
        .select('*')
        .single();
      if (!error && data) {
        return {
          ...data,
          status: data.status || newEntry.status,
        } as TimeEntry;
      }
    } catch (e) {
      console.warn('Erro ao inserir ponto manual no Supabase:', e);
    }
  }

  // Fallback LocalStorage
  const localKey = 'castello_time_entries_manual';
  try {
    const raw = localStorage.getItem(localKey);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(newEntry);
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch {}

  return newEntry;
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

  // Atualiza também no local se existir
  try {
    const raw = localStorage.getItem('castello_time_entries_manual');
    if (raw) {
      const list: TimeEntry[] = JSON.parse(raw);
      const updated = list.map((e) => (e.id === id ? { ...e, status } : e));
      localStorage.setItem('castello_time_entries_manual', JSON.stringify(updated));
    }
  } catch {}
}

// ============================================================================
// GESTÃO FINANCEIRA DE OBRAS (Sem dados mockados)
// ============================================================================
const getFinStorageKey = (companyId?: string) =>
  `castello_financial_${companyId || 'default'}`;

// Flag de cache inteligente: se a tabela não existir no Supabase (404/PGRST205),
// memoriza para não ficar repetindo requisições a cada 5 segundos no console
let hasFinancialTransactionsTable: boolean | null = null;

export async function getFinancialRecords(companyId?: string): Promise<FinancialRecord[]> {
  const localKey = getFinStorageKey(companyId);

  if (supabase && hasFinancialTransactionsTable !== false) {
    try {
      let query = supabase.from('financial_transactions').select('*').order('due_date', { ascending: false });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('financial_transactions') || (error as any).status === 404) {
          hasFinancialTransactionsTable = false;
        }
      } else if (data) {
        hasFinancialTransactionsTable = true;
        // Remove quaisquer dados mockados legados com id 'fin-0'
        const realData = (data as FinancialRecord[]).filter((r) => !r.id.startsWith('fin-0'));
        localStorage.setItem(localKey, JSON.stringify(realData));
        return realData;
      }
    } catch (e: any) {
      if (e?.message?.includes('financial_transactions') || e?.code === 'PGRST205') {
        hasFinancialTransactionsTable = false;
      }
    }
  }

  // Fallback LocalStorage
  const stored = localStorage.getItem(localKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as FinancialRecord[];
      // Remove quaisquer dados mockados legados ('fin-01' a 'fin-08')
      const realOnly = parsed.filter((r) => !r.id.startsWith('fin-0'));
      if (realOnly.length !== parsed.length) {
        localStorage.setItem(localKey, JSON.stringify(realOnly));
      }
      return realOnly;
    } catch {
      // ignore
    }
  }

  // Sem dados mockados: inicia limpo com lista vazia
  return [];
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
  if (supabase && hasFinancialTransactionsTable !== false) {
    try {
      if (record.id) {
        const { error } = await supabase
          .from('financial_transactions')
          .update(newRecord)
          .eq('id', record.id);
        if (error && (error.code === 'PGRST205' || error.message?.includes('financial_transactions'))) {
          hasFinancialTransactionsTable = false;
        }
      } else {
        const { error } = await supabase.from('financial_transactions').insert(newRecord);
        if (error && (error.code === 'PGRST205' || error.message?.includes('financial_transactions'))) {
          hasFinancialTransactionsTable = false;
        }
      }
    } catch (err) {
      hasFinancialTransactionsTable = false;
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

// ============================================================================
// TEMAS VISUAIS DA FIRMA (AZUL, VERMELHO, VERDE, AMARELO, LARANJA - CLARO / ESCURO)
// ============================================================================
const THEME_COLOR_KEY = 'castello_theme_color';
const THEME_MODE_KEY = 'castello_theme_mode';

export function getSavedTheme(): { color: ThemeColor; mode: ThemeMode } {
  const savedColor = (localStorage.getItem(THEME_COLOR_KEY) as ThemeColor) || 'azul';
  const savedMode = (localStorage.getItem(THEME_MODE_KEY) as ThemeMode) || 'dark';
  return { color: savedColor, mode: savedMode };
}

export function saveTheme(color: ThemeColor, mode: ThemeMode): void {
  localStorage.setItem(THEME_COLOR_KEY, color);
  localStorage.setItem(THEME_MODE_KEY, mode);
  applyTheme(color, mode);
}

export function applyTheme(color: ThemeColor, mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.setAttribute('data-theme-color', color);
}

// ============================================================================
// GESTÃO DE INVENTÁRIO (FERRAMENTAS, MÁQUINAS E MATERIAIS)
// ============================================================================
const getInvStorageKey = (companyId?: string) =>
  `castello_inventory_${companyId || 'default'}`;

export async function getInventoryItems(companyId?: string): Promise<InventoryItem[]> {
  const localKey = getInvStorageKey(companyId);
  if (supabase) {
    try {
      let query = supabase.from('inventory_items').select('*').order('name', { ascending: true });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        localStorage.setItem(localKey, JSON.stringify(data));
        return data as InventoryItem[];
      }
    } catch (e) {
      console.warn('Erro ao carregar inventário do Supabase:', e);
    }
  }

  const stored = localStorage.getItem(localKey);
  if (stored) {
    try {
      return JSON.parse(stored) as InventoryItem[];
    } catch {}
  }
  return [];
}

export async function saveInventoryItem(
  item: Partial<InventoryItem>,
  companyId?: string
): Promise<InventoryItem> {
  const localKey = getInvStorageKey(companyId);
  const now = new Date().toISOString();
  const id = item.id || `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const total = Number(item.total_quantity || 1);
  const allocated = Number(item.allocated_quantity || 0);
  const available = Math.max(0, total - allocated);

  const newItem: InventoryItem = {
    id,
    company_id: item.company_id || companyId || null,
    name: (item.name || 'Item sem nome').trim(),
    category: item.category || 'ferramentas',
    serial_number: item.serial_number?.trim() || null,
    total_quantity: total,
    allocated_quantity: allocated,
    available_quantity: available,
    allocated_site_id: item.allocated_site_id || null,
    allocated_site_name: item.allocated_site_name || null,
    condition: item.condition || 'bom',
    unit_price: typeof item.unit_price === 'number' ? item.unit_price : null,
    supplier: item.supplier?.trim() || null,
    location: item.location?.trim() || null,
    notes: item.notes?.trim() || null,
    created_at: item.created_at || now.slice(0, 10),
    updated_at: now.slice(0, 10),
  };

  if (supabase) {
    try {
      if (item.id) {
        await supabase.from('inventory_items').update(newItem).eq('id', item.id);
      } else {
        await supabase.from('inventory_items').insert(newItem);
      }
    } catch (err) {
      console.warn('Aviso: gravando inventário localmente:', err);
    }
  }

  const current = await getInventoryItems(companyId);
  const exists = current.some((i) => i.id === newItem.id);
  const updated = exists
    ? current.map((i) => (i.id === newItem.id ? newItem : i))
    : [newItem, ...current];

  localStorage.setItem(localKey, JSON.stringify(updated));
  return newItem;
}

export async function deleteInventoryItem(
  itemId: string,
  companyId?: string
): Promise<void> {
  const localKey = getInvStorageKey(companyId);
  if (supabase) {
    try {
      await supabase.from('inventory_items').delete().eq('id', itemId);
    } catch (err) {
      console.warn('Erro ao remover item no Supabase:', err);
    }
  }

  const current = await getInventoryItems(companyId);
  const filtered = current.filter((i) => i.id !== itemId);
  localStorage.setItem(localKey, JSON.stringify(filtered));
}

// ============================================================================
// GESTÃO DE CARRINHAS / FROTA DE OBRAS
// ============================================================================
const getVehiclesStorageKey = (companyId?: string) =>
  `castello_vehicles_${companyId || 'default'}`;

export async function getVehicles(companyId?: string): Promise<Vehicle[]> {
  const localKey = getVehiclesStorageKey(companyId);
  if (supabase) {
    try {
      let query = supabase.from('vehicles').select('*').order('brand', { ascending: true });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        // Se houver viaturas no localStorage que ainda não estão no Supabase, sincroniza para o Supabase
        const stored = localStorage.getItem(localKey);
        if (stored) {
          try {
            const localList = JSON.parse(stored) as Vehicle[];
            for (const lv of localList) {
              if (!data.some((sv: any) => sv.id === lv.id || (sv.license_plate && sv.license_plate === lv.license_plate))) {
                await supabase.from('vehicles').upsert(lv, { onConflict: 'id' });
                data.push(lv);
              }
            }
          } catch {}
        }
        localStorage.setItem(localKey, JSON.stringify(data));
        return data as Vehicle[];
      }
    } catch (e) {
      console.warn('Erro ao carregar carrinhas do Supabase:', e);
    }
  }

  const stored = localStorage.getItem(localKey);
  if (stored) {
    try {
      return JSON.parse(stored) as Vehicle[];
    } catch {}
  }
  return [];
}

export async function saveVehicle(
  vehicle: Partial<Vehicle>,
  companyId?: string
): Promise<Vehicle> {
  const localKey = getVehiclesStorageKey(companyId);
  const now = new Date().toISOString();
  const id = vehicle.id || `veh-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const newVehicle: Vehicle = {
    id,
    company_id: vehicle.company_id || companyId || null,
    license_plate: (vehicle.license_plate || '').trim().toUpperCase(),
    brand: (vehicle.brand || '').trim(),
    model: (vehicle.model || '').trim(),
    year: vehicle.year ? Number(vehicle.year) : null,
    vehicle_type: vehicle.vehicle_type || 'furgao',
    current_km: Number(vehicle.current_km || 0),
    assigned_driver_id: vehicle.assigned_driver_id || null,
    assigned_driver_name: vehicle.assigned_driver_name || null,
    assigned_site_id: vehicle.assigned_site_id || null,
    assigned_site_name: vehicle.assigned_site_name || null,
    next_inspection_date: vehicle.next_inspection_date || null,
    next_maintenance_km: vehicle.next_maintenance_km ? Number(vehicle.next_maintenance_km) : null,
    insurance_expiry_date: vehicle.insurance_expiry_date || null,
    status: vehicle.status || 'em_servico',
    fuel_type: vehicle.fuel_type || 'Gasóleo (Diesel)',
    photo_url: vehicle.photo_url || null,
    notes: vehicle.notes?.trim() || null,
    last_oil_change_date: vehicle.last_oil_change_date || null,
    last_oil_change_km: vehicle.last_oil_change_km ? Number(vehicle.last_oil_change_km) : null,
    next_oil_change_km: vehicle.next_oil_change_km ? Number(vehicle.next_oil_change_km) : null,
    last_tire_change_date: vehicle.last_tire_change_date || null,
    last_tire_change_km: vehicle.last_tire_change_km ? Number(vehicle.last_tire_change_km) : null,
    next_tire_change_km: vehicle.next_tire_change_km ? Number(vehicle.next_tire_change_km) : null,
    last_brakes_check_date: vehicle.last_brakes_check_date || null,
    next_brakes_check_km: vehicle.next_brakes_check_km ? Number(vehicle.next_brakes_check_km) : null,
    created_at: vehicle.created_at || now.slice(0, 10),
    updated_at: now.slice(0, 10),
  };

  if (supabase) {
    try {
      await supabase.from('vehicles').upsert(newVehicle, { onConflict: 'id' });
    } catch (err) {
      console.warn('Aviso: gravando carrinha localmente:', err);
    }
  }

  const current = await getVehicles(companyId);
  const exists = current.some((v) => v.id === newVehicle.id);
  const updated = exists
    ? current.map((v) => (v.id === newVehicle.id ? newVehicle : v))
    : [newVehicle, ...current];

  localStorage.setItem(localKey, JSON.stringify(updated));
  return newVehicle;
}

export async function deleteVehicle(
  vehicleId: string,
  companyId?: string
): Promise<void> {
  const localKey = getVehiclesStorageKey(companyId);
  if (supabase) {
    try {
      await supabase.from('vehicles').delete().eq('id', vehicleId);
    } catch (err) {
      console.warn('Erro ao remover carrinha no Supabase:', err);
    }
  }

  const current = await getVehicles(companyId);
  const filtered = current.filter((v) => v.id !== vehicleId);
  localStorage.setItem(localKey, JSON.stringify(filtered));
}

// ----------------------------------------------------------------------------
// REPORTS DA CARRINHA (Anomalias, Avarias, Abastecimento, Limpeza, KM)
// ----------------------------------------------------------------------------
const getReportsStorageKey = (vehicleId: string) => `castello_veh_reports_${vehicleId}`;

export async function getVehicleReports(vehicleId: string): Promise<VehicleReport[]> {
  const localKey = getReportsStorageKey(vehicleId);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('vehicle_reports')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        localStorage.setItem(localKey, JSON.stringify(data));
        return data as VehicleReport[];
      }
    } catch (e) {
      console.warn('Erro ao carregar reports do Supabase:', e);
    }
  }

  const stored = localStorage.getItem(localKey);
  return stored ? JSON.parse(stored) : [];
}

export async function createVehicleReport(
  report: Omit<VehicleReport, 'id' | 'created_at'>
): Promise<VehicleReport> {
  const localKey = getReportsStorageKey(report.vehicle_id);
  const newReport: VehicleReport = {
    ...report,
    id: `rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      await supabase.from('vehicle_reports').insert(newReport);
    } catch (e) {
      console.warn('Erro ao salvar report no Supabase, gravando localmente:', e);
    }
  }

  // Se o report contém KM atualizado, sincroniza a quilometragem da carrinha
  if (report.current_km && report.current_km > 0) {
    try {
      const vehicles = await getVehicles();
      const veh = vehicles.find((v) => v.id === report.vehicle_id);
      if (veh && report.current_km > (veh.current_km || 0)) {
        await saveVehicle({ ...veh, current_km: report.current_km });
      }
    } catch {}
  }

  const current = await getVehicleReports(report.vehicle_id);
  const updated = [newReport, ...current];
  localStorage.setItem(localKey, JSON.stringify(updated));
  return newReport;
}

// ----------------------------------------------------------------------------
// HISTÓRICO SEMANAL / "COM QUEM ELA ESTAVA EM CADA DIA"
// ----------------------------------------------------------------------------
const getAssignmentsStorageKey = (vehicleId: string) => `castello_veh_assign_${vehicleId}`;

export async function getVehicleWeeklyAssignments(
  vehicleId: string
): Promise<VehicleWeeklyAssignment[]> {
  const localKey = getAssignmentsStorageKey(vehicleId);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('vehicle_weekly_assignments')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('date', { ascending: false });
      if (!error && data) {
        localStorage.setItem(localKey, JSON.stringify(data));
        return data as VehicleWeeklyAssignment[];
      }
    } catch (e) {
      console.warn('Erro ao carregar atribuições do Supabase:', e);
    }
  }

  const stored = localStorage.getItem(localKey);
  return stored ? JSON.parse(stored) : [];
}

export async function saveVehicleWeeklyAssignment(
  assignment: Omit<VehicleWeeklyAssignment, 'id'> & { id?: string }
): Promise<VehicleWeeklyAssignment> {
  const localKey = getAssignmentsStorageKey(assignment.vehicle_id);
  const record: VehicleWeeklyAssignment = {
    ...assignment,
    id: assignment.id || `assign-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  };

  if (supabase) {
    try {
      if (assignment.id) {
        await supabase.from('vehicle_weekly_assignments').update(record).eq('id', record.id);
      } else {
        await supabase.from('vehicle_weekly_assignments').insert(record);
      }
    } catch (e) {
      console.warn('Erro ao gravar atribuição no Supabase:', e);
    }
  }

  const current = await getVehicleWeeklyAssignments(assignment.vehicle_id);
  const exists = current.some((a) => a.id === record.id);
  const updated = exists ? current.map((a) => (a.id === record.id ? record : a)) : [record, ...current];
  localStorage.setItem(localKey, JSON.stringify(updated));
  return record;
}

export async function deleteVehicleWeeklyAssignment(vehicleId: string, assignmentId: string): Promise<void> {
  const localKey = getAssignmentsStorageKey(vehicleId);
  if (supabase) {
    try {
      await supabase.from('vehicle_weekly_assignments').delete().eq('id', assignmentId);
    } catch (e) {
      console.warn('Erro ao deletar atribuição no Supabase:', e);
    }
  }
  const current = await getVehicleWeeklyAssignments(vehicleId);
  const updated = current.filter((a) => a.id !== assignmentId);
  localStorage.setItem(localKey, JSON.stringify(updated));
}

// ----------------------------------------------------------------------------
// INVENTÁRIO DINÂMICO DA CARRINHA (Itens que estão na carrinha)
// ----------------------------------------------------------------------------
const getVehInvStorageKey = (vehicleId: string) => `castello_veh_inventory_${vehicleId}`;
const MOVEMENTS_STORAGE_KEY = 'castello_inventory_movements';

export async function getVehicleInventory(vehicleId: string): Promise<VehicleInventoryItem[]> {
  const localKey = getVehInvStorageKey(vehicleId);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('vehicle_inventory_items')
        .select('*')
        .eq('vehicle_id', vehicleId);
      if (!error && data) {
        localStorage.setItem(localKey, JSON.stringify(data));
        return data as VehicleInventoryItem[];
      }
    } catch (e) {
      console.warn('Erro ao carregar inventário da carrinha do Supabase:', e);
    }
  }

  const stored = localStorage.getItem(localKey);
  return stored ? JSON.parse(stored) : [];
}

export async function getInventoryMovements(vehicleId?: string): Promise<InventoryMovement[]> {
  const localKey = MOVEMENTS_STORAGE_KEY;
  if (supabase) {
    try {
      let query = supabase.from('inventory_movements').select('*').order('timestamp', { ascending: false });
      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data as InventoryMovement[];
      }
    } catch (e) {
      console.warn('Erro ao carregar movimentações do Supabase:', e);
    }
  }

  const stored = localStorage.getItem(localKey);
  const all: InventoryMovement[] = stored ? JSON.parse(stored) : [];
  return vehicleId ? all.filter((m) => m.vehicle_id === vehicleId) : all;
}

export async function loadItemToVehicle(
  vehicleId: string,
  vehiclePlate: string,
  itemId: string,
  quantity: number,
  employeeName: string,
  employeeId: string,
  companyId?: string
): Promise<void> {
  const invItems = await getInventoryItems(companyId);
  const item = invItems.find((i) => i.id === itemId);
  if (!item) throw new Error('Item não encontrado no estoque.');
  if (item.available_quantity < quantity) {
    throw new Error(`Quantidade solicitada (${quantity}) excede o estoque disponível (${item.available_quantity}).`);
  }

  // 1. Atualiza estoque central: diminui disponível, aumenta alocado
  const updatedItem: InventoryItem = {
    ...item,
    available_quantity: item.available_quantity - quantity,
    allocated_quantity: item.allocated_quantity + quantity,
    allocated_site_name: `Carrinha ${vehiclePlate}`,
    updated_at: new Date().toISOString().slice(0, 10),
  };
  await saveInventoryItem(updatedItem, companyId);

  // 2. Atualiza inventário da carrinha
  const vehInventory = await getVehicleInventory(vehicleId);
  const existingIdx = vehInventory.findIndex((vi) => vi.item_id === itemId);
  const now = new Date().toISOString();
  let updatedVehInv: VehicleInventoryItem[];

  if (existingIdx !== -1) {
    const existing = vehInventory[existingIdx];
    const newRecord: VehicleInventoryItem = {
      ...existing,
      quantity: existing.quantity + quantity,
      updated_at: now,
    };
    updatedVehInv = vehInventory.map((vi, idx) => (idx === existingIdx ? newRecord : vi));
    if (supabase) {
      try {
        await supabase.from('vehicle_inventory_items').update(newRecord).eq('id', existing.id);
      } catch {}
    }
  } else {
    const newRecord: VehicleInventoryItem = {
      id: `vi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      vehicle_id: vehicleId,
      item_id: item.id,
      item_name: item.name,
      category: item.category,
      quantity: quantity,
      condition: item.condition,
      serial_number: item.serial_number || null,
      updated_at: now,
    };
    updatedVehInv = [newRecord, ...vehInventory];
    if (supabase) {
      try {
        await supabase.from('vehicle_inventory_items').insert(newRecord);
      } catch {}
    }
  }
  localStorage.setItem(getVehInvStorageKey(vehicleId), JSON.stringify(updatedVehInv));

  // 3. Regista a movimentação dinâmica
  const movement: InventoryMovement = {
    id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    company_id: companyId || null,
    vehicle_id: vehicleId,
    vehicle_plate: vehiclePlate,
    item_id: item.id,
    item_name: item.name,
    employee_id: employeeId,
    employee_name: employeeName,
    movement_type: 'carregar',
    quantity: quantity,
    timestamp: now,
  };

  if (supabase) {
    try {
      await supabase.from('inventory_movements').insert(movement);
    } catch {}
  }
  const allMovements = await getInventoryMovements();
  localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify([movement, ...allMovements]));
}

export async function returnItemFromVehicle(
  vehicleId: string,
  vehiclePlate: string,
  itemId: string,
  quantity: number,
  employeeName: string,
  employeeId: string,
  companyId?: string
): Promise<void> {
  const vehInventory = await getVehicleInventory(vehicleId);
  const existing = vehInventory.find((vi) => vi.item_id === itemId);
  if (!existing || existing.quantity < quantity) {
    throw new Error('Quantidade informada para devolução maior do que a presente na carrinha.');
  }

  // 1. Atualiza estoque central: devolve ao disponível
  const invItems = await getInventoryItems(companyId);
  const item = invItems.find((i) => i.id === itemId);
  if (item) {
    const updatedItem: InventoryItem = {
      ...item,
      available_quantity: item.available_quantity + quantity,
      allocated_quantity: Math.max(0, item.allocated_quantity - quantity),
      updated_at: new Date().toISOString().slice(0, 10),
    };
    await saveInventoryItem(updatedItem, companyId);
  }

  // 2. Atualiza inventário da carrinha
  const now = new Date().toISOString();
  let updatedVehInv: VehicleInventoryItem[];
  if (existing.quantity === quantity) {
    updatedVehInv = vehInventory.filter((vi) => vi.item_id !== itemId);
    if (supabase) {
      try {
        await supabase.from('vehicle_inventory_items').delete().eq('id', existing.id);
      } catch {}
    }
  } else {
    const newRecord: VehicleInventoryItem = {
      ...existing,
      quantity: existing.quantity - quantity,
      updated_at: now,
    };
    updatedVehInv = vehInventory.map((vi) => (vi.id === existing.id ? newRecord : vi));
    if (supabase) {
      try {
        await supabase.from('vehicle_inventory_items').update(newRecord).eq('id', existing.id);
      } catch {}
    }
  }
  localStorage.setItem(getVehInvStorageKey(vehicleId), JSON.stringify(updatedVehInv));

  // 3. Regista movimentação
  const movement: InventoryMovement = {
    id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    company_id: companyId || null,
    vehicle_id: vehicleId,
    vehicle_plate: vehiclePlate,
    item_id: itemId,
    item_name: existing.item_name,
    employee_id: employeeId,
    employee_name: employeeName,
    movement_type: 'devolver',
    quantity: quantity,
    timestamp: now,
  };

  if (supabase) {
    try {
      await supabase.from('inventory_movements').insert(movement);
    } catch {}
  }
  const allMovements = await getInventoryMovements();
  localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify([movement, ...allMovements]));
}

// ----------------------------------------------------------------------------
// REGISTOS DE MANUTENÇÃO (Troca de Óleo, Pneus, Revisão, IPO)
// ----------------------------------------------------------------------------
const getMaintStorageKey = (vehicleId: string) => `castello_veh_maint_${vehicleId}`;

export async function getVehicleMaintenanceRecords(
  vehicleId: string
): Promise<VehicleMaintenanceRecord[]> {
  const localKey = getMaintStorageKey(vehicleId);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('vehicle_maintenance_records')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('performed_at', { ascending: false });
      if (!error && data) {
        localStorage.setItem(localKey, JSON.stringify(data));
        return data as VehicleMaintenanceRecord[];
      }
    } catch (e) {
      console.warn('Erro ao carregar manutenções do Supabase:', e);
    }
  }

  const stored = localStorage.getItem(localKey);
  return stored ? JSON.parse(stored) : [];
}

export async function addVehicleMaintenanceRecord(
  record: Omit<VehicleMaintenanceRecord, 'id' | 'created_at'>
): Promise<VehicleMaintenanceRecord> {
  const localKey = getMaintStorageKey(record.vehicle_id);
  const now = new Date().toISOString();
  const newRecord: VehicleMaintenanceRecord = {
    ...record,
    id: `maint-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: now,
  };

  if (supabase) {
    try {
      await supabase.from('vehicle_maintenance_records').insert(newRecord);
    } catch (e) {
      console.warn('Erro ao registrar manutenção no Supabase:', e);
    }
  }

  // Atualiza também os campos rápidos de manutenção no próprio veículo
  try {
    const vehicles = await getVehicles();
    const veh = vehicles.find((v) => v.id === record.vehicle_id);
    if (veh) {
      const patch: Partial<Vehicle> = { ...veh };
      if (record.item_type === 'oleo') {
        patch.last_oil_change_date = record.performed_at;
        patch.last_oil_change_km = record.performed_km;
        if (record.next_due_km) patch.next_oil_change_km = record.next_due_km;
      } else if (record.item_type === 'pneus') {
        patch.last_tire_change_date = record.performed_at;
        patch.last_tire_change_km = record.performed_km;
        if (record.next_due_km) patch.next_tire_change_km = record.next_due_km;
      } else if (record.item_type === 'travoes') {
        patch.last_brakes_check_date = record.performed_at;
        if (record.next_due_km) patch.next_brakes_check_km = record.next_due_km;
      }
      await saveVehicle(patch);
    }
  } catch {}

  const current = await getVehicleMaintenanceRecords(record.vehicle_id);
  const updated = [newRecord, ...current];
  localStorage.setItem(localKey, JSON.stringify(updated));
  return newRecord;
}

// ============================================================================
// AGENDA E CALENDÁRIO DE COMPROMISSOS
// ============================================================================
const getCalendarStorageKey = (companyId?: string) =>
  `castello_calendar_${companyId || 'default'}`;

export async function getCalendarEvents(companyId?: string): Promise<CalendarEvent[]> {
  const localKey = getCalendarStorageKey(companyId);
  if (supabase) {
    try {
      let query = supabase.from('calendar_events').select('*').order('event_date', { ascending: true });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        localStorage.setItem(localKey, JSON.stringify(data));
        return data as CalendarEvent[];
      }
    } catch (e) {
      console.warn('Erro ao carregar calendário do Supabase:', e);
    }
  }

  const stored = localStorage.getItem(localKey);
  if (stored) {
    try {
      return JSON.parse(stored) as CalendarEvent[];
    } catch {}
  }
  return [];
}

export async function saveCalendarEvent(
  event: Partial<CalendarEvent>,
  companyId?: string
): Promise<CalendarEvent> {
  const localKey = getCalendarStorageKey(companyId);
  const now = new Date().toISOString();
  const id = event.id || `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const newEvent: CalendarEvent = {
    id,
    company_id: event.company_id || companyId || null,
    title: (event.title || 'Compromisso sem título').trim(),
    description: event.description?.trim() || null,
    event_date: event.event_date || now.slice(0, 10),
    start_time: event.start_time || null,
    end_time: event.end_time || null,
    category: event.category || 'obra',
    site_id: event.site_id || null,
    site_name: event.site_name || null,
    assigned_employee_id: event.assigned_employee_id || null,
    assigned_employee_name: event.assigned_employee_name || null,
    location: event.location?.trim() || null,
    is_completed: Boolean(event.is_completed),
    created_at: event.created_at || now.slice(0, 10),
  };

  if (supabase) {
    try {
      if (event.id) {
        await supabase.from('calendar_events').update(newEvent).eq('id', event.id);
      } else {
        await supabase.from('calendar_events').insert(newEvent);
      }
    } catch (err) {
      console.warn('Aviso: gravando evento localmente:', err);
    }
  }

  const current = await getCalendarEvents(companyId);
  const exists = current.some((e) => e.id === newEvent.id);
  const updated = exists
    ? current.map((e) => (e.id === newEvent.id ? newEvent : e))
    : [newEvent, ...current];

  localStorage.setItem(localKey, JSON.stringify(updated));
  return newEvent;
}

export async function deleteCalendarEvent(
  eventId: string,
  companyId?: string
): Promise<void> {
  const localKey = getCalendarStorageKey(companyId);
  if (supabase) {
    try {
      await supabase.from('calendar_events').delete().eq('id', eventId);
    } catch (err) {
      console.warn('Erro ao remover evento no Supabase:', err);
    }
  }

  const current = await getCalendarEvents(companyId);
  const filtered = current.filter((e) => e.id !== eventId);
  localStorage.setItem(localKey, JSON.stringify(filtered));
}

export async function toggleCalendarEventCompleted(
  eventId: string,
  companyId?: string
): Promise<void> {
  const current = await getCalendarEvents(companyId);
  const target = current.find((e) => e.id === eventId);
  if (!target) return;
  await saveCalendarEvent({ ...target, is_completed: !target.is_completed }, companyId);
}

// ============================================================================
// JUSTIFICATIVAS DE FALTAS (WEB ADMIN & GESTÃO)
// ============================================================================
const ABSENCE_JUSTIFICATIONS_STORAGE_KEY = 'castelo_absence_justifications_v1';
let hasWebAbsenceTable: boolean | null = null;

function parseJustificationFromTimeEntry(entry: any): AbsenceJustification | null {
  if (!entry.notes || !entry.notes.startsWith('[JUSTIFICATIVA_FALTA]')) return null;
  try {
    const raw = entry.notes.slice('[JUSTIFICATIVA_FALTA]'.length);
    const meta = JSON.parse(raw);
    return {
      id: meta.justif_id || String(entry.id),
      employee_id: entry.employee_id,
      employee_name: meta.employee_name || 'Colaborador',
      company_id: entry.company_id,
      date: entry.work_date,
      reason: meta.reason || '',
      photos: Array.isArray(meta.photos) ? meta.photos : [],
      status:
        entry.status === 'aprovado'
          ? 'aprovada'
          : entry.status === 'rejeitado'
          ? 'rejeitada'
          : 'pendente',
      created_at: entry.created_at || entry.recorded_at,
    };
  } catch {
    return null;
  }
}

export async function getAbsenceJustifications(
  employeeId?: string,
  companyId?: string
): Promise<AbsenceJustification[]> {
  let list: AbsenceJustification[] = [];

  try {
    const raw = localStorage.getItem(ABSENCE_JUSTIFICATIONS_STORAGE_KEY);
    if (raw) {
      list = JSON.parse(raw);
    }
  } catch {}

  if (supabase) {
    let remoteJustifs: AbsenceJustification[] = [];

    if (hasWebAbsenceTable !== false) {
      try {
        let query = supabase.from('absence_justifications').select('*').order('date', { ascending: false });
        if (employeeId) {
          query = query.eq('employee_id', employeeId);
        }
        if (companyId) {
          query = query.or(`company_id.eq.${companyId},company_id.is.null`);
        }
        const { data, error } = await query;
        if (!error && data) {
          hasWebAbsenceTable = true;
          remoteJustifs = data as AbsenceJustification[];
        } else if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) {
          hasWebAbsenceTable = false;
        }
      } catch {
        hasWebAbsenceTable = false;
      }
    }

    // Se a tabela absence_justifications não existir, consulta em time_entries
    if (hasWebAbsenceTable === false) {
      try {
        let teQuery = supabase
          .from('time_entries')
          .select('*')
          .like('notes', '[JUSTIFICATIVA_FALTA]%')
          .order('work_date', { ascending: false });
        if (employeeId) {
          teQuery = teQuery.eq('employee_id', employeeId);
        }
        if (companyId) {
          teQuery = teQuery.or(`company_id.eq.${companyId},company_id.is.null`);
        }
        const { data: teData } = await teQuery;
        if (teData) {
          remoteJustifs = teData
            .map(parseJustificationFromTimeEntry)
            .filter(Boolean) as AbsenceJustification[];
        }
      } catch (errFallback) {
        console.warn('Erro ao consultar justificativas em time_entries:', errFallback);
      }
    }

    if (remoteJustifs.length > 0) {
      const remoteIds = new Set(remoteJustifs.map((d) => d.id));
      const localsNotRemote = list.filter((l) => !remoteIds.has(l.id));
      const merged = [...remoteJustifs, ...localsNotRemote];
      localStorage.setItem(ABSENCE_JUSTIFICATIONS_STORAGE_KEY, JSON.stringify(merged));
      list = merged;
    }
  }

  if (employeeId) {
    list = list.filter((j) => j.employee_id === employeeId);
  }
  return list;
}

export async function updateAbsenceJustificationStatus(
  id: string,
  status: 'aprovada' | 'rejeitada' | 'pendente'
): Promise<void> {
  if (supabase) {
    // 1. Tenta atualizar na tabela absence_justifications
    if (hasWebAbsenceTable !== false) {
      try {
        const { error } = await supabase
          .from('absence_justifications')
          .update({ status })
          .eq('id', id);
        if (!error) {
          hasWebAbsenceTable = true;
        }
      } catch {}
    }

    // 2. Atualiza também em time_entries se foi gravado lá
    try {
      const dbStatus = status === 'aprovada' ? 'aprovado' : status === 'rejeitada' ? 'rejeitado' : 'pendente';
      const numId = Number(id);
      if (!isNaN(numId)) {
        await supabase
          .from('time_entries')
          .update({ status: dbStatus, validated_at: new Date().toISOString() })
          .eq('id', numId);
      } else {
        await supabase
          .from('time_entries')
          .update({ status: dbStatus, validated_at: new Date().toISOString() })
          .like('notes', `%${id}%`);
      }
    } catch {}
  }

  try {
    const raw = localStorage.getItem(ABSENCE_JUSTIFICATIONS_STORAGE_KEY);
    if (raw) {
      const list: AbsenceJustification[] = JSON.parse(raw);
      const updated = list.map((j) => (j.id === id ? { ...j, status } : j));
      localStorage.setItem(ABSENCE_JUSTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
}
