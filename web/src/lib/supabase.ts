import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from './fetchWithTimeout';
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
  SiteAccident,
  Team,
  TeamAllocationRecord,
  TeamActivityEvent,
  TaskPriority,
  TaskExecutionStatus,
} from '../types';
import {
  constructionSiteSchema,
  employeeSchema,
  financialRecordSchema,
  inventoryItemSchema,
  loginSchema,
  registerSchema,
  siteTaskSchema,
  teamSchema,
  validateWithZod,
  vehicleSchema,
} from './validation';

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
      global: {
        fetch: (input, init) =>
          fetchWithTimeout(input, init, { timeoutMs: 12000, retries: 1 }),
      },
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
// CRIPTOGRAFIA DE SENHAS E PINS (SHA-256 + SALT — COMPATÍVEL WEB E MOBILE)
// ============================================================================
const HASH_PREFIX = 'sha256$';
const CREDENTIAL_SALT = 'castello_sec_salt_v1:';
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const SHA256_W = new Int32Array(64);

function sha256HexSync(asciiInput: string): string {
  const utf8 = unescape(encodeURIComponent(asciiInput));
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const msgLen = utf8.length;
  const wordCount = (((msgLen + 8) >> 6) + 1) << 4;
  const words = new Int32Array(wordCount);

  for (let i = 0; i < msgLen; i++) {
    words[i >> 2] |= utf8.charCodeAt(i) << (24 - (i % 4) * 8);
  }
  words[msgLen >> 2] |= 0x80 << (24 - (msgLen % 4) * 8);
  words[wordCount - 1] = msgLen * 8;

  for (let i = 0; i < wordCount; i += 16) {
    for (let t = 0; t < 16; t++) SHA256_W[t] = words[i + t];
    for (let t = 16; t < 64; t++) {
      const w15 = SHA256_W[t - 15];
      const w2 = SHA256_W[t - 2];
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      SHA256_W[t] = (SHA256_W[t - 16] + s0 + SHA256_W[t - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + SHA256_W[t]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

export function isHashedCredential(value?: string | null): boolean {
  return Boolean(value && value.startsWith(HASH_PREFIX) && value.length === HASH_PREFIX.length + 64);
}

export function hashCredential(plainText: string): string {
  const clean = (plainText || '').trim();
  if (isHashedCredential(clean)) return clean;
  return `${HASH_PREFIX}${sha256HexSync(`${CREDENTIAL_SALT}${clean}`)}`;
}

// Recupera automaticamente qualquer PIN de funcionário que tenha sido convertido para sha256$
function recoverHashedEmployeePins(employees: EmployeeProfile[]): EmployeeProfile[] {
  const hashedTargets = new Set<string>();
  for (const emp of employees) {
    if (isHashedCredential(emp.access_code)) {
      hashedTargets.add(emp.access_code);
    }
  }
  if (hashedTargets.size === 0) return employees;

  const resolved = new Map<string, string>();
  const tryCandidate = (pin: string) => {
    const h = `${HASH_PREFIX}${sha256HexSync(`${CREDENTIAL_SALT}${pin}`)}`;
    if (hashedTargets.has(h) && !resolved.has(h)) {
      resolved.set(h, pin);
    }
  };

  // Testa PINs comuns de 4 dígitos (0000-9999) e 6 dígitos (000000-999999)
  for (let i = 0; i <= 9999 && resolved.size < hashedTargets.size; i++) {
    tryCandidate(String(i));
    tryCandidate(String(i).padStart(4, '0'));
  }
  for (let i = 0; i <= 999999 && resolved.size < hashedTargets.size; i++) {
    tryCandidate(String(i).padStart(6, '0'));
  }

  return employees.map((emp) => {
    if (isHashedCredential(emp.access_code)) {
      const recovered = resolved.get(emp.access_code) || '123456';
      if (supabase) {
        supabase.from('profiles').update({ access_code: recovered }).eq('id', emp.id).then(() => {});
      }
      return { ...emp, access_code: recovered };
    }
    return emp;
  });
}

// ============================================================================
// SESSÃO DA FIRMA / PATRÃO
// ============================================================================
export function getActiveCompanySession(): Company | null {
  const raw = localStorage.getItem(CURRENT_COMPANY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Company;
    // Se a sessão ativa ainda tinha password_hash em texto simples, migra silenciosamente no Supabase
    if (parsed && parsed.id && parsed.password_hash && !isHashedCredential(parsed.password_hash)) {
      const hashed = hashCredential(parsed.password_hash);
      parsed.password_hash = hashed;
      localStorage.setItem(CURRENT_COMPANY_KEY, JSON.stringify(parsed));
      if (supabase) {
        supabase.from('companies').update({ password_hash: hashed }).eq('id', parsed.id).then(() => {});
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

// ============================================================================
// PROJEÇÕES EXPLÍCITAS DE COLUNAS (EVITA SELECT * E TRAFEGO DESNECESSÁRIO)
// ============================================================================
const COMPANY_SAFE_COLS =
  'id, name, tax_id, owner_email, phone, logo_url, theme_color, theme_mode, created_at';
const SITES_COLS =
  'id, company_id, name, share_code, address, manager_name, manager_id, status, budget, description, client_name, client_phone, start_date, expected_end_date, created_at';
const PROFILES_COLS =
  'id, company_id, full_name, email, access_code, role, job_title, phone, hourly_rate, monthly_target_hours, avatar_url, admission_date, is_active, created_at';
const TIME_ENTRIES_COLS =
  'id, company_id, employee_id, site_id, entry_type, status, validated_at, validation_notes, recorded_at, work_date, notes, created_at';
const DAILY_LOGS_COLS =
  'id, site_id, log_date, summary, weather, workers_count, notes, created_at';
const WORK_SESSIONS_COLS =
  'id, company_id, site_id, team_name, leader_id, leader_name, workers_count, work_date, hours_worked, description, created_at';
const INVENTORY_COLS =
  'id, company_id, name, category, serial_number, total_quantity, allocated_quantity, available_quantity, allocated_site_id, allocated_site_name, condition, unit_price, supplier, location, photo_url, notes, created_at, updated_at';
const VEHICLES_COLS =
  'id, company_id, license_plate, brand, model, year, vehicle_type, current_km, assigned_driver_id, assigned_driver_name, assigned_site_id, assigned_site_name, next_inspection_date, next_maintenance_km, insurance_expiry_date, status, fuel_type, photo_url, notes, last_oil_change_date, last_oil_change_km, next_oil_change_km, last_tire_change_date, last_tire_change_km, next_tire_change_km, last_brakes_check_date, next_brakes_check_km, created_at, updated_at';
const TEAMS_COLS =
  'id, company_id, name, leader_id, leader_name, leader_phone, member_ids, member_names, current_site_id, current_site_name, allocated_at, notes, created_at';

// ============================================================================
// CACHE INTELIGENTE EM MEMÓRIA & DEDUPLICAÇÃO DE REQUISIÇÕES (SRE / PERFORMANCE)
// ============================================================================
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

export function getCached<T>(key: string, ttlMs = 30000): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    memoryCache.clear();
    return;
  }
  for (const k of memoryCache.keys()) {
    if (k.startsWith(keyPrefix)) {
      memoryCache.delete(k);
    }
  }
}

export async function fetchWithDedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }
  const promise = fetcher().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

export function setActiveCompanySession(company: Company | null) {
  invalidateCache(); // Limpa cache imediatamente na troca de sessão/logout (isolamento multi-tenant)
  if (company) {
    localStorage.setItem(CURRENT_COMPANY_KEY, JSON.stringify(company));
  } else {
    localStorage.removeItem(CURRENT_COMPANY_KEY);
  }
}

// ----------------------------------------------------------------------------
// SINCRONIZAÇÃO EM NUVEM DE CONFIGURAÇÕES DA FIRMA (LOGO, CORES E TEMA)
// Garante persistência imediata entre todos os dispositivos, computadores e navegadores
// ----------------------------------------------------------------------------
export async function saveCompanyCloudSettings(
  companyId: string,
  settings: { logo_url?: string | null; theme_color?: ThemeColor | null; theme_mode?: ThemeMode | null }
): Promise<void> {
  if (!supabase || !companyId) return;
  try {
    const payload = {
      id: `settings_${companyId}`,
      company_id: companyId,
      title: '__CASTELLO_COMPANY_SETTINGS__',
      content: JSON.stringify({
        logo_url: settings.logo_url ?? null,
        theme_color: settings.theme_color ?? 'azul',
        theme_mode: settings.theme_mode ?? 'dark',
        updated_at: new Date().toISOString(),
      }),
    };
    await supabase.from('company_notifications').upsert(payload, { onConflict: 'id' });
  } catch (e) {
    console.warn('Erro ao sincronizar configurações da firma na nuvem:', e);
  }
}

export async function fetchCompanyCloudSettings(
  companyId: string
): Promise<{ logo_url?: string | null; theme_color?: ThemeColor | null; theme_mode?: ThemeMode | null } | null> {
  if (!supabase || !companyId) return null;
  try {
    const { data, error } = await supabase
      .from('company_notifications')
      .select('content')
      .eq('id', `settings_${companyId}`)
      .maybeSingle();

    if (!error && data?.content) {
      try {
        const parsed = JSON.parse(data.content);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch {}
    }
  } catch (e) {
    console.warn('Erro ao obter configurações da nuvem da firma:', e);
  }
  return null;
}

export async function registerCompany(
  name: string,
  ownerEmail: string,
  password: string,
  phone?: string,
  taxId?: string
): Promise<Company> {
  const validation = validateWithZod(registerSchema, {
    companyName: name,
    email: ownerEmail,
    password,
    phone,
    taxId,
  });
  if (!validation.success) {
    throw new Error(validation.error);
  }

  const cleanEmail = ownerEmail.trim().toLowerCase();
  const hashedPassword = hashCredential(password);

  if (supabase) {
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_email', cleanEmail)
      .maybeSingle();

    if (existing) {
      throw new Error('Já existe uma firma registada com este e-mail.');
    }

    // Dispara o registo com envio do e-mail de verificação oficial pelo Supabase Auth
    const redirectUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/?verified=true`
        : undefined;

    // Gera e armazena token numérico de contingência
    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    try {
      localStorage.setItem(`castello_otp_${cleanEmail}`, generatedOtp);
    } catch {}

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          company_name: name.trim(),
          phone: phone?.trim() || null,
          tax_id: taxId?.trim() || null,
        },
        emailRedirectTo: redirectUrl,
      },
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered')) {
        throw new Error('Já existe uma conta registada com este e-mail no sistema.');
      }
      console.warn('Aviso no supabase.auth.signUp:', authError.message);
    }

    const { data, error } = await supabase
      .from('companies')
      .insert({
        name: name.trim(),
        owner_email: cleanEmail,
        password_hash: hashedPassword,
        phone: phone?.trim() || null,
        tax_id: taxId?.trim() || null,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Falha ao criar firma.');
    }

    // Carrega configurações da nuvem (logo_url, theme_color, theme_mode)
    const cloudSettings = await fetchCompanyCloudSettings(data.id);
    if (cloudSettings) {
      if (cloudSettings.logo_url && !data.logo_url) data.logo_url = cloudSettings.logo_url;
      if (cloudSettings.theme_color && !data.theme_color) data.theme_color = cloudSettings.theme_color;
      if (cloudSettings.theme_mode && !data.theme_mode) data.theme_mode = cloudSettings.theme_mode;
    }

    if (data.theme_color || data.theme_mode) {
      saveTheme((data.theme_color as ThemeColor) || 'azul', (data.theme_mode as ThemeMode) || 'dark');
    }

    return data as Company;
  }

  const mockCompany: Company = {
    id: crypto.randomUUID(),
    name,
    owner_email: cleanEmail,
    password_hash: hashedPassword,
    phone,
    tax_id: taxId,
  };
  try {
    localStorage.setItem(`castello_otp_${cleanEmail}`, '123456');
  } catch {}
  return mockCompany;
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
  try {
    localStorage.setItem(`castello_otp_${cleanEmail}`, generatedOtp);
  } catch {}

  if (supabase) {
    try {
      const redirectUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/?verified=true`
          : undefined;

      await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });
    } catch (e: any) {
      console.warn('Aviso no resend do Supabase:', e?.message || e);
    }
  }
}

export async function verifyRegistrationCode(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim().replace(/\D/g, '');

  if (cleanCode.length !== 6) {
    return {
      success: false,
      error: 'O código de verificação deve conter exatamente 6 dígitos numéricos.',
    };
  }

  // 1. Tenta validar via Supabase Auth OTP oficial
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'signup',
      });

      if (!error && data?.user) {
        try {
          localStorage.setItem(`castello_verified_${cleanEmail}`, 'true');
          localStorage.removeItem(`castello_otp_${cleanEmail}`);
        } catch {}

        return { success: true };
      }

      // Tenta também com type: 'email'
      const retry = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'email',
      });

      if (!retry.error && retry.data?.user) {
        try {
          localStorage.setItem(`castello_verified_${cleanEmail}`, 'true');
          localStorage.removeItem(`castello_otp_${cleanEmail}`);
        } catch {}

        return { success: true };
      }
    } catch (err) {
      console.warn('Aviso no Supabase verifyOtp:', err);
    }
  }

  // 2. Validação via token local de contingência
  try {
    const localOtp = localStorage.getItem(`castello_otp_${cleanEmail}`);
    if (localOtp && localOtp === cleanCode) {
      localStorage.setItem(`castello_verified_${cleanEmail}`, 'true');
      localStorage.removeItem(`castello_otp_${cleanEmail}`);
      return { success: true };
    }
  } catch {}

  return {
    success: false,
    error: 'Código incorreto ou expirado. Verifique os 6 dígitos recebidos no seu e-mail e tente novamente.',
  };
}

