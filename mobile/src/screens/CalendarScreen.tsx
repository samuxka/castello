import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  AbsenceJustification,
  ConstructionSite,
  EmployeeProfile,
  EntryType,
  TimeEntry,
} from '../types';
import {
  calculateMonthlySummaries,
  getLocalDateString,
} from '../utils/timeCalculations';
import {
  fetchAbsenceJustifications,
  fetchSites,
  registerTimeEntry,
  submitAbsenceJustification,
} from '../lib/supabase';
import { uploadImageToCloudinary } from '../services/cloudinary';

interface CalendarScreenProps {
  entries: TimeEntry[];
  employee?: EmployeeProfile | null;
  theme: 'light' | 'dark';
  initialDate?: string | null;
  autoOpenJustification?: boolean;
  onEntryAdded?: (entry: TimeEntry) => void;
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

const WEEKDAYS_HEADER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const CalendarScreen: React.FC<CalendarScreenProps> = ({
  entries,
  employee,
  theme,
  initialDate,
  autoOpenJustification,
  onEntryAdded,
}) => {
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    border: isDark ? '#334155' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#94A3B8' : '#64748B',
    primary: '#2563EB',    // Azul quando trabalhou
    absent: '#DC2626',     // Vermelho quando faltou
    admission: '#10B981',  // Verde Esmeralda para o dia de admissão
    cardSubtle: isDark ? '#172554' : '#EFF6FF',
    warning: '#D97706',
  };

  const today = new Date();
  const todayStr = getLocalDateString(today);

  // Data de admissão do colaborador
  const admissionDateStr =
    employee?.admission_date ||
    (employee?.created_at ? employee.created_at.slice(0, 10) : null) ||
    (entries.length > 0
      ? [...entries].map((e) => e.work_date).sort()[0]
      : todayStr);

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  // Estado de Justificativas de Falta
  const [justifications, setJustifications] = useState<AbsenceJustification[]>([]);
  const [justifModalVisible, setJustifModalVisible] = useState(false);
  const [justifReasonInput, setJustifReasonInput] = useState('');
  const [justifPhotos, setJustifPhotos] = useState<string[]>([]);
  const [submittingJustif, setSubmittingJustif] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  // Estado de Picagem Retroativa (solicitação para aprovação do patrão)
  const [punchModalVisible, setPunchModalVisible] = useState(false);
  const [punchType, setPunchType] = useState<EntryType>('entrada');
  const [punchHour, setPunchHour] = useState('08:00');
  const [punchSiteId, setPunchSiteId] = useState<string | null>(null);
  const [punchNotes, setPunchNotes] = useState('');
  const [submittingPunch, setSubmittingPunch] = useState(false);
  const [sitesList, setSitesList] = useState<ConstructionSite[]>([]);
  const [localEntries, setLocalEntries] = useState<TimeEntry[]>(entries);

  useEffect(() => {
    setLocalEntries(entries);
  }, [entries]);

  useEffect(() => {
    fetchSites().then(setSitesList).catch(() => {});
  }, []);

  const handleOpenPunchModal = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    const dayPunches = localEntries.filter(
      (e) => e.work_date === dateStr && (!e.notes || !e.notes.startsWith('[JUSTIFICATIVA_FALTA]'))
    );
    const hasEntrada = dayPunches.some((e) => e.entry_type === 'entrada');
    const hasAlmoco = dayPunches.some((e) => e.entry_type === 'almoco');
    const hasSaida = dayPunches.some((e) => e.entry_type === 'saida');

    if (!hasEntrada) {
      setPunchType('entrada');
      setPunchHour('08:00');
    } else if (!hasAlmoco) {
      setPunchType('almoco');
      setPunchHour('12:30');
    } else if (!hasSaida) {
      setPunchType('saida');
      setPunchHour('17:00');
    } else {
      setPunchType('saida');
      setPunchHour('18:00');
    }

