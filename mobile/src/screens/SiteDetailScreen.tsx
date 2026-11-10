import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConstructionSite, EmployeeProfile, SiteTask } from '../types';
import { completeTaskByWorker, fetchSiteTasks } from '../lib/supabase';

interface SiteDetailScreenProps {
  site: ConstructionSite;
  employee: EmployeeProfile;
  theme: 'light' | 'dark';
  onBack: () => void;
}

export const SiteDetailScreen: React.FC<SiteDetailScreenProps> = ({
  site,
  employee,
  theme,
  onBack,
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
    success: '#16A34A',
    warning: '#D97706',
  };

  const [tasks, setTasks] = useState<SiteTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const data = await fetchSiteTasks(site.id);
      setTasks(data);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [site.id]);

  const handleCompleteTask = (taskId: string) => {
    Alert.alert(
      'Concluir Tarefa',
      'Confirma que concluiu esta tarefa? O encarregado ou chefe irá validar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, Concluir',
          onPress: async () => {
            await completeTaskByWorker(taskId, employee.full_name);
            await loadTasks();
            Alert.alert('Sucesso', 'Tarefa marcada como concluída! Aguardando confirmação do encarregado.');
          },
        },
      ]
    );
  };

  const pendingTasks = tasks.filter((t) => t.status === 'pendente');
  const awaitingBoss = tasks.filter((t) => t.status === 'concluida_funcionario');
  const confirmedTasks = tasks.filter((t) => t.status === 'confirmada_chefe');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Botão Voltar */}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={18} color={colors.primary} />
        <Text style={[styles.backButtonText, { color: colors.primary }]}>
          Voltar às Obras
        </Text>
      </TouchableOpacity>

      {/* Cartão de Informações da Obra */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.siteTitle, { color: colors.textMain }]}>
                {site.name}
              </Text>
            </View>
            {site.share_code && (
              <Text style={[styles.codeBadge, { color: colors.primary }]}>
                CÓDIGO: #{site.share_code}
              </Text>
            )}
          </View>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor:
                  site.status === 'ativa'
                    ? 'rgba(22, 163, 74, 0.15)'
                    : site.status === 'pausada'
                    ? 'rgba(217, 119, 6, 0.15)'
                    : 'rgba(37, 99, 235, 0.15)',
              },
            ]}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color:
                  site.status === 'ativa'
                    ? '#16A34A'
                    : site.status === 'pausada'
                    ? '#D97706'
                    : '#2563EB',
              }}
            >
              {site.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {site.description ? (
          <Text style={[styles.descriptionText, { color: colors.textMuted }]}>
            {site.description}
          </Text>
        ) : null}

        {/* Lista de Detalhes da Obra */}
        <View style={[styles.detailsSection, { borderTopColor: colors.border }]}>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.detailValue, { color: colors.textMain }]}>
              {site.address}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.detailValue, { color: colors.textMain }]}>
              Encarregado: {site.manager_name || 'Ainda não atribuído'}
            </Text>
          </View>

          {site.start_date && (
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.detailValue, { color: colors.textMain }]}>
                Data de Início: {site.start_date.split('-').reverse().join('/')}
              </Text>
            </View>
          )}

          {site.budget ? (
            <View style={styles.detailRow}>
              <Ionicons name="cash-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.detailValue, { color: colors.textMain }]}>
                Orçamento Previsto: € {Number(site.budget).toLocaleString('pt-PT')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Resumo de Tarefas da Obra */}
      <View style={styles.tasksSummaryRow}>
        <View
          style={[
            styles.summaryBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            A Fazer
          </Text>
          <Text style={[styles.summaryNum, { color: colors.warning }]}>
            {pendingTasks.length}
          </Text>
        </View>

        <View
          style={[
            styles.summaryBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Aguardando Chefe
          </Text>
          <Text style={[styles.summaryNum, { color: colors.primary }]}>
            {awaitingBoss.length}
          </Text>
        </View>

        <View
          style={[
            styles.summaryBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Validadas
          </Text>
          <Text style={[styles.summaryNum, { color: colors.success }]}>
            {confirmedTasks.length}
          </Text>
        </View>
      </View>

      {/* Seção de Tarefas da Obra */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
            Tarefas desta Obra
          </Text>
          <TouchableOpacity onPress={loadTasks}>
            <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {tasks.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Nenhuma tarefa pendente para esta obra no momento.
          </Text>
        ) : (
          tasks.map((task) => (
            <View
              key={task.id}
              style={[
                styles.taskItem,
                {
                  backgroundColor: colors.cardSubtle,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.taskTitle, { color: colors.textMain }]}>
                  {task.title}
                </Text>
                {task.description ? (
                  <Text style={[styles.taskDesc, { color: colors.textMuted }]}>
                    {task.description}
                  </Text>
                ) : null}

                <View style={styles.taskMetaRow}>
                  {task.due_date && (
                    <Text style={[styles.taskDue, { color: colors.textMuted }]}>
                      Prazo: {task.due_date.split('-').reverse().join('/')}
                    </Text>
                  )}

                  {task.status === 'concluida_funcionario' && (
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                      Concluído por: {task.completed_by_name}
                    </Text>
                  )}

                  {task.status === 'confirmada_chefe' && (
                    <Text style={{ fontSize: 11, color: colors.success, fontWeight: '600' }}>
                      Validado por: {task.confirmed_by_name}
                    </Text>
                  )}
                </View>
              </View>

              {task.status === 'pendente' ? (
                <TouchableOpacity
                  style={styles.btnCompleteTask}
                  onPress={() => handleCompleteTask(task.id)}
                >
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  <Text style={styles.btnCompleteTaskText}>Concluir</Text>
                </TouchableOpacity>
              ) : task.status === 'concluida_funcionario' ? (
                <View style={styles.badgePendingValidation}>
                  <Text style={styles.badgePendingValidationText}>Aguardando Chefe</Text>
                </View>
              ) : (
                <View style={styles.badgeConfirmed}>
                  <Text style={styles.badgeConfirmedText}>Validada</Text>
                </View>
              )}
            </View>
          ))
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  siteTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  codeBadge: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  detailsSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  tasksSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  summaryBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryNum: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12,
    paddingVertical: 12,
    textAlign: 'center',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  taskDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  taskDue: {
    fontSize: 10,
  },
  btnCompleteTask: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  btnCompleteTaskText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  badgePendingValidation: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  badgePendingValidationText: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeConfirmed: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  badgeConfirmedText: {
    color: '#16A34A',
    fontSize: 10,
    fontWeight: '700',
  },
});