export async function checkEmailVerificationStatus(email: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    if (localStorage.getItem(`castello_verified_${cleanEmail}`) === 'true') {
      return true;
    }
  } catch {}

  if (!supabase) return false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && session.user.email?.toLowerCase() === cleanEmail) {
      return !!session.user.email_confirmed_at;
    }
  } catch (e) {
    console.warn('Erro ao verificar status de e-mail:', e);
  }
  return false;
}

export async function getCompanyByEmail(email: string): Promise<Company | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('companies')
      .select(COMPANY_SAFE_COLS)
      .eq('owner_email', email.trim().toLowerCase())
      .maybeSingle();
    return (data as unknown as Company) || null;
  } catch {
    return null;
  }
}

export async function loginCompany(
  ownerEmail: string,
  password: string
): Promise<Company> {
  const validation = validateWithZod(loginSchema, {
    email: ownerEmail,
    password,
  });
  if (!validation.success) {
    throw new Error(validation.error);
  }

  const cleanEmail = ownerEmail.trim().toLowerCase();
  const hashedInput = hashCredential(password);

  if (supabase) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_email', cleanEmail)
      .maybeSingle();

    if (error || !data) {
      throw new Error('E-mail ou senha da firma incorretos.');
    }

    const storedHash = String(data.password_hash || '');
    const isMatch = storedHash === hashedInput || storedHash === password.trim();

    if (!isMatch) {
      throw new Error('E-mail ou senha da firma incorretos.');
    }

    // Se ainda estava em texto simples na base de dados, criptografa automaticamente agora
    if (!isHashedCredential(storedHash)) {
      await supabase
        .from('companies')
        .update({ password_hash: hashedInput })
        .eq('id', data.id);
      data.password_hash = hashedInput;
    }

    // Carrega configurações da nuvem (logo_url, theme_color, theme_mode)
    const cloudSettings = await fetchCompanyCloudSettings(data.id);
    if (cloudSettings) {
      if (cloudSettings.logo_url && !data.logo_url) data.logo_url = cloudSettings.logo_url;
      if (cloudSettings.theme_color && !data.theme_color) data.theme_color = cloudSettings.theme_color;
      if (cloudSettings.theme_mode && !data.theme_mode) data.theme_mode = cloudSettings.theme_mode;
    }

    if (data.theme_color || data.theme_mode) {
      saveTheme((data.theme_color as ThemeColor) || 'azul', (data.theme_mode as ThemeMode) || 'dark');
    }

    setActiveCompanySession(data as Company);
    return data as Company;
  }
  throw new Error('Serviço indisponível.');
}

export async function loginWithGoogle(): Promise<void> {
  if (!supabase) {
    throw new Error('Serviço de autenticação não configurado.');
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) {
    throw new Error(error.message || 'Falha ao autenticar com o Google.');
  }
}

export async function handleGoogleAuthRedirect(): Promise<Company | null> {
  if (!supabase) return null;
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session || !session.user) {
      return null;
    }
    const user = session.user;
    const userEmail = user.email;
    if (!userEmail) return null;

    // Procura se já existe uma firma associada a este e-mail
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('admin_email', userEmail.toLowerCase().trim())
      .maybeSingle();

    if (existingCompany) {
      setActiveCompanySession(existingCompany as Company);
      return existingCompany as Company;
    }

    // Se é a primeira vez que entra via Google, regista a firma automaticamente
    const companyName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      userEmail.split('@')[0] ||
      'Firma Castello';

    const newCompanyId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'comp_' + Math.random().toString(36).substring(2, 11);

    const newCompany: any = {
      id: newCompanyId,
      name: companyName,
      admin_email: userEmail.toLowerCase().trim(),
      password_hash: hashCredential(newCompanyId),
      phone: user.phone || '',
      created_at: new Date().toISOString(),
    };

    const { data: created, error: insertError } = await supabase
      .from('companies')
      .insert([newCompany])
      .select('*')
      .maybeSingle();

    if (insertError) {
      console.warn('Erro ao registar firma via Google:', insertError);
      return null;
    }

    if (created) {
      setActiveCompanySession(created as Company);
      return created as Company;
    }
  } catch (err) {
    console.warn('Erro ao processar sessão Google:', err);
  }
  return null;
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
      if (updates.theme_color !== undefined) payload.theme_color = updates.theme_color;
      if (updates.theme_mode !== undefined) payload.theme_mode = updates.theme_mode;
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
      }

      // Persiste também no registro de configurações da nuvem (garante persistência para todos os dispositivos)
      await saveCompanyCloudSettings(companyId, {
        logo_url: merged.logo_url,
        theme_color: merged.theme_color,
        theme_mode: merged.theme_mode,
      });

      if (data) {
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
  const hashedCurrent = hashCredential(currentPassword);
  const hashedNew = hashCredential(newPassword);

  if (
    current &&
    current.password_hash !== hashedCurrent &&
    current.password_hash !== currentPassword.trim()
  ) {
    throw new Error('A senha atual fornecida está incorreta.');
  }

  if (supabase) {
    const { error } = await supabase
      .from('companies')
      .update({ password_hash: hashedNew })
      .eq('id', companyId);

    if (error) {
      throw new Error('Falha ao atualizar senha: ' + error.message);
    }
  }

  if (current) {
    current.password_hash = hashedNew;
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

export async function getSites(companyId?: string, forceRefresh = false): Promise<ConstructionSite[]> {
  const cacheKey = `sites_${companyId || 'all'}`;
  if (!forceRefresh) {
    const cached = getCached<ConstructionSite[]>(cacheKey, 30000);
    if (cached) return cached;
  }

  return fetchWithDedupe(cacheKey, async () => {
    if (supabase) {
      try {
        let query = supabase
          .from('construction_sites')
          .select(SITES_COLS)
          .order('created_at', { ascending: false });
        if (companyId) {
          query = query.or(`company_id.eq.${companyId},company_id.is.null`);
        }
        const { data, error } = await query;
        if (!error && data) {
          const localDates = getLocalSiteDates();
          const mapped = (data as unknown as ConstructionSite[]).map((s) => ({
            ...s,
            start_date: s.start_date || localDates[s.id]?.start_date || null,
            expected_end_date: s.expected_end_date || localDates[s.id]?.expected_end_date || null,
          }));
          setCached(cacheKey, mapped);
          return mapped;
        }
      } catch (e) {
        console.warn('Erro ao carregar obras:', e);
      }
    }
    return [];
  });
}

export async function getSiteByShareCode(shareCode: string): Promise<ConstructionSite | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('construction_sites')
        .select(SITES_COLS)
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
        .select(COMPANY_SAFE_COLS)
        .eq('id', companyId)
        .maybeSingle();
      if (!error && data) {
        const comp = data as unknown as Company;
        const cloudSettings = await fetchCompanyCloudSettings(companyId);
        if (cloudSettings) {
          if (cloudSettings.logo_url && !comp.logo_url) comp.logo_url = cloudSettings.logo_url;
          if (cloudSettings.theme_color && !comp.theme_color) comp.theme_color = cloudSettings.theme_color;
          if (cloudSettings.theme_mode && !comp.theme_mode) comp.theme_mode = cloudSettings.theme_mode;
        }
        const currentSession = getActiveCompanySession();
        if (currentSession && currentSession.id === comp.id) {
          setActiveCompanySession(comp);
        }
        if (comp.theme_color) {
          localStorage.setItem(THEME_COLOR_KEY, comp.theme_color);
        }
        if (comp.theme_mode) {
          localStorage.setItem(THEME_MODE_KEY, comp.theme_mode);
        }
        return comp;
      }
    } catch (e) {
      console.warn('Erro ao buscar dados da firma:', e);
    }
  }
  const session = getActiveCompanySession();
  if (session && session.id === companyId) return session;
  return null;
}

// ----------------------------------------------------------------------------
// SESSÕES DE TRABALHO DAS EQUIPAS NA OBRA (Para controle de horas do cliente e equipa)
// ----------------------------------------------------------------------------
const getWorkSessionsStorageKey = (siteId: string) => `castello_site_work_sessions_${siteId}`;
const SESS_META_REGEX = /\n?<!--CASTELLO_SESS_META:([\s\S]*?)-->/;

function stripSessionMeta(desc?: string | null): string | null {
  if (!desc) return null;
  const cleaned = desc.replace(SESS_META_REGEX, '').trim();
  return cleaned || null;
}

function encodeSessionDescription(sess: SiteWorkSession): string | null {
  const cleanDesc = stripSessionMeta(sess.description) || '';
  const meta = {
    team_id: sess.team_id || null,
    man_hours: typeof sess.man_hours === 'number' ? sess.man_hours : null,
    member_ids_snapshot: Array.isArray(sess.member_ids_snapshot) ? sess.member_ids_snapshot : [],
    status: sess.status || 'aprovado',
    validated_at: sess.validated_at || null,
    validation_notes: sess.validation_notes || null,
  };
  return `${cleanDesc}\n<!--CASTELLO_SESS_META:${JSON.stringify(meta)}-->`;
}

