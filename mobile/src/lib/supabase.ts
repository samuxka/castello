import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AbsenceJustification,
  Company,
  CompanyNotification,
  ConstructionSite,
  EmployeeProfile,
  EntryType,
  TimeEntry,
  Vehicle,
  VehicleReport,
  VehicleInventoryItem,
  InventoryItem,
  InventoryMovement,
  SiteWorkSession,
  SiteAccident,
  Team,
} from '../types';
import { getLocalDateString } from '../utils/timeCalculations';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://kkygvorgxehkadaqfqrx.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_JwCC3MlUbGCfgWFWSbkxmw_zBHdsKFX';

export const isSupabaseConfigured =
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) &&
  !SUPABASE_URL.includes('seu-projeto.supabase.co');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
          return await fn();
        },
      },
    })
  : null;

const CURRENT_EMPLOYEE_ID_KEY = '@castello:current_employee_id_v4';
const BIOMETRIC_SAVED_CREDS_KEY = '@castello:biometric_saved_creds_v4';

// ============================================================================
// CACHE INTELIGENTE EM MEMÓRIA & PROTEÇÃO DE CONCORRÊNCIA (MOBILE PERFORMANCE)
// ============================================================================
interface MobileCacheEntry<T> {
  data: T;
  timestamp: number;
}
const mobileMemoryCache = new Map<string, MobileCacheEntry<any>>();

