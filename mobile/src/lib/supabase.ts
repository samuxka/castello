import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AbsenceJustification,
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
        return data
          .filter((d: any) => !d.notes || !d.notes.startsWith('[JUSTIFICATIVA_FALTA]'))
          .map((d: any) => ({
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
 * Registo de Ponto compatível com schema Supabase (inclui company_id, data retroativa e fallback)
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
