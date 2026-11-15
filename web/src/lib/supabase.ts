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
  FinancialPaymentInstallment,
  FinancialRecord,
  FinancialStatus,
  FinancialType,
  InventoryItem,
  SiteDailyLog,
  SiteFinancialConfig,
  SiteMeasurement,
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
  SiteWorkSession,
  SiteDocument,
  Team,
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

const LOCAL_SITE_DATES_KEY = 'castello_site_dates_cache';

function getLocalSiteDates(): Record<string, { start_date?: string | null; expected_end_date?: string | null }> {
  try {
    const raw = localStorage.getItem(LOCAL_SITE_DATES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalSiteDates(siteId: string, startDate?: string | null, expectedEndDate?: string | null) {
  try {
    const map = getLocalSiteDates();
    map[siteId] = {
      start_date: startDate ?? map[siteId]?.start_date ?? null,
      expected_end_date: expectedEndDate ?? map[siteId]?.expected_end_date ?? null,
    };
    localStorage.setItem(LOCAL_SITE_DATES_KEY, JSON.stringify(map));
  } catch {}
}

export async function getSites(companyId?: string): Promise<ConstructionSite[]> {
  if (supabase) {
    try {
      let query = supabase.from('construction_sites').select('*').order('created_at', { ascending: false });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        const localDates = getLocalSiteDates();
        return (data as ConstructionSite[]).map((s) => ({
          ...s,
          start_date: s.start_date || localDates[s.id]?.start_date || null,
          expected_end_date: s.expected_end_date || localDates[s.id]?.expected_end_date || null,
        }));
      }
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
      if (!error && data) {
        const localDates = getLocalSiteDates();
        const s = data as ConstructionSite;
        return {
          ...s,
          start_date: s.start_date || localDates[s.id]?.start_date || null,
          expected_end_date: s.expected_end_date || localDates[s.id]?.expected_end_date || null,
        };
      }
    } catch (e) {
      console.warn('Erro ao buscar obra por código:', e);
    }
  }
  return null;
}

export async function getCompanyById(companyId?: string | null): Promise<Company | null> {
  if (!companyId) {
    return getActiveCompanySession();
  }
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();
      if (!error && data) return data as Company;
    } catch (e) {
      console.warn('Erro ao buscar dados da firma:', e);
    }
  }
  const session = getActiveCompanySession();
  if (session && session.id === companyId) return session;
  return null;
}

// ----------------------------------------------------------------------------
// SESSÕES DE TRABALHO DAS EQUIPAS NA OBRA (Para controle de horas do cliente)
// ----------------------------------------------------------------------------
const getWorkSessionsStorageKey = (siteId: string) => `castello_site_work_sessions_${siteId}`;

export async function getSiteWorkSessions(siteId: string): Promise<SiteWorkSession[]> {
  const localKey = getWorkSessionsStorageKey(siteId);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_work_sessions')
        .select('*')
        .eq('site_id', siteId)
        .order('work_date', { ascending: false });
      if (!error && data) {
        localStorage.setItem(localKey, JSON.stringify(data));
        return data as SiteWorkSession[];
      }
    } catch (e) {
      console.warn('Erro ao carregar sessões de trabalho da obra:', e);
    }
  }
  const stored = localStorage.getItem(localKey);
  if (stored) {
    try {
      return JSON.parse(stored) as SiteWorkSession[];
    } catch {}
  }
  return [];
}

export async function saveSiteWorkSession(
  session: Partial<SiteWorkSession>
): Promise<SiteWorkSession> {
  const localKey = getWorkSessionsStorageKey(session.site_id!);
  const now = new Date().toISOString();
  const id = session.id || `sess-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const newSession: SiteWorkSession = {
    id,
    company_id: session.company_id || null,
    site_id: session.site_id!,
    team_name: session.team_name?.trim() || 'Equipa 1',
    leader_id: session.leader_id || null,
    leader_name: session.leader_name?.trim() || 'Líder da Equipa',
    workers_count: Number(session.workers_count || 1),
    work_date: session.work_date || now.slice(0, 10),
    hours_worked: Number(session.hours_worked || 0),
    description: session.description?.trim() || null,
    created_at: session.created_at || now,
  };

  if (supabase) {
    try {
      await supabase.from('site_work_sessions').upsert(newSession, { onConflict: 'id' });
    } catch (e) {
      console.warn('Erro ao salvar sessão de trabalho:', e);
    }
  }

  const current = await getSiteWorkSessions(session.site_id!);
  const exists = current.some((s) => s.id === newSession.id);
  const updated = exists
    ? current.map((s) => (s.id === newSession.id ? newSession : s))
    : [newSession, ...current];
  localStorage.setItem(localKey, JSON.stringify(updated));
  return newSession;
}

export async function deleteSiteWorkSession(siteId: string, sessionId: string): Promise<void> {
  const localKey = getWorkSessionsStorageKey(siteId);
  if (supabase) {
    try {
      await supabase.from('site_work_sessions').delete().eq('id', sessionId);
    } catch {}
  }
  const current = await getSiteWorkSessions(siteId);
  const updated = current.filter((s) => s.id !== sessionId);
  localStorage.setItem(localKey, JSON.stringify(updated));
}

// ----------------------------------------------------------------------------
// DOCUMENTOS E CONTRATOS DA OBRA
// ----------------------------------------------------------------------------
const getSiteDocsStorageKey = (siteId: string) => `castello_site_docs_${siteId}`;

export async function getSiteDocuments(siteId: string): Promise<SiteDocument[]> {
  const localKey = getSiteDocsStorageKey(siteId);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_documents')
        .select('*')
        .eq('site_id', siteId)
        .order('uploaded_at', { ascending: false });
      if (!error && data && data.length > 0) {
        localStorage.setItem(localKey, JSON.stringify(data));
        return data as SiteDocument[];
      }
    } catch {}
  }
  const stored = localStorage.getItem(localKey);
  if (stored) {
    try {
      return JSON.parse(stored) as SiteDocument[];
    } catch {}
  }
  // Documentos padrão da obra para consulta transparente do cliente
  return [
    {
      id: `doc-1-${siteId}`,
      site_id: siteId,
      name: 'Contrato de Empreitada & Condições Gerais',
      doc_type: 'Contrato',
      file_size: '2.4 MB',
      uploaded_at: '2026-11-01',
      status: 'disponivel',
    },
    {
      id: `doc-2-${siteId}`,
      site_id: siteId,
      name: 'Orçamento Descritivo & Mapa de Quantidades',
      doc_type: 'Orçamento',
      file_size: '1.8 MB',
      uploaded_at: '2026-11-02',
      status: 'disponivel',
    },
    {
      id: `doc-3-${siteId}`,
      site_id: siteId,
      name: 'Licença Municipal de Obras e Autorização Prévia',
      doc_type: 'Licença',
      file_size: '850 KB',
      uploaded_at: '2026-11-05',
      status: 'disponivel',
    },
    {
      id: `doc-4-${siteId}`,
      site_id: siteId,
      name: 'Apólice de Seguro de Acidentes de Trabalho & Responsabilidade Civil',
      doc_type: 'Seguro',
      file_size: '620 KB',
      uploaded_at: '2026-11-05',
      status: 'disponivel',
    },
  ];
}

export async function saveSiteDocument(doc: Partial<SiteDocument>): Promise<SiteDocument> {
  const localKey = getSiteDocsStorageKey(doc.site_id!);
  const newDoc: SiteDocument = {
    id: doc.id || `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    site_id: doc.site_id!,
    name: doc.name?.trim() || 'Documento da Obra',
    doc_type: doc.doc_type || 'Geral',
    file_url: doc.file_url || null,
    file_size: doc.file_size || 'N/D',
    uploaded_at: doc.uploaded_at || new Date().toISOString().slice(0, 10),
    status: (doc.status as any) || 'disponivel',
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_documents')
        .upsert(newDoc)
        .select('*')
        .single();
      if (!error && data) {
        const current = await getSiteDocuments(doc.site_id!);
        const exists = current.some((d) => d.id === data.id);
        const updated = exists ? current.map((d) => (d.id === data.id ? (data as SiteDocument) : d)) : [data as SiteDocument, ...current];
        localStorage.setItem(localKey, JSON.stringify(updated));
        return data as SiteDocument;
      }
    } catch {}
  }

  const current = await getSiteDocuments(doc.site_id!);
  const exists = current.some((d) => d.id === newDoc.id);
  const updated = exists ? current.map((d) => (d.id === newDoc.id ? newDoc : d)) : [newDoc, ...current];
  localStorage.setItem(localKey, JSON.stringify(updated));
  return newDoc;
}