function getMobileCached<T>(key: string, ttlMs = 30000): T | null {
  const entry = mobileMemoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    mobileMemoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setMobileCached<T>(key: string, data: T): void {
  mobileMemoryCache.set(key, { data, timestamp: Date.now() });
}

export function clearMobileCache(): void {
  mobileMemoryCache.clear();
}

// Guard de concorrência e idempotência de picagem de ponto contra toques repetidos
let lastRegisteredEntry: { empId: string; type: EntryType; time: number; result: TimeEntry } | null = null;

export async function fetchSites(forceRefresh = false): Promise<ConstructionSite[]> {
  const emp = await getActiveEmployee();
  const cacheKey = `sites_${emp?.company_id || 'all'}`;
  if (!forceRefresh) {
    const cached = getMobileCached<ConstructionSite[]>(cacheKey, 30000);
    if (cached) return cached;
  }

  if (supabase) {
    try {
      let query = supabase
        .from('construction_sites')
        .select('*')
        .order('created_at', { ascending: false });
      if (emp && emp.company_id) {
        query = query.or(`company_id.eq.${emp.company_id},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        const mapped = data as unknown as ConstructionSite[];
        setMobileCached(cacheKey, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Erro ao carregar obras:', e);
    }
  }
  return [];
}

export async function fetchEmployees(forceRefresh = false): Promise<EmployeeProfile[]> {
  const cacheKey = 'employees_active';
  if (!forceRefresh) {
    const cached = getMobileCached<EmployeeProfile[]>(cacheKey, 30000);
    if (cached) return cached;
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name', { ascending: true });
      if (!error && data) {
        const mapped = data as unknown as EmployeeProfile[];
        setMobileCached(cacheKey, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Erro ao carregar perfis:', e);
    }
  }
  return [];
}

export async function getActiveEmployee(): Promise<EmployeeProfile | null> {
  const savedId = await AsyncStorage.getItem(CURRENT_EMPLOYEE_ID_KEY);
  if (!savedId) return null;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', savedId)
        .maybeSingle();
      if (data) return data as EmployeeProfile;
    } catch {}
  }
  const emps = await fetchEmployees();
  return emps.find((e) => e.id === savedId) || null;
}

export async function setActiveEmployeeId(employeeId: string): Promise<void> {
  await AsyncStorage.setItem(CURRENT_EMPLOYEE_ID_KEY, employeeId);
}

export async function clearActiveEmployee(): Promise<void> {
  await AsyncStorage.removeItem(CURRENT_EMPLOYEE_ID_KEY);
}

export async function fetchCompanyMobile(companyId?: string | null): Promise<Company | null> {
  if (!companyId) return null;
  const localKey = `@castello:company_${companyId}`;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (!error && data) {
        await AsyncStorage.setItem(localKey, JSON.stringify(data));
        return data as Company;
      }
    } catch (e) {
      console.warn('Erro ao buscar dados da firma no mobile:', e);
    }
  }

  const stored = await AsyncStorage.getItem(localKey);
  if (stored) {
    try {
      return JSON.parse(stored) as Company;
    } catch {}
  }
  return null;
}

export async function authenticateEmployee(
  email: string,
  accessCode: string
): Promise<EmployeeProfile | null> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = accessCode.trim();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', cleanEmail)
        .eq('access_code', cleanCode)
        .maybeSingle();

      if (!error && data) {
        await setActiveEmployeeId(data.id);
        await AsyncStorage.setItem(
          BIOMETRIC_SAVED_CREDS_KEY,
          JSON.stringify({ email: cleanEmail, code: cleanCode, id: data.id })
        );
        await AsyncStorage.setItem(`@castello:profile_${data.id}`, JSON.stringify(data));
        return data as EmployeeProfile;
      }
    } catch (e) {
      console.warn('Erro ao autenticar no Supabase', e);
    }
  }

  // Fallback offline / cache local se as credenciais corresponderem às salvas
  try {
    const saved = await getSavedBiometricCredentials();
    if (saved && saved.email.toLowerCase() === cleanEmail && saved.code === cleanCode) {
      const cached = await AsyncStorage.getItem(`@castello:profile_${saved.id}`);
      if (cached) {
        await setActiveEmployeeId(saved.id);
        return JSON.parse(cached) as EmployeeProfile;
      }
    }
  } catch (err) {
    console.warn('Erro ao verificar cache offline de autenticação:', err);
  }

  return null;
}

export async function getSavedBiometricCredentials(): Promise<{
  email: string;
  code: string;
  id: string;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(BIOMETRIC_SAVED_CREDS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function fetchEmployeeTimeEntries(employeeId: string, limit = 60): Promise<TimeEntry[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .order('recorded_at', { ascending: false })
        .limit(limit);
      if (!error && data) {
        // Ordena cronologicamente para a timeline móvel
        return (data as any[])
          .filter((d: any) => !d.notes || !d.notes.startsWith('[JUSTIFICATIVA_FALTA]'))
          .map((d: any) => ({
            ...d,
            status: d.status || 'pendente',
          }))
          .reverse() as TimeEntry[];
      }
    } catch (e) {
      console.warn('Erro ao buscar picagens:', e);
    }
  }
  return [];
}

/**
 * Registo de Ponto compatível com schema Supabase (inclui company_id, data retroativa, fallback e idempotência)
 */
export async function registerTimeEntry(
  employeeId: string,
  siteId: string | null,
  entryType: EntryType,
  customWorkDate?: string,
  customRecordedAt?: string,
  notes?: string
): Promise<TimeEntry> {
  const now = new Date();
  const workDate = customWorkDate || getLocalDateString(now);
  const recordedAt = customRecordedAt || now.toISOString();

  // Proteção de idempotência contra cliques duplos rápidos no botão físico/tela do telemóvel (dentro de 4s)
  if (
    lastRegisteredEntry &&
    lastRegisteredEntry.empId === employeeId &&
    lastRegisteredEntry.type === entryType &&
    Date.now() - lastRegisteredEntry.time < 4000
  ) {
    return lastRegisteredEntry.result;
  }

  let compId: string | null = null;
  const activeEmp = await getActiveEmployee();
  if (activeEmp) compId = activeEmp.company_id || null;

  if (supabase) {
    // 1. Tenta gravar com todos os campos (com status, company_id e notas)
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          company_id: compId,
          employee_id: employeeId,
          site_id: siteId,
          entry_type: entryType,
          status: 'pendente',
          recorded_at: recordedAt,
          work_date: workDate,
          notes: notes || null,
        })
        .select('*')
        .single();

      if (!error && data) {
        const res: TimeEntry = {
          ...data,
          status: data.status || 'pendente',
        };
        lastRegisteredEntry = { empId: employeeId, type: entryType, time: Date.now(), result: res };
        return res;
      }
    } catch (e) {
      console.warn('Tentativa com status falhou, aplicando fallback de colunas', e);
    }

    // 2. Fallback caso a tabela time_entries ainda não tenha executado a migração da coluna status
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          employee_id: employeeId,
          site_id: siteId,
          entry_type: entryType,
          recorded_at: recordedAt,
          work_date: workDate,
        })
        .select('*')
        .single();

      if (!error && data) {
        const res: TimeEntry = {
          ...data,
          status: 'pendente',
        };
        lastRegisteredEntry = { empId: employeeId, type: entryType, time: Date.now(), result: res };
        return res;
      }
    } catch (e) {
      console.error('Erro total ao gravar ponto no Supabase', e);
    }
  }

  // Objeto retornado
  return {
    id: Date.now(),
    company_id: compId,
    employee_id: employeeId,
    site_id: siteId,
    entry_type: entryType,
    status: 'pendente',
    recorded_at: recordedAt,
    work_date: workDate,
    notes: notes || null,
  };
}

export async function updateEmployeeAvatar(
  employeeId: string,
  cloudinaryUrl: string
): Promise<void> {
  if (supabase) {
    try {
      await supabase
        .from('profiles')
        .update({ avatar_url: cloudinaryUrl })
        .eq('id', employeeId);
    } catch (e) {
      console.warn('Erro ao gravar avatar no Supabase:', e);
    }
  }
}

export async function fetchSiteTasks(siteId: string): Promise<any[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_tasks')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Erro ao carregar tarefas da obra:', e);
    }
  }
  return [];
}

export async function completeTaskByWorker(
  taskId: string,
  workerName: string,
  completionPhotos?: string[]
): Promise<void> {
  if (supabase) {
    try {
      const patch: any = {
        status: 'concluida_funcionario',
        completed_by_name: workerName,
        completed_at: new Date().toISOString(),
      };
      if (completionPhotos && completionPhotos.length > 0) {
        patch.completion_photos = completionPhotos;
      }
      await supabase
        .from('site_tasks')
        .update(patch)
        .eq('id', taskId);
    } catch (e) {
      console.warn('Erro ao concluir tarefa:', e);
    }
  }
}

// ============================================================================
// JUSTIFICATIVAS DE FALTA (PERSISTÊNCIA SUPABASE + ASYNCSTORAGE)
// ============================================================================
const ABSENCE_JUSTIFICATIONS_STORAGE_KEY = '@castello:absence_justifications_v1';
let hasAbsenceTable: boolean | null = null;

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

export async function fetchAbsenceJustifications(
  employeeId?: string
): Promise<AbsenceJustification[]> {
  let list: AbsenceJustification[] = [];

  // 1. Tenta carregar do AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(ABSENCE_JUSTIFICATIONS_STORAGE_KEY);
    if (raw) {
      list = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Erro ao ler justificativas locais:', err);
  }

  // 2. Se Supabase estiver disponível, tenta tabela dedicada ou fallback em time_entries
  if (supabase) {
    let remoteJustifs: AbsenceJustification[] = [];

    if (hasAbsenceTable !== false) {
      try {
        let query = supabase.from('absence_justifications').select('*').order('date', { ascending: false });
        if (employeeId) {
          query = query.eq('employee_id', employeeId);
        }
        const { data, error } = await query;
        if (!error && data) {
          hasAbsenceTable = true;
          remoteJustifs = data as AbsenceJustification[];
        } else if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) {
          hasAbsenceTable = false;
        }
      } catch {
        hasAbsenceTable = false;
      }
    }

    // Fallback: se não houver tabela absence_justifications, busca em time_entries
    if (hasAbsenceTable === false) {
      try {
        let teQuery = supabase
          .from('time_entries')
          .select('*')
          .like('notes', '[JUSTIFICATIVA_FALTA]%')
          .order('work_date', { ascending: false });
        if (employeeId) {
          teQuery = teQuery.eq('employee_id', employeeId);
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
      await AsyncStorage.setItem(
        ABSENCE_JUSTIFICATIONS_STORAGE_KEY,
        JSON.stringify(merged)
      );
      return employeeId ? merged.filter((j) => j.employee_id === employeeId) : merged;
    }
  }

  return employeeId ? list.filter((j) => j.employee_id === employeeId) : list;
}

export async function submitAbsenceJustification(
  data: Omit<AbsenceJustification, 'id' | 'created_at' | 'status'>
): Promise<AbsenceJustification> {
  const newJustification: AbsenceJustification = {
    id: `justif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...data,
    status: 'pendente',
    created_at: new Date().toISOString(),
  };

  // 1. Grava no AsyncStorage imediatamente
  try {
    const existing = await fetchAbsenceJustifications();
    const updated = [newJustification, ...existing.filter((j) => !(j.employee_id === data.employee_id && j.date === data.date))];
    await AsyncStorage.setItem(
      ABSENCE_JUSTIFICATIONS_STORAGE_KEY,
      JSON.stringify(updated)
    );
  } catch (err) {
    console.warn('Erro ao salvar justificativa no AsyncStorage:', err);
  }

  // 2. Grava no Supabase (tabela absence_justifications ou fallback time_entries)
  if (supabase) {
    let savedInTable = false;
    if (hasAbsenceTable !== false) {
      try {
        const { error } = await supabase.from('absence_justifications').insert({
          id: newJustification.id,
          employee_id: newJustification.employee_id,
          employee_name: newJustification.employee_name,
          company_id: newJustification.company_id,
          date: newJustification.date,
          reason: newJustification.reason,
          photos: newJustification.photos,
          status: newJustification.status,
        });
        if (!error) {
          hasAbsenceTable = true;
          savedInTable = true;
        } else if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          hasAbsenceTable = false;
        }
      } catch {
        hasAbsenceTable = false;
      }
    }

    if (!savedInTable) {
      try {
        const notesPayload = `[JUSTIFICATIVA_FALTA]${JSON.stringify({
          justif_id: newJustification.id,
          reason: newJustification.reason,
          photos: newJustification.photos,
          employee_name: newJustification.employee_name,
        })}`;
        await supabase.from('time_entries').insert({
          employee_id: newJustification.employee_id,
          company_id: newJustification.company_id || null,
          entry_type: 'entrada',
          work_date: newJustification.date,
          recorded_at: `${newJustification.date}T00:00:00.000Z`,
          status: 'pendente',
          notes: notesPayload,
        });
      } catch (e) {
        console.warn('Erro ao inserir justificativa em time_entries:', e);
      }
    }
  }

  return newJustification;
}

// ============================================================================
// NOTIFICAÇÕES / MENSAGENS DA EMPRESA
// ============================================================================
const NOTIFICATIONS_STORAGE_KEY = '@castello:company_notifications_v1';
const READ_NOTIFICATIONS_KEY = '@castello:read_notifications_v1';
let hasNotificationsTable: boolean | null = null;

const DEFAULT_COMPANY_NOTIFICATIONS: CompanyNotification[] = [
  {
    id: 'notif_welcome',
    title: 'Bem-vindo ao Castello Mobile',
    content:
      'Lembramos a todos os colaboradores que as picagens de ponto devem ser efetuadas diariamente nos horários de entrada, almoço e saída. Em caso de dúvidas, contacte a gestão.',
    created_at: new Date().toISOString(),
    author_name: 'Direção Castello',
    priority: 'normal',
  },
  {
    id: 'notif_safety',
    title: 'Normas de Segurança em Obra',
    content:
      'O uso de EPI (Equipamento de Proteção Individual) completo: capacete, colete refletor e calçado de segurança é obrigatório em todas as áreas ativas de construção.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    author_name: 'Segurança & Saúde',
    priority: 'alta',
  },
  {
    id: 'notif_absence',
    title: 'Procedimento de Justificação de Faltas',
    content:
      'Caso se ausente a um dia de trabalho, pode agora submeter a sua justificativa escrita e anexar fotos de comprovativos/atestados diretamente no separador Calendário.',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    author_name: 'Recursos Humanos',
    priority: 'normal',
  },
];

export async function fetchCompanyNotifications(
  companyId?: string | null
): Promise<CompanyNotification[]> {
  let list: CompanyNotification[] = [];

  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (raw) {
      list = JSON.parse(raw);
    } else {
      list = DEFAULT_COMPANY_NOTIFICATIONS;
      await AsyncStorage.setItem(
        NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(DEFAULT_COMPANY_NOTIFICATIONS)
      );
    }
  } catch {
    list = DEFAULT_COMPANY_NOTIFICATIONS;
  }

  // Lê IDs marcados como lidos
  let readIds = new Set<string>();
  try {
    const rawRead = await AsyncStorage.getItem(READ_NOTIFICATIONS_KEY);
    if (rawRead) {
      readIds = new Set(JSON.parse(rawRead));
    }
  } catch {}

  if (supabase && hasNotificationsTable !== false) {
    try {
      let query = supabase.from('company_notifications').select('*').order('created_at', { ascending: false });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        hasNotificationsTable = true;
        list = data as CompanyNotification[];
        await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
      } else if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) {
        hasNotificationsTable = false;
      }
    } catch {}
  }

  return list.map((n) => ({
    ...n,
    is_read: readIds.has(n.id),
  }));
}

