import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConstructionSite, EmployeeProfile, EntryType, TimeEntry } from '../types';
import {
  calculateDailySummary,
  calculateMonthlySummaries,
  formatIsoToTime,
  formatSecondsToTimer,
  getLocalDateString,
} from '../utils/timeCalculations';
import {
  clearLunchTimer,
  getSavedLunchTimer,
  LunchTimerState,
  playRingingAlarm,
  startLunchTimer,
  stopRingingAlarm,
} from '../utils/alarmService';

interface HomeScreenProps {
  employee: EmployeeProfile;
  currentSite: ConstructionSite | null;
  entries: TimeEntry[];
  onRegisterEntry: (type: EntryType) => Promise<void>;
  theme: 'light' | 'dark';
}

const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAYS_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  employee,
  currentSite,
  entries,
  onRegisterEntry,
  theme,
}) => {
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    border: isDark ? '#334155' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#94A3B8' : '#64748B',
    primary: '#2563EB',
    cardSubtle: isDark ? '#172554' : '#EFF6FF',
    primaryBorder: isDark ? '#1E3A8A' : '#BFDBFE',
  };

  const [now, setNow] = useState<Date>(new Date());
  const [dialogVisible, setDialogVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Timer de Almoço de 1h
  const [lunchTimer, setLunchTimer] = useState<LunchTimerState | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(3600);
  const [alarmRinging, setAlarmRinging] = useState<boolean>(false);
  const alarmTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      const saved = await getSavedLunchTimer();
      if (saved && saved.isActive) {
        const diffSec = Math.ceil((saved.endTimeMs - Date.now()) / 1000);
        if (diffSec > 0) {
          setLunchTimer(saved);
          setRemainingSeconds(diffSec);
        } else {
          setLunchTimer(saved);
          setRemainingSeconds(0);
          triggerAlarmNow();
        }
      }
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        setNow(new Date());
        const saved = await getSavedLunchTimer();
        if (saved && saved.isActive) {
          const diffSec = Math.ceil((saved.endTimeMs - Date.now()) / 1000);
          if (diffSec <= 0 && !alarmTriggeredRef.current) {
            setRemainingSeconds(0);
            triggerAlarmNow();
          } else if (diffSec > 0) {
            setRemainingSeconds(diffSec);
          }
        }
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const current = new Date();
      setNow(current);

      if (lunchTimer && lunchTimer.isActive) {
        const diffSec = Math.ceil((lunchTimer.endTimeMs - current.getTime()) / 1000);
        if (diffSec <= 0) {
          setRemainingSeconds(0);
          if (!alarmTriggeredRef.current) {
            triggerAlarmNow();
          }
        } else {
          setRemainingSeconds(diffSec);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lunchTimer]);

  const triggerAlarmNow = async () => {
    alarmTriggeredRef.current = true;
    setAlarmRinging(true);
    await playRingingAlarm();
  };

  const handleStopAlarm = async () => {
    await stopRingingAlarm();
    await clearLunchTimer();
    alarmTriggeredRef.current = false;
    setAlarmRinging(false);
    setLunchTimer(null);
  };

  const handleSelectOption = async (type: EntryType) => {
    setSubmitting(true);
    try {
      await onRegisterEntry(type);
      setDialogVisible(false);

      if (type === 'almoco') {
        alarmTriggeredRef.current = false;
        const timerState = await startLunchTimer(3600);
        setLunchTimer(timerState);
        setRemainingSeconds(3600);
        showFeedback('Registo de almoço efetuado. Timer de 1 hora ativado.');
      } else if (type === 'entrada') {
        if (lunchTimer) await handleStopAlarm();
        showFeedback('Registo de entrada enviado para validação.');
      } else if (type === 'saida') {
        if (lunchTimer) await handleStopAlarm();
        showFeedback('Registo de saída enviado para validação.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const showFeedback = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => setFeedbackBanner(null), 4000);
  };

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthlyStats = calculateMonthlySummaries(entries, currentYear, currentMonth);
  const todayStr = getLocalDateString(now);
  const todayEntries = entries.filter((e) => e.work_date === todayStr);
  const todaySummary = calculateDailySummary(todayStr, todayEntries);

  // Regras de bloqueio progressivo diário:
  // 1. Início do dia: Apenas 'entrada' liberada
  // 2. Após 'entrada' feita: 'entrada' bloqueada, 'almoco' e 'saida' liberadas
  // 3. Uma vez feito cada tipo no dia, ele não pode ser repetido
  const hasEntrada = todayEntries.some((e) => e.entry_type === 'entrada');
  const hasAlmoco = todayEntries.some((e) => e.entry_type === 'almoco');
  const hasSaida = todayEntries.some((e) => e.entry_type === 'saida');

  const canDoEntrada = !hasEntrada;
  const canDoAlmoco = hasEntrada && !hasAlmoco;
  const canDoSaida = hasEntrada && !hasSaida;
  const allCompletedToday = hasEntrada && hasSaida;

  const targetMinutes = (employee.monthly_target_hours || 176) * 60;
  const progressPercent = Math.min(
    100,
    Math.round((monthlyStats.totalMinutes / targetMinutes) * 100)
  );

  const hoursStr = String(now.getHours()).padStart(2, '0');
  const minutesStr = String(now.getMinutes()).padStart(2, '0');
  const secondsStr = String(now.getSeconds()).padStart(2, '0');
  const formattedDate = `${WEEKDAYS_PT[now.getDay()]}, ${now.getDate()} de ${
    MONTHS_PT[now.getMonth()]
  } de ${now.getFullYear()}`;

  // Estimativa em Euros (€)
  const estimatedEarned = (
    (monthlyStats.totalMinutes / 60) *
    (employee.hourly_rate || 0)
  ).toFixed(2);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {feedbackBanner && (
        <View style={styles.feedbackBanner}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#2563EB" />
          <Text style={styles.feedbackText}>{feedbackBanner}</Text>
        </View>
      )}

      {/* CARD 1: QUANTAS HORAS TRABALHOU NO MÊS */}
      <View
        style={[
          styles.flatCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={[styles.cardTagLabel, { color: colors.textMuted }]}>
              TOTAL DE HORAS TRABALHADAS EM {MONTHS_PT[currentMonth].toUpperCase()}
            </Text>
            <Text style={[styles.cardBigHours, { color: colors.textMain }]}>
              {monthlyStats.totalFormatted}
            </Text>
          </View>
          <View style={styles.tagEuroBadge}>
            <Text style={styles.tagEuroText}>€ {estimatedEarned}</Text>
          </View>
        </View>

        {/* Barra de Progresso Flat */}
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[styles.progressIndicator, { width: `${progressPercent}%` }]}
          />
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            Meta mensal: {employee.monthly_target_hours}h ({progressPercent}%)
          </Text>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {monthlyStats.daysWorkedCount} dias efetuados
          </Text>
        </View>
      </View>

      {/* CARD 2: RELÓGIO DIGITAL FLAT (OU TIMER DE 1H SE EM ALMOÇO) */}
      {lunchTimer && lunchTimer.isActive ? (
        <View
          style={[
            styles.flatCard,
            styles.timerCardActive,
            { backgroundColor: colors.cardSubtle, borderColor: colors.primaryBorder },
          ]}
        >
          <View style={styles.timerHeaderRow}>
            <Text style={styles.timerBadgeLabel}>PAUSA DE ALMOÇO (1 HORA)</Text>
            <Text style={[styles.timerReturnSub, { color: colors.primary }]}>
              Regresso: {formatIsoToTime(new Date(lunchTimer.endTimeMs).toISOString())}
            </Text>
          </View>

          <Text style={[styles.timerDigitalValue, { color: colors.primary }]}>
            {formatSecondsToTimer(remainingSeconds)}
          </Text>

          <Text style={[styles.timerHintText, { color: colors.textMuted }]}>
            O alarme soará automaticamente no término da 1h de descanso
          </Text>

          <View style={styles.timerActionsRow}>
            <TouchableOpacity
              style={styles.btnSmallAction}
              onPress={async () => {
                alarmTriggeredRef.current = false;
                const state = await startLunchTimer(5);
                setLunchTimer(state);
                setRemainingSeconds(5);
                showFeedback('Teste de alarme configurado para 5 segundos.');
              }}
            >
              <Text style={styles.btnSmallActionText}>Testar Alarme (5s)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSmallCancel} onPress={handleStopAlarm}>
              <Text style={styles.btnSmallCancelText}>Cancelar Timer</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.flatCard,
            styles.clockCenteredCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.clockLabel, { color: colors.textMuted }]}>
            HORA OFICIAL
          </Text>

          <View style={styles.clockDigitsRow}>
            <Text style={[styles.clockMainDigits, { color: colors.textMain }]}>
              {hoursStr}:{minutesStr}
            </Text>
            <Text style={styles.clockSecondsDigit}>:{secondsStr}</Text>
          </View>

          <Text style={[styles.clockDateFormatted, { color: colors.textMuted }]}>
            {formattedDate}
          </Text>
        </View>
      )}

      {/* CARD 3: BOTÃO REGISTAR PONTO */}
      <TouchableOpacity
        style={[
          styles.btnRegisterBig,
          allCompletedToday && { backgroundColor: '#16A34A', opacity: 0.85 },
        ]}
        activeOpacity={0.9}
        onPress={() => setDialogVisible(true)}
      >
        <Ionicons
          name={allCompletedToday ? 'checkmark-done-circle-outline' : 'time-outline'}
          size={24}
          color="#FFFFFF"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.btnRegisterTitle}>
            {allCompletedToday ? 'Picagens Concluídas Hoje' : 'Registar Ponto'}
          </Text>
          <Text style={styles.btnRegisterSub}>
            {!hasEntrada
              ? 'Próximo: Registar Entrada'
              : !hasSaida
              ? 'Próximo: Almoço ou Saída'
              : 'Entrada e Saída já efetuadas'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {/* REGISTOS DE HOJE */}
      <View
        style={[
          styles.flatCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.todayHeader}>
          <Text style={[styles.todayTitle, { color: colors.textMain }]}>
            Registos de Hoje
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
            {todaySummary.workedFormatted}
          </Text>
        </View>

        <View style={styles.punchesGrid}>
          <View
            style={[
              styles.punchColumn,
              { backgroundColor: colors.cardSubtle, borderColor: colors.primaryBorder },
            ]}
          >
            <Text style={[styles.punchColLabel, { color: colors.textMuted }]}>
              Entrada
            </Text>
            <Text style={[styles.punchColValue, { color: colors.textMain }]}>
              {todaySummary.entradaTime || '--:--'}
            </Text>
          </View>

          <View
            style={[
              styles.punchColumn,
              { backgroundColor: colors.cardSubtle, borderColor: colors.primaryBorder },
            ]}
          >
            <Text style={[styles.punchColLabel, { color: colors.textMuted }]}>
              Almoço
            </Text>
            <Text style={[styles.punchColValue, { color: colors.textMain }]}>
              {todaySummary.almocoTime || '--:--'}
            </Text>
          </View>

          <View
            style={[
              styles.punchColumn,
              { backgroundColor: colors.cardSubtle, borderColor: colors.primaryBorder },
            ]}
          >
            <Text style={[styles.punchColLabel, { color: colors.textMuted }]}>
              Saída
            </Text>
            <Text style={[styles.punchColValue, { color: colors.textMain }]}>
              {todaySummary.saidaTime || '--:--'}
            </Text>
          </View>
        </View>
      </View>

      {/* MODAL DIALOG REGISTAR PONTO */}
      <Modal visible={dialogVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalTitleText, { color: colors.textMain }]}>
                  Registar Ponto
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Horário: {hoursStr}:{minutesStr}:{secondsStr}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDialogVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Opção Entrada */}
            <TouchableOpacity
              style={[
                styles.dialogOptionBtn,
                {
                  borderColor: canDoEntrada ? colors.border : 'transparent',
                  opacity: canDoEntrada ? 1 : 0.4,
                  backgroundColor: canDoEntrada ? 'transparent' : colors.cardSubtle,
                },
              ]}
              disabled={submitting || !canDoEntrada}
              onPress={() => handleSelectOption('entrada')}
            >
              <View style={styles.dialogOptionIconBox}>
                <Ionicons
                  name={hasEntrada ? 'checkmark-circle' : 'log-in-outline'}
                  size={20}
                  color={hasEntrada ? '#16A34A' : '#2563EB'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dialogOptionTitle, { color: colors.textMain }]}>
                  Entrada {hasEntrada ? '(Já Registada Hoje)' : ''}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {hasEntrada
                    ? `Efetuada às ${todaySummary.entradaTime || '--:--'}`
                    : 'Início da jornada diária'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Opção Almoço */}
            <TouchableOpacity
              style={[
                styles.dialogOptionBtn,
                {
                  borderColor: canDoAlmoco ? colors.border : 'transparent',
                  opacity: canDoAlmoco ? 1 : 0.4,
                  backgroundColor: canDoAlmoco ? 'transparent' : colors.cardSubtle,
                },
              ]}
              disabled={submitting || !canDoAlmoco}
              onPress={() => handleSelectOption('almoco')}
            >
              <View style={styles.dialogOptionIconBox}>
                <Ionicons
                  name={hasAlmoco ? 'checkmark-circle' : 'restaurant-outline'}
                  size={20}
                  color={hasAlmoco ? '#16A34A' : '#2563EB'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dialogOptionTitle, { color: colors.textMain }]}>
                  Almoço {hasAlmoco ? '(Já Registado Hoje)' : ''}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {!hasEntrada
                    ? 'Bloqueado: Requer registo de Entrada primeiro'
                    : hasAlmoco
                    ? `Efetuado às ${todaySummary.almocoTime || '--:--'}`
                    : 'Inicia timer de 1 hora com alarme'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Opção Saída */}
            <TouchableOpacity
              style={[
                styles.dialogOptionBtn,
                {
                  borderColor: canDoSaida ? colors.border : 'transparent',
                  opacity: canDoSaida ? 1 : 0.4,
                  backgroundColor: canDoSaida ? 'transparent' : colors.cardSubtle,
                },
              ]}
              disabled={submitting || !canDoSaida}
              onPress={() => handleSelectOption('saida')}
            >
              <View style={styles.dialogOptionIconBox}>
                <Ionicons
                  name={hasSaida ? 'checkmark-circle' : 'log-out-outline'}
                  size={20}
                  color={hasSaida ? '#16A34A' : '#2563EB'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dialogOptionTitle, { color: colors.textMain }]}>
                  Saída {hasSaida ? '(Já Registada Hoje)' : ''}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {!hasEntrada
                    ? 'Bloqueado: Requer registo de Entrada primeiro'
                    : hasSaida
                    ? `Efetuada às ${todaySummary.saidaTime || '--:--'}`
                    : 'Término do período diário de trabalho'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogCloseBtn}
              onPress={() => setDialogVisible(false)}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                Fechar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL ALARME DE ALMOÇO */}
      <Modal visible={alarmRinging} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, alignItems: 'center' }]}>
            <View style={styles.alarmIconCircle}>
              <Ionicons name="alarm-outline" size={36} color="#FFFFFF" />
            </View>
            <Text style={[styles.modalTitleText, { color: colors.textMain, textAlign: 'center' }]}>
              Fim do Horário de Almoço
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginVertical: 12 }}>
              A 1 hora de pausa terminou. Desative o alarme e regresse às atividades.
            </Text>
            <TouchableOpacity style={styles.btnStopAlarm} onPress={handleStopAlarm}>
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>
                Desligar Alarme
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  feedbackText: {
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  flatCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTagLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardBigHours: {
    fontSize: 30,
    fontWeight: '700',
    marginTop: 4,
  },
  tagEuroBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  tagEuroText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressIndicator: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12,
  },
  siteFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  siteFooterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  clockCenteredCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  clockLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  clockDigitsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  clockMainDigits: {
    fontSize: 52,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  clockSecondsDigit: {
    fontSize: 26,
    fontWeight: '600',
    color: '#2563EB',
    fontVariant: ['tabular-nums'],
  },
  clockDateFormatted: {
    fontSize: 13,
    marginTop: 6,
  },
  timerCardActive: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  timerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  timerBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  timerReturnSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  timerDigitalValue: {
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timerHintText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  timerActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btnSmallAction: {
    backgroundColor: '#2563EB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  btnSmallActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  btnSmallCancel: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  btnSmallCancelText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  btnRegisterBig: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  btnRegisterTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  btnRegisterSub: {
    color: '#BFDBFE',
    fontSize: 12,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  todayTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  punchesGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  punchColumn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  punchColLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  punchColValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitleText: {
    fontSize: 17,
    fontWeight: '700',
  },
  dialogOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  dialogOptionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  dialogCloseBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  alarmIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  btnStopAlarm: {
    backgroundColor: '#2563EB',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
});
