import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConstructionSite, EmployeeProfile, EntryType, TimeEntry } from '../types';
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
      },
    })
  : null;

const CURRENT_EMPLOYEE_ID_KEY = '@castello:current_employee_id_v4';
const BIOMETRIC_SAVED_CREDS_KEY = '@castello:biometric_saved_creds_v4';

export async function fetchSites(): Promise<ConstructionSite[]> {
  if (supabase) {
    try {
      const emp = await getActiveEmployee();
      let query = supabase.from('construction_sites').select('*').order('created_at', { ascending: false });
      if (emp && emp.company_id) {
        query = query.or(`company_id.eq.${emp.company_id},company_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) return data as ConstructionSite[];
    } catch (e) {
      console.warn('Erro ao carregar obras:', e);
    }
  }
  return [];
}

export async function fetchEmployees(): Promise<EmployeeProfile[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name', { ascending: true });
      if (!error && data) return data as EmployeeProfile[];
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
        return data as EmployeeProfile;
      }
    } catch (e) {
      console.warn('Erro ao autenticar no Supabase', e);
    }
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

export async function fetchEmployeeTimeEntries(employeeId: string): Promise<TimeEntry[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .order('recorded_at', { ascending: true });
      if (!error && data) {
        return data.map((d: any) => ({
          ...d,
          status: d.status || 'pendente',
        })) as TimeEntry[];
      }
    } catch (e) {
      console.warn('Erro ao buscar picagens:', e);
    }
  }
  return [];
}

/**
 * Registo de Ponto compatível com schema Supabase (inclui company_id e fallback)
 */
export async function registerTimeEntry(
  employeeId: string,
  siteId: string | null,
  entryType: EntryType
): Promise<TimeEntry> {
  const now = new Date();
  const workDate = getLocalDateString(now);
  const recordedAt = now.toISOString();

  let compId: string | null = null;
  const activeEmp = await getActiveEmployee();
  if (activeEmp) compId = activeEmp.company_id || null;

  if (supabase) {
    // 1. Tenta gravar com todos os campos (com status e company_id)
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
        })
        .select('*')
        .single();

      if (!error && data) {
        return {
          ...data,
          status: data.status || 'pendente',
        } as TimeEntry;
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
        return {
          ...data,
          status: 'pendente',
        } as TimeEntry;
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
  workerName: string
): Promise<void> {
  if (supabase) {
    try {
      await supabase
        .from('site_tasks')
        .update({
          status: 'concluida_funcionario',
          completed_by_name: workerName,
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId);
    } catch (e) {
      console.warn('Erro ao concluir tarefa:', e);
    }
  }
}
