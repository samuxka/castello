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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConstructionSite, EmployeeProfile, EntryType, Team, TimeEntry } from '../types';
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
import {
  fetchSites,
  fetchUserTeamMobile,
  allocateTeamToSiteMobile,
  changeTeamSiteMobile,
  finishTeamShiftMobile,
} from '../lib/supabase';
import { showCustomAlert, showCustomConfirm } from '../context/DialogContext';

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
    success: '#16A34A',
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

  // ==========================================================================
  // GESTÃO DE EQUIPA E ALOCAÇÃO DE OBRA PELO LÍDER
  // ==========================================================================
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [loadingTeam, setLoadingTeam] = useState<boolean>(false);
  const [teamModalVisible, setTeamModalVisible] = useState<boolean>(false);
  const [sitesList, setSitesList] = useState<ConstructionSite[]>([]);
  const [siteSelectModalVisible, setSiteSelectModalVisible] = useState<boolean>(false);
  const [teamActionLoading, setTeamActionLoading] = useState<boolean>(false);

  const loadTeamData = async () => {
    setLoadingTeam(true);
    try {
      const team = await fetchUserTeamMobile(
        employee.id,
        employee.full_name,
        employee.company_id || undefined
      );
      setUserTeam(team);
    } catch (e) {
      console.warn('Erro ao carregar equipa do colaborador:', e);
    } finally {
      setLoadingTeam(false);
    }
  };

  useEffect(() => {
    loadTeamData();
    fetchSites()
      .then((data) => setSitesList(data || []))
      .catch(() => {});
  }, [employee.id]);

  const isTeamLeader = Boolean(
    userTeam &&
      (userTeam.leader_id === employee.id ||
        userTeam.leader_name?.trim().toLowerCase() === employee.full_name?.trim().toLowerCase() ||
        employee.role === 'patrao')
  );

  const getElapsedWorkTimeString = () => {
    if (!userTeam?.allocated_at) return '0h 00m';
    const startMs = new Date(userTeam.allocated_at).getTime();
    const diffMs = Math.max(0, now.getTime() - startMs);
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes < 10 ? '0' : ''}${minutes}m`;
  };

  const handleSelectSiteToAllocate = async (selectedSite: ConstructionSite) => {
    if (!userTeam) return;
    setTeamActionLoading(true);
    try {
      if (userTeam.current_site_id && userTeam.current_site_id !== selectedSite.id) {
        // Mudar de Obra: Salva horas na anterior e aloca na nova
        const { session, updatedTeam } = await changeTeamSiteMobile({
          team: userTeam,
          newSiteId: selectedSite.id,
          newSiteName: selectedSite.name,
          companyId: employee.company_id || undefined,
        });
        setUserTeam(updatedTeam);
        setSiteSelectModalVisible(false);
        const hoursTxt = session ? `${session.hours_worked}h` : '';
        showCustomAlert(
          'Obra Alterada com Sucesso!',
          `A equipa ${updatedTeam.name} foi deslocada para ${selectedSite.name}.${
            hoursTxt ? ` Foram contabilizadas e enviadas ${hoursTxt} trabalhadas na obra anterior para o portal do cliente.` : ''
          }`,
          [{ text: 'OK' }],
          'success'
        );
      } else {
        // Primeira alocação do dia
        const updated = await allocateTeamToSiteMobile(
          userTeam.id,
          selectedSite.id,
          selectedSite.name,
          employee.company_id || undefined
        );
        setUserTeam(updated);
        setSiteSelectModalVisible(false);
        showCustomAlert(
          'Equipa Alocada!',
          `A equipa ${updated.name} iniciou os trabalhos na obra ${selectedSite.name}. O tempo de permanência começou a contar agora.`,
          [{ text: 'OK' }],
          'success'
        );
      }
    } catch (err: any) {
      showCustomAlert('Erro', err.message || 'Falha ao alocar obra.', [{ text: 'OK' }], 'danger');
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handleConfirmFinishShift = () => {
    if (!userTeam || !userTeam.current_site_id) return;
    showCustomConfirm(
      'Finalizar Turno na Obra?',
      `Deseja concluir o trabalho da equipa ${userTeam.name} na obra "${userTeam.current_site_name}"? As horas de hoje serão gravadas automaticamente para o relatório do cliente.`,
      async () => {
        setTeamActionLoading(true);
        try {
          const { session, updatedTeam } = await finishTeamShiftMobile({
            team: userTeam,
            companyId: employee.company_id || undefined,
          });
          setUserTeam(updatedTeam);
          const hoursTxt = session ? `${session.hours_worked}h` : '';
          showCustomAlert(
            'Turno Finalizado!',
            `Turno encerrado com sucesso.${
              hoursTxt ? ` Foram registadas ${hoursTxt} de trabalho da equipa para o cliente.` : ''
            }`,
            [{ text: 'OK' }],
            'success'
          );
        } catch (err: any) {
          showCustomAlert('Erro', err.message || 'Erro ao finalizar turno.', [{ text: 'OK' }], 'danger');
        } finally {
          setTeamActionLoading(false);
        }
      },
      undefined,
      'Sim, Finalizar Turno',
      'Cancelar',
      'danger'
    );
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

      {/* BOTÃO DA EQUIPA (EMBAIXO DOS REGISTOS DE HOJE) */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          loadTeamData();
          setTeamModalVisible(true);
        }}
        style={[
          styles.flatCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 14,
            paddingHorizontal: 16,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              backgroundColor: colors.cardSubtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="people" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textMain }}>
                {userTeam ? userTeam.name : 'Equipa'}
              </Text>
              {isTeamLeader && (
                <View
                  style={{
                    backgroundColor: colors.primary,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>
                    LÍDER
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={{
                fontSize: 12,
                color: userTeam?.current_site_name ? colors.success : colors.textMuted,
                marginTop: 2,
                fontWeight: userTeam?.current_site_name ? '600' : '400',
              }}
              numberOfLines={1}
            >
              {userTeam
                ? userTeam.current_site_name
                  ? `Em Obra: ${userTeam.current_site_name} (${getElapsedWorkTimeString()})`
                  : 'Nenhuma obra alocada hoje'
                : 'Toque para consultar a sua equipa'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: userTeam?.current_site_name ? '#16A34A' : '#94A3B8',
            }}
          />
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </TouchableOpacity>

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

      {/* ================================================================== */}
      {/* MODAL: INFORMAÇÕES DA EQUIPA & ALOCAÇÃO DE OBRA PELO LÍDER          */}
      {/* ================================================================== */}
      <Modal visible={teamModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              {
                backgroundColor: colors.card,
                maxHeight: '85%',
                width: '92%',
                padding: 20,
              },
            ]}
          >
            {/* Cabeçalho do Modal */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: colors.cardSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="people" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.modalTitleText, { color: colors.textMain }]}>
                    {userTeam ? userTeam.name : 'Equipa'}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    {isTeamLeader ? 'Você é o líder desta equipa' : 'Membro da equipa'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setTeamModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
              {!userTeam ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.textMain,
                      fontWeight: '600',
                      marginTop: 10,
                      textAlign: 'center',
                    }}
                  >
                    Nenhuma equipa atribuída
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center' }}>
                    Ainda não foi adicionado a nenhuma equipa. Contacte o administrador da firma.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  {/* CARD DE STATUS DA OBRA HOJE */}
                  <View
                    style={{
                      borderRadius: 10,
                      padding: 16,
                      backgroundColor: userTeam.current_site_name ? (isDark ? '#064E3B' : '#ECFDF5') : colors.cardSubtle,
                      borderWidth: 1,
                      borderColor: userTeam.current_site_name ? '#10B981' : colors.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          color: userTeam.current_site_name ? colors.success : colors.textMuted,
                          letterSpacing: 0.5,
                        }}
                      >
                        {userTeam.current_site_name ? 'Obra Alocada Hoje' : 'Sem Obra Ativa'}
                      </Text>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: userTeam.current_site_name ? '#10B981' : '#64748B',
                        }}
                      />
                    </View>

                    {userTeam.current_site_name ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textMain }}>
                          {userTeam.current_site_name}
                        </Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="time-outline" size={15} color={colors.primary} />
                            <Text style={{ fontSize: 12, color: colors.textMuted }}>
                              Início:{' '}
                              <Text style={{ fontWeight: '700', color: colors.textMain }}>
                                {userTeam.allocated_at
                                  ? new Date(userTeam.allocated_at).toLocaleTimeString('pt-PT', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : '08:00'}
                              </Text>
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="timer-outline" size={15} color={colors.success} />
                            <Text style={{ fontSize: 12, color: colors.textMuted }}>
                              Permanência:{' '}
                              <Text style={{ fontWeight: '800', color: colors.success }}>
                                {getElapsedWorkTimeString()}
                              </Text>
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 6 }}>
                        A equipa ainda não iniciou atividade em nenhuma obra hoje.
                      </Text>
                    )}

                    {/* Ações do Líder para Alocação / Mudança de Obra */}
                    {isTeamLeader ? (
                      <View style={{ marginTop: 14, gap: 8 }}>
                        {userTeam.current_site_name ? (
                          <>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => setSiteSelectModalVisible(true)}
                              disabled={teamActionLoading}
                              style={{
                                backgroundColor: colors.primary,
                                paddingVertical: 10,
                                borderRadius: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                            >
                              <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
                              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                                Mudar de Obra
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={handleConfirmFinishShift}
                              disabled={teamActionLoading}
                              style={{
                                borderWidth: 1,
                                borderColor: '#EF4444',
                                paddingVertical: 9,
                                borderRadius: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                            >
                              <Ionicons name="stop-circle-outline" size={16} color="#EF4444" />
                              <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>
                                Finalizar Turno na Obra
                              </Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setSiteSelectModalVisible(true)}
                            disabled={teamActionLoading}
                            style={{
                              backgroundColor: colors.primary,
                              paddingVertical: 12,
                              borderRadius: 8,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                            }}
                          >
                            <Ionicons name="location" size={18} color="#FFFFFF" />
                            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
                              Alocar Obra Agora
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <Text
                        style={{
                          fontSize: 11,
                          color: colors.textMuted,
                          marginTop: 10,
                          fontStyle: 'italic',
                        }}
                      >
                        A alocação de obra e registo de horas é gerido pelo líder ({userTeam.leader_name}).
                      </Text>
                    )}
                  </View>

                  {/* INFORMAÇÕES DO LÍDER */}
                  <View
                    style={{
                      borderRadius: 10,
                      padding: 14,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>
                      Líder Responsável
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          backgroundColor: colors.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="person" size={20} color="#FFFFFF" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMain }}>
                          {userTeam.leader_name} {isTeamLeader ? '(Você)' : ''}
                        </Text>
                        {userTeam.leader_phone && (
                          <Text style={{ fontSize: 12, color: colors.textMuted }}>
                            Tel: {userTeam.leader_phone}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* INTEGRANTES DA EQUIPA */}
                  <View
                    style={{
                      borderRadius: 10,
                      padding: 14,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
                      Integrantes da Equipa ({userTeam.member_names?.length || 0})
                    </Text>
                    {userTeam.member_names && userTeam.member_names.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {userTeam.member_names.map((mName, mIdx) => (
                          <View
                            key={mIdx}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 5,
                              borderRadius: 6,
                              backgroundColor: colors.cardSubtle,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Text style={{ fontSize: 12, color: colors.textMain, fontWeight: '500' }}>
                              {mName}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' }}>
                        Nenhum outro membro associado.
                      </Text>
                    )}
                  </View>

                  {userTeam.notes && (
                    <View
                      style={{
                        borderRadius: 10,
                        padding: 12,
                        backgroundColor: colors.cardSubtle,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        Observações: {userTeam.notes}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL: SELECIONAR OBRA PARA ALOCAÇÃO DA EQUIPA                    */}
      {/* ================================================================== */}
      <Modal visible={siteSelectModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              {
                backgroundColor: colors.card,
                maxHeight: '80%',
                width: '90%',
                padding: 20,
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalTitleText, { color: colors.textMain }]}>
                  Alocar Equipa em Obra
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                  Selecione o local de trabalho da equipa
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSiteSelectModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 14 }}>
              {sitesList.length === 0 ? (
                <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 }}>
                  Nenhuma obra cadastrada na empresa.
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {sitesList.map((siteItem) => {
                    const isSelected = userTeam?.current_site_id === siteItem.id;
                    return (
                      <TouchableOpacity
                        key={siteItem.id}
                        activeOpacity={0.7}
                        onPress={() => handleSelectSiteToAllocate(siteItem)}
                        disabled={teamActionLoading}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          backgroundColor: isSelected ? colors.cardSubtle : colors.card,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.primary : colors.border,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMain }}>
                            {siteItem.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                            {siteItem.address}
                          </Text>
                        </View>
                        {isSelected ? (
                          <View
                            style={{
                              backgroundColor: colors.primary,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>
                              ATUAL
                            </Text>
                          </View>
                        ) : (
                          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>
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