function decodeSessionRow(row: Record<string, unknown>): SiteWorkSession {
  const rawDesc = typeof row.description === 'string' ? row.description : '';
  let meta: Record<string, unknown> = {};
  const match = rawDesc.match(SESS_META_REGEX);
  if (match && match[1]) {
    try {
      meta = JSON.parse(match[1]);
    } catch (err) {
      console.warn('Falha ao decodificar metadados de sessão:', err);
    }
  }
  const cleanDesc = stripSessionMeta(rawDesc);
  const hoursWorked = Number(row.hours_worked || 0);
  const workersCount = Number(row.workers_count || 1);
  const status = (meta.status as 'pendente' | 'aprovado' | 'rejeitado') || (row.status as string) || 'aprovado';
  return {
    id: String(row.id || ''),
    company_id: (row.company_id as string | null) || null,
    site_id: String(row.site_id || ''),
    team_id: (row.team_id as string | null) || (meta.team_id as string | null) || null,
    team_name: String(row.team_name || 'Equipa'),
    leader_id: (row.leader_id as string | null) || null,
    leader_name: String(row.leader_name || 'Líder'),
    workers_count: workersCount,
    work_date: String(row.work_date || ''),
    hours_worked: hoursWorked,
    man_hours:
      typeof row.man_hours === 'number'
        ? row.man_hours
        : typeof meta.man_hours === 'number'
        ? meta.man_hours
        : Math.round(hoursWorked * workersCount * 10) / 10,
    member_ids_snapshot: Array.isArray(row.member_ids_snapshot)
      ? (row.member_ids_snapshot as string[])
      : Array.isArray(meta.member_ids_snapshot)
      ? (meta.member_ids_snapshot as string[])
      : [],
    status: status as 'pendente' | 'aprovado' | 'rejeitado',
    validated_at: (meta.validated_at as string | null) || null,
    validation_notes: (meta.validation_notes as string | null) || null,
    description: cleanDesc,
    created_at: (row.created_at as string | undefined) || undefined,
  };
}

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
        const decoded = (data as Record<string, unknown>[]).map(decodeSessionRow);
        localStorage.setItem(localKey, JSON.stringify(decoded));
        return decoded;
      }
    } catch (e) {
      console.warn('Erro ao carregar sessões de trabalho da obra:', e);
    }
  }
  const stored = localStorage.getItem(localKey);
  if (stored) {
    try {
      return (JSON.parse(stored) as Record<string, unknown>[]).map(decodeSessionRow);
    } catch (err) {
      console.warn('Erro ao ler sessões locais:', err);
    }
  }
  return [];
}

/**
 * Consulta otimizada e direta de sessões de uma equipa com paginação e migração segura de team_id
 */
export async function getTeamWorkSessions(params: {
  team: Team;
  allTeams?: Team[];
  companyId?: string;
  siteIds?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ sessions: SiteWorkSession[]; totalCount: number }> {
  const { team, allTeams = [], companyId, siteIds = [], page = 1, pageSize = 200 } = params;
  let candidateRows: SiteWorkSession[] = [];

  // Verifica se o nome da equipa e o líder são exclusivos (não ambíguos) para migração segura de dados antigos
  const normTeamName = (team.name || '').trim().toLowerCase();
  const sameNameTeamsCount = allTeams.filter(
    (t) => (t.name || '').trim().toLowerCase() === normTeamName
  ).length;
  const isNameUnambiguous = sameNameTeamsCount <= 1;

  const sameLeaderTeamsCount = team.leader_id
    ? allTeams.filter((t) => t.leader_id === team.leader_id).length
    : 0;
  const isLeaderUnambiguous = Boolean(team.leader_id && sameLeaderTeamsCount === 1);

  if (supabase) {
    try {
      const fromIdx = Math.max(0, (page - 1) * pageSize);
      const toIdx = fromIdx + pageSize - 1;
      let query = supabase
        .from('site_work_sessions')
        .select(WORK_SESSIONS_COLS)
        .order('work_date', { ascending: false })
        .range(fromIdx, toIdx);

      if (companyId && siteIds.length > 0) {
        query = query.or(`company_id.eq.${companyId},site_id.in.(${siteIds.join(',')})`);
      } else if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      } else if (siteIds.length > 0) {
        query = query.in('site_id', siteIds);
      }

      const { data, error } = await query;
      if (!error && data) {
        candidateRows = (data as Record<string, unknown>[]).map(decodeSessionRow);
      }
    } catch (e) {
      console.warn('Erro ao consultar sessões da equipa no Supabase:', e);
    }
  }

  // Mescla com caches locais das obras para garantir zero perda offline
  const seenIds = new Set(candidateRows.map((r) => r.id));
  for (const sId of siteIds) {
    try {
      const raw = localStorage.getItem(getWorkSessionsStorageKey(sId));
      if (raw) {
        const localList = (JSON.parse(raw) as Record<string, unknown>[]).map(decodeSessionRow);
        for (const item of localList) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            candidateRows.push(item);
          }
        }
      }
    } catch (err) {
      console.warn('Aviso ao mesclar cache local de sessões:', err);
    }
  }

  const matchedSessions: SiteWorkSession[] = [];
  for (const sess of candidateRows) {
    // 1. Associação permanente direta por team_id
    if (sess.team_id) {
      if (sess.team_id === team.id) {
        matchedSessions.push(sess);
      }
      continue;
    }

    // 2. Migração segura para registos antigos sem team_id (apenas quando não houver ambiguidade)
    const sessNormName = (sess.team_name || '').trim().toLowerCase();
    const matchesUniqueName = isNameUnambiguous && sessNormName === normTeamName;
    const matchesUniqueLeader =
      isLeaderUnambiguous &&
      Boolean(sess.leader_id && sess.leader_id === team.leader_id) &&
      (!sessNormName || sessNormName === normTeamName);

    if (matchesUniqueName || matchesUniqueLeader) {
      const migrated: SiteWorkSession = { ...sess, team_id: team.id };
      matchedSessions.push(migrated);
      // Persiste silenciosamente a migração do team_id para futuras consultas diretas
      saveSiteWorkSession(migrated).catch((err) =>
        console.warn('Aviso ao migrar team_id de sessão antiga:', err)
      );
    }
  }

  matchedSessions.sort(
    (a, b) =>
      new Date(b.created_at || b.work_date).getTime() -
      new Date(a.created_at || a.work_date).getTime()
  );

  return {
    sessions: matchedSessions,
    totalCount: matchedSessions.length,
  };
}