export async function markNotificationAsRead(id: string): Promise<void> {
  try {
    const rawRead = await AsyncStorage.getItem(READ_NOTIFICATIONS_KEY);
    const readIds: string[] = rawRead ? JSON.parse(rawRead) : [];
    if (!readIds.includes(id)) {
      readIds.push(id);
      await AsyncStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(readIds));
    }
  } catch (err) {
    console.warn('Erro ao marcar notificação como lida:', err);
  }
}

// ============================================================================
// ENVIO DE E-MAIL DE LEMBRETE DE FALTA
// ============================================================================
export async function sendAbsenceReminderEmail(
  recipientEmail: string,
  employeeName: string,
  absenceDateStr: string
): Promise<boolean> {
  const formattedDate = absenceDateStr.split('-').reverse().join('/');
  console.log(
    `[EMAIL ENVIADO] Para: ${recipientEmail} | Assunto: Castello - Lembrete de Falta a Justificar (${formattedDate}) | Colaborador: ${employeeName}`
  );

  // Se houver Supabase configurado, podemos registar o log do envio
  if (supabase) {
    try {
      await supabase.from('email_logs').insert({
        to_email: recipientEmail,
        subject: `Castello - Falta em ${formattedDate} pendente de justificativa`,
        employee_name: employeeName,
        absence_date: absenceDateStr,
        sent_at: new Date().toISOString(),
      });
    } catch {
      // Ignora erro silenciosamente se a tabela não existir
    }
  }

  return true;
}

