import { DailyWorkSummary, TimeEntry } from '../types';

/**
 * Formata minutos em string "XXh YYm" (ex: 485 -> "08h 05m")
 */
export function formatMinutesToHours(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

/**
 * Formata segundos restantes do timer de almoço em "HH:MM:SS"
 */
export function formatSecondsToTimer(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formata um ISO timestamp para "HH:MM" no fuso local
 */
export function formatIsoToTime(isoString: string | null): string {
  if (!isoString) return '--:--';
  const date = new Date(isoString);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Retorna a data local no formato YYYY-MM-DD
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcula os minutos trabalhados em um dia a partir das batidas (entrada, almoco, saida).
 * Regra de cálculo:
 * - Se tem Entrada e Saída:
 *   total = (Saída - Entrada) - (60 min se registrou Almoço e o período total for > 90 min).
 * - Se tem apenas Entrada e Almoço (ainda não bateu saída):
 *   total parcial = (Almoço - Entrada).
 */
export function calculateDailySummary(
  date: string,
  dayEntries: TimeEntry[]
): DailyWorkSummary {
  const sorted = [...dayEntries]
    .filter((e) => !e.notes || !e.notes.startsWith('[JUSTIFICATIVA_FALTA]'))
    .sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );

  const entrada = sorted.find((e) => e.entry_type === 'entrada') || null;
  const almoco = sorted.find((e) => e.entry_type === 'almoco') || null;
  const saida = [...sorted].reverse().find((e) => e.entry_type === 'saida') || null;

  let workedMinutes = 0;
  let isComplete = false;

  if (entrada && saida) {
    const startMs = new Date(entrada.recorded_at).getTime();
    const endMs = new Date(saida.recorded_at).getTime();
    const rawMinutes = Math.max(0, (endMs - startMs) / 60000);

    // Se houve registro de almoço, desconta 1h (60 min) de intervalo de almoço
    if (almoco && rawMinutes > 60) {
      workedMinutes = Math.max(0, rawMinutes - 60);
    } else {
      workedMinutes = rawMinutes;
    }
    isComplete = true;
  } else if (entrada && almoco) {
    const startMs = new Date(entrada.recorded_at).getTime();
    const lunchMs = new Date(almoco.recorded_at).getTime();
    workedMinutes = Math.max(0, (lunchMs - startMs) / 60000);
  }

  const hasPending = sorted.some((e) => e.status === 'pendente');

  return {
    date,
    entries: sorted,
    entradaTime: entrada ? formatIsoToTime(entrada.recorded_at) : null,
    almocoTime: almoco ? formatIsoToTime(almoco.recorded_at) : null,
    saidaTime: saida ? formatIsoToTime(saida.recorded_at) : null,
    workedMinutes: Math.round(workedMinutes),
    workedFormatted: formatMinutesToHours(workedMinutes),
    isComplete,
    hasPending,
  };
}

/**
 * Agrupa todos os registros de um mês (YYYY-MM) por dia e retorna o resumo mensal
 */
export function calculateMonthlySummaries(
  entries: TimeEntry[],
  year: number,
  monthZeroIndexed: number
): {
  totalMinutes: number;
  totalFormatted: string;
  daysWorkedCount: number;
  dailyMap: Record<string, DailyWorkSummary>;
  dailyList: DailyWorkSummary[];
} {
  const prefix = `${year}-${String(monthZeroIndexed + 1).padStart(2, '0')}`;
  const filtered = entries.filter(
    (e) =>
      e.work_date.startsWith(prefix) &&
      (!e.notes || !e.notes.startsWith('[JUSTIFICATIVA_FALTA]'))
  );

  const grouped: Record<string, TimeEntry[]> = {};
  for (const entry of filtered) {
    if (!grouped[entry.work_date]) {
      grouped[entry.work_date] = [];
    }
    grouped[entry.work_date].push(entry);
  }

  const dailyMap: Record<string, DailyWorkSummary> = {};
  let totalMinutes = 0;
  let daysWorkedCount = 0;

  for (const [date, dayEntries] of Object.entries(grouped)) {
    const summary = calculateDailySummary(date, dayEntries);
    dailyMap[date] = summary;
    if (summary.workedMinutes > 0) {
      totalMinutes += summary.workedMinutes;
      daysWorkedCount += 1;
    }
  }

  const dailyList = Object.values(dailyMap).sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  return {
    totalMinutes,
    totalFormatted: formatMinutesToHours(totalMinutes),
    daysWorkedCount,
    dailyMap,
    dailyList,
  };
}