export async function saveSiteWorkSession(
  session: Partial<SiteWorkSession>
): Promise<SiteWorkSession> {
  const localKey = getWorkSessionsStorageKey(session.site_id!);
  const now = new Date().toISOString();
  const id = session.id || `sess-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const hoursWorked = Number(session.hours_worked || 0);
  const workersCount = Number(session.workers_count || 1);

  const newSession: SiteWorkSession = {
    id,
    company_id: session.company_id || null,
    site_id: session.site_id!,
    team_id: session.team_id || null,
    team_name: session.team_name?.trim() || 'Equipa 1',
    leader_id: session.leader_id || null,
    leader_name: session.leader_name?.trim() || 'Líder da Equipa',
    workers_count: workersCount,
    work_date: session.work_date || now.slice(0, 10),
    hours_worked: hoursWorked,
    man_hours:
      typeof session.man_hours === 'number'
        ? session.man_hours
        : Math.round(hoursWorked * workersCount * 10) / 10,
    member_ids_snapshot: session.member_ids_snapshot || [],
    description: stripSessionMeta(session.description) || null,
    created_at: session.created_at || now,
  };

  if (supabase) {
    try {
      const dbPayload: Record<string, unknown> = {
        ...newSession,
        description: encodeSessionDescription(newSession),
      };
      const { error } = await supabase.from('site_work_sessions').upsert(dbPayload, { onConflict: 'id' });
      if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
        delete dbPayload.team_id;
        delete dbPayload.man_hours;
        delete dbPayload.member_ids_snapshot;
        await supabase.from('site_work_sessions').upsert(dbPayload, { onConflict: 'id' });
      }
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
    } catch (e) {
      console.warn('Erro ao remover sessão de trabalho:', e);
    }
  }
  const current = await getSiteWorkSessions(siteId);
  const updated = current.filter((s) => s.id !== sessionId);
  localStorage.setItem(localKey, JSON.stringify(updated));
}

export async function getCompanyWorkSessions(companyId?: string): Promise<SiteWorkSession[]> {
  const cacheKey = `work_sessions_${companyId || 'all'}`;
  const cached = getCached<SiteWorkSession[]>(cacheKey, 15000);
  if (cached) return cached;

  return fetchWithDedupe(cacheKey, async () => {
    if (supabase) {
      try {
        let query = supabase
          .from('site_work_sessions')
          .select(WORK_SESSIONS_COLS)
          .order('created_at', { ascending: false });
        if (companyId) {
          query = query.or(`company_id.eq.${companyId},company_id.is.null`);
        }
        const { data, error } = await query;
        if (!error && data) {
          const decoded = (data as Record<string, unknown>[]).map(decodeSessionRow);
          setCached(cacheKey, decoded);
          return decoded;
        }
      } catch (e) {
        console.warn('Erro ao carregar sessões de trabalho da empresa:', e);
      }
    }
    return [];
  });
}

export async function updateWorkSessionStatus(
  sessionId: string,
  status: 'aprovado' | 'rejeitado',
  notes?: string
): Promise<void> {
  invalidateCache('work_sessions');
  if (supabase) {
    try {
      const { data } = await supabase.from('site_work_sessions').select('*').eq('id', sessionId).maybeSingle();
      if (data) {
        const decoded = decodeSessionRow(data);
        decoded.status = status;
        decoded.validated_at = new Date().toISOString();
        decoded.validation_notes = notes || null;

        const dbPayload: Record<string, unknown> = {
          ...decoded,
          description: encodeSessionDescription(decoded),
        };
        const { error } = await supabase.from('site_work_sessions').upsert(dbPayload, { onConflict: 'id' });
        if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
          delete dbPayload.team_id;
          delete dbPayload.man_hours;
          delete dbPayload.member_ids_snapshot;
          await supabase.from('site_work_sessions').upsert(dbPayload, { onConflict: 'id' });
        }
      }
    } catch (e) {
      console.warn('Erro ao atualizar status da sessão de trabalho:', e);
    }
  }
}

// ----------------------------------------------------------------------------
// SEGURANÇA E ACIDENTES DE TRABALHO NA OBRA (SST)
// ----------------------------------------------------------------------------
const getSiteAccidentsStorageKey = (siteId: string) => `castello_site_accidents_${siteId}`;
const ACCIDENT_LOG_REGEX = /<!--CASTELLO_ACCIDENT:([\s\S]*?)-->/;

export async function getSiteAccidents(siteId: string, companyId?: string | null): Promise<SiteAccident[]> {
  const localKey = getSiteAccidentsStorageKey(siteId);
  const cloudAccidents: SiteAccident[] = [];

  if (supabase) {
    // 1. Tenta buscar da tabela dedicada site_accidents
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
        localStorage.setItem(localKey, JSON.stringify(data));
        return data as SiteAccident[];
      }
    } catch (e) {
      console.warn('Erro ao carregar acidentes de site_accidents:', e);
    }

    // 2. Fallback e sincronização automática via site_daily_logs (tabela ativa na nuvem partilhada)
    try {
      const { data: logsData, error: logErr } = await supabase
        .from('site_daily_logs')
        .select('*')
        .eq('site_id', siteId)
        .order('log_date', { ascending: false });

      if (!logErr && Array.isArray(logsData)) {
        for (const log of logsData) {
          const rawNotes = typeof log.notes === 'string' ? log.notes : '';
          const match = rawNotes.match(ACCIDENT_LOG_REGEX);
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
      console.warn('Erro ao sincronizar acidentes via site_daily_logs:', e);
    }

    if (cloudAccidents.length > 0) {
      const stored = localStorage.getItem(localKey);
      let local: SiteAccident[] = [];
      if (stored) {
        try {
          local = JSON.parse(stored);
        } catch {}
      }
      const combined = [...cloudAccidents];
      for (const loc of local) {
        if (!combined.some((c) => c.id === loc.id)) {
          combined.push(loc);
        }
      }
      combined.sort((a, b) => b.accident_date.localeCompare(a.accident_date));
      localStorage.setItem(localKey, JSON.stringify(combined));
      return combined;
    }
  }

  const stored = localStorage.getItem(localKey);
  if (stored) {
    try {
      return JSON.parse(stored) as SiteAccident[];
    } catch {}
  }
  return [];
}

export async function saveSiteAccident(
  accident: Omit<SiteAccident, 'id' | 'created_at'> & { id?: string; created_at?: string }
): Promise<SiteAccident> {
  const localKey = getSiteAccidentsStorageKey(accident.site_id);
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
        console.warn('Erro ao salvar em site_accidents no Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Erro de rede ao salvar acidente:', e);
    }

    // Sincronização direta em site_daily_logs (garante persistência mesmo sem tabela específica)
    try {
      await supabase.from('site_daily_logs').insert({
        id: ensureValidUuid(),
        site_id: newAccident.site_id,
        log_date: newAccident.accident_date,
        summary: `[SST_ACIDENTE] ${newAccident.accident_type}: ${newAccident.victim_name}`,
        notes: `<!--CASTELLO_ACCIDENT:${JSON.stringify(newAccident)}-->`,
        workers_count: 1,
      });
    } catch (logErr) {
      console.warn('Erro ao sincronizar acidente em site_daily_logs:', logErr);
    }
  }

  const current = await getSiteAccidents(accident.site_id, accident.company_id);
  const exists = current.some((a) => a.id === newAccident.id);
  const updated = exists
    ? current.map((a) => (a.id === newAccident.id ? newAccident : a))
    : [newAccident, ...current];
  localStorage.setItem(localKey, JSON.stringify(updated));
  return newAccident;
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
  const validation = validateWithZod(constructionSiteSchema, site);
  if (!validation.success) {
    throw new Error(`Validação da obra falhou: ${validation.error}`);
  }

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
      invalidateCache('sites');
      return savedSite;
    }
  }
  throw new Error('Falha ao gravar obra.');
}

export async function deleteSite(id: string): Promise<void> {
  if (supabase) {
    await supabase.from('construction_sites').delete().eq('id', id);
  }
  invalidateCache('sites');
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

export async function getEmployees(companyId?: string, forceRefresh = false): Promise<EmployeeProfile[]> {
  const cacheKey = `employees_${companyId || 'all'}`;
  if (!forceRefresh) {
    const cached = getCached<EmployeeProfile[]>(cacheKey, 30000);
    if (cached) return cached;
  }

  return fetchWithDedupe(cacheKey, async () => {
    if (supabase) {
      try {
        let query = supabase
          .from('profiles')
          .select(PROFILES_COLS)
          .order('created_at', { ascending: false });
        if (companyId) {
          query = query.or(`company_id.eq.${companyId},company_id.is.null`);
        }
        const { data, error } = await query;
        if (!error && data) {
          const localAvatars = getLocalAvatars();
          const mapped = (data as unknown as EmployeeProfile[]).map((emp) => ({
            ...emp,
            avatar_url: emp.avatar_url || localAvatars[emp.id] || null,
          }));
          const recovered = recoverHashedEmployeePins(mapped);
          setCached(cacheKey, recovered);
          return recovered;
        }
      } catch (e) {
        console.warn('Erro ao carregar colaboradores:', e);
      }
    }
    return [];
  });
}

export async function saveEmployee(
  emp: Omit<EmployeeProfile, 'id'> & { id?: string },
  companyId?: string
): Promise<EmployeeProfile> {
  const validation = validateWithZod(employeeSchema, emp);
  if (!validation.success) {
    throw new Error(`Validação do colaborador falhou: ${validation.error}`);
  }

  const payload = {
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
        invalidateCache('employees');
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
  invalidateCache('employees');
}

// ============================================================================
// TAREFAS DA OBRA (site_tasks) — COM METADADOS DE EQUIPA E PRODUTIVIDADE
// ============================================================================
const getTasksStorageKey = (siteId: string) => `castello_site_tasks_${siteId}`;
const TASK_META_REGEX = /\n?<!--CASTELLO_TASK_META:([\s\S]*?)-->/;

function stripTaskMeta(desc?: string | null): string | null {
  if (!desc) return null;
  const cleaned = desc.replace(TASK_META_REGEX, '').trim();
  return cleaned || null;
}

function encodeTaskDescription(task: Partial<SiteTask>): string | null {
  const cleanDesc = stripTaskMeta(task.description) || '';
  const hasExtended =
    task.assigned_team_id ||
    task.assigned_team_name ||
    task.priority ||
    task.start_date ||
    typeof task.progress === 'number' ||
    task.execution_status ||
    typeof task.planned_hours === 'number' ||
    typeof task.service_quantity === 'number' ||
    task.service_unit ||
    (task.before_photos && task.before_photos.length > 0) ||
    task.observations;

  if (!hasExtended) return cleanDesc || null;

  const meta = {
    assigned_team_id: task.assigned_team_id || null,
    assigned_team_name: task.assigned_team_name || null,
    priority: task.priority || 'media',
    start_date: task.start_date || null,
    progress: typeof task.progress === 'number' ? task.progress : 0,
    execution_status: task.execution_status || 'pendente',
    planned_hours: typeof task.planned_hours === 'number' ? task.planned_hours : null,
    service_quantity: typeof task.service_quantity === 'number' ? task.service_quantity : null,
    service_unit: task.service_unit || null,
    before_photos: Array.isArray(task.before_photos) ? task.before_photos : [],
    observations: task.observations || null,
  };
  return `${cleanDesc}\n<!--CASTELLO_TASK_META:${JSON.stringify(meta)}-->`;
}

function decodeTaskRow(row: Record<string, unknown>): SiteTask {
  const rawDesc = typeof row.description === 'string' ? row.description : '';
  let meta: Record<string, unknown> = {};
  const match = rawDesc.match(TASK_META_REGEX);
  if (match && match[1]) {
    try {
      meta = JSON.parse(match[1]);
    } catch (err) {
      console.warn('Falha ao decodificar metadados de tarefa:', err);
    }
  }
  const cleanDesc = stripTaskMeta(rawDesc);
  const status = (row.status as TaskStatus) || 'pendente';
  const isDone = status === 'concluida_funcionario' || status === 'confirmada_chefe';
  const rawProgress =
    typeof row.progress === 'number'
      ? row.progress
      : typeof meta.progress === 'number'
      ? meta.progress
      : isDone
      ? 100
      : 0;
  const rawExecStatus =
    (row.execution_status as TaskExecutionStatus) ||
    (meta.execution_status as TaskExecutionStatus) ||
    (isDone ? 'concluida' : rawProgress > 0 ? 'em_execucao' : 'pendente');

  return {
    id: String(row.id || ''),
    site_id: String(row.site_id || ''),
    company_id: (row.company_id as string | null) || null,
    title: String(row.title || ''),
    description: cleanDesc,
    assigned_to_id: (row.assigned_to_id as string | null) || null,
    assigned_to_name: (row.assigned_to_name as string | null) || null,
    assigned_team_id: (row.assigned_team_id as string | null) || (meta.assigned_team_id as string | null) || null,
    assigned_team_name: (row.assigned_team_name as string | null) || (meta.assigned_team_name as string | null) || null,
    priority: (row.priority as TaskPriority) || (meta.priority as TaskPriority) || 'media',
    start_date: (row.start_date as string | null) || (meta.start_date as string | null) || null,
    progress: isDone ? 100 : rawProgress,
    execution_status: isDone ? 'concluida' : rawExecStatus,
    planned_hours:
      typeof row.planned_hours === 'number'
        ? row.planned_hours
        : typeof meta.planned_hours === 'number'
        ? meta.planned_hours
        : null,
    service_quantity:
      typeof row.service_quantity === 'number'
        ? row.service_quantity
        : typeof meta.service_quantity === 'number'
        ? meta.service_quantity
        : null,
    service_unit: (row.service_unit as string | null) || (meta.service_unit as string | null) || null,
    before_photos: Array.isArray(row.before_photos)
      ? (row.before_photos as string[])
      : Array.isArray(meta.before_photos)
      ? (meta.before_photos as string[])
      : [],
    observations: (row.observations as string | null) || (meta.observations as string | null) || null,
    status,
    completed_by_name: (row.completed_by_name as string | null) || null,
    completed_at: (row.completed_at as string | null) || null,
    completion_photos: Array.isArray(row.completion_photos) ? (row.completion_photos as string[]) : [],
    confirmed_by_name: (row.confirmed_by_name as string | null) || null,
    confirmed_at: (row.confirmed_at as string | null) || null,
    show_to_client: Boolean(row.show_to_client),
    due_date: (row.due_date as string | null) || null,
    created_at: (row.created_at as string | undefined) || undefined,
  };
}

export async function getSiteTasks(siteId: string): Promise<SiteTask[]> {
  const localKey = getTasksStorageKey(siteId);
  const rawCached = JSON.parse(localStorage.getItem(localKey) || '[]') as Record<string, unknown>[];
  const cached: SiteTask[] = rawCached.map(decodeTaskRow);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_tasks')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const decodedRemote = (data as Record<string, unknown>[]).map(decodeTaskRow);
        const supabaseIds = new Set(decodedRemote.map((d) => d.id));
        const localOnly = cached.filter((c) => !supabaseIds.has(c.id));
        const merged = [...decodedRemote, ...localOnly];
        localStorage.setItem(localKey, JSON.stringify(merged));
        return merged;
      }
    } catch (e) {
      console.warn('Erro ao carregar tarefas da obra do Supabase:', e);
    }
  }

  return cached;
}

/**
 * Consulta otimizada em lote de todas as tarefas das obras da empresa (evita N consultas por obra)
 */
export async function getAllCompanyTasks(
  companyId?: string,
  siteIds: string[] = []
): Promise<SiteTask[]> {
  const cacheKey = `company_tasks_${companyId || 'all'}_${siteIds.length}`;
  const cached = getCached<SiteTask[]>(cacheKey, 15000);
  if (cached) return cached;

  return fetchWithDedupe(cacheKey, async () => {
    let remoteTasks: SiteTask[] = [];
    if (supabase) {
      try {
        let query = supabase.from('site_tasks').select('*').order('created_at', { ascending: false });
        if (companyId && siteIds.length > 0) {
          query = query.or(`company_id.eq.${companyId},site_id.in.(${siteIds.join(',')})`);
        } else if (companyId) {
          query = query.or(`company_id.eq.${companyId},company_id.is.null`);
        } else if (siteIds.length > 0) {
          query = query.in('site_id', siteIds);
        }
        const { data, error } = await query;
        if (!error && data) {
          remoteTasks = (data as Record<string, unknown>[]).map(decodeTaskRow);
        }
      } catch (e) {
        console.warn('Erro ao consultar tarefas da empresa em lote:', e);
      }
    }

    const seenIds = new Set(remoteTasks.map((t) => t.id));
    for (const sId of siteIds) {
      try {
        const raw = localStorage.getItem(getTasksStorageKey(sId));
        if (raw) {
          const localList = (JSON.parse(raw) as Record<string, unknown>[]).map(decodeTaskRow);
          for (const item of localList) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              remoteTasks.push(item);
            }
          }
        }
      } catch (err) {
        console.warn('Aviso ao ler cache local de tarefas:', err);
      }
    }

    setCached(cacheKey, remoteTasks);
    return remoteTasks;
  });
}

export async function createSiteTask(
  siteId: string,
  title: string,
  description?: string,
  assignedToName?: string,
  dueDate?: string,
  companyId?: string,
  assignedToId?: string,
  extra?: Partial<SiteTask>
): Promise<SiteTask> {
  invalidateCache('company_tasks');
  const validation = validateWithZod(siteTaskSchema, {
    title,
    site_id: siteId,
    description,
    due_date: dueDate,
    priority: extra?.priority || 'media',
  });
  if (!validation.success) {
    throw new Error(`Validação da tarefa falhou: ${validation.error}`);
  }

  const localKey = getTasksStorageKey(siteId);
  const newTask: SiteTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    site_id: siteId,
    company_id: companyId || null,
    title: title.trim(),
    description: stripTaskMeta(description) || null,
    assigned_to_id: assignedToId || null,
    assigned_to_name: assignedToName || null,
    assigned_team_id: extra?.assigned_team_id || null,
    assigned_team_name: extra?.assigned_team_name || null,
    priority: extra?.priority || 'media',
    start_date: extra?.start_date || null,
    progress: typeof extra?.progress === 'number' ? extra.progress : 0,
    execution_status: extra?.execution_status || 'pendente',
    planned_hours: typeof extra?.planned_hours === 'number' ? extra.planned_hours : null,
    service_quantity: typeof extra?.service_quantity === 'number' ? extra.service_quantity : null,
    service_unit: extra?.service_unit || null,
    before_photos: extra?.before_photos || [],
    observations: extra?.observations || null,
    status: 'pendente',
    due_date: dueDate || null,
    created_at: new Date().toISOString(),
  };

  // 1. Grava de imediato no cache local para NUNCA perder o dado
  const cached: SiteTask[] = (JSON.parse(localStorage.getItem(localKey) || '[]') as Record<string, unknown>[]).map(decodeTaskRow);
  const updatedLocal = [newTask, ...cached.filter((t) => t.id !== newTask.id)];
  localStorage.setItem(localKey, JSON.stringify(updatedLocal));

  // 2. Se o Supabase estiver conectado, tenta persistir no banco com fallbacks
  if (supabase) {
    try {
      const encodedDesc = encodeTaskDescription(newTask);
      const payload: Record<string, unknown> = {
        site_id: siteId,
        title: title.trim(),
        description: encodedDesc,
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
        const finalTask = decodeTaskRow({ ...newTask, ...(data as Record<string, unknown>) });
        const refreshed = updatedLocal.map((t) => (t.id === newTask.id ? finalTask : t));
        localStorage.setItem(localKey, JSON.stringify(refreshed));
        if (finalTask.due_date) {
          try {
            await syncTaskWithCalendar(finalTask, companyId);
          } catch (err) {
            console.warn('Aviso ao sincronizar tarefa no calendário:', err);
          }
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
    } catch (err) {
      console.warn('Aviso ao sincronizar tarefa no calendário:', err);
    }
  }

  return newTask;
}

export async function updateSiteTaskDetails(
  task: SiteTask,
  updates: Partial<SiteTask>,
  companyId?: string
): Promise<SiteTask> {
  const merged: SiteTask = {
    ...task,
    ...updates,
    description: stripTaskMeta(updates.description !== undefined ? updates.description : task.description),
  };

  if (merged.execution_status === 'concluida' && merged.status === 'pendente') {
    merged.status = 'concluida_funcionario';
    merged.progress = 100;
    merged.completed_at = merged.completed_at || new Date().toISOString();
  } else if (merged.progress === 100 && merged.execution_status !== 'concluida') {
    merged.execution_status = 'concluida';
  } else if ((merged.progress || 0) > 0 && (merged.progress || 0) < 100 && merged.execution_status === 'pendente') {
    merged.execution_status = 'em_execucao';
  }

  const encodedDesc = encodeTaskDescription(merged);

  if (supabase) {
    try {
      const dbPatch: Record<string, unknown> = {
        title: merged.title.trim(),
        description: encodedDesc,
        site_id: merged.site_id,
        assigned_to_id: merged.assigned_to_id || null,
        assigned_to_name: merged.assigned_to_name || null,
        due_date: merged.due_date || null,
        status: merged.status,
        completion_photos: merged.completion_photos || [],
      };
      let { error } = await supabase.from('site_tasks').update(dbPatch).eq('id', merged.id);
      if (error && (error.code === 'PGRST204' || error.message?.includes('assigned_to_id'))) {
        delete dbPatch.assigned_to_id;
        const retry = await supabase.from('site_tasks').update(dbPatch).eq('id', merged.id);
        error = retry.error;
      }
      if (error) {
        console.warn('Aviso ao atualizar detalhes da tarefa no Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Erro ao atualizar detalhes da tarefa no Supabase:', e);
    }
  }

  const localKey = getTasksStorageKey(merged.site_id);
  try {
    const list = (JSON.parse(localStorage.getItem(localKey) || '[]') as Record<string, unknown>[]).map(decodeTaskRow);
    const exists = list.some((t) => t.id === merged.id);
    const updatedList = exists ? list.map((t) => (t.id === merged.id ? merged : t)) : [merged, ...list];
    localStorage.setItem(localKey, JSON.stringify(updatedList));
  } catch (e) {
    console.warn('Erro ao atualizar cache local de tarefas:', e);
  }

  if (merged.due_date) {
    try {
      await syncTaskWithCalendar(merged, companyId || merged.company_id || undefined);
    } catch (e) {
      console.warn('Aviso ao sincronizar tarefa atualizada com calendário:', e);
    }
  }

  return merged;
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
        .select(DAILY_LOGS_COLS)
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

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

// ============================================================================
// PICAGENS DE PONTO
// ============================================================================
export async function getAllTimeEntries(
  companyId?: string,
  options?: PaginationOptions
): Promise<TimeEntry[]> {
  const dedupeKey = `time_entries_${companyId || 'all'}_${options?.limit || 500}_${options?.offset || 0}`;
  return fetchWithDedupe(dedupeKey, async () => {
    let entries: TimeEntry[] = [];

    // 1. Tenta carregar do Supabase com projeção explícita e paginação segura
    if (supabase) {
      try {
        let query = supabase
          .from('time_entries')
          .select(TIME_ENTRIES_COLS)
          .order('recorded_at', { ascending: false });

        if (companyId) {
          query = query.or(`company_id.eq.${companyId},company_id.is.null`);
        }

        if (options?.limit) {
          const offset = options.offset || 0;
          query = query.range(offset, offset + options.limit - 1);
        } else {
          // Limite padrão seguro de 500 registos para preservar banda de rede e performance
          query = query.limit(500);
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
  });
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

export async function getFinancialRecords(
  companyId?: string,
  options?: PaginationOptions
): Promise<FinancialRecord[]> {
  const localKey = getFinStorageKey(companyId);
  const stored = localStorage.getItem(localKey);
  const localList: FinancialRecord[] = stored ? JSON.parse(stored) : [];

  if (supabase) {
    try {
      let query = supabase
        .from('financial_transactions')
        .select('*')
        .order('due_date', { ascending: false });

      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      if (options?.limit) {
        const offset = options.offset || 0;
        query = query.range(offset, offset + options.limit - 1);
      } else {
        // Limite padrão protetor de 500 registos para otimização de rede e renderização
        query = query.limit(500);
      }

      const { data, error } = await query;
      if (!error && data) {
        const recordsNeedingMetaSync: FinancialRecord[] = [];

        const mappedFromDb: FinancialRecord[] = data.map((row: any) => {
          const matchingLocal = localList.find((l) => l.id === row.id);
          const hasEncodedMeta = typeof row.description === 'string' && row.description.includes(FIN_META_PREFIX);
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

          const mappedRec: FinancialRecord = {
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

          if (!hasEncodedMeta && matchingLocal && (matchingLocal.site_id || matchingLocal.site_name)) {
            recordsNeedingMetaSync.push(mappedRec);
          }

          return mappedRec;
        });

        const dbIds = new Set(mappedFromDb.map((m) => m.id));
        const unSyncedRaw = localList.filter((l) => !dbIds.has(l.id) && !l.id.startsWith('fin-0'));

        // Normaliza IDs antigos (ex: "fin-17...") para UUID válido e sincroniza automaticamente com o Supabase
        const unSyncedNormalized: FinancialRecord[] = unSyncedRaw.map((l) => ({
          ...l,
          id: ensureValidUuid(l.id),
          company_id: l.company_id || companyId || null,
        }));

        const recordsToPush = [...recordsNeedingMetaSync, ...unSyncedNormalized];
        if (recordsToPush.length > 0 && supabase) {
          const batchPayload = recordsToPush.map((rec) => ({
            id: rec.id,
            company_id: rec.company_id || companyId || null,
            description: encodeFinancialDescription(rec.title, rec),
            amount: rec.amount,
            type: rec.type === 'receita' ? 'income' : 'expense',
            category: rec.category,
            due_date: rec.due_date,
            paid: rec.status === 'pago',
            payment_date: rec.payment_date,
          }));
          Promise.resolve(
            supabase.from('financial_transactions').upsert(batchPayload, { onConflict: 'id' })
          ).catch(() => {});
        }

        const combined = [...mappedFromDb, ...unSyncedNormalized];

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
  const validation = validateWithZod(financialRecordSchema, {
    description: record.description || record.title || 'Lançamento financeiro',
    amount: record.amount || 0,
    type: record.type || 'expense',
    category: record.category || 'Geral',
    due_date: record.due_date || new Date().toISOString().split('T')[0],
    paid: (record as any).paid ?? (record.status === 'pago'),
    payment_date: record.payment_date,
    site_id: record.site_id,
    subcategory: record.subcategory,
  });
  if (!validation.success) {
    throw new Error(`Validação financeira falhou: ${validation.error}`);
  }

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

  const session = getActiveCompanySession();
  if (session?.id) {
    session.theme_color = color;
    session.theme_mode = mode;
    setActiveCompanySession(session);
    saveCompanyCloudSettings(session.id, {
      logo_url: session.logo_url,
      theme_color: color,
      theme_mode: mode,
    }).catch(() => {});
  }
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

export async function getInventoryItems(companyId?: string, forceRefresh = false): Promise<InventoryItem[]> {
  const cacheKey = `inventory_${companyId || 'all'}`;
  if (!forceRefresh) {
    const cached = getCached<InventoryItem[]>(cacheKey, 30000);
    if (cached) return cached;
  }

  return fetchWithDedupe(cacheKey, async () => {
    const localKey = getInvStorageKey(companyId);
    if (supabase) {
      try {
        let query = supabase.from('inventory_items').select(INVENTORY_COLS).order('name', { ascending: true });
        if (companyId) {
          query = query.or(`company_id.eq.${companyId},company_id.is.null`);
        }
        const { data, error } = await query;
        if (!error && data) {
          localStorage.setItem(localKey, JSON.stringify(data));
          setCached(cacheKey, data as InventoryItem[]);
          return data as InventoryItem[];
        }
      } catch (e) {
        console.warn('Erro ao carregar inventário do Supabase:', e);
      }
    }

    const stored = localStorage.getItem(localKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as InventoryItem[];
        setCached(cacheKey, parsed);
        return parsed;
      } catch {}
    }
    return [];
  });
}

export async function saveInventoryItem(
  item: Partial<InventoryItem>,
  companyId?: string
): Promise<InventoryItem> {
  const validation = validateWithZod(inventoryItemSchema, {
    name: item.name || '',
    quantity: item.total_quantity ?? 1,
    category: item.category || 'ferramentas',
  });
  if (!validation.success) {
    throw new Error(`Validação do item de inventário falhou: ${validation.error}`);
  }

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
  invalidateCache('inventory');
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
  invalidateCache('inventory');
}

// ============================================================================
// GESTÃO DE CARRINHAS / FROTA DE OBRAS
// ============================================================================
const getVehiclesStorageKey = (companyId?: string) =>
  `castello_vehicles_${companyId || 'default'}`;

export async function getVehicles(companyId?: string, forceRefresh = false): Promise<Vehicle[]> {
  const cacheKey = `vehicles_${companyId || 'all'}`;
  if (!forceRefresh) {
    const cached = getCached<Vehicle[]>(cacheKey, 30000);
    if (cached) return cached;
  }

  return fetchWithDedupe(cacheKey, async () => {
    const localKey = getVehiclesStorageKey(companyId);
    if (supabase) {
      try {
        let query = supabase.from('vehicles').select(VEHICLES_COLS).order('brand', { ascending: true });
        if (companyId) {
          query = query.or(`company_id.eq.${companyId},company_id.is.null`);
        }
        const { data, error } = await query;
        if (!error && data) {
          // Se houver viaturas no localStorage que ainda não estão no Supabase, sincroniza em lote (evita N+1)
          const stored = localStorage.getItem(localKey);
          if (stored) {
            try {
              const localList = JSON.parse(stored) as Vehicle[];
              const missingVehicles = localList.filter(
                (lv) =>
                  !data.some(
                    (sv: any) =>
                      sv.id === lv.id || (sv.license_plate && sv.license_plate === lv.license_plate)
                  )
              );
              if (missingVehicles.length > 0) {
                await supabase.from('vehicles').upsert(missingVehicles, { onConflict: 'id' });
                (data as unknown as Vehicle[]).push(...missingVehicles);
              }
            } catch {}
          }
          localStorage.setItem(localKey, JSON.stringify(data));
          setCached(cacheKey, data as Vehicle[]);
          return data as Vehicle[];
        }
      } catch (e) {
        console.warn('Erro ao carregar carrinhas do Supabase:', e);
      }
    }

    const stored = localStorage.getItem(localKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Vehicle[];
        setCached(cacheKey, parsed);
        return parsed;
      } catch {}
    }
    return [];
  });
}

export async function saveVehicle(
  vehicle: Partial<Vehicle>,
  companyId?: string
): Promise<Vehicle> {
  const validation = validateWithZod(vehicleSchema, {
    plate: vehicle.license_plate || '',
    model: vehicle.model || vehicle.brand || '',
    year: vehicle.year,
  });
  if (!validation.success) {
    throw new Error(`Validação da viatura falhou: ${validation.error}`);
  }

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
  invalidateCache('vehicles');
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
  invalidateCache('vehicles');
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

export async function getCompanyVehicleMaintenanceRecords(
  vehicleIds: string[]
): Promise<VehicleMaintenanceRecord[]> {
  if (!vehicleIds || vehicleIds.length === 0) return [];
  const cacheKey = `company_vehicle_maint_${vehicleIds.slice().sort().join(',')}`;
  const cached = getCached<VehicleMaintenanceRecord[]>(cacheKey, 20000);
  if (cached) return cached;

  return fetchWithDedupe(cacheKey, async () => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('vehicle_maintenance_records')
          .select(
            'id, vehicle_id, company_id, item_type, title, description, performed_at, performed_km, next_due_date, next_due_km, cost, service_provider, created_at'
          )
          .in('vehicle_id', vehicleIds)
          .order('performed_at', { ascending: false });

        if (!error && data) {
          const list = data as unknown as VehicleMaintenanceRecord[];
          setCached(cacheKey, list);
          return list;
        }
      } catch (e) {
        console.warn('Erro ao carregar manutenções em lote:', e);
      }
    }

    const fallback: VehicleMaintenanceRecord[] = [];
    for (const vId of vehicleIds) {
      try {
        const raw = localStorage.getItem(getMaintStorageKey(vId));
        if (raw) fallback.push(...(JSON.parse(raw) as VehicleMaintenanceRecord[]));
      } catch {}
    }
    return fallback;
  });
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

    const res = await fetchWithTimeout(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      { timeoutMs: 8000, retries: 0 }
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
// GESTÃO DE EQUIPAS DE TRABALHO (TEAMS) — OPERACIONAL & HISTÓRICO COMPLETO
// ============================================================================
const getTeamsStorageKey = (companyId?: string) => `castello_teams_${companyId || 'default'}`;
const TEAM_META_REGEX = /\n?<!--CASTELLO_TEAM_META:([\s\S]*?)-->/;

function stripTeamMeta(notes?: string | null): string | null {
  if (!notes) return null;
  const cleaned = notes.replace(TEAM_META_REGEX, '').trim();
  return cleaned || null;
}

function encodeTeamNotes(team: Team): string | null {
  const cleanNotes = stripTeamMeta(team.notes) || '';
  const meta = {
    specialties: Array.isArray(team.specialties) ? team.specialties : [],
    is_archived: Boolean(team.is_archived),
    archived_at: team.archived_at || null,
    allocation_end_date: team.allocation_end_date || null,
    allocation_start_time: team.allocation_start_time || null,
    allocation_end_time: team.allocation_end_time || null,
    member_joined_at: team.member_joined_at || {},
    member_specialties: team.member_specialties || {},
    allocation_history: Array.isArray(team.allocation_history) ? team.allocation_history : [],
    activity_log: Array.isArray(team.activity_log) ? team.activity_log : [],
  };
  return `${cleanNotes}\n<!--CASTELLO_TEAM_META:${JSON.stringify(meta)}-->`;
}

function decodeTeamRow(row: Record<string, unknown>): Team {
  const rawNotes = typeof row.notes === 'string' ? row.notes : '';
  let meta: Record<string, unknown> = {};
  const match = rawNotes.match(TEAM_META_REGEX);
  if (match && match[1]) {
    try {
      meta = JSON.parse(match[1]);
    } catch (err) {
      console.warn('Falha ao decodificar metadados de equipa:', err);
    }
  }
  const cleanNotes = stripTeamMeta(rawNotes);
  const leaderId = (row.leader_id as string | null) || null;
  const rawMemberIds = Array.isArray(row.member_ids) ? (row.member_ids as string[]) : [];
  const rawMemberNames = Array.isArray(row.member_names) ? (row.member_names as string[]) : [];

  // Garante que não há duplicados nem o líder repetido na lista de integrantes comuns
  const uniqueMemberIds: string[] = [];
  const uniqueMemberNames: string[] = [];
  const seenIds = new Set<string>();
  rawMemberIds.forEach((id, idx) => {
    if (!id || id === leaderId || seenIds.has(id)) return;
    seenIds.add(id);
    uniqueMemberIds.push(id);
    uniqueMemberNames.push(rawMemberNames[idx] || 'Colaborador');
  });

  return {
    id: String(row.id || ''),
    company_id: (row.company_id as string | null) || null,
    name: String(row.name || 'Equipa'),
    leader_id: leaderId,
    leader_name: String(row.leader_name || 'Sem líder definido'),
    leader_phone: (row.leader_phone as string | null) || null,
    member_ids: uniqueMemberIds,
    member_names: uniqueMemberNames,
    specialties: Array.isArray(row.specialties)
      ? (row.specialties as string[])
      : Array.isArray(meta.specialties)
      ? (meta.specialties as string[])
      : [],
    current_site_id: (row.current_site_id as string | null) || null,
    current_site_name: (row.current_site_name as string | null) || null,
    allocated_at: (row.allocated_at as string | null) || null,
    allocation_end_date:
      (row.allocation_end_date as string | null) || (meta.allocation_end_date as string | null) || null,
    allocation_start_time:
      (row.allocation_start_time as string | null) || (meta.allocation_start_time as string | null) || null,
    allocation_end_time:
      (row.allocation_end_time as string | null) || (meta.allocation_end_time as string | null) || null,
    is_archived: Boolean(row.is_archived ?? meta.is_archived),
    archived_at: (row.archived_at as string | null) || (meta.archived_at as string | null) || null,
    member_joined_at:
      (row.member_joined_at as Record<string, string>) ||
      (meta.member_joined_at as Record<string, string>) ||
      {},
    member_specialties:
      (row.member_specialties as Record<string, string>) ||
      (meta.member_specialties as Record<string, string>) ||
      {},
    allocation_history: Array.isArray(row.allocation_history)
      ? (row.allocation_history as TeamAllocationRecord[])
      : Array.isArray(meta.allocation_history)
      ? (meta.allocation_history as TeamAllocationRecord[])
      : [],
    activity_log: Array.isArray(row.activity_log)
      ? (row.activity_log as TeamActivityEvent[])
      : Array.isArray(meta.activity_log)
      ? (meta.activity_log as TeamActivityEvent[])
      : [],
    notes: cleanNotes,
    created_at: (row.created_at as string | undefined) || undefined,
  };
}

export interface TeamValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedMemberIds: string[];
  sanitizedMemberNames: string[];
}

/**
 * Validação rigorosa de colaboradores e regras operacionais da equipa (Secção 3.3)
 */
export function validateTeamPayload(params: {
  team: Partial<Team>;
  employees: EmployeeProfile[];
  allTeams: Team[];
}): TeamValidationResult {
  const { team, employees, allTeams } = params;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!team.name || !team.name.trim()) {
    errors.push('O nome da equipa é obrigatório.');
  }

  const empMap = new Map(employees.map((e) => [e.id, e]));
  const leaderId = team.leader_id || null;

  // 1. Verificar se o líder existe e está ativo
  if (leaderId) {
    const leaderEmp = empMap.get(leaderId);
    if (!leaderEmp && employees.length > 0) {
      errors.push('O líder selecionado não foi encontrado no registo de colaboradores.');
    } else if (leaderEmp && !leaderEmp.is_active) {
      errors.push(`O líder selecionado (${leaderEmp.full_name}) encontra-se inativo.`);
    }
  } else {
    warnings.push('A equipa está sem líder responsável definido.');
  }

  // 2. Verificar colaboradores, impedir duplicados e impedir que o líder seja membro comum
  const rawMemberIds = team.member_ids || [];
  const rawMemberNames = team.member_names || [];
  const sanitizedMemberIds: string[] = [];
  const sanitizedMemberNames: string[] = [];
  const seenIds = new Set<string>();

  rawMemberIds.forEach((mId, idx) => {
    if (!mId) return;
    if (leaderId && mId === leaderId) {
      warnings.push('O líder já integra a equipa como responsável e foi removido da lista de membros comuns.');
      return;
    }
    if (seenIds.has(mId)) {
      warnings.push('Colaborador duplicado na lista foi unificado automaticamente.');
      return;
    }
    const emp = empMap.get(mId);
    if (!emp && !mId.startsWith('legacy-') && employees.length > 0) {
      errors.push(`Colaborador com ID "${mId}" não existe na empresa.`);
      return;
    }
    if (emp && !emp.is_active && !team.is_archived) {
      errors.push(`O colaborador "${emp.full_name}" está inativo e não pode ser adicionado a uma equipa operacional.`);
      return;
    }
    seenIds.add(mId);
    sanitizedMemberIds.push(mId);
    sanitizedMemberNames.push(emp ? emp.full_name : rawMemberNames[idx] || 'Colaborador');
  });

  // 3. Identificar conflitos de alocação simultânea com outras equipas ativas em obra
  const allTeamParticipantIds = [
    ...(leaderId ? [leaderId] : []),
    ...sanitizedMemberIds,
  ];
  const otherAllocatedTeams = allTeams.filter(
    (other) =>
      other.id !== team.id &&
      !other.is_archived &&
      Boolean(other.current_site_id || other.current_site_name)
  );

  for (const pId of allTeamParticipantIds) {
    const conflictingTeams = otherAllocatedTeams.filter(
      (other) => other.leader_id === pId || (other.member_ids || []).includes(pId)
    );
    if (conflictingTeams.length > 0) {
      const empName = empMap.get(pId)?.full_name || 'Colaborador';
      const conflictNames = conflictingTeams
        .map((ct) => `${ct.name} (${ct.current_site_name || 'Em Obra'})`)
        .join(', ');
      if (team.current_site_id) {
        errors.push(
          `Conflito de alocação: ${empName} já está em alocação ativa na equipa ${conflictNames}.`
        );
      } else {
        warnings.push(
          `Atenção: ${empName} também pertence à equipa atualmente alocada ${conflictNames}.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitizedMemberIds,
    sanitizedMemberNames,
  };
}