export async function deleteSiteDocument(siteId: string, docId: string): Promise<void> {
  const localKey = getSiteDocsStorageKey(siteId);
  if (supabase) {
    try {
      await supabase.from('site_documents').delete().eq('id', docId);
    } catch {}
  }
  const current = await getSiteDocuments(siteId);
  const filtered = current.filter((d) => d.id !== docId);
  localStorage.setItem(localKey, JSON.stringify(filtered));
}

export async function saveSite(
  site: Omit<ConstructionSite, 'id' | 'share_code'> & { id?: string; share_code?: string },
  companyId?: string,
  skipCalendarSync?: boolean
): Promise<ConstructionSite> {
  const payload: any = {
    ...site,
    share_code: site.share_code || generateShareCode(),
    company_id: site.company_id || companyId || null,
  };

  if (supabase) {
    let data: any = null;
    let error: any = null;

    if (site.id) {
      const res = await supabase
        .from('construction_sites')
        .update(payload)
        .eq('id', site.id)
        .select('*')
        .single();
      data = res.data;
      error = res.error;

      if (error && (error.code === 'PGRST204' || error.message?.includes('expected_end_date'))) {
        const cleanPayload = { ...payload };
        delete cleanPayload.expected_end_date;
        const retry = await supabase
          .from('construction_sites')
          .update(cleanPayload)
          .eq('id', site.id)
          .select('*')
          .single();
        data = retry.data;
        error = retry.error;
      }
    } else {
      const res = await supabase
        .from('construction_sites')
        .insert(payload)
        .select('*')
        .single();
      data = res.data;
      error = res.error;

      if (error && (error.code === 'PGRST204' || error.message?.includes('expected_end_date'))) {
        const cleanPayload = { ...payload };
        delete cleanPayload.expected_end_date;
        const retry = await supabase
          .from('construction_sites')
          .insert(cleanPayload)
          .select('*')
          .single();
        data = retry.data;
        error = retry.error;
      }
    }

    if (!error && data) {
      setLocalSiteDates(data.id, site.start_date, site.expected_end_date);
      const savedSite: ConstructionSite = {
        ...(data as ConstructionSite),
        start_date: site.start_date || data.start_date || null,
        expected_end_date: site.expected_end_date || data.expected_end_date || null,
      };
      if (!skipCalendarSync) {
        try {
          await syncSiteMilestonesWithCalendar(savedSite, savedSite.company_id || companyId);
        } catch (err) {
          console.warn('Erro ao sincronizar marcos da obra no calendário:', err);
        }
      }
      return savedSite;
    }
  }
  throw new Error('Falha ao gravar obra.');
}

export async function deleteSite(id: string): Promise<void> {
  if (supabase) {
    await supabase.from('construction_sites').delete().eq('id', id);
  }
  try {
    await deleteCalendarEvent(`sync-site-start-${id}`);
    await deleteCalendarEvent(`sync-site-end-${id}`);
  } catch {}
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
        const finalTask = { ...newTask, ...data } as SiteTask;
        const refreshed = updatedLocal.map((t) => (t.id === newTask.id ? finalTask : t));
        localStorage.setItem(localKey, JSON.stringify(refreshed));
        if (finalTask.due_date) {
          try {
            await syncTaskWithCalendar(finalTask, companyId);
          } catch {}
        }
        return finalTask;
      } else if (error) {
        console.warn('Supabase não pôde inserir a tarefa (mantida localmente):', error.message);
      }
    } catch (e) {
      console.warn('Erro na inserção da tarefa no Supabase (mantida localmente):', e);
    }
  }

  if (newTask.due_date) {
    try {
      await syncTaskWithCalendar(newTask, companyId);
    } catch {}
  }

  return newTask;
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  operatorName: string,
  completionPhotos?: string[],
  showToClient?: boolean,
  skipCalendarSync?: boolean
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
  let updatedTaskObj: SiteTask | null = null;
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
          updatedTaskObj = list[idx];
        }
      }
    }
  } catch (e) {
    console.warn('Erro ao atualizar cache local da tarefa:', e);
  }

  if (!skipCalendarSync) {
    try {
      if (updatedTaskObj && updatedTaskObj.due_date) {
        await syncTaskWithCalendar(updatedTaskObj, updatedTaskObj.company_id || undefined);
      } else {
        const activeComp = getActiveCompanySession();
        const evts = await getCalendarEvents(activeComp?.id);
        const existingEvt = evts.find((e) => e.id === `sync-task-${taskId}` || (e.source_module === 'tarefa' && e.source_id === taskId));
        if (existingEvt) {
          const isDone = status === 'concluida_funcionario' || status === 'confirmada_chefe';
          await saveCalendarEvent(
            {
              ...existingEvt,
              is_completed: isDone,
              status: isDone ? 'concluido' : 'em_andamento',
              progress: status === 'confirmada_chefe' ? 100 : isDone ? 85 : 25,
              visible_to_client: showToClient !== undefined ? showToClient : existingEvt.visible_to_client,
            },
            existingEvt.company_id || activeComp?.id,
            true
          );
        }
      }
    } catch {}
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  if (supabase) {
    await supabase.from('site_tasks').delete().eq('id', taskId);
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('castello_site_tasks_')) {
        const list: SiteTask[] = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = list.filter((t) => t.id !== taskId);
        if (filtered.length !== list.length) {
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      }
    }
    const activeComp = getActiveCompanySession();
    await deleteCalendarEvent(`sync-task-${taskId}`, activeComp?.id);
  } catch {}
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
// GESTÃO FINANCEIRA DE OBRAS E EMPRESA (Sem dados mockados, precisão em cêntimos)
// ============================================================================
const getFinStorageKey = (companyId?: string) =>
  `castello_financial_${companyId || 'default'}`;

const FIN_META_PREFIX = '<!--CASTELLO_FIN_META:';
const FIN_META_SUFFIX = '-->';

