import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TimeEntry } from '../types';
import {
  calculateMonthlySummaries,
  getLocalDateString,
} from '../utils/timeCalculations';

interface CalendarScreenProps {
  entries: TimeEntry[];
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
  theme,
}) => {
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    border: isDark ? '#334155' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#94A3B8' : '#64748B',
    primary: '#2563EB', // Azul quando trabalhou
    absent: '#DC2626',  // Vermelho quando faltou
    cardSubtle: isDark ? '#172554' : '#EFF6FF',
  };

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    getLocalDateString(today)
  );

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
  let presentDaysCount = 0;
  let absentDaysCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(selectedYear, selectedMonth, d);
    const dayOfWeek = dateObj.getDay();
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isPastOrToday = dateObj.getTime() <= today.getTime();

    // Dias úteis passados (Segunda a Sexta)
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && isPastOrToday) {
      const summary = monthlyData.dailyMap[dateStr];
      if (summary && summary.workedMinutes > 0) {
        presentDaysCount += 1;
      } else {
        absentDaysCount += 1;
      }
    }
  }

  const selectedDaySummary = monthlyData.dailyMap[selectedDateStr] || null;

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

      {/* Legenda: Azul = Compareceu | Vermelho = Faltou */}
      <View
        style={[
          styles.legendCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: '#2563EB' }]} />
          <Text style={[styles.legendText, { color: colors.textMain }]}>
            Compareceu ({presentDaysCount} dias)
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: '#DC2626' }]} />
          <Text style={[styles.legendText, { color: colors.textMain }]}>
            Faltou ({absentDaysCount} dias)
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
            const isPastOrToday = dateObj.getTime() <= today.getTime();
            const hasWorked = Boolean(daySummary && daySummary.workedMinutes > 0);

            // Regra:
            // Azul = Trabalhou/Compareceu
            // Vermelho = Faltou (dia útil passado sem picagem de ponto)
            let cellBg = colors.card;
            let cellTextColor = colors.textMain;

            if (hasWorked) {
              cellBg = '#2563EB'; // Azul
              cellTextColor = '#FFFFFF';
            } else if (!isWeekend && isPastOrToday) {
              cellBg = '#DC2626'; // Vermelho
              cellTextColor = '#FFFFFF';
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
        ) : (
          <Text style={{ color: colors.absent, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
            Sem registo de ponto (Falta)
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
    gap: 8,
  },
  legendIndicator: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
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
  },
  dayCellSelectedRing: {
    borderWidth: 2,
    borderColor: '#F8FAFC',
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '700',
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