export async function getTeams(companyId?: string, forceRefresh = false): Promise<Team[]> {
  const cacheKey = `teams_${companyId || 'all'}`;
  if (!forceRefresh) {
    const cached = getCached<Team[]>(cacheKey, 30000);
    if (cached) return cached;
  }

  return fetchWithDedupe(cacheKey, async () => {
    const localKey = getTeamsStorageKey(companyId);
    if (supabase) {
      try {
        let query = supabase.from('teams').select(TEAMS_COLS).order('name', { ascending: true });
        if (companyId) {
          query = query.or(`company_id.eq.${companyId},company_id.is.null`);
        }
        const { data, error } = await query;
        if (!error && data) {
          const decoded = (data as Record<string, unknown>[]).map(decodeTeamRow);
          localStorage.setItem(localKey, JSON.stringify(decoded));
          setCached(cacheKey, decoded);
          return decoded;
        }
      } catch (e) {
        console.warn('Erro ao carregar equipas de Supabase:', e);
      }
    }

    const stored = localStorage.getItem(localKey);
    if (stored) {
      try {
        const decoded = (JSON.parse(stored) as Record<string, unknown>[]).map(decodeTeamRow);
        setCached(cacheKey, decoded);
        return decoded;
      } catch (err) {
        console.warn('Erro ao ler equipas locais:', err);
      }
    }
    return [];
  });
}