function roundMoney(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

function encodeFinancialDescription(title: string, meta: Partial<FinancialRecord>): string {
  const cleanTitle = (title || 'Lançamento financeiro').trim();
  const payload = {
    title: cleanTitle,
    description: meta.description || null,
    site_id: meta.site_id || null,
    site_name: meta.site_name || null,
    subcategory: meta.subcategory || null,
    entity_name: meta.entity_name || null,
    entity_type: meta.entity_type || null,
    entity_id: meta.entity_id || null,
    invoice_number: meta.invoice_number || null,
    payment_method: meta.payment_method || null,
    paid_amount: typeof meta.paid_amount === 'number' ? roundMoney(meta.paid_amount) : undefined,
    status: meta.status || 'pendente',
    receipt_url: meta.receipt_url || null,
    measurement_id: meta.measurement_id || null,
    source_module: meta.source_module || 'manual',
    source_id: meta.source_id || null,
    is_committed: Boolean(meta.is_committed),
    installments: Array.isArray(meta.installments) ? meta.installments : [],
  };
  return `${cleanTitle} ${FIN_META_PREFIX}${JSON.stringify(payload)}${FIN_META_SUFFIX}`;
}

function decodeFinancialDescription(rawDesc?: string | null): {
  cleanTitle: string;
  meta: Partial<FinancialRecord>;
} {
  if (!rawDesc) return { cleanTitle: 'Lançamento', meta: {} };
  const idx = rawDesc.indexOf(FIN_META_PREFIX);
  if (idx === -1) {
    return { cleanTitle: rawDesc.trim(), meta: {} };
  }
  const cleanTitle = rawDesc.slice(0, idx).trim();
  const endIdx = rawDesc.indexOf(FIN_META_SUFFIX, idx);
  if (endIdx === -1) {
    return { cleanTitle: cleanTitle || rawDesc.trim(), meta: {} };
  }
  try {
    const jsonStr = rawDesc.slice(idx + FIN_META_PREFIX.length, endIdx);
    const meta = JSON.parse(jsonStr);
    return {
      cleanTitle: meta.title || cleanTitle || 'Lançamento',
      meta,
    };
  } catch {
    return { cleanTitle: cleanTitle || 'Lançamento', meta: {} };
  }
}

function ensureValidUuid(id?: string): string {
  if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getFinancialRecords(companyId?: string): Promise<FinancialRecord[]> {
  const localKey = getFinStorageKey(companyId);
  const stored = localStorage.getItem(localKey);
  const localList: FinancialRecord[] = stored ? JSON.parse(stored) : [];

  if (supabase) {
    try {
      let query = supabase.from('financial_transactions').select('*').order('due_date', { ascending: false });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        const mappedFromDb: FinancialRecord[] = data.map((row: any) => {
          const matchingLocal = localList.find((l) => l.id === row.id);
          const { cleanTitle, meta } = decodeFinancialDescription(row.description);
          const isIncome = row.type === 'income' || row.type === 'receita';
          const rawAmount = typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount || 0)) || 0;
          const amount = roundMoney(rawAmount);

          const isPaidDb = row.paid === true || row.status === 'pago';
          let resolvedStatus: FinancialStatus =
            (meta.status as FinancialStatus) ||
            matchingLocal?.status ||
            (isPaidDb ? 'pago' : 'pendente');

          if (isPaidDb && resolvedStatus === 'pendente') {
            resolvedStatus = 'pago';
          }

          let paidAmount =
            typeof meta.paid_amount === 'number'
              ? roundMoney(meta.paid_amount)
              : typeof matchingLocal?.paid_amount === 'number'
              ? roundMoney(matchingLocal.paid_amount)
              : resolvedStatus === 'pago'
              ? amount
              : 0;

          if (resolvedStatus === 'pago') {
            paidAmount = amount;
          } else if (paidAmount > 0 && paidAmount < amount && resolvedStatus !== 'cancelado') {
            resolvedStatus = 'parcial';
          } else if (paidAmount >= amount && amount > 0) {
            resolvedStatus = 'pago';
            paidAmount = amount;
          }

          return {
            id: row.id,
            company_id: row.company_id || companyId || null,
            site_id: row.site_id || meta.site_id || matchingLocal?.site_id || null,
            site_name: row.site_name || meta.site_name || matchingLocal?.site_name || null,
            type: isIncome ? 'receita' : 'despesa',
            category: (row.category || meta.category || matchingLocal?.category || (isIncome ? 'receita_medicao' : 'custo_materiais')) as FinancialCategory,
            subcategory: meta.subcategory ?? matchingLocal?.subcategory ?? null,
            title: cleanTitle || matchingLocal?.title || 'Lançamento',
            description: meta.description ?? matchingLocal?.description ?? null,
            entity_name: row.entity_name || meta.entity_name || matchingLocal?.entity_name || null,
            entity_type: meta.entity_type ?? matchingLocal?.entity_type ?? null,
            entity_id: meta.entity_id ?? matchingLocal?.entity_id ?? null,
            invoice_number: row.invoice_number || meta.invoice_number || matchingLocal?.invoice_number || null,
            payment_method: meta.payment_method ?? matchingLocal?.payment_method ?? null,
            amount,
            paid_amount: paidAmount,
            due_date: row.due_date ? String(row.due_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
            payment_date: row.payment_date
              ? String(row.payment_date).slice(0, 10)
              : matchingLocal?.payment_date || null,
            status: resolvedStatus,
            receipt_url: meta.receipt_url ?? matchingLocal?.receipt_url ?? null,
            measurement_id: meta.measurement_id ?? matchingLocal?.measurement_id ?? null,
            source_module: meta.source_module ?? matchingLocal?.source_module ?? 'manual',
            source_id: meta.source_id ?? matchingLocal?.source_id ?? null,
            is_committed: meta.is_committed ?? matchingLocal?.is_committed ?? false,
            installments: Array.isArray(meta.installments)
              ? meta.installments
              : Array.isArray(matchingLocal?.installments)
              ? matchingLocal!.installments
              : [],
            created_at: row.created_at ? String(row.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
          };
        });

        const dbIds = new Set(mappedFromDb.map((m) => m.id));
        const unSynced = localList.filter((l) => !dbIds.has(l.id) && !l.id.startsWith('fin-0'));
        const combined = [...mappedFromDb, ...unSynced];

        localStorage.setItem(localKey, JSON.stringify(combined));
        return combined;
      }
    } catch (e: any) {
      console.warn('Erro ao carregar transações financeiras do Supabase:', e);
    }
  }

  return localList.filter((r) => !r.id.startsWith('fin-0'));
}

export async function saveFinancialRecord(
  record: Partial<FinancialRecord>,
  companyId?: string
): Promise<FinancialRecord> {
  const localKey = getFinStorageKey(companyId);
  const now = new Date().toISOString();
  const id = ensureValidUuid(record.id);

  const stored = localStorage.getItem(localKey);
  const current: FinancialRecord[] = stored ? JSON.parse(stored) : [];
  const existing = current.find((r) => r.id === id);

  const titleText = (record.title || existing?.title || 'Lançamento financeiro').trim();
  const rawAmount = typeof record.amount === 'number' ? record.amount : parseFloat(String(record.amount || 0)) || 0;
  const amountVal = roundMoney(rawAmount);

  let statusVal: FinancialStatus = record.status || existing?.status || 'pendente';
  let paidAmountVal =
    typeof record.paid_amount === 'number'
      ? roundMoney(record.paid_amount)
      : statusVal === 'pago'
      ? amountVal
      : statusVal === 'pendente' || statusVal === 'cancelado'
      ? 0
      : roundMoney(existing?.paid_amount || 0);

  if (statusVal === 'pago') {
    paidAmountVal = amountVal;
  } else if (paidAmountVal >= amountVal && amountVal > 0 && statusVal !== 'cancelado') {
    statusVal = 'pago';
    paidAmountVal = amountVal;
  } else if (paidAmountVal > 0 && paidAmountVal < amountVal && statusVal !== 'cancelado') {
    statusVal = 'parcial';
  } else if (paidAmountVal <= 0 && statusVal === 'parcial') {
    statusVal = 'pendente';
    paidAmountVal = 0;
  }

  const isFullyPaid = statusVal === 'pago';
  const hasAnyPayment = statusVal === 'pago' || statusVal === 'parcial';

  // Preserva a data original de pagamento ao editar um registo pago, salvo alteração explícita
  let resolvedPaymentDate: string | null = null;
  if (hasAnyPayment) {
    if (record.payment_date !== undefined) {
      resolvedPaymentDate = record.payment_date || existing?.payment_date || now.slice(0, 10);
    } else {
      resolvedPaymentDate = existing?.payment_date || now.slice(0, 10);
    }
  }

  const newRecord: FinancialRecord = {
    id,
    company_id: record.company_id || existing?.company_id || companyId || null,
    site_id: record.site_id !== undefined ? record.site_id : (existing?.site_id || null),
    site_name: record.site_name !== undefined ? record.site_name : (existing?.site_name || null),
    type: record.type || existing?.type || 'despesa',
    category: record.category || existing?.category || 'custo_materiais',
    subcategory: record.subcategory !== undefined ? (record.subcategory?.trim() || null) : (existing?.subcategory || null),
    title: titleText,
    description: record.description !== undefined ? (record.description?.trim() || null) : (existing?.description || null),
    entity_name: record.entity_name !== undefined ? (record.entity_name?.trim() || null) : (existing?.entity_name || null),
    entity_type: record.entity_type !== undefined ? record.entity_type : (existing?.entity_type || null),
    entity_id: record.entity_id !== undefined ? record.entity_id : (existing?.entity_id || null),
    invoice_number: record.invoice_number !== undefined ? (record.invoice_number?.trim() || null) : (existing?.invoice_number || null),
    payment_method: record.payment_method !== undefined ? record.payment_method : (existing?.payment_method || null),
    amount: amountVal,
    paid_amount: paidAmountVal,
    due_date: record.due_date || existing?.due_date || now.slice(0, 10),
    payment_date: resolvedPaymentDate,
    status: statusVal,
    receipt_url: record.receipt_url !== undefined ? record.receipt_url : (existing?.receipt_url || null),
    measurement_id: record.measurement_id !== undefined ? record.measurement_id : (existing?.measurement_id || null),
    source_module: record.source_module || existing?.source_module || 'manual',
    source_id: record.source_id !== undefined ? record.source_id : (existing?.source_id || null),
    is_committed: record.is_committed !== undefined ? record.is_committed : (existing?.is_committed ?? false),
    installments: record.installments !== undefined ? record.installments : (existing?.installments || []),
    created_at: record.created_at || existing?.created_at || now.slice(0, 10),
  };

  if (supabase) {
    try {
      const encodedDescription = encodeFinancialDescription(newRecord.title, newRecord);
      const dbPayload = {
        id,
        company_id: newRecord.company_id,
        description: encodedDescription,
        amount: newRecord.amount,
        type: newRecord.type === 'receita' ? 'income' : 'expense',
        category: newRecord.category,
        due_date: newRecord.due_date,
        paid: isFullyPaid,
        payment_date: newRecord.payment_date,
      };

      const { error } = await supabase
        .from('financial_transactions')
        .upsert(dbPayload, { onConflict: 'id' });

      if (error) {
        console.warn('Aviso ao sincronizar no Supabase (será mantido localmente):', error);
      }
    } catch (err) {
      console.warn('Falha na requisição ao Supabase:', err);
    }
  }

  const exists = current.some((r) => r.id === newRecord.id);
  const updated = exists
    ? current.map((r) => (r.id === newRecord.id ? newRecord : r))
    : [newRecord, ...current];

  localStorage.setItem(localKey, JSON.stringify(updated));

  // Se estiver associado a uma medição, sincroniza o valor recebido da medição
  if (newRecord.measurement_id && newRecord.type === 'receita') {
    try {
      await recalculateMeasurementFromRecords(newRecord.measurement_id, companyId);
    } catch {}
  }

  return newRecord;
}

export async function registerPartialPayment(params: {
  recordId: string;
  installmentAmount: number;
  paymentDate: string;
  paymentMethod?: string | null;
  reference?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
  companyId?: string;
}): Promise<FinancialRecord> {
  const { recordId, installmentAmount, paymentDate, paymentMethod, reference, receiptUrl, notes, companyId } = params;
  const records = await getFinancialRecords(companyId);
  const target = records.find((r) => r.id === recordId);
  if (!target) throw new Error('Registo financeiro não encontrado.');

  const cleanAmount = roundMoney(installmentAmount);
  if (cleanAmount <= 0) throw new Error('O valor da parcela deve ser superior a zero.');

  const currentPaid = roundMoney(
    typeof target.paid_amount === 'number'
      ? target.paid_amount
      : target.status === 'pago'
      ? target.amount
      : 0
  );
  const remaining = roundMoney(Math.max(0, target.amount - currentPaid));
  if (cleanAmount > remaining + 0.01) {
    throw new Error(`O valor informado (€ ${cleanAmount.toFixed(2)}) excede o saldo restante (€ ${remaining.toFixed(2)}).`);
  }

  const newInstallment: FinancialPaymentInstallment = {
    id: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    amount: cleanAmount,
    payment_date: paymentDate || new Date().toISOString().slice(0, 10),
    payment_method: paymentMethod || target.payment_method || 'transferencia',
    reference: reference || null,
    receipt_url: receiptUrl || null,
    notes: notes || null,
    created_at: new Date().toISOString(),
  };

  const nextPaid = roundMoney(Math.min(target.amount, currentPaid + cleanAmount));
  const nextStatus: FinancialStatus = nextPaid >= target.amount - 0.009 ? 'pago' : 'parcial';
  const prevInstallments = Array.isArray(target.installments) ? target.installments : [];

  return saveFinancialRecord(
    {
      ...target,
      paid_amount: nextPaid,
      status: nextStatus,
      payment_date: newInstallment.payment_date,
      payment_method: newInstallment.payment_method || target.payment_method,
      receipt_url: newInstallment.receipt_url || target.receipt_url,
      installments: [...prevInstallments, newInstallment],
    },
    companyId
  );
}

export async function deleteFinancialRecord(
  recordId: string,
  companyId?: string
): Promise<void> {
  const localKey = getFinStorageKey(companyId);
  const current = await getFinancialRecords(companyId);
  const target = current.find((r) => r.id === recordId);

  if (supabase) {
    try {
      await supabase.from('financial_transactions').delete().eq('id', recordId);
    } catch (err) {
      console.warn('Erro ao remover no Supabase:', err);
    }
  }

  const filtered = current.filter((r) => r.id !== recordId);
  localStorage.setItem(localKey, JSON.stringify(filtered));

  if (target?.measurement_id) {
    try {
      await recalculateMeasurementFromRecords(target.measurement_id, companyId);
    } catch {}
  }
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

  const nextPaidAmount =
    status === 'pago'
      ? target.amount
      : status === 'pendente' || status === 'cancelado'
      ? 0
      : target.paid_amount || 0;

  const updated: FinancialRecord = {
    ...target,
    status,
    paid_amount: nextPaidAmount,
    payment_date:
      status === 'pago' || status === 'parcial'
        ? paymentDate || target.payment_date || new Date().toISOString().slice(0, 10)
        : null,
  };

  await saveFinancialRecord(updated, companyId);
}

// ============================================================================
// MEDIÇÕES DE OBRAS E CONFIGURAÇÃO DE ORÇAMENTO / CONTRATO POR OBRA
// ============================================================================
const getMeasurementsStorageKey = (companyId?: string) =>
  `castello_site_measurements_${companyId || 'default'}`;

const getSiteFinConfigStorageKey = (companyId?: string) =>
  `castello_site_fin_config_${companyId || 'default'}`;

export async function getSiteMeasurements(companyId?: string, siteId?: string): Promise<SiteMeasurement[]> {
  const localKey = getMeasurementsStorageKey(companyId);
  let list: SiteMeasurement[] = [];
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) list = JSON.parse(raw);
  } catch {}

  if (supabase) {
    try {
      let query = supabase.from('site_measurements').select('*').order('measurement_number', { ascending: true });
      if (companyId) query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const remoteIds = new Set(data.map((d: any) => d.id));
        const localOnly = list.filter((l) => !remoteIds.has(l.id));
        list = [...(data as SiteMeasurement[]), ...localOnly];
        localStorage.setItem(localKey, JSON.stringify(list));
      }
    } catch {}
  }

  if (siteId && siteId !== 'todos') {
    return list.filter((m) => m.site_id === siteId);
  }
  return list;
}