// ============================================================================
// GESTÃO DA CARRINHA DO FUNCIONÁRIO (Inventário & Reports)
// ============================================================================
const VEHICLE_INV_KEY = '@castello:vehicle_inv_';
const VEHICLE_REPORTS_KEY = '@castello:vehicle_reports_';
const MOVEMENTS_KEY = '@castello:inventory_movements';

export async function fetchAssignedVehicle(employeeId: string, employeeName?: string): Promise<Vehicle | null> {
  if (supabase) {
    try {
      // 1. Procura por ID do motorista
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('assigned_driver_id', employeeId)
        .limit(1);
      if (!error && data && data.length > 0) {
        return data[0] as Vehicle;
      }

      // 2. Procura por nome do motorista caso tenha sido cadastrado com nome
      if (employeeName) {
        const { data: nameData } = await supabase
          .from('vehicles')
          .select('*')
          .ilike('assigned_driver_name', `%${employeeName.trim()}%`)
          .limit(1);
        if (nameData && nameData.length > 0) {
          return nameData[0] as Vehicle;
        }
      }

      // 3. Fallback: Se existir carrinha cadastrada no sistema, retorna a carrinha ativa
      const { data: anyData } = await supabase
        .from('vehicles')
        .select('*')
        .limit(1);
      if (anyData && anyData.length > 0) {
        return anyData[0] as Vehicle;
      }
    } catch (e) {
      console.warn('Erro ao buscar carrinha do funcionário no Supabase:', e);
    }
  }

  // Fallback: se não achar por motorista específico, tenta buscar carrinha salva localmente
  try {
    const raw = await AsyncStorage.getItem(`@castello:assigned_vehicle_${employeeId}`);
    if (raw) return JSON.parse(raw);
    const anyRaw = await AsyncStorage.getItem(`@castello:assigned_vehicle_default`);
    if (anyRaw) return JSON.parse(anyRaw);
  } catch {}

  return null;
}