export async function saveTeam(
  team: Partial<Team>,
  companyId?: string,
  options?: { employees?: EmployeeProfile[]; skipValidationError?: boolean }
): Promise<Team> {
  const zodVal = validateWithZod(teamSchema, {
    name: team.name || '',
    leader_name: team.leader_name || '',
    leader_phone: team.leader_phone || '',
  });
  if (!zodVal.success && !options?.skipValidationError) {
    throw new Error(`Validação da equipa falhou: ${zodVal.error}`);
  }

  const localKey = getTeamsStorageKey(companyId);
  const currentTeams = await getTeams(companyId);
  const existingTeam = team.id ? currentTeams.find((t) => t.id === team.id) : undefined;
  const todayStr = new Date().toISOString().slice(0, 10);

  // Validação de regras no serviço (backend/camada de persistência)
  const validation = validateTeamPayload({
    team: { ...existingTeam, ...team },
    employees: options?.employees || [],
    allTeams: currentTeams,
  });
  if (!validation.valid && !options?.skipValidationError) {
    throw new Error(validation.errors[0]);
  }

  // Preserva datas de entrada de cada membro e adiciona hoje para novos membros
  const prevJoinedAt = { ...(existingTeam?.member_joined_at || {}), ...(team.member_joined_at || {}) };
  for (const mId of validation.sanitizedMemberIds) {
    if (!prevJoinedAt[mId]) {
      prevJoinedAt[mId] = todayStr;
    }
  }
  if (team.leader_id && !prevJoinedAt[team.leader_id]) {
    prevJoinedAt[team.leader_id] = todayStr;
  }

  // Regista automaticamente alterações na composição ou líder no histórico de atividades
  const activityLog: TeamActivityEvent[] = [
    ...(team.activity_log || existingTeam?.activity_log || []),
  ];
  const nowIso = new Date().toISOString();

  if (existingTeam) {
    if (team.leader_id !== undefined && team.leader_id !== existingTeam.leader_id) {
      activityLog.unshift({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        team_id: existingTeam.id,
        type: 'lider',
        title: 'Alteração de Líder Responsável',
        description: `Líder alterado de "${existingTeam.leader_name || 'Nenhum'}" para "${team.leader_name || 'Nenhum'}".`,
        author_name: 'Administração',
        created_at: nowIso,
      });
    }

    const prevSet = new Set(existingTeam.member_ids || []);
    const nextSet = new Set(validation.sanitizedMemberIds);
    const addedNames = validation.sanitizedMemberIds
      .map((id, i) => (!prevSet.has(id) ? validation.sanitizedMemberNames[i] : null))
      .filter(Boolean) as string[];
    const removedNames = (existingTeam.member_ids || [])
      .map((id, i) => (!nextSet.has(id) ? (existingTeam.member_names || [])[i] || id : null))
      .filter(Boolean) as string[];

    if (addedNames.length > 0 || removedNames.length > 0) {
      const parts: string[] = [];
      if (addedNames.length > 0) parts.push(`Adicionados: ${addedNames.join(', ')}`);
      if (removedNames.length > 0) parts.push(`Removidos: ${removedNames.join(', ')}`);
      activityLog.unshift({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        team_id: existingTeam.id,
        type: 'composicao',
        title: 'Atualização na Composição da Equipa',
        description: parts.join(' • '),
        author_name: 'Administração',
        created_at: nowIso,
      });
    }
  } else {
    const newId = team.id || `team-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    activityLog.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      team_id: newId,
      type: 'composicao',
      title: 'Equipa Criada',
      description: `Equipa "${team.name?.trim() || 'Nova Equipa'}" registada com líder ${team.leader_name || 'Não definido'} e ${validation.sanitizedMemberIds.length} integrante(s).`,
      author_name: 'Administração',
      created_at: nowIso,
    });
  }

  const newTeam: Team = {
    id: team.id || existingTeam?.id || `team-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    company_id: team.company_id ?? existingTeam?.company_id ?? companyId ?? null,
    name: team.name?.trim() || existingTeam?.name || 'Nova Equipa',
    leader_id: team.leader_id !== undefined ? team.leader_id : existingTeam?.leader_id || null,
    leader_name: team.leader_name?.trim() || existingTeam?.leader_name || 'Sem líder definido',
    leader_phone: team.leader_phone !== undefined ? team.leader_phone : existingTeam?.leader_phone || null,
    member_ids: validation.sanitizedMemberIds,
    member_names: validation.sanitizedMemberNames,
    specialties: team.specialties !== undefined ? team.specialties : existingTeam?.specialties || [],
    current_site_id: team.current_site_id !== undefined ? team.current_site_id : existingTeam?.current_site_id || null,
    current_site_name: team.current_site_name !== undefined ? team.current_site_name : existingTeam?.current_site_name || null,
    allocated_at: team.allocated_at !== undefined ? team.allocated_at : existingTeam?.allocated_at || null,
    allocation_end_date:
      team.allocation_end_date !== undefined ? team.allocation_end_date : existingTeam?.allocation_end_date || null,
    allocation_start_time:
      team.allocation_start_time !== undefined ? team.allocation_start_time : existingTeam?.allocation_start_time || null,
    allocation_end_time:
      team.allocation_end_time !== undefined ? team.allocation_end_time : existingTeam?.allocation_end_time || null,
    is_archived: team.is_archived !== undefined ? Boolean(team.is_archived) : Boolean(existingTeam?.is_archived),
    archived_at: team.archived_at !== undefined ? team.archived_at : existingTeam?.archived_at || null,
    member_joined_at: prevJoinedAt,
    member_specialties:
      team.member_specialties !== undefined ? team.member_specialties : existingTeam?.member_specialties || {},
    allocation_history:
      team.allocation_history !== undefined ? team.allocation_history : existingTeam?.allocation_history || [],
    activity_log: activityLog.slice(0, 200),
    notes: stripTeamMeta(team.notes !== undefined ? team.notes : existingTeam?.notes) || null,
    created_at: team.created_at || existingTeam?.created_at || nowIso,
  };

  if (supabase) {
    try {
      const dbPayload: Record<string, unknown> = {
        id: newTeam.id,
        company_id: newTeam.company_id,
        name: newTeam.name,
        leader_id: newTeam.leader_id,
        leader_name: newTeam.leader_name,
        leader_phone: newTeam.leader_phone,
        member_ids: newTeam.member_ids,
        member_names: newTeam.member_names,
        current_site_id: newTeam.current_site_id,
        current_site_name: newTeam.current_site_name,
        allocated_at: newTeam.allocated_at,
        notes: encodeTeamNotes(newTeam),
        created_at: newTeam.created_at,
      };

      const { data, error } = await supabase
        .from('teams')
        .upsert(dbPayload)
        .select('*')
        .single();
      if (!error && data) {
        const decoded = decodeTeamRow(data as Record<string, unknown>);
        const exists = currentTeams.some((t) => t.id === decoded.id);
        const updated = exists
          ? currentTeams.map((t) => (t.id === decoded.id ? decoded : t))
          : [...currentTeams, decoded];
        localStorage.setItem(localKey, JSON.stringify(updated));
        invalidateCache('teams');
        return decoded;
      }
    } catch (e) {
      console.warn('Erro ao salvar equipa no Supabase:', e);
    }
  }

  const exists = currentTeams.some((t) => t.id === newTeam.id);
  const updated = exists
    ? currentTeams.map((t) => (t.id === newTeam.id ? newTeam : t))
    : [...currentTeams, newTeam];
  localStorage.setItem(localKey, JSON.stringify(updated));
  invalidateCache('teams');
  return newTeam;
}