    setPunchSiteId(sitesList.length > 0 ? sitesList[0].id : null);
    setPunchNotes('');
    setPunchModalVisible(true);
  };

  const handleSubmitRetroactivePunch = async () => {
    if (!employee) return;
    if (!punchHour.trim() || !/^\d{1,2}:\d{2}$/.test(punchHour.trim())) {
      Alert.alert('Horário Inválido', 'Insira o horário no formato HH:MM (ex: 08:00 ou 17:30).');
      return;
    }

    setSubmittingPunch(true);
    try {
      const parts = punchHour.trim().split(':');
      const h = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const recordedAt = `${selectedDateStr}T${h}:${m}:00.000Z`;

      const created = await registerTimeEntry(
        employee.id,
        punchSiteId,
        punchType,
        selectedDateStr,
        recordedAt,
        punchNotes.trim() || undefined
      );

      setLocalEntries((prev) => [...prev, created]);
      if (onEntryAdded) {
        onEntryAdded(created);
      }

      setPunchModalVisible(false);
      Alert.alert(
        'Picagem Registada!',
        'A sua picagem foi enviada e está com estado PENDENTE. O patrão ou encarregado poderá aprová-la no painel.'
      );
    } catch (err: any) {
      Alert.alert('Erro ao Registar', err.message || 'Falha ao registar picagem retroativa.');
    } finally {
      setSubmittingPunch(false);
    }
  };

  const loadJustifs = async () => {
    if (!employee) return;
    const list = await fetchAbsenceJustifications(employee.id);
    setJustifications(list);
  };

  useEffect(() => {
    loadJustifs();
  }, [employee?.id]);

  // Se receber initialDate (por exemplo ao clicar em "Justificar" no popup de falta)
  useEffect(() => {
    if (initialDate) {
      setSelectedDateStr(initialDate);
      const parts = initialDate.split('-');
      if (parts.length === 3) {
        setSelectedYear(parseInt(parts[0], 10));
        setSelectedMonth(parseInt(parts[1], 10) - 1);
      }
      if (autoOpenJustification) {
        handleOpenJustifModal(initialDate);
      }
    }
  }, [initialDate, autoOpenJustification]);

  const handleOpenJustifModal = (dateStr: string) => {
    const existing = justifications.find((j) => j.date === dateStr);
    setSelectedDateStr(dateStr);
    if (existing) {
      setJustifReasonInput(existing.reason);
      setJustifPhotos(existing.photos || []);
    } else {
      setJustifReasonInput('');
      setJustifPhotos([]);
    }
    setJustifModalVisible(true);
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão', 'Permissão de acesso à câmara necessária.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const photoStr = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setJustifPhotos((prev) => [...prev, photoStr]);
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao aceder à câmara.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão', 'Permissão de galeria necessária.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const newPhotos = res.assets.map((a) =>
          a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri
        );
        setJustifPhotos((prev) => [...prev, ...newPhotos]);
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao aceder à galeria.');
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setJustifPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitJustification = async () => {
    if (!employee) return;
    if (!justifReasonInput.trim()) {
      Alert.alert(
        'Justificativa Obrigatória',
        'Por favor, escreva a justificativa da sua ausência.'
      );
      return;
    }

    setSubmittingJustif(true);
    try {
      // Faz upload de fotos se necessário ou usa base64
      const uploadedPhotos: string[] = [];
      for (const p of justifPhotos) {
        if (p.startsWith('http')) {
          uploadedPhotos.push(p);
        } else {
          try {
            const url = await uploadImageToCloudinary(p, 'castello_justifications');
            uploadedPhotos.push(url);
          } catch {
            uploadedPhotos.push(p);
          }
        }
      }

      await submitAbsenceJustification({
        employee_id: employee.id,
        employee_name: employee.full_name,
        company_id: employee.company_id,
        date: selectedDateStr,
        reason: justifReasonInput.trim(),
        photos: uploadedPhotos,
      });

      await loadJustifs();
      setJustifModalVisible(false);
      Alert.alert(
        'Justificativa Enviada',
        'A sua justificativa e comprovativos foram submetidos à administração com sucesso.'
      );
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao submeter justificativa.');
    } finally {
      setSubmittingJustif(false);
    }
  };

  const monthlyData = calculateMonthlySummaries(
    localEntries,
    selectedYear,
    selectedMonth
  );

  // Monta os dias da grade mensal
  const firstDayWeekIndex = new Date(selectedYear, selectedMonth, 1).getDay();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  const gridCells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstDayWeekIndex; i++) {
    gridCells.push({ day: null, dateStr: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(
      2,
      '0'
    )}-${String(day).padStart(2, '0')}`;
    gridCells.push({ day, dateStr });
  }

  // Estatísticas de Presença e Falta no mês
  // Regra do utilizador: dias anteriores à admissão NÃO contam como falta!
  let presentDaysCount = 0;
  let absentDaysCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(selectedYear, selectedMonth, d);
    const dayOfWeek = dateObj.getDay();
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isPastOrToday = dateStr <= todayStr;
    const isAfterAdmission = dateStr > admissionDateStr;

    const summary = monthlyData.dailyMap[dateStr];
    const hasWorked = Boolean(summary && summary.workedMinutes > 0);

    if (hasWorked) {
      presentDaysCount += 1;
    } else if (isAfterAdmission && dayOfWeek !== 0 && dayOfWeek !== 6 && isPastOrToday) {
      absentDaysCount += 1;
    }
  }

  const selectedDaySummary = monthlyData.dailyMap[selectedDateStr] || null;
  const selectedDateObj = new Date(
    parseInt(selectedDateStr.slice(0, 4), 10),
    parseInt(selectedDateStr.slice(5, 7), 10) - 1,
    parseInt(selectedDateStr.slice(8, 10), 10)
  );
  const isSelectedWeekend =
    selectedDateObj.getDay() === 0 || selectedDateObj.getDay() === 6;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Seletor Mês */}
      <View
        style={[
          styles.monthBar,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            if (selectedMonth === 0) {
              setSelectedMonth(11);
              setSelectedYear((y) => y - 1);
            } else {
              setSelectedMonth((m) => m - 1);
            }
          }}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textMain} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.monthTitle, { color: colors.textMain }]}>
            {MONTHS_PT[selectedMonth]} {selectedYear}
          </Text>
          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
            {monthlyData.totalFormatted} trabalhadas
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            if (selectedMonth === 11) {
              setSelectedMonth(0);
              setSelectedYear((y) => y + 1);
            } else {
              setSelectedMonth((m) => m + 1);
            }
          }}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textMain} />
        </TouchableOpacity>
      </View>

      {/* Legenda Dinâmica: Azul = Compareceu | Vermelho = Faltou | Verde = Admissão */}
      <View
        style={[
          styles.legendCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.textMain }]}>
            Compareceu ({presentDaysCount})
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: colors.absent }]} />
          <Text style={[styles.legendText, { color: colors.textMain }]}>
            Faltou ({absentDaysCount})
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: colors.admission }]} />
          <Text style={[styles.legendText, { color: colors.textMain }]}>
            Admissão
          </Text>
        </View>
      </View>

      {/* GRADE VISUAL DO CALENDÁRIO */}
      <View
        style={[
          styles.calendarGridCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.weekHeaderRow}>
          {WEEKDAYS_HEADER.map((w, idx) => (
            <Text key={idx} style={[styles.weekHeaderLetter, { color: colors.textMuted }]}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {gridCells.map((cell, idx) => {
            if (!cell.day || !cell.dateStr) {
              return <View key={`empty-${idx}`} style={styles.dayCell} />;
            }

            const daySummary = monthlyData.dailyMap[cell.dateStr];
            const dateObj = new Date(selectedYear, selectedMonth, cell.day);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isPastOrToday = cell.dateStr <= todayStr;
            const hasWorked = Boolean(daySummary && daySummary.workedMinutes > 0);

            const isAdmissionDay = cell.dateStr === admissionDateStr;
            const isBeforeAdmission = cell.dateStr < admissionDateStr;
            const isAfterAdmission = cell.dateStr > admissionDateStr;

            // Regras do utilizador:
            // 1. Dia da admissão: cor diferente (Verde Esmeralda)
            // 2. Dias anteriores: ficam normais (neutros, sem vermelho)
            // 3. Dias seguintes: dinâmicos (Azul para trabalho, Vermelho para falta nos dias úteis passados)
            let cellBg = colors.card;
            let cellTextColor = colors.textMain;

            if (isAdmissionDay) {
              cellBg = colors.admission; // Verde Esmeralda
              cellTextColor = '#FFFFFF';
            } else if (isBeforeAdmission) {
              // Ficam normais / neutros
              cellBg = 'transparent';
              cellTextColor = colors.textMuted;
            } else if (isAfterAdmission) {
              if (hasWorked) {
                cellBg = colors.primary; // Azul
                cellTextColor = '#FFFFFF';
              } else if (!isWeekend && isPastOrToday) {
                cellBg = colors.absent; // Vermelho
                cellTextColor = '#FFFFFF';
              } else {
                cellBg = colors.card;
                cellTextColor = isWeekend ? colors.textMuted : colors.textMain;
              }
            }

            const isSelected = cell.dateStr === selectedDateStr;

            return (
              <TouchableOpacity
                key={cell.dateStr}
                style={[
                  styles.dayCell,
                  { backgroundColor: cellBg },
                  isSelected && styles.dayCellSelectedRing,
                ]}
                onPress={() => setSelectedDateStr(cell.dateStr!)}
              >
                <Text style={[styles.dayCellText, { color: cellTextColor }]}>
                  {cell.day}
                </Text>
                {isAdmissionDay && (
                  <View style={styles.admissionDot} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Detalhe do Dia Selecionado */}
      <View
        style={[
          styles.dayDetailCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.dayDetailTitle, { color: colors.textMain }]}>
          Dia {selectedDateStr.split('-').reverse().join('/')}
        </Text>

        {/* Destaque se o dia selecionado for o dia de admissão */}
        {selectedDateStr === admissionDateStr && (
          <View
            style={[
              styles.admissionBanner,
              {
                backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
                borderColor: colors.admission,
              },
            ]}
          >
            <Ionicons name="ribbon-outline" size={18} color={colors.admission} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.admission, fontWeight: '700', fontSize: 13 }}>
                Data de Admissão no Castello
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                Início oficial de funções na empresa
              </Text>
            </View>
          </View>
        )}

        {selectedDaySummary ? (
          <View>
            <View style={styles.detailGrid}>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Entrada
                </Text>
                <Text style={[styles.detailValue, { color: colors.textMain }]}>
                  {selectedDaySummary.entradaTime || '--:--'}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Almoço
                </Text>
                <Text style={[styles.detailValue, { color: colors.textMain }]}>
                  {selectedDaySummary.almocoTime || '--:--'}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Saída
                </Text>
                <Text style={[styles.detailValue, { color: colors.textMain }]}>
                  {selectedDaySummary.saidaTime || '--:--'}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Trabalhado
                </Text>
                <Text style={[styles.detailValue, { color: colors.primary }]}>
                  {selectedDaySummary.workedFormatted}
                </Text>
              </View>
            </View>

            {/* Lista das Picagens Registadas neste Dia + Botão de Adicionar Outra */}
            {(() => {
              const dayPunches = localEntries
                .filter(
                  (e) =>
                    e.work_date === selectedDateStr &&
                    (!e.notes || !e.notes.startsWith('[JUSTIFICATIVA_FALTA]'))
                )
                .sort(
                  (a, b) =>
                    new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
                );

              return (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>
                    Picagens Registadas ({dayPunches.length}):
                  </Text>
                  {dayPunches.map((p) => {
                    const d = new Date(p.recorded_at);
                    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    const isPending = p.status === 'pendente';
                    const siteObj = sitesList.find((s) => s.id === p.site_id);

                    return (
                      <View
                        key={p.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 10,
                          borderRadius: 6,
                          backgroundColor: colors.cardSubtle,
                          borderWidth: 1,
                          borderColor: isPending ? '#D97706' : colors.border,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                              backgroundColor: colors.primary,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                              {p.entry_type.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMain }}>
                            {timeStr}
                          </Text>
                          {siteObj && (
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>
                              • {siteObj.name}
                            </Text>
                          )}
                        </View>

                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            backgroundColor: isPending ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '700',
                              color: isPending ? '#D97706' : '#10B981',
                            }}
                          >
                            {isPending ? 'PENDENTE' : 'APROVADO'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 6,
                      backgroundColor: colors.primary,
                      marginTop: 6,
                    }}
                    onPress={() => handleOpenPunchModal(selectedDateStr)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                      Adicionar Outra Picagem neste Dia
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        ) : selectedDateStr < admissionDateStr ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
            Dia anterior à admissão do colaborador (Sem atividade).
          </Text>
        ) : selectedDateStr === admissionDateStr ? (
          <Text style={{ color: colors.admission, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
            Primeiro dia oficial na empresa.
          </Text>
        ) : selectedDateStr > todayStr ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
            Dia futuro (Aguardando trabalho).
          </Text>
        ) : isSelectedWeekend ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
            Fim de semana (Descanso semanal).
          </Text>
        ) : (() => {
          const currentJustif = justifications.find((j) => j.date === selectedDateStr);
          if (currentJustif) {
            const isApproved = currentJustif.status === 'aprovada';
            const isRejected = currentJustif.status === 'rejeitada';
            const badgeBg = isApproved
              ? 'rgba(16, 185, 129, 0.15)'
              : isRejected
              ? 'rgba(220, 38, 38, 0.15)'
              : 'rgba(245, 158, 11, 0.15)';
            const badgeColor = isApproved
              ? '#10B981'
              : isRejected
              ? '#DC2626'
              : '#D97706';

            return (
              <View style={{ marginTop: 10, gap: 10 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 10,
                    borderRadius: 6,
                    backgroundColor: badgeBg,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={
                        isApproved
                          ? 'checkmark-circle'
                          : isRejected
                          ? 'close-circle'
                          : 'time-outline'
                      }
                      size={16}
                      color={badgeColor}
                    />
                    <Text style={{ color: badgeColor, fontWeight: '700', fontSize: 12 }}>
                      {isApproved
                        ? 'Falta Justificada (Aprovada)'
                        : isRejected
                        ? 'Justificativa Rejeitada'
                        : 'Justificativa Submetida (Em Análise)'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleOpenJustifModal(selectedDateStr)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                      Editar
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Texto da Justificativa */}
                <View
                  style={{
                    padding: 12,
                    borderRadius: 6,
                    backgroundColor: colors.cardSubtle,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', marginBottom: 4 }}>
                    MOTIVO APRESENTADO:
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textMain, lineHeight: 18 }}>
                    {currentJustif.reason}
                  </Text>
                </View>

                {/* Miniaturas de Comprovativos */}
                {currentJustif.photos && currentJustif.photos.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', marginBottom: 6 }}>
                      COMPROVATIVOS ANEXADOS ({currentJustif.photos.length}):
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {currentJustif.photos.map((uri, pIdx) => (
                        <TouchableOpacity
                          key={pIdx}
                          onPress={() => setFullscreenPhoto(uri)}
                          activeOpacity={0.8}
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 6,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Opção de adicionar picagem retroativa mesmo se justificado */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    backgroundColor: colors.cardSubtle,
                    marginTop: 4,
                  }}
                  onPress={() => handleOpenPunchModal(selectedDateStr)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                    Registar Picagem deste Dia (Pendente de Validação)
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <View style={{ marginTop: 10, gap: 10 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  padding: 10,
                  borderRadius: 6,
                  backgroundColor: 'rgba(220, 38, 38, 0.1)',
                }}
              >
                <Ionicons name="alert-circle-outline" size={18} color={colors.absent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.absent, fontSize: 13, fontWeight: '700' }}>
                    Sem registo de ponto (Falta)
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    Pode solicitar o registo de ponto ou submeter uma justificativa.
                  </Text>
                </View>
              </View>

              {/* Botão 1: Solicitar Registo de Ponto (Aprovação do Patrão) */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 6,
                  backgroundColor: colors.primary,
                }}
                onPress={() => handleOpenPunchModal(selectedDateStr)}
                activeOpacity={0.8}
              >
                <Ionicons name="time-outline" size={16} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                  Registar Ponto (Aprovação do Patrão)
                </Text>
              </TouchableOpacity>

              {/* Botão 2: Justificar Falta */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.cardSubtle,
                }}
                onPress={() => handleOpenJustifModal(selectedDateStr)}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={16} color={colors.textMain} />
                <Text style={{ color: colors.textMain, fontWeight: '600', fontSize: 13 }}>
                  Justificar com Documento / Atestado
                </Text>
              </TouchableOpacity>
            </View>
          );
        })()}
      </View>

      {/* MODAL DE JUSTIFICATIVA DE FALTA (Texto Obrigatório + Fotos Opcionais) */}
      <Modal
        visible={justifModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setJustifModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Header Modal */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.textMain }]}>
                  Justificar Falta
                </Text>
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                  Dia {selectedDateStr.split('-').reverse().join('/')}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setJustifModalVisible(false)}
                style={[styles.modalCloseBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="close" size={18} color={colors.textMain} />
              </TouchableOpacity>
            </View>

            {/* Conteúdo do Formulário */}
            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 6 }}>
                Motivo / Justificativa Escrita *
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.cardSubtle,
                    borderColor: colors.border,
                    color: colors.textMain,
                  },
                ]}
                placeholder="Ex: Consulta médica de urgência / Falecimento de familiar / Avaria de transporte..."
                placeholderTextColor={colors.textMuted}
                value={justifReasonInput}
                onChangeText={setJustifReasonInput}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {/* Seção de Fotos de Comprovativo */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginTop: 14, marginBottom: 6 }}>
                Comprovativos / Fotos (Opcional)
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 10 }}>
                Pode anexar atestado médico, declaração de presença ou foto do comprovativo.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity
                  style={[styles.btnMedia, { borderColor: colors.border, backgroundColor: colors.cardSubtle }]}
                  onPress={handleTakePhoto}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera-outline" size={16} color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                    Tirar Foto
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnMedia, { borderColor: colors.border, backgroundColor: colors.cardSubtle }]}
                  onPress={handlePickFromGallery}
                  activeOpacity={0.7}
                >
                  <Ionicons name="images-outline" size={16} color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                    Galeria
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Lista de Fotos Selecionadas com Botão de Excluir */}
              {justifPhotos.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {justifPhotos.map((photoUri, idx) => (
                    <View
                      key={idx}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 6,
                        overflow: 'hidden',
                        position: 'relative',
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} />
                      <TouchableOpacity
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          backgroundColor: 'rgba(220, 38, 38, 0.85)',
                          borderRadius: 10,
                          width: 20,
                          height: 20,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onPress={() => handleRemovePhoto(idx)}
                      >
                        <Ionicons name="close" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Rodapé de Ações */}
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.btnCancel, { borderColor: colors.border }]}
                onPress={() => setJustifModalVisible(false)}
                disabled={submittingJustif}
              >
                <Text style={{ color: colors.textMain, fontWeight: '600', fontSize: 13 }}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSubmit, { backgroundColor: colors.primary }]}
                onPress={handleSubmitJustification}
                disabled={submittingJustif}
                activeOpacity={0.8}
              >
                {submittingJustif ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                    Enviar Justificativa
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE SOLICITAÇÃO DE PICAGEM RETROATIVA (Aprovação do Patrão) */}
      <Modal
        visible={punchModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPunchModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Header Modal */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.textMain }]}>
                  Registar Picagem de Ponto
                </Text>
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                  Dia {selectedDateStr.split('-').reverse().join('/')} • Requer Aprovação
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setPunchModalVisible(false)}
                style={[styles.modalCloseBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="close" size={18} color={colors.textMain} />
              </TouchableOpacity>
            </View>

            {/* Form de Picagem */}
            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              {/* Tipo de Ponto */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 8 }}>
                Tipo de Registo
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {(['entrada', 'almoco', 'saida'] as EntryType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 6,
                      borderWidth: 1,
                      alignItems: 'center',
                      borderColor: punchType === t ? colors.primary : colors.border,
                      backgroundColor: punchType === t ? colors.primary : colors.cardSubtle,
                    }}
                    onPress={() => setPunchType(t)}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: punchType === t ? '#FFFFFF' : colors.textMain,
                        textTransform: 'uppercase',
                      }}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Horário */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 6 }}>
                Horário da Picagem (HH:MM) *
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    minHeight: 44,
                    height: 44,
                    backgroundColor: colors.cardSubtle,
                    borderColor: colors.border,
                    color: colors.textMain,
                    fontSize: 16,
                    fontWeight: '700',
                    fontFamily: 'monospace',
                    marginBottom: 14,
                  },
                ]}
                placeholder="Ex: 08:00, 12:30, 17:30"
                placeholderTextColor={colors.textMuted}
                value={punchHour}
                onChangeText={setPunchHour}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />

              {/* Obra */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 6 }}>
                Obra de Trabalho
              </Text>
              <View style={{ gap: 6, marginBottom: 14 }}>
                <TouchableOpacity
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: !punchSiteId ? colors.primary : colors.border,
                    backgroundColor: !punchSiteId ? colors.cardSubtle : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onPress={() => setPunchSiteId(null)}
                >
                  <Text style={{ color: colors.textMain, fontSize: 13, fontWeight: '600' }}>
                    Geral / Apoio Logístico
                  </Text>
                  {!punchSiteId && (
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>

                {sitesList.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: punchSiteId === s.id ? colors.primary : colors.border,
                      backgroundColor: punchSiteId === s.id ? colors.cardSubtle : 'transparent',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onPress={() => setPunchSiteId(s.id)}
                  >
                    <Text style={{ color: colors.textMain, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                      {s.name} {s.share_code ? `(#${s.share_code})` : ''}
                    </Text>
                    {punchSiteId === s.id && (
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Observação / Motivo */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 6 }}>
                Observação (Opcional)
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.cardSubtle,
                    borderColor: colors.border,
                    color: colors.textMain,
                    minHeight: 60,
                  },
                ]}
                placeholder="Ex: Esqueci-me de picar à saída do turno..."
                placeholderTextColor={colors.textMuted}
                value={punchNotes}
                onChangeText={setPunchNotes}
                multiline
                numberOfLines={2}
              />
            </ScrollView>

            {/* Rodapé */}
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.btnCancel, { borderColor: colors.border }]}
                onPress={() => setPunchModalVisible(false)}
                disabled={submittingPunch}
              >
                <Text style={{ color: colors.textMain, fontWeight: '600', fontSize: 13 }}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSubmit, { backgroundColor: colors.primary }]}
                onPress={handleSubmitRetroactivePunch}
                disabled={submittingPunch}
                activeOpacity={0.8}
              >
                {submittingPunch ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                    Submeter Picagem
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Visualizador de Foto em Tela Cheia */}
      <Modal
        visible={Boolean(fullscreenPhoto)}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenPhoto(null)}
      >
        <TouchableOpacity
          style={styles.fullscreenBackdrop}
          activeOpacity={1}
          onPress={() => setFullscreenPhoto(null)}
        >
          {fullscreenPhoto && (
            <Image
              source={{ uri: fullscreenPhoto }}
              style={{ width: '92%', height: '80%', resizeMode: 'contain', borderRadius: 8 }}
            />
          )}
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setFullscreenPhoto(null)}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </TouchableOpacity>
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
  monthBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  navBtn: {
    padding: 6,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  legendCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIndicator: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  calendarGridCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekHeaderLetter: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    marginVertical: 2,
    position: 'relative',
  },
  dayCellSelectedRing: {
    borderWidth: 2,
    borderColor: '#F8FAFC',
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '700',
  },
  admissionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 3,
  },
  admissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  dayDetailCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  dayDetailTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  detailGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    minHeight: 85,
  },
  btnMedia: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
  },
  btnCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  btnSubmit: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 120,
    alignItems: 'center',
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
});