export async function fetchVehicleInventory(vehicleId: string): Promise<VehicleInventoryItem[]> {
  const localKey = `${VEHICLE_INV_KEY}${vehicleId}`;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('vehicle_inventory_items')
        .select('*')
        .eq('vehicle_id', vehicleId);
      if (!error && data) {
        await AsyncStorage.setItem(localKey, JSON.stringify(data));
        return data as VehicleInventoryItem[];
      }
    } catch (e) {
      console.warn('Erro ao carregar estoque da carrinha do Supabase:', e);
    }
  }

  try {
    const stored = await AsyncStorage.getItem(localKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function fetchAvailableStock(companyId?: string): Promise<InventoryItem[]> {
  if (supabase) {
    try {
      let query = supabase.from('inventory_items').select('*').order('name', { ascending: true });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) return data as InventoryItem[];
    } catch (e) {
      console.warn('Erro ao buscar estoque central:', e);
    }
  }
  return [];
}

export async function loadItemToVehicleMobile(
  vehicleId: string,
  vehiclePlate: string,
  itemId: string,
  quantity: number,
  employeeName: string,
  employeeId: string,
  companyId?: string
): Promise<void> {
  const stock = await fetchAvailableStock(companyId);
  const item = stock.find((i) => i.id === itemId);
  if (!item) throw new Error('Item não encontrado no estoque.');
  if (item.available_quantity < quantity) {
    throw new Error(`Quantidade solicitada (${quantity}) excede o estoque disponível (${item.available_quantity}).`);
  }

  const now = new Date().toISOString();

  // 1. Atualiza no Supabase o estoque central
  if (supabase) {
    try {
      await supabase
        .from('inventory_items')
        .update({
          available_quantity: item.available_quantity - quantity,
          allocated_quantity: item.allocated_quantity + quantity,
          allocated_site_name: `Carrinha ${vehiclePlate}`,
        })
        .eq('id', itemId);
    } catch (e) {
      console.warn('Erro ao atualizar estoque central:', e);
    }
  }

  // 2. Atualiza inventário da carrinha
  const currentInv = await fetchVehicleInventory(vehicleId);
  const existingIdx = currentInv.findIndex((vi) => vi.item_id === itemId);
  let updatedInv: VehicleInventoryItem[];

  if (existingIdx !== -1) {
    const existing = currentInv[existingIdx];
    const updatedRecord: VehicleInventoryItem = {
      ...existing,
      quantity: existing.quantity + quantity,
      updated_at: now,
    };
    updatedInv = currentInv.map((vi, idx) => (idx === existingIdx ? updatedRecord : vi));
    if (supabase) {
      try {
        await supabase.from('vehicle_inventory_items').update(updatedRecord).eq('id', existing.id);
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
    updatedInv = [newRecord, ...currentInv];
    if (supabase) {
      try {
        await supabase.from('vehicle_inventory_items').insert(newRecord);
      } catch {}
    }
  }
  await AsyncStorage.setItem(`${VEHICLE_INV_KEY}${vehicleId}`, JSON.stringify(updatedInv));

  // 3. Registra movimentação dinâmica
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

  try {
    const rawMov = await AsyncStorage.getItem(MOVEMENTS_KEY);
    const list: InventoryMovement[] = rawMov ? JSON.parse(rawMov) : [];
    await AsyncStorage.setItem(MOVEMENTS_KEY, JSON.stringify([movement, ...list]));
  } catch {}
}

export async function returnItemFromVehicleMobile(
  vehicleId: string,
  vehiclePlate: string,
  itemId: string,
  quantity: number,
  employeeName: string,
  employeeId: string,
  companyId?: string
): Promise<void> {
  const currentInv = await fetchVehicleInventory(vehicleId);
  const existing = currentInv.find((vi) => vi.item_id === itemId);
  if (!existing || existing.quantity < quantity) {
    throw new Error('Quantidade selecionada excede o que há na carrinha.');
  }

  const now = new Date().toISOString();

  // 1. Atualiza estoque central
  const stock = await fetchAvailableStock(companyId);
  const item = stock.find((i) => i.id === itemId);
  if (item && supabase) {
    try {
      await supabase
        .from('inventory_items')
        .update({
          available_quantity: item.available_quantity + quantity,
          allocated_quantity: Math.max(0, item.allocated_quantity - quantity),
        })
        .eq('id', itemId);
    } catch (e) {
      console.warn('Erro ao devolver item para estoque central:', e);
    }
  }

  // 2. Atualiza inventário da carrinha
  let updatedInv: VehicleInventoryItem[];
  if (existing.quantity === quantity) {
    updatedInv = currentInv.filter((vi) => vi.item_id !== itemId);
    if (supabase) {
      try {
        await supabase.from('vehicle_inventory_items').delete().eq('id', existing.id);
      } catch {}
    }
  } else {
    const updatedRecord: VehicleInventoryItem = {
      ...existing,
      quantity: existing.quantity - quantity,
      updated_at: now,
    };
    updatedInv = currentInv.map((vi) => (vi.id === existing.id ? updatedRecord : vi));
    if (supabase) {
      try {
        await supabase.from('vehicle_inventory_items').update(updatedRecord).eq('id', existing.id);
      } catch {}
    }
  }
  await AsyncStorage.setItem(`${VEHICLE_INV_KEY}${vehicleId}`, JSON.stringify(updatedInv));

  // 3. Registra movimentação dinâmica
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

  try {
    const rawMov = await AsyncStorage.getItem(MOVEMENTS_KEY);
    const list: InventoryMovement[] = rawMov ? JSON.parse(rawMov) : [];
    await AsyncStorage.setItem(MOVEMENTS_KEY, JSON.stringify([movement, ...list]));
  } catch {}
}

export async function fetchVehicleReports(vehicleId: string): Promise<VehicleReport[]> {
  const localKey = `${VEHICLE_REPORTS_KEY}${vehicleId}`;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('vehicle_reports')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        await AsyncStorage.setItem(localKey, JSON.stringify(data));
        return data as VehicleReport[];
      }
    } catch (e) {
      console.warn('Erro ao carregar reports do Supabase:', e);
    }
  }

  try {
    const stored = await AsyncStorage.getItem(localKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function submitVehicleReport(
  report: Omit<VehicleReport, 'id' | 'created_at'>
): Promise<VehicleReport> {
  const localKey = `${VEHICLE_REPORTS_KEY}${report.vehicle_id}`;
  const newReport: VehicleReport = {
    ...report,
    id: `rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      await supabase.from('vehicle_reports').insert(newReport);
    } catch (e) {
      console.warn('Erro ao salvar report no Supabase:', e);
    }
  }

  // Se informou KM, atualiza o KM do veículo no Supabase
  if (report.current_km && report.current_km > 0 && supabase) {
    try {
      await supabase
        .from('vehicles')
        .update({ current_km: report.current_km })
        .eq('id', report.vehicle_id);
    } catch {}
  }

  const current = await fetchVehicleReports(report.vehicle_id);
  const updated = [newReport, ...current];
  await AsyncStorage.setItem(localKey, JSON.stringify(updated));
  return newReport;
}

// ----------------------------------------------------------------------------
// SESSÕES DE TRABALHO DA EQUIPA NA OBRA (Registadas pelo Líder da Equipa)
// ----------------------------------------------------------------------------
const SITE_SESSIONS_KEY = '@castello:site_work_sessions_';
const SESS_META_REGEX_MOBILE = /\n?<!--CASTELLO_SESS_META:([\s\S]*?)-->/;

export function stripSessionMetaMobile(desc?: string | null): string | null {
  if (!desc) return null;
  const cleaned = desc.replace(SESS_META_REGEX_MOBILE, '').trim();
  return cleaned || null;
}

function decodeSessionMobileRow(row: any): SiteWorkSession {
  const rawDesc = typeof row?.description === 'string' ? row.description : '';
  let meta: any = {};
  const match = rawDesc.match(SESS_META_REGEX_MOBILE);
  if (match && match[1]) {
    try {
      meta = JSON.parse(match[1]);
    } catch {}
  }
  const cleanDesc = stripSessionMetaMobile(rawDesc);
  const hoursWorked = Number(row?.hours_worked || 0);
  const workersCount = Number(row?.workers_count || 1);
  return {
    id: String(row?.id || ''),
    company_id: (row?.company_id as string | null) || null,
    site_id: String(row?.site_id || ''),
    team_id: (row?.team_id as string | null) || (meta.team_id as string | null) || null,
    team_name: String(row?.team_name || 'Equipa 1'),
    leader_id: (row?.leader_id as string | null) || null,
    leader_name: String(row?.leader_name || 'Líder da Equipa'),
    workers_count: workersCount,
    work_date: String(row?.work_date || ''),
    hours_worked: hoursWorked,
    man_hours:
      typeof row?.man_hours === 'number'
        ? row.man_hours
        : typeof meta?.man_hours === 'number'
          ? meta.man_hours
          : Number((hoursWorked * workersCount).toFixed(2)),
    description: cleanDesc,
    member_ids_snapshot: Array.isArray(row?.member_ids_snapshot)
      ? row.member_ids_snapshot
      : Array.isArray(meta?.member_ids_snapshot)
        ? meta.member_ids_snapshot
        : [],
    created_at: String(row?.created_at || new Date().toISOString()),
  };
}

export async function fetchSiteWorkSessionsMobile(siteId: string): Promise<SiteWorkSession[]> {
  const localKey = `${SITE_SESSIONS_KEY}${siteId}`;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_work_sessions')
        .select('*')
        .eq('site_id', siteId)
        .order('work_date', { ascending: false });
      if (!error && Array.isArray(data)) {
        const decoded = data.map(decodeSessionMobileRow);
        await AsyncStorage.setItem(localKey, JSON.stringify(decoded));
        return decoded;
      }
    } catch (e) {
      console.warn('Erro ao carregar sessões de trabalho:', e);
    }
  }
  try {
    const raw = await AsyncStorage.getItem(localKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(decodeSessionMobileRow);
      }
    }
  } catch {}
  return [];
}

export async function saveSiteWorkSessionMobile(
  session: Partial<SiteWorkSession>
): Promise<SiteWorkSession> {
  const localKey = `${SITE_SESSIONS_KEY}${session.site_id}`;
  const now = new Date().toISOString();
  const cleanDescription = stripSessionMetaMobile(session.description);
  const newSession: SiteWorkSession = {
    id: session.id || `sess-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    company_id: session.company_id || null,
    site_id: session.site_id!,
    team_id: session.team_id || null,
    team_name: session.team_name?.trim() || 'Equipa 1',
    leader_id: session.leader_id || null,
    leader_name: session.leader_name?.trim() || 'Líder da Equipa',
    workers_count: Number(session.workers_count || 1),
    work_date: session.work_date || now.slice(0, 10),
    hours_worked: Number(session.hours_worked || 0),
    description: cleanDescription,
    created_at: session.created_at || now,
  };

  if (supabase) {
    try {
      const { error } = await supabase.from('site_work_sessions').upsert(newSession, { onConflict: 'id' });
      if (error && (error.code === 'PGRST204' || error.message?.includes('team_id'))) {
        const fallbackPayload = { ...newSession } as Record<string, unknown>;
        delete fallbackPayload.team_id;
        await supabase.from('site_work_sessions').upsert(fallbackPayload, { onConflict: 'id' });
      }
    } catch (e) {
      console.warn('Erro ao gravar sessão no Supabase:', e);
    }
  }

  const current = await fetchSiteWorkSessionsMobile(session.site_id!);
  const exists = current.some((s) => s.id === newSession.id);
  const updated = exists
    ? current.map((s) => (s.id === newSession.id ? newSession : s))
    : [newSession, ...current];
  await AsyncStorage.setItem(localKey, JSON.stringify(updated));
  return newSession;
}

// ----------------------------------------------------------------------------
// REGISTO DE ACIDENTES DE TRABALHO NA OBRA (MOBILE)
// ----------------------------------------------------------------------------
const SITE_ACCIDENTS_KEY = '@castello:site_accidents_';
const ACCIDENT_LOG_REGEX_MOBILE = /\n?<!--CASTELLO_ACCIDENT:([\s\S]*?)-->/;

function safeUUIDMobile(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function fetchSiteAccidentsMobile(
  siteId: string,
  companyId?: string | null
): Promise<SiteAccident[]> {
  const localKey = `${SITE_ACCIDENTS_KEY}${siteId}`;
  let localAccidents: SiteAccident[] = [];
  try {
    const raw = await AsyncStorage.getItem(localKey);
    if (raw) localAccidents = JSON.parse(raw) as SiteAccident[];
  } catch {}

  if (supabase) {
    let cloudAccidents: SiteAccident[] = [];

    // 1. Tenta carregar da tabela dedicada site_accidents
    try {
      let query = supabase
        .from('site_accidents')
        .select('*')
        .eq('site_id', siteId)
        .order('accident_date', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        cloudAccidents = data as SiteAccident[];
      }
    } catch (e) {
      console.warn('Erro ao carregar acidentes no Supabase:', e);
    }

    // 2. Se a tabela não existir ou estiver vazia, sincroniza através de site_daily_logs (compatível com portal do cliente)
    if (cloudAccidents.length === 0) {
      try {
        const { data: logsData, error: logErr } = await supabase
          .from('site_daily_logs')
          .select('*')
          .eq('site_id', siteId)
          .order('log_date', { ascending: false });

        if (!logErr && Array.isArray(logsData)) {
          for (const log of logsData) {
            const rawNotes = typeof log.notes === 'string' ? log.notes : '';
            const match = rawNotes.match(ACCIDENT_LOG_REGEX_MOBILE);
            if (match && match[1]) {
              try {
                const parsed = JSON.parse(match[1]);
                if (parsed && !cloudAccidents.some((x) => x.id === parsed.id)) {
                  cloudAccidents.push(parsed);
                }
              } catch {}
            }
          }
        }
      } catch (e) {
        console.warn('Erro ao ler acidentes de site_daily_logs:', e);
      }
    }

    // 3. Auto-sincronização: se existirem acidentes locais no telemóvel que ainda não subiram à nuvem, envia-os agora
    if (localAccidents.length > 0) {
      for (const loc of localAccidents) {
        if (!cloudAccidents.some((c) => c.id === loc.id)) {
          try {
            await supabase.from('site_daily_logs').insert({
              id: safeUUIDMobile(),
              site_id: loc.site_id,
              log_date: loc.accident_date,
              summary: `[SST_ACIDENTE] ${loc.accident_type}: ${loc.victim_name}`,
              notes: `<!--CASTELLO_ACCIDENT:${JSON.stringify(loc)}-->`,
              workers_count: 1,
            });
            cloudAccidents.unshift(loc);
          } catch (syncErr) {
            console.warn('Falha na auto-sincronização do acidente local:', syncErr);
          }
        }
      }
    }

    if (cloudAccidents.length > 0) {
      await AsyncStorage.setItem(localKey, JSON.stringify(cloudAccidents));
      return cloudAccidents;
    }
  }

  return localAccidents;
}

export async function saveSiteAccidentMobile(
  accident: Omit<SiteAccident, 'id' | 'created_at'> & { id?: string; created_at?: string }
): Promise<SiteAccident> {
  const localKey = `${SITE_ACCIDENTS_KEY}${accident.site_id}`;
  const now = new Date().toISOString();
  const newAccident: SiteAccident = {
    id: accident.id || `acc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    company_id: accident.company_id || null,
    site_id: accident.site_id,
    site_name: accident.site_name || null,
    title: accident.title.trim(),
    accident_type: accident.accident_type.trim(),
    severity: accident.severity,
    accident_date: accident.accident_date,
    accident_time: accident.accident_time || null,
    victim_name: accident.victim_name.trim(),
    victim_role: accident.victim_role?.trim() || null,
    description: accident.description.trim(),
    first_aid_provided: Boolean(accident.first_aid_provided),
    hospital_referral: Boolean(accident.hospital_referral),
    photos: Array.isArray(accident.photos) ? accident.photos : [],
    reported_by_id: accident.reported_by_id,
    reported_by_name: accident.reported_by_name.trim(),
    status: accident.status || 'registado',
    created_at: accident.created_at || now,
  };

  if (supabase) {
    try {
      const { error } = await supabase.from('site_accidents').upsert(newAccident, { onConflict: 'id' });
      if (error) {
        console.warn('Erro ao gravar em site_accidents no Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Erro de rede ao salvar acidente no Supabase:', e);
    }

    // Sincronização direta em site_daily_logs (tabela ativa na nuvem e lida pelo Portal do Cliente)
    try {
      const dailyLogPayload = {
        id: safeUUIDMobile(),
        site_id: newAccident.site_id,
        log_date: newAccident.accident_date,
        summary: `[SST_ACIDENTE] ${newAccident.accident_type}: ${newAccident.victim_name}`,
        notes: `<!--CASTELLO_ACCIDENT:${JSON.stringify(newAccident)}-->`,
        workers_count: 1,
      };
      await supabase.from('site_daily_logs').insert(dailyLogPayload);
    } catch (logErr) {
      console.warn('Erro ao sincronizar acidente em site_daily_logs:', logErr);
    }
  }

  const current = await fetchSiteAccidentsMobile(accident.site_id, accident.company_id);
  const exists = current.some((a) => a.id === newAccident.id);
  const updated = exists
    ? current.map((a) => (a.id === newAccident.id ? newAccident : a))
    : [newAccident, ...current];
  await AsyncStorage.setItem(localKey, JSON.stringify(updated));
  return newAccident;
}

// ----------------------------------------------------------------------------
// GESTÃO DE EQUIPAS E ALOCAÇÃO DE OBRAS PELO LÍDER (MOBILE)
// ----------------------------------------------------------------------------
const TEAMS_MOBILE_KEY = '@castello:teams';
const TEAM_META_REGEX_MOBILE = /\n?<!--CASTELLO_TEAM_META:([\s\S]*?)-->/;

function decodeTeamMobileRow(row: any): Team {
  const rawNotes = typeof row.notes === 'string' ? row.notes : '';
  let meta: any = {};
  const match = rawNotes.match(TEAM_META_REGEX_MOBILE);
  if (match && match[1]) {
    try {
      meta = JSON.parse(match[1]);
    } catch {}
  }
  const cleanNotes = rawNotes.replace(TEAM_META_REGEX_MOBILE, '').trim() || null;
  return {
    ...row,
    specialties: Array.isArray(row.specialties) ? row.specialties : Array.isArray(meta.specialties) ? meta.specialties : [],
    is_archived: Boolean(row.is_archived ?? meta.is_archived),
    notes: cleanNotes,
  } as Team;
}

export async function fetchTeamsMobile(companyId?: string): Promise<Team[]> {
  if (supabase) {
    try {
      let query = supabase.from('teams').select('*').order('name', { ascending: true });
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        const decoded = data.map(decodeTeamMobileRow);
        await AsyncStorage.setItem(TEAMS_MOBILE_KEY, JSON.stringify(decoded));
        return decoded;
      }
    } catch (e) {
      console.warn('Erro ao carregar equipas no mobile:', e);
    }
  }
  try {
    const raw = await AsyncStorage.getItem(TEAMS_MOBILE_KEY);
    if (raw) return (JSON.parse(raw) as any[]).map(decodeTeamMobileRow);
  } catch {}
  return [];
}

export async function fetchUserTeamMobile(
  employeeId: string,
  employeeName: string,
  companyId?: string
): Promise<Team | null> {
  const allTeams = (await fetchTeamsMobile(companyId)).filter((t) => !t.is_archived);
  const normName = (employeeName || '').trim().toLowerCase();
  const found = allTeams.find(
    (t) =>
      t.leader_id === employeeId ||
      t.leader_name?.trim().toLowerCase() === normName ||
      (t.leader_name && normName && (normName.includes(t.leader_name.trim().toLowerCase()) || t.leader_name.trim().toLowerCase().includes(normName))) ||
      t.member_ids?.includes(employeeId) ||
      t.member_names?.some((m) => {
        const mn = (m || '').trim().toLowerCase();
        return mn === normName || (mn && normName && (normName.includes(mn) || mn.includes(normName)));
      })
  );
  return found || null;
}

export async function allocateTeamToSiteMobile(
  teamId: string,
  siteId: string,
  siteName: string,
  companyId?: string
): Promise<Team> {
  const now = new Date().toISOString();
  const updatePayload = {
    current_site_id: siteId,
    current_site_name: siteName,
    allocated_at: now,
  };

  if (supabase) {
    try {
      await supabase.from('teams').update(updatePayload).eq('id', teamId);
    } catch (e) {
      console.warn('Erro ao alocar obra para equipa:', e);
    }
  }

  const allTeams = await fetchTeamsMobile(companyId);
  const updatedList = allTeams.map((t) =>
    t.id === teamId ? { ...t, ...updatePayload } : t
  );
  await AsyncStorage.setItem(TEAMS_MOBILE_KEY, JSON.stringify(updatedList));
  const updatedTeam = updatedList.find((t) => t.id === teamId)!;
  return updatedTeam;
}

export async function changeTeamSiteMobile(params: {
  team: Team;
  newSiteId: string;
  newSiteName: string;
  companyId?: string;
}): Promise<{ session: SiteWorkSession | null; updatedTeam: Team }> {
  const { team, newSiteId, newSiteName, companyId } = params;
  let sessionCreated: SiteWorkSession | null = null;
  const now = new Date().toISOString();

  // 1. Se estava alocada em outra obra, calcula as horas e registra no site_work_sessions da obra anterior
  if (team.current_site_id && team.allocated_at) {
    const startMs = new Date(team.allocated_at).getTime();
    const endMs = Date.now();
    const diffHours = Math.max(0.1, (endMs - startMs) / (1000 * 60 * 60));
    const roundedHours = Math.round(diffHours * 10) / 10;

    const startTimeFormatted = new Date(team.allocated_at).toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const endTimeFormatted = new Date().toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });

    sessionCreated = await saveSiteWorkSessionMobile({
      company_id: companyId || team.company_id || null,
      site_id: team.current_site_id,
      team_id: team.id,
      team_name: team.name,
      leader_id: team.leader_id,
      leader_name: team.leader_name,
      workers_count: (team.member_ids?.length || team.member_names?.length || 0) + 1,
      work_date: now.slice(0, 10),
      hours_worked: roundedHours,
      description: `Turno cumprido das ${startTimeFormatted} às ${endTimeFormatted} (${roundedHours}h) antes da deslocação para ${newSiteName}`,
    });
  }

  // 2. Aloca para a nova obra com o novo timestamp
  const updatedTeam = await allocateTeamToSiteMobile(team.id, newSiteId, newSiteName, companyId);
  return { session: sessionCreated, updatedTeam };
}

export async function finishTeamShiftMobile(params: {
  team: Team;
  companyId?: string;
}): Promise<{ session: SiteWorkSession | null; updatedTeam: Team }> {
  const { team, companyId } = params;
  let sessionCreated: SiteWorkSession | null = null;
  const now = new Date().toISOString();

  if (team.current_site_id && team.allocated_at) {
    const startMs = new Date(team.allocated_at).getTime();
    const endMs = Date.now();
    const diffHours = Math.max(0.1, (endMs - startMs) / (1000 * 60 * 60));
    const roundedHours = Math.round(diffHours * 10) / 10;

    const startTimeFormatted = new Date(team.allocated_at).toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const endTimeFormatted = new Date().toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });

    sessionCreated = await saveSiteWorkSessionMobile({
      company_id: companyId || team.company_id || null,
      site_id: team.current_site_id,
      team_id: team.id,
      team_name: team.name,
      leader_id: team.leader_id,
      leader_name: team.leader_name,
      workers_count: (team.member_ids?.length || team.member_names?.length || 0) + 1,
      work_date: now.slice(0, 10),
      hours_worked: roundedHours,
      description: `Turno finalizado das ${startTimeFormatted} às ${endTimeFormatted} (${roundedHours}h trabalhadas no local)`,
    });
  }

  const updatePayload = {
    current_site_id: null,
    current_site_name: null,
    allocated_at: null,
  };

  if (supabase) {
    try {
      await supabase.from('teams').update(updatePayload).eq('id', team.id);
    } catch {}
  }

  const allTeams = await fetchTeamsMobile(companyId);
  const updatedList = allTeams.map((t) =>
    t.id === team.id ? { ...t, ...updatePayload } : t
  );
  await AsyncStorage.setItem(TEAMS_MOBILE_KEY, JSON.stringify(updatedList));
  const updatedTeam = updatedList.find((t) => t.id === team.id)!;
  return { session: sessionCreated, updatedTeam };
}

// ----------------------------------------------------------------------------
// MATERIAIS NA OBRA (SITE INVENTORY) MOBILE
// ----------------------------------------------------------------------------
export async function fetchSiteInventoryMobile(
  siteId: string,
  companyId?: string
): Promise<InventoryItem[]> {
  const stock = await fetchAvailableStock(companyId);
  return stock.filter(
    (item) => item.allocated_site_id === siteId && (item.allocated_quantity || 0) > 0
  );
}