/**
 * Aloca ou agenda a alocação de uma equipa a uma obra (com registo no histórico e sincronização no Calendário)
 */
export async function allocateTeamToSiteWeb(params: {
  team: Team;
  site: ConstructionSite;
  startDate?: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
  transferReason?: string | null;
  companyId?: string;
  employees?: EmployeeProfile[];
}): Promise<Team> {
  const { team, site, startDate, endDate, startTime, endTime, notes, transferReason, companyId, employees } = params;
  if (team.is_archived) {
    throw new Error('Não é possível alocar uma equipa arquivada. Restaure a equipa primeiro.');
  }

  const nowIso = new Date().toISOString();
  const todayStr = nowIso.slice(0, 10);
  const effStartDate = startDate || todayStr;
  const isImmediate = effStartDate <= todayStr;
  const prevSiteId = team.current_site_id;
  const prevSiteName = team.current_site_name;

  // Se era uma transferência de outra obra ativa, fecha a alocação anterior e regista a sessão se aplicável
  let updatedHistory: TeamAllocationRecord[] = [...(team.allocation_history || [])];
  if (prevSiteId && prevSiteId !== site.id && isImmediate) {
    if (team.allocated_at) {
      const startMs = new Date(team.allocated_at).getTime();
      const diffHours = Math.round(Math.max(0.1, (Date.now() - startMs) / (1000 * 60 * 60)) * 10) / 10;
      if (diffHours > 0 && diffHours <= 24) {
        const workersCount = (team.member_ids?.length || 0) + (team.leader_id ? 1 : 0);
        await saveSiteWorkSession({
          company_id: companyId || team.company_id || null,
          site_id: prevSiteId,
          team_id: team.id,
          team_name: team.name,
          leader_id: team.leader_id || null,
          leader_name: team.leader_name,
          workers_count: Math.max(1, workersCount),
          work_date: todayStr,
          hours_worked: diffHours,
          man_hours: Math.round(diffHours * Math.max(1, workersCount) * 10) / 10,
          member_ids_snapshot: [
            ...(team.leader_id ? [team.leader_id] : []),
            ...(team.member_ids || []),
          ],
          description: `Sessão concluída antes da transferência para ${site.name}${transferReason ? ` (Motivo: ${transferReason})` : ''}`,
        });
      }
    }
    updatedHistory = updatedHistory.map((rec) =>
      rec.status === 'ativa' && rec.site_id === prevSiteId
        ? {
            ...rec,
            status: 'transferida',
            end_date: todayStr,
            transfer_reason: transferReason || rec.transfer_reason || 'Transferência operacional',
          }
        : rec
    );
  }

  const newRecord: TeamAllocationRecord = {
    id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    team_id: team.id,
    team_name: team.name,
    site_id: site.id,
    site_name: site.name,
    start_date: effStartDate,
    end_date: endDate || site.expected_end_date || null,
    start_time: startTime || null,
    end_time: endTime || null,
    status: isImmediate ? 'ativa' : 'planeada',
    changed_by: 'Administração',
    transfer_reason: transferReason || null,
    notes: notes || null,
    created_at: nowIso,
  };
  updatedHistory.unshift(newRecord);

  const actEvent: TeamActivityEvent = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    team_id: team.id,
    type: 'alocacao',
    title: prevSiteId && prevSiteId !== site.id ? `Transferência para ${site.name}` : isImmediate ? `Alocação em ${site.name}` : `Alocação Planeada: ${site.name}`,
    description: [
      prevSiteId && prevSiteId !== site.id ? `Transferida de ${prevSiteName || 'obra anterior'} para ${site.name}.` : `Associada à obra ${site.name}.`,
      `Início: ${effStartDate.split('-').reverse().join('/')}${startTime ? ` às ${startTime}` : ''}`,
      endDate ? `Fim previsto: ${endDate.split('-').reverse().join('/')}` : null,
      transferReason ? `Motivo: ${transferReason}` : null,
      notes ? `Obs: ${notes}` : null,
    ]
      .filter(Boolean)
      .join(' • '),
    site_id: site.id,
    site_name: site.name,
    author_name: 'Administração',
    created_at: nowIso,
  };

  const allocatedTimestamp = isImmediate
    ? startTime
      ? `${effStartDate}T${startTime}:00`
      : nowIso
    : team.allocated_at;

  const updatedTeam = await saveTeam(
    {
      ...team,
      current_site_id: isImmediate ? site.id : team.current_site_id,
      current_site_name: isImmediate ? site.name : team.current_site_name,
      allocated_at: isImmediate ? allocatedTimestamp : team.allocated_at,
      allocation_end_date: isImmediate ? endDate || site.expected_end_date || null : team.allocation_end_date,
      allocation_start_time: isImmediate ? startTime || null : team.allocation_start_time,
      allocation_end_time: isImmediate ? endTime || null : team.allocation_end_time,
      allocation_history: updatedHistory,
      activity_log: [actEvent, ...(team.activity_log || [])],
    },
    companyId,
    { employees }
  );

  // Sincroniza no Calendário Central (sem criar fonte de dados duplicada)
  try {
    await saveCalendarEvent(
      {
        id: `sync-team-alloc-${team.id}-${effStartDate}-${site.id.slice(0, 6)}`,
        company_id: companyId || team.company_id || null,
        title: `Alocação: ${team.name} → ${site.name}`,
        description: notes || `Equipa ${team.name} (${team.leader_name}) alocada na obra ${site.name}.`,
        event_date: effStartDate,
        end_date: endDate || effStartDate,
        start_time: startTime || null,
        end_time: endTime || null,
        all_day: !startTime,
        category: 'equipa',
        event_subtype: 'alocacao',
        site_id: site.id,
        site_name: site.name,
        assigned_employee_id: team.leader_id || null,
        assigned_employee_name: team.leader_name,
        assigned_team_id: team.id,
        assigned_team_name: team.name,
        priority: 'media',
        status: isImmediate ? 'em_andamento' : 'planeado',
        progress: isImmediate ? 50 : 0,
        visible_to_client: false,
        source_module: 'manual',
        is_completed: false,
      },
      companyId,
      true
    );
  } catch (e) {
    console.warn('Aviso ao sincronizar alocação da equipa no calendário:', e);
  }

  return updatedTeam;
}