export async function saveSiteMeasurement(
  measurement: Partial<SiteMeasurement>,
  companyId?: string
): Promise<SiteMeasurement> {
  const localKey = getMeasurementsStorageKey(companyId);
  const current = await getSiteMeasurements(companyId);
  const now = new Date().toISOString().slice(0, 10);
  const id = ensureValidUuid(measurement.id);

  const siteMeasurements = current.filter((m) => m.site_id === measurement.site_id);
  const nextNumber =
    measurement.measurement_number ||
    (siteMeasurements.length > 0 ? Math.max(...siteMeasurements.map((m) => m.measurement_number || 0)) + 1 : 1);

  const measuredVal = roundMoney(Number(measurement.measured_value || 0));
  const approvedVal = roundMoney(
    measurement.approved_value !== undefined ? Number(measurement.approved_value) : measuredVal
  );
  const retentionPct = Number(measurement.retention_pct || 0);
  const retentionVal =
    measurement.retention_value !== undefined
      ? roundMoney(Number(measurement.retention_value))
      : roundMoney((approvedVal * retentionPct) / 100);
  const invoicedVal = roundMoney(Number(measurement.invoiced_value || 0));
  const receivedVal = roundMoney(Number(measurement.received_value || 0));

  let resolvedStatus = measurement.status || 'rascunho';
  if (receivedVal > 0 && approvedVal > 0) {
    const netReceivable = Math.max(0, approvedVal - retentionVal);
    if (receivedVal >= netReceivable - 0.01 && netReceivable > 0) {
      resolvedStatus = 'recebida';
    } else {
      resolvedStatus = 'parcialmente_recebida';
    }
  }

  const saved: SiteMeasurement = {
    id,
    company_id: measurement.company_id || companyId || null,
    site_id: measurement.site_id!,
    site_name: measurement.site_name || null,
    client_name: measurement.client_name || null,
    measurement_number: nextNumber,
    kind: measurement.kind || 'normal',
    description: (measurement.description || `Auto de Medição #${nextNumber}`).trim(),
    period_start: measurement.period_start || now,
    period_end: measurement.period_end || now,
    measured_value: measuredVal,
    approved_value: approvedVal,
    approval_date: measurement.approval_date || null,
    invoiced_value: invoicedVal,
    received_value: receivedVal,
    retention_pct: retentionPct,
    retention_value: retentionVal,
    status: resolvedStatus,
    notes: measurement.notes?.trim() || null,
    attachments: Array.isArray(measurement.attachments) ? measurement.attachments : [],
    linked_record_ids: Array.isArray(measurement.linked_record_ids) ? measurement.linked_record_ids : [],
    created_at: measurement.created_at || now,
    updated_at: now,
  };

  if (supabase) {
    try {
      await supabase.from('site_measurements').upsert(saved, { onConflict: 'id' });
    } catch {}
  }

  const exists = current.some((m) => m.id === saved.id);
  const updated = exists ? current.map((m) => (m.id === saved.id ? saved : m)) : [...current, saved];
  localStorage.setItem(localKey, JSON.stringify(updated));
  return saved;
}

export async function deleteSiteMeasurement(measurementId: string, companyId?: string): Promise<void> {
  const localKey = getMeasurementsStorageKey(companyId);
  if (supabase) {
    try {
      await supabase.from('site_measurements').delete().eq('id', measurementId);
    } catch {}
  }
  const current = await getSiteMeasurements(companyId);
  const filtered = current.filter((m) => m.id !== measurementId);
  localStorage.setItem(localKey, JSON.stringify(filtered));
}

