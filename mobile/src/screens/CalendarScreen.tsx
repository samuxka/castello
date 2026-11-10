import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmployeeProfile, TimeEntry } from '../types';
import {
  calculateMonthlySummaries,
  getLocalDateString,
} from '../utils/timeCalculations';

interface CalendarScreenProps {
  entries: TimeEntry[];
  employee?: EmployeeProfile | null;
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

const WEEKDAYS_HEADER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const CalendarScreen: React.FC<CalendarScreenProps> = ({
  entries,
  employee,
  theme,
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
  };

  const today = new Date();
  const todayStr = getLocalDateString(today);

  // Data de admissão do colaborador (se não definida, usa a data de criação ou a primeira picagem)
  const admissionDateStr =
    employee?.admission_date ||
    (employee?.created_at ? employee.created_at.slice(0, 10) : null) ||
    (entries.length > 0
      ? [...entries].map((e) => e.work_date).sort()[0]
      : todayStr);

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  const monthlyData = calculateMonthlySummaries(
    entries,
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
        ) : (
          <Text style={{ color: colors.absent, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
            Sem registo de ponto (Falta).
          </Text>
        )}
      </View>
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
});