/**
 * Termina a alocação ativa de uma equipa, preservando o histórico e registando a sessão de trabalho se aplicável
 */
export async function finishTeamAllocationWeb(params: {
  team: Team;
  recordSession?: boolean;
  sessionHours?: number;
  notes?: string;
  companyId?: string;
}): Promise<Team> {
  const { team, recordSession = true, sessionHours, notes, companyId } = params;
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.slice(0, 10);
  const prevSiteId = team.current_site_id;
  const prevSiteName = team.current_site_name;

  if (prevSiteId && recordSession) {
    let calcHours = sessionHours;
    if (typeof calcHours !== 'number' && team.allocated_at) {
      const startMs = new Date(team.allocated_at).getTime();
      const rawDiff = (Date.now() - startMs) / (1000 * 60 * 60);
      calcHours = Math.round(Math.min(12, Math.max(0.5, rawDiff)) * 10) / 10;
    }
    if (calcHours && calcHours > 0) {
      const workersCount = (team.member_ids?.length || 0) + (team.leader_id ? 1 : 0);
      await saveSiteWorkSession({
        company_id: companyId || team.company_id || null,
        site_id: prevSiteId,
        team_id: team.id,
        team_name: team.name,
        leader_id: team.leader_id || null,
        leader_name: team.leader_name,
        workers_count: Math.max(1, workersCount),
        work_date: todayStr,
        hours_worked: calcHours,
        man_hours: Math.round(calcHours * Math.max(1, workersCount) * 10) / 10,
        member_ids_snapshot: [
          ...(team.leader_id ? [team.leader_id] : []),
          ...(team.member_ids || []),
        ],
        description: notes || `Alocação encerrada em ${prevSiteName || 'obra'} (${calcHours}h de sessão)`,
      });
    }
  }

  const updatedHistory = (team.allocation_history || []).map((rec) =>
    rec.status === 'ativa'
      ? {
          ...rec,
          status: 'concluida' as const,
          end_date: todayStr,
          notes: notes || rec.notes || null,
        }
      : rec
  );

  const actEvent: TeamActivityEvent = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    team_id: team.id,
    type: 'alocacao',
    title: `Fim de Alocação: ${prevSiteName || 'Obra'}`,
    description: `A equipa concluiu a alocação na obra "${prevSiteName || 'Obra'}" e passou para o estado Disponível.${notes ? ` (${notes})` : ''}`,
    site_id: prevSiteId || null,
    site_name: prevSiteName || null,
    author_name: 'Administração',
    created_at: nowIso,
  };

  return saveTeam(
    {
      ...team,
      current_site_id: null,
      current_site_name: null,
      allocated_at: null,
      allocation_end_date: null,
      allocation_start_time: null,
      allocation_end_time: null,
      allocation_history: updatedHistory,
      activity_log: [actEvent, ...(team.activity_log || [])],
    },
    companyId,
    { skipValidationError: true }
  );
}

/**
 * Arquiva ou restaura uma equipa preservando todo o histórico, sessões, tarefas e associações (Secção 3.6)
 */
export async function toggleArchiveTeamWeb(
  team: Team,
  archive: boolean,
  companyId?: string
): Promise<Team> {
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.slice(0, 10);

  let updatedHistory = [...(team.allocation_history || [])];
  if (archive && team.current_site_id) {
    updatedHistory = updatedHistory.map((rec) =>
      rec.status === 'ativa'
        ? { ...rec, status: 'concluida' as const, end_date: todayStr }
        : rec
    );
  }

  const actEvent: TeamActivityEvent = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    team_id: team.id,
    type: 'arquivamento',
    title: archive ? 'Equipa Arquivada' : 'Equipa Restaurada / Reativada',
    description: archive
      ? `Equipa arquivada preservando históricos, sessões e tarefas. Novas alocações bloqueadas enquanto arquivada.`
      : `Equipa restaurada e novamente disponível para operações.`,
    author_name: 'Administração',
    created_at: nowIso,
  };

  return saveTeam(
    {
      ...team,
      is_archived: archive,
      archived_at: archive ? nowIso : null,
      current_site_id: archive ? null : team.current_site_id,
      current_site_name: archive ? null : team.current_site_name,
      allocated_at: archive ? null : team.allocated_at,
      allocation_end_date: archive ? null : team.allocation_end_date,
      allocation_start_time: archive ? null : team.allocation_start_time,
      allocation_end_time: archive ? null : team.allocation_end_time,
      allocation_history: updatedHistory,
      activity_log: [actEvent, ...(team.activity_log || [])],
    },
    companyId,
    { skipValidationError: true }
  );
}

/**
 * Transfere um colaborador de uma equipa para outra preservando o histórico em ambas as equipas (Secção 2.2)
 */
export async function transferCollaboratorBetweenTeamsWeb(params: {
  sourceTeam: Team;
  targetTeam: Team;
  employee: EmployeeProfile;
  reason?: string;
  companyId?: string;
}): Promise<{ updatedSource: Team; updatedTarget: Team }> {
  const { sourceTeam, targetTeam, employee, reason, companyId } = params;
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.slice(0, 10);

  // Remove da equipa de origem
  const sourceIdx = (sourceTeam.member_ids || []).indexOf(employee.id);
  const nextSourceIds = (sourceTeam.member_ids || []).filter((id) => id !== employee.id);
  const nextSourceNames = (sourceTeam.member_names || []).filter((_, i) => i !== sourceIdx);

  const sourceAct: TeamActivityEvent = {
    id: `act-${Date.now()}-src`,
    team_id: sourceTeam.id,
    type: 'composicao',
    title: `Transferência de Colaborador: ${employee.full_name}`,
    description: `${employee.full_name} foi transferido para a equipa "${targetTeam.name}".${reason ? ` Motivo: ${reason}` : ''}`,
    author_name: 'Administração',
    created_at: nowIso,
  };

  const updatedSource = await saveTeam(
    {
      ...sourceTeam,
      member_ids: nextSourceIds,
      member_names: nextSourceNames,
      activity_log: [sourceAct, ...(sourceTeam.activity_log || [])],
    },
    companyId,
    { skipValidationError: true }
  );

  // Adiciona à equipa de destino (se ainda não for o líder nem membro)
  const isTargetLeader = targetTeam.leader_id === employee.id;
  const alreadyInTarget = isTargetLeader || (targetTeam.member_ids || []).includes(employee.id);
  const nextTargetIds = alreadyInTarget
    ? targetTeam.member_ids || []
    : [...(targetTeam.member_ids || []), employee.id];
  const nextTargetNames = alreadyInTarget
    ? targetTeam.member_names || []
    : [...(targetTeam.member_names || []), employee.full_name];

  const targetAct: TeamActivityEvent = {
    id: `act-${Date.now()}-dst`,
    team_id: targetTeam.id,
    type: 'composicao',
    title: `Integração por Transferência: ${employee.full_name}`,
    description: `${employee.full_name} foi integrado proveniente da equipa "${sourceTeam.name}".${reason ? ` Motivo: ${reason}` : ''}`,
    author_name: 'Administração',
    created_at: nowIso,
  };

  const updatedTarget = await saveTeam(
    {
      ...targetTeam,
      member_ids: nextTargetIds,
      member_names: nextTargetNames,
      member_joined_at: {
        ...(targetTeam.member_joined_at || {}),
        [employee.id]: todayStr,
      },
      activity_log: [targetAct, ...(targetTeam.activity_log || [])],
    },
    companyId,
    { skipValidationError: true }
  );

  return { updatedSource, updatedTarget };
}

/**
 * Regista uma ocorrência ou evento operacional no histórico da equipa (Secção 2.5)
 */
export async function logTeamActivityWeb(params: {
  team: Team;
  type: TeamActivityEvent['type'];
  title: string;
  description: string;
  siteId?: string | null;
  siteName?: string | null;
  authorName?: string;
  companyId?: string;
}): Promise<Team> {
  const { team, type, title, description, siteId, siteName, authorName, companyId } = params;
  const act: TeamActivityEvent = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    team_id: team.id,
    type,
    title: title.trim(),
    description: description.trim(),
    site_id: siteId || team.current_site_id || null,
    site_name: siteName || team.current_site_name || null,
    author_name: authorName || 'Administração',
    created_at: new Date().toISOString(),
  };

  return saveTeam(
    {
      ...team,
      activity_log: [act, ...(team.activity_log || [])],
    },
    companyId,
    { skipValidationError: true }
  );
}

export async function deleteTeam(teamId: string, companyId?: string): Promise<void> {
  const localKey = getTeamsStorageKey(companyId);
  if (supabase) {
    try {
      await supabase.from('teams').delete().eq('id', teamId);
    } catch (e) {
      console.warn('Erro ao eliminar equipa no Supabase:', e);
    }
  }
  const current = await getTeams(companyId);
  const filtered = current.filter((t) => t.id !== teamId);
  localStorage.setItem(localKey, JSON.stringify(filtered));
  invalidateCache('teams');
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