export async function recalculateMeasurementFromRecords(
  measurementId: string,
  companyId?: string
): Promise<void> {
  const [measurements, records] = await Promise.all([
    getSiteMeasurements(companyId),
    getFinancialRecords(companyId),
  ]);
  const target = measurements.find((m) => m.id === measurementId);
  if (!target) return;

  const linkedRecs = records.filter(
    (r) => r.measurement_id === measurementId && r.type === 'receita' && r.status !== 'cancelado'
  );
  const totalReceived = roundMoney(
    linkedRecs.reduce((sum, r) => {
      if (r.status === 'pago') return sum + r.amount;
      if (r.status === 'parcial') return sum + (r.paid_amount || 0);
      return sum;
    }, 0)
  );
  const totalInvoiced = roundMoney(
    Math.max(
      target.invoiced_value || 0,
      linkedRecs.reduce((sum, r) => sum + r.amount, 0)
    )
  );

  await saveSiteMeasurement(
    {
      ...target,
      invoiced_value: totalInvoiced,
      received_value: totalReceived,
      linked_record_ids: linkedRecs.map((r) => r.id),
    },
    companyId
  );
}

export function getSiteFinancialConfigs(companyId?: string): Record<string, SiteFinancialConfig> {
  const key = getSiteFinConfigStorageKey(companyId);
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSiteFinancialConfig(
  config: SiteFinancialConfig,
  companyId?: string
): SiteFinancialConfig {
  const key = getSiteFinConfigStorageKey(companyId);
  const map = getSiteFinancialConfigs(companyId);
  const updated: SiteFinancialConfig = {
    ...config,
    contracted_value: roundMoney(Number(config.contracted_value || 0)),
    cost_budget: roundMoney(Number(config.cost_budget || 0)),
    additional_forecast_cost: roundMoney(Number(config.additional_forecast_cost || 0)),
    social_charges_pct: Number(config.social_charges_pct || 0),
    updated_at: new Date().toISOString().slice(0, 10),
  };
  map[config.site_id] = updated;
  localStorage.setItem(key, JSON.stringify(map));
  return updated;
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
// AGENDA E CALENDÁRIO DE COMPROMISSOS (CENTRAL DE PLANEAMENTO INTEGRADA)
// ============================================================================
const getCalendarStorageKey = (companyId?: string) =>
  `castello_calendar_${companyId || 'default'}`;

const META_REGEX = /\n?<!--CASTELLO_META:([\s\S]*?)-->/;

function stripCalendarMeta(desc?: string | null): string | null {
  if (!desc) return null;
  const cleaned = desc.replace(META_REGEX, '').trim();
  return cleaned || null;
}

function encodeCalendarDescription(evt: CalendarEvent): string | null {
  const cleanDesc = stripCalendarMeta(evt.description) || '';
  const meta = {
    end_date: evt.end_date || evt.event_date,
    all_day: Boolean(evt.all_day),
    event_subtype: evt.event_subtype || null,
    assigned_team_id: evt.assigned_team_id || null,
    assigned_team_name: evt.assigned_team_name || null,
    supplier_name: evt.supplier_name || null,
    priority: evt.priority || 'media',
    status: evt.status || (evt.is_completed ? 'concluido' : 'planeado'),
    progress: typeof evt.progress === 'number' ? evt.progress : evt.is_completed ? 100 : 0,
    dependencies: Array.isArray(evt.dependencies) ? evt.dependencies : [],
    recurrence: evt.recurrence || 'nenhuma',
    reminder_minutes: evt.reminder_minutes ?? 60,
    visible_to_client: Boolean(evt.visible_to_client),
    source_module: evt.source_module || 'manual',
    source_id: evt.source_id || null,
    google_calendar_synced: Boolean(evt.google_calendar_synced),
    google_event_url: evt.google_event_url || null,
  };
  return `${cleanDesc}\n<!--CASTELLO_META:${JSON.stringify(meta)}-->`;
}

function decodeCalendarRow(row: any): CalendarEvent {
  const rawDesc = typeof row.description === 'string' ? row.description : '';
  let meta: any = {};
  const match = rawDesc.match(META_REGEX);
  if (match && match[1]) {
    try {
      meta = JSON.parse(match[1]);
    } catch {}
  }
  const cleanDesc = stripCalendarMeta(rawDesc);
  const isCompleted = Boolean(row.is_completed || meta.status === 'concluido');
  const todayStr = new Date().toISOString().slice(0, 10);
  const endDate = row.end_date || meta.end_date || row.event_date;

  let computedStatus = row.status || meta.status || (isCompleted ? 'concluido' : 'planeado');
  if (!isCompleted && computedStatus !== 'cancelado' && endDate && endDate < todayStr) {
    computedStatus = 'atrasado';
  } else if (isCompleted && computedStatus !== 'cancelado') {
    computedStatus = 'concluido';
  }

  return {
    id: row.id,
    company_id: row.company_id || null,
    title: row.title || 'Evento sem título',
    description: cleanDesc,
    event_date: row.event_date ? String(row.event_date).slice(0, 10) : todayStr,
    end_date: endDate ? String(endDate).slice(0, 10) : String(row.event_date || todayStr).slice(0, 10),
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    all_day: row.all_day !== undefined ? Boolean(row.all_day) : Boolean(meta.all_day),
    category: row.category || 'obra',
    event_subtype: row.event_subtype || meta.event_subtype || null,
    site_id: row.site_id || null,
    site_name: row.site_name || null,
    assigned_employee_id: row.assigned_employee_id || null,
    assigned_employee_name: row.assigned_employee_name || null,
    assigned_team_id: row.assigned_team_id || meta.assigned_team_id || null,
    assigned_team_name: row.assigned_team_name || meta.assigned_team_name || null,
    supplier_name: row.supplier_name || meta.supplier_name || null,
    location: row.location || null,
    priority: row.priority || meta.priority || 'media',
    status: computedStatus,
    progress:
      typeof row.progress === 'number'
        ? row.progress
        : typeof meta.progress === 'number'
        ? meta.progress
        : isCompleted
        ? 100
        : 0,
    dependencies: Array.isArray(row.dependencies)
      ? row.dependencies
      : Array.isArray(meta.dependencies)
      ? meta.dependencies
      : [],
    recurrence: row.recurrence || meta.recurrence || 'nenhuma',
    reminder_minutes:
      row.reminder_minutes !== undefined
        ? row.reminder_minutes
        : meta.reminder_minutes !== undefined
        ? meta.reminder_minutes
        : 60,
    visible_to_client:
      row.visible_to_client !== undefined
        ? Boolean(row.visible_to_client)
        : Boolean(meta.visible_to_client),
    source_module: row.source_module || meta.source_module || 'manual',
    source_id: row.source_id || meta.source_id || null,
    google_calendar_synced:
      row.google_calendar_synced !== undefined
        ? Boolean(row.google_calendar_synced)
        : Boolean(meta.google_calendar_synced),
    google_event_url: row.google_event_url || meta.google_event_url || null,
    is_completed: isCompleted,
    created_at: row.created_at ? String(row.created_at).slice(0, 10) : todayStr,
  };
}

export async function getCalendarEvents(companyId?: string): Promise<CalendarEvent[]> {
  const localKey = getCalendarStorageKey(companyId);
  const storedRaw = localStorage.getItem(localKey);
  const localList: CalendarEvent[] = storedRaw
    ? (JSON.parse(storedRaw) as any[]).map(decodeCalendarRow)
    : [];

  if (supabase) {
    try {
      let query = supabase.from('calendar_events').select('*').order('event_date', { ascending: true });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        const remoteList = data.map(decodeCalendarRow);
        const remoteIds = new Set(remoteList.map((r) => r.id));
        const unsyncedLocal = localList.filter((l) => !remoteIds.has(l.id));
        const merged = [...remoteList, ...unsyncedLocal];
        localStorage.setItem(localKey, JSON.stringify(merged));
        return merged;
      }
    } catch (e) {
      console.warn('Erro ao carregar calendário do Supabase:', e);
    }
  }

  return localList;
}

export async function saveCalendarEvent(
  event: Partial<CalendarEvent>,
  companyId?: string,
  skipReverseSync?: boolean
): Promise<CalendarEvent> {
  const localKey = getCalendarStorageKey(companyId);
  const now = new Date().toISOString();
  const todayStr = now.slice(0, 10);
  const id = event.id || `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const startDate = event.event_date || todayStr;
  const endDate = event.end_date && event.end_date >= startDate ? event.end_date : startDate;
  const isCompleted = Boolean(event.is_completed || event.status === 'concluido');

  let statusVal = event.status || (isCompleted ? 'concluido' : 'planeado');
  if (isCompleted && statusVal !== 'cancelado') {
    statusVal = 'concluido';
  } else if (!isCompleted && statusVal !== 'cancelado' && endDate < todayStr) {
    statusVal = 'atrasado';
  }

  const progressVal =
    statusVal === 'concluido'
      ? 100
      : typeof event.progress === 'number'
      ? Math.min(100, Math.max(0, event.progress))
      : statusVal === 'em_andamento'
      ? 50
      : 0;

  const newEvent: CalendarEvent = {
    id,
    company_id: event.company_id || companyId || null,
    title: (event.title || 'Compromisso sem título').trim(),
    description: stripCalendarMeta(event.description),
    event_date: startDate,
    end_date: endDate,
    start_time: event.all_day ? null : event.start_time || null,
    end_time: event.all_day ? null : event.end_time || null,
    all_day: Boolean(event.all_day),
    category: event.category || 'etapa_obra',
    event_subtype: event.event_subtype || null,
    site_id: event.site_id || null,
    site_name: event.site_name || null,
    assigned_employee_id: event.assigned_employee_id || null,
    assigned_employee_name: event.assigned_employee_name || null,
    assigned_team_id: event.assigned_team_id || null,
    assigned_team_name: event.assigned_team_name || null,
    supplier_name: event.supplier_name?.trim() || null,
    location: event.location?.trim() || null,
    priority: event.priority || 'media',
    status: statusVal,
    progress: progressVal,
    dependencies: Array.isArray(event.dependencies) ? event.dependencies : [],
    recurrence: event.recurrence || 'nenhuma',
    reminder_minutes: event.reminder_minutes !== undefined ? event.reminder_minutes : 60,
    visible_to_client: Boolean(event.visible_to_client),
    source_module: event.source_module || 'manual',
    source_id: event.source_id || null,
    google_calendar_synced: Boolean(event.google_calendar_synced),
    google_event_url: event.google_event_url || null,
    is_completed: isCompleted,
    created_at: event.created_at || todayStr,
  };

  if (supabase) {
    try {
      const dbPayload = {
        id: newEvent.id,
        company_id: newEvent.company_id,
        title: newEvent.title,
        description: encodeCalendarDescription(newEvent),
        event_date: newEvent.event_date,
        start_time: newEvent.start_time,
        end_time: newEvent.end_time,
        category: newEvent.category,
        site_id: newEvent.site_id,
        site_name: newEvent.site_name,
        assigned_employee_id: newEvent.assigned_employee_id,
        assigned_employee_name: newEvent.assigned_employee_name,
        location: newEvent.location,
        is_completed: newEvent.is_completed,
      };
      await supabase.from('calendar_events').upsert(dbPayload, { onConflict: 'id' });
    } catch (err) {
      console.warn('Aviso: gravando evento localmente:', err);
    }
  }

  const storedRaw = localStorage.getItem(localKey);
  const current: CalendarEvent[] = storedRaw
    ? (JSON.parse(storedRaw) as any[]).map(decodeCalendarRow)
    : [];
  const exists = current.some((e) => e.id === newEvent.id);
  const updated = exists
    ? current.map((e) => (e.id === newEvent.id ? newEvent : e))
    : [newEvent, ...current];

  localStorage.setItem(localKey, JSON.stringify(updated));

  // Sincronização reversa: se o evento pertence a uma Obra ou Tarefa, propaga alterações para o módulo original
  if (!skipReverseSync) {
    try {
      if (newEvent.source_module === 'obra' && newEvent.source_id) {
        const sitesList = await getSites(newEvent.company_id || companyId);
        const targetSite = sitesList.find((s) => s.id === newEvent.source_id);
        if (targetSite) {
          if (newEvent.id.startsWith('sync-site-start-')) {
            await saveSite(
              { ...targetSite, start_date: newEvent.event_date },
              newEvent.company_id || companyId,
              true
            );
          } else if (newEvent.id.startsWith('sync-site-end-')) {
            await saveSite(
              {
                ...targetSite,
                expected_end_date: newEvent.end_date || newEvent.event_date,
                status: newEvent.is_completed ? 'concluida' : targetSite.status,
              },
              newEvent.company_id || companyId,
              true
            );
          }
        }
      } else if (newEvent.source_module === 'tarefa' && newEvent.source_id) {
        const cleanTaskTitle = newEvent.title.replace(/^Tarefa:\s*/i, '').trim();
        const dueDate = newEvent.end_date || newEvent.event_date;
        if (supabase) {
          try {
            await supabase
              .from('site_tasks')
              .update({
                title: cleanTaskTitle,
                due_date: dueDate,
                assigned_to_id: newEvent.assigned_employee_id || null,
                assigned_to_name: newEvent.assigned_employee_name || null,
                show_to_client: newEvent.visible_to_client,
              })
              .eq('id', newEvent.source_id);
          } catch {}
        }
        // Atualiza também na cache local de tarefas
        if (newEvent.site_id) {
          const tKey = getTasksStorageKey(newEvent.site_id);
          const tList: SiteTask[] = JSON.parse(localStorage.getItem(tKey) || '[]');
          const tIdx = tList.findIndex((t) => t.id === newEvent.source_id);
          if (tIdx !== -1) {
            tList[tIdx] = {
              ...tList[tIdx],
              title: cleanTaskTitle,
              due_date: dueDate,
              assigned_to_id: newEvent.assigned_employee_id || tList[tIdx].assigned_to_id,
              assigned_to_name: newEvent.assigned_employee_name || tList[tIdx].assigned_to_name,
              show_to_client: newEvent.visible_to_client,
            };
            localStorage.setItem(tKey, JSON.stringify(tList));
          }
        }
        await updateTaskStatus(
          newEvent.source_id,
          newEvent.is_completed ? 'confirmada_chefe' : 'pendente',
          'Gestor Castello',
          undefined,
          newEvent.visible_to_client,
          true
        );
      }
    } catch (syncErr) {
      console.warn('Aviso ao sincronizar módulo original:', syncErr);
    }
  }

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
  const nextCompleted = !target.is_completed;
  await saveCalendarEvent(
    {
      ...target,
      is_completed: nextCompleted,
      status: nextCompleted ? 'concluido' : 'planeado',
      progress: nextCompleted ? 100 : 0,
    },
    companyId
  );
}

// ----------------------------------------------------------------------------
// FUNÇÕES DE SINCRONIZAÇÃO AUTOMÁTICA SEM DUPLICAÇÃO (OBRAS, TAREFAS, EQUIPAS)
// ----------------------------------------------------------------------------
export async function syncSiteMilestonesWithCalendar(
  site: ConstructionSite,
  companyId?: string | null
): Promise<void> {
  const cid = companyId || site.company_id || undefined;
  const todayStr = new Date().toISOString().slice(0, 10);

  if (site.start_date) {
    const startId = `sync-site-start-${site.id}`;
    const isStarted = site.start_date <= todayStr;
    await saveCalendarEvent(
      {
        id: startId,
        company_id: cid || null,
        title: `Início da Obra: ${site.name}`,
        description: `Marco oficial de abertura e mobilização da empreitada ${site.name}.`,
        event_date: site.start_date,
        end_date: site.start_date,
        all_day: true,
        category: 'etapa_obra',
        event_subtype: 'inicio_obra',
        site_id: site.id,
        site_name: site.name,
        assigned_employee_id: site.manager_id || null,
        assigned_employee_name: site.manager_name || 'Engenharia',
        location: site.address,
        priority: 'alta',
        status: isStarted ? 'concluido' : 'planeado',
        progress: isStarted ? 100 : 0,
        visible_to_client: true,
        source_module: 'obra',
        source_id: site.id,
        is_completed: isStarted,
      },
      cid,
      true
    );
  }

  if (site.expected_end_date) {
    const endId = `sync-site-end-${site.id}`;
    const isDone = site.status === 'concluida';
    await saveCalendarEvent(
      {
        id: endId,
        company_id: cid || null,
        title: `Conclusão e Entrega: ${site.name}`,
        description: `Prazo final previsto para conclusão e vistoria de entrega da obra ${site.name}.`,
        event_date: site.expected_end_date,
        end_date: site.expected_end_date,
        all_day: true,
        category: 'etapa_obra',
        event_subtype: 'conclusao_entrega',
        site_id: site.id,
        site_name: site.name,
        assigned_employee_id: site.manager_id || null,
        assigned_employee_name: site.manager_name || 'Engenharia',
        location: site.address,
        priority: 'urgente',
        status: isDone ? 'concluido' : site.expected_end_date < todayStr ? 'atrasado' : 'planeado',
        progress: isDone ? 100 : 0,
        dependencies: site.start_date ? [`sync-site-start-${site.id}`] : [],
        visible_to_client: true,
        source_module: 'obra',
        source_id: site.id,
        is_completed: isDone,
      },
      cid,
      true
    );
  }
}

export async function syncTaskWithCalendar(
  task: SiteTask,
  companyId?: string | null,
  siteName?: string | null
): Promise<void> {
  if (!task.due_date) return;
  const cid = companyId || task.company_id || undefined;
  const todayStr = new Date().toISOString().slice(0, 10);
  const isDone = task.status === 'concluida_funcionario' || task.status === 'confirmada_chefe';
  const createdDate = task.created_at ? task.created_at.slice(0, 10) : task.due_date;
  const startDate = createdDate <= task.due_date ? createdDate : task.due_date;

  let resolvedSiteName = siteName || null;
  if (!resolvedSiteName && task.site_id) {
    const sites = await getSites(cid);
    const found = sites.find((s) => s.id === task.site_id);
    if (found) resolvedSiteName = found.name;
  }

  await saveCalendarEvent(
    {
      id: `sync-task-${task.id}`,
      company_id: cid || null,
      title: `Tarefa: ${task.title}`,
      description: task.description || `Tarefa operacional atribuída na obra ${resolvedSiteName || ''}.`,
      event_date: startDate,
      end_date: task.due_date,
      all_day: false,
      start_time: '08:00',
      end_time: '17:00',
      category: 'tarefa',
      event_subtype: 'tarefa_obra',
      site_id: task.site_id,
      site_name: resolvedSiteName,
      assigned_employee_id: task.assigned_to_id || null,
      assigned_employee_name: task.assigned_to_name || null,
      priority: !isDone && task.due_date < todayStr ? 'urgente' : 'alta',
      status: isDone ? 'concluido' : task.due_date < todayStr ? 'atrasado' : 'em_andamento',
      progress: task.status === 'confirmada_chefe' ? 100 : isDone ? 85 : 35,
      visible_to_client: Boolean(task.show_to_client),
      source_module: 'tarefa',
      source_id: task.id,
      is_completed: isDone,
    },
    cid,
    true
  );
}

export async function syncAllModulesWithCalendar(params: {
  companyId?: string;
  sites: ConstructionSite[];
  tasks: SiteTask[];
  justifications: AbsenceJustification[];
  teams: Team[];
}): Promise<CalendarEvent[]> {
  const { companyId, sites, tasks, justifications, teams } = params;
  const existingEvents = await getCalendarEvents(companyId);
  const existingMap = new Map(existingEvents.map((e) => [e.id, e]));
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Sincroniza marcos de todas as obras (Início e Conclusão)
  for (const site of sites) {
    if (site.start_date) {
      const startId = `sync-site-start-${site.id}`;
      const prev = existingMap.get(startId);
      if (!prev || prev.event_date !== site.start_date || prev.site_name !== site.name) {
        await syncSiteMilestonesWithCalendar(site, companyId);
      }
    }
    if (site.expected_end_date) {
      const endId = `sync-site-end-${site.id}`;
      const prev = existingMap.get(endId);
      if (!prev || prev.event_date !== site.expected_end_date || prev.is_completed !== (site.status === 'concluida')) {
        await syncSiteMilestonesWithCalendar(site, companyId);
      }
    }
  }

  // 2. Sincroniza tarefas com prazo definido
  for (const task of tasks) {
    if (!task.due_date) continue;
    const taskEvtId = `sync-task-${task.id}`;
    const prev = existingMap.get(taskEvtId);
    const isDone = task.status === 'concluida_funcionario' || task.status === 'confirmada_chefe';
    const siteObj = sites.find((s) => s.id === task.site_id);
    if (
      !prev ||
      prev.end_date !== task.due_date ||
      prev.is_completed !== isDone ||
      prev.assigned_employee_name !== (task.assigned_to_name || null)
    ) {
      await syncTaskWithCalendar(task, companyId, siteObj?.name);
    }
  }

  // 3. Sincroniza ausências / faltas aprovadas de colaboradores (nunca usa picagens de ponto)
  for (const justif of justifications) {
    if (justif.status !== 'aprovada') continue;
    const absId = `sync-absence-${justif.id}`;
    if (!existingMap.has(absId)) {
      await saveCalendarEvent(
        {
          id: absId,
          company_id: companyId || justif.company_id || null,
          title: `Ausência Aprovada: ${justif.employee_name || 'Colaborador'}`,
          description: `Motivo aprovado: ${justif.reason}`,
          event_date: justif.date,
          end_date: justif.date,
          all_day: true,
          category: 'equipa',
          event_subtype: 'ausencia',
          assigned_employee_id: justif.employee_id,
          assigned_employee_name: justif.employee_name || 'Colaborador',
          priority: 'media',
          status: 'concluido',
          progress: 100,
          visible_to_client: false,
          source_module: 'ausencia',
          source_id: justif.id,
          is_completed: true,
        },
        companyId,
        true
      );
    }
  }

  // 4. Sincroniza alocações ativas de equipas em obras hoje
  for (const team of teams) {
    if (!team.current_site_id) continue;
    const allocDate = team.allocated_at ? team.allocated_at.slice(0, 10) : todayStr;
    const allocId = `sync-team-alloc-${team.id}-${allocDate}`;
    if (!existingMap.has(allocId)) {
      await saveCalendarEvent(
        {
          id: allocId,
          company_id: companyId || team.company_id || null,
          title: `Alocação: ${team.name} → ${team.current_site_name || 'Obra'}`,
          description: `Equipa liderada por ${team.leader_name} alocada em campo (${(team.member_names?.length || 0) + 1} integrantes).`,
          event_date: allocDate,
          end_date: allocDate,
          start_time: '08:00',
          end_time: '17:00',
          all_day: false,
          category: 'equipa',
          event_subtype: 'alocacao',
          site_id: team.current_site_id,
          site_name: team.current_site_name || null,
          assigned_employee_id: team.leader_id || null,
          assigned_employee_name: team.leader_name,
          assigned_team_id: team.id,
          assigned_team_name: team.name,
          priority: 'media',
          status: 'em_andamento',
          progress: 60,
          visible_to_client: false,
          source_module: 'manual',
          is_completed: false,
        },
        companyId,
        true
      );
    }
  }

  return getCalendarEvents(companyId);
}

// ----------------------------------------------------------------------------
// INTEGRAÇÃO COM GOOGLE CALENDAR (NOTIFICAÇÕES E LEMBRETES AO GESTOR)
// ----------------------------------------------------------------------------
export function buildGoogleCalendarTemplateUrl(evt: CalendarEvent): string {
  const startDateClean = (evt.event_date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const endDateBase = evt.end_date && evt.end_date >= evt.event_date ? evt.end_date : evt.event_date;

  let datesParam = '';
  if (evt.all_day || !evt.start_time) {
    // Em eventos dia inteiro no Google Calendar, a data final é exclusiva (+1 dia)
    const endObj = new Date(endDateBase + 'T12:00:00');
    endObj.setDate(endObj.getDate() + 1);
    const endDateClean = endObj.toISOString().slice(0, 10).replace(/-/g, '');
    datesParam = `${startDateClean}/${endDateClean}`;
  } else {
    const st = (evt.start_time || '09:00').replace(':', '') + '00';
    const et = (evt.end_time || '10:00').replace(':', '') + '00';
    const endDateClean = endDateBase.replace(/-/g, '');
    datesParam = `${startDateClean}T${st}/${endDateClean}T${et}`;
  }

  const detailsParts: string[] = [];
  if (evt.description) detailsParts.push(evt.description);
  if (evt.site_name) detailsParts.push(`Obra: ${evt.site_name}`);
  if (evt.assigned_employee_name) detailsParts.push(`Responsável: ${evt.assigned_employee_name}`);
  if (evt.assigned_team_name) detailsParts.push(`Equipa: ${evt.assigned_team_name}`);
  if (evt.supplier_name) detailsParts.push(`Fornecedor: ${evt.supplier_name}`);
  if (evt.priority) detailsParts.push(`Prioridade: ${evt.priority.toUpperCase()}`);
  detailsParts.push('Gerado automaticamente pelo Sistema Castello.');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `[Castello] ${evt.title}`,
    dates: datesParam,
    details: detailsParts.join('\n'),
    location: evt.location || evt.site_name || '',
  });

  if (evt.recurrence && evt.recurrence !== 'nenhuma') {
    const freqMap: Record<string, string> = {
      diaria: 'DAILY',
      semanal: 'WEEKLY',
      mensal: 'MONTHLY',
    };
    if (freqMap[evt.recurrence]) {
      params.append('recur', `RRULE:FREQ=${freqMap[evt.recurrence]}`);
    }
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function pushEventToGoogleCalendarApi(
  evt: CalendarEvent,
  accessToken: string,
  calendarId = 'primary'
): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const startDate = evt.event_date;
    const endDate = evt.end_date && evt.end_date >= startDate ? evt.end_date : startDate;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Lisbon';

    let startObj: any;
    let endObj: any;

    if (evt.all_day || !evt.start_time) {
      const endPlusOne = new Date(endDate + 'T12:00:00');
      endPlusOne.setDate(endPlusOne.getDate() + 1);
      startObj = { date: startDate };
      endObj = { date: endPlusOne.toISOString().slice(0, 10) };
    } else {
      startObj = {
        dateTime: `${startDate}T${evt.start_time}:00`,
        timeZone: tz,
      };
      endObj = {
        dateTime: `${endDate}T${evt.end_time || '18:00'}:00`,
        timeZone: tz,
      };
    }

    const reminderMins = evt.reminder_minutes ?? 60;
    const body: any = {
      summary: `[Castello] ${evt.title}`,
      location: evt.location || evt.site_name || '',
      description: [
        evt.description || '',
        evt.site_name ? `Obra: ${evt.site_name}` : '',
        evt.assigned_employee_name ? `Responsável: ${evt.assigned_employee_name}` : '',
        evt.assigned_team_name ? `Equipa: ${evt.assigned_team_name}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      start: startObj,
      end: endObj,
      reminders: {
        useDefault: false,
        overrides:
          reminderMins > 0
            ? [
                { method: 'popup', minutes: reminderMins },
                { method: 'email', minutes: reminderMins },
              ]
            : [],
      },
    };

    if (evt.recurrence && evt.recurrence !== 'nenhuma') {
      const freqMap: Record<string, string> = {
        diaria: 'DAILY',
        semanal: 'WEEKLY',
        mensal: 'MONTHLY',
      };
      if (freqMap[evt.recurrence]) {
        body.recurrence = [`RRULE:FREQ=${freqMap[evt.recurrence]}`];
      }
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data.htmlLink || null;
    }
  } catch (err) {
    console.warn('Falha ao sincronizar via Google Calendar API:', err);
  }
  return null;
}

export function generateIcsContent(events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Castello Construction SaaS//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  for (const evt of events) {
    if (evt.status === 'cancelado') continue;
    const startClean = (evt.event_date || '').replace(/-/g, '');
    const endBase = evt.end_date && evt.end_date >= evt.event_date ? evt.end_date : evt.event_date;
    const endClean = endBase.replace(/-/g, '');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${evt.id}@castello.app`);
    lines.push(`DTSTAMP:${nowStamp}`);

    if (evt.all_day || !evt.start_time) {
      const endPlusOne = new Date(endBase + 'T12:00:00');
      endPlusOne.setDate(endPlusOne.getDate() + 1);
      const endNextClean = endPlusOne.toISOString().slice(0, 10).replace(/-/g, '');
      lines.push(`DTSTART;VALUE=DATE:${startClean}`);
      lines.push(`DTEND;VALUE=DATE:${endNextClean}`);
    } else {
      const st = (evt.start_time || '09:00').replace(':', '') + '00';
      const et = (evt.end_time || '10:00').replace(':', '') + '00';
      lines.push(`DTSTART:${startClean}T${st}`);
      lines.push(`DTEND:${endClean}T${et}`);
    }

    lines.push(`SUMMARY:[Castello] ${evt.title.replace(/\r?\n/g, ' ')}`);
    const desc = [
      evt.description,
      evt.site_name ? `Obra: ${evt.site_name}` : null,
      evt.assigned_employee_name ? `Responsável: ${evt.assigned_employee_name}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
    if (desc) lines.push(`DESCRIPTION:${desc.replace(/\r?\n/g, ' ')}`);
    if (evt.location || evt.site_name) {
      lines.push(`LOCATION:${(evt.location || evt.site_name || '').replace(/\r?\n/g, ' ')}`);
    }

    if (evt.reminder_minutes && evt.reminder_minutes > 0) {
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-PT${evt.reminder_minutes}M`);
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Lembrete Castello: ${evt.title}`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
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

// ============================================================================
// GESTÃO DE EQUIPAS DE TRABALHO (TEAMS)
// ============================================================================
const getTeamsStorageKey = (companyId?: string) => `castello_teams_${companyId || 'default'}`;

export async function getTeams(companyId?: string): Promise<Team[]> {
  const localKey = getTeamsStorageKey(companyId);
  if (supabase) {
    try {
      let query = supabase.from('teams').select('*').order('name', { ascending: true });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        localStorage.setItem(localKey, JSON.stringify(data));
        return data as Team[];
      }
    } catch (e) {
      console.warn('Erro ao carregar equipas de Supabase:', e);
    }
  }

  const stored = localStorage.getItem(localKey);
  if (stored) {
    try {
      return JSON.parse(stored) as Team[];
    } catch {}
  }
  return [];
}

export async function saveTeam(team: Partial<Team>, companyId?: string): Promise<Team> {
  const localKey = getTeamsStorageKey(companyId);
  const newTeam: Team = {
    id: team.id || `team-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    company_id: team.company_id || companyId || null,
    name: team.name?.trim() || 'Nova Equipa',
    leader_id: team.leader_id || null,
    leader_name: team.leader_name?.trim() || 'Líder',
    leader_phone: team.leader_phone || null,
    member_ids: team.member_ids || [],
    member_names: team.member_names || [],
    current_site_id: team.current_site_id || null,
    current_site_name: team.current_site_name || null,
    allocated_at: team.allocated_at || null,
    notes: team.notes?.trim() || null,
    created_at: team.created_at || new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('teams')
        .upsert(newTeam)
        .select('*')
        .single();
      if (!error && data) {
        const current = await getTeams(companyId);
        const exists = current.some((t) => t.id === data.id);
        const updated = exists ? current.map((t) => (t.id === data.id ? (data as Team) : t)) : [...current, data as Team];
        localStorage.setItem(localKey, JSON.stringify(updated));
        return data as Team;
      }
    } catch (e) {
      console.warn('Erro ao salvar equipa no Supabase:', e);
    }
  }

  const current = await getTeams(companyId);
  const exists = current.some((t) => t.id === newTeam.id);
  const updated = exists ? current.map((t) => (t.id === newTeam.id ? newTeam : t)) : [...current, newTeam];
  localStorage.setItem(localKey, JSON.stringify(updated));
  return newTeam;
}

export async function deleteTeam(teamId: string, companyId?: string): Promise<void> {
  const localKey = getTeamsStorageKey(companyId);
  if (supabase) {
    try {
      await supabase.from('teams').delete().eq('id', teamId);
    } catch {}
  }
  const current = await getTeams(companyId);
  const filtered = current.filter((t) => t.id !== teamId);
  localStorage.setItem(localKey, JSON.stringify(filtered));
}

// ============================================================================
// MATERIAIS ALOCADOS NA OBRA (SITE INVENTORY)
// ============================================================================
export async function getSiteInventory(siteId: string, companyId?: string): Promise<InventoryItem[]> {
  const allItems = await getInventoryItems(companyId);
  return allItems.filter((item) => item.allocated_site_id === siteId && (item.allocated_quantity || 0) > 0);
}

export async function allocateItemToSite(
  itemId: string,
  siteId: string,
  siteName: string,
  quantity: number,
  companyId?: string
): Promise<void> {
  const allItems = await getInventoryItems(companyId);
  const item = allItems.find((i) => i.id === itemId);
  if (!item) throw new Error('Material não encontrado no inventário.');
  if (item.available_quantity < quantity) {
    throw new Error(`Quantidade solicitada (${quantity}) excede o estoque disponível no armazém (${item.available_quantity}).`);
  }

  const updatedItem: InventoryItem = {
    ...item,
    available_quantity: item.available_quantity - quantity,
    allocated_quantity: (item.allocated_quantity || 0) + quantity,
    allocated_site_id: siteId,
    allocated_site_name: siteName,
    updated_at: new Date().toISOString().slice(0, 10),
  };

  await saveInventoryItem(updatedItem, companyId);
}

export async function returnItemFromSite(
  itemId: string,
  siteId: string,
  quantity: number,
  companyId?: string
): Promise<void> {
  const allItems = await getInventoryItems(companyId);
  const item = allItems.find((i) => i.id === itemId);
  if (!item) throw new Error('Material não encontrado no inventário.');

  const remaining = Math.max(0, (item.allocated_quantity || 0) - quantity);
  const updatedItem: InventoryItem = {
    ...item,
    available_quantity: item.available_quantity + quantity,
    allocated_quantity: remaining,
    allocated_site_id: remaining <= 0 ? null : siteId,
    allocated_site_name: remaining <= 0 ? null : item.allocated_site_name,
    updated_at: new Date().toISOString().slice(0, 10),
  };

  await saveInventoryItem(updatedItem, companyId);
}
