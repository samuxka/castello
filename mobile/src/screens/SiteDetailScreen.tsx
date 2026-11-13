import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ConstructionSite, EmployeeProfile, SiteTask } from '../types';
import { completeTaskByWorker, fetchSiteTasks } from '../lib/supabase';
import { uploadImageToCloudinary } from '../services/cloudinary';

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

  // Modal Conclusão de Tarefa com Foto Obrigatória
  const [completingTask, setCompletingTask] = useState<SiteTask | null>(null);
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

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

  // REGRA: O encarregado da obra e gestores têm acesso a todas as tarefas da obra.
  // Colaboradores comuns só veem tarefas gerais ou tarefas designadas especificamente a eles.
  const isSiteEncarregado =
    employee.role === 'patrao' ||
    (Boolean(site.manager_id) && site.manager_id === employee.id) ||
    (Boolean(site.manager_name) && site.manager_name?.trim().toLowerCase() === employee.full_name.trim().toLowerCase()) ||
    (Boolean(employee.job_title) && /(encarregado|chefe|mestre|gestor|supervisor|engenheiro)/i.test(employee.job_title));

  const visibleTasks = tasks.filter((t) => {
    // Encarregado da obra vê todas as tarefas (mesmo as específicas de outros colaboradores)
    if (isSiteEncarregado) return true;
    // Se a tarefa não tem responsável específico, está aberta para qualquer colaborador
    if (!t.assigned_to_id && !t.assigned_to_name) return true;
    // Se foi atribuída pelo ID do colaborador
    if (t.assigned_to_id && t.assigned_to_id === employee.id) return true;
    // Se foi atribuída pelo Nome do colaborador
    if (
      t.assigned_to_name &&
      t.assigned_to_name.trim().toLowerCase() === employee.full_name.trim().toLowerCase()
    ) {
      return true;
    }
    // Tarefa exclusiva de outro colaborador: não exibir
    return false;
  });

  const handleOpenCompleteModal = (task: SiteTask) => {
    setCompletingTask(task);
    setCompletionPhotos([]);
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'É necessária a permissão da câmara para fotografar o serviço concluído.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const photoStr = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setCompletionPhotos((prev) => [...prev, photoStr]);
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao aceder à câmara.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'É necessária a permissão da galeria para selecionar fotos do serviço.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhotos = result.assets.map((a) =>
          a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri
        );
        setCompletionPhotos((prev) => [...prev, ...newPhotos]);
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao aceder à galeria.');
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setCompletionPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmCompletion = async () => {
    if (!completingTask) return;

    // REGRA OBRIGATÓRIA: Enviar foto (ou mais) do serviço
    if (completionPhotos.length === 0) {
      Alert.alert(
        'Foto Obrigatória',
        'É obrigatório anexar pelo menos 1 foto do serviço concluído para finalizar esta tarefa.'
      );
      return;
    }

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < completionPhotos.length; i++) {
        const photo = completionPhotos[i];
        try {
          const url = await uploadImageToCloudinary(photo, 'castello_tarefas');
          uploadedUrls.push(url);
        } catch (uploadErr) {
          console.warn('Falha no upload Cloudinary, mantendo data URI:', uploadErr);
          uploadedUrls.push(photo);
        }
      }

      await completeTaskByWorker(completingTask.id, employee.full_name, uploadedUrls);
      await loadTasks();

      setCompletingTask(null);
      setCompletionPhotos([]);

      Alert.alert(
        'Tarefa Concluída!',
        'Fotos enviadas com sucesso! A tarefa agora aguarda validação do encarregado. Após aprovada, as fotos aparecerão no acompanhamento do cliente.'
      );
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao registrar conclusão da tarefa.');
    } finally {
      setUploading(false);
    }
  };

  const pendingTasks = visibleTasks.filter((t) => t.status === 'pendente');
  const awaitingBoss = visibleTasks.filter((t) => t.status === 'concluida_funcionario');
  const confirmedTasks = visibleTasks.filter((t) => t.status === 'confirmada_chefe');

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

        {visibleTasks.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Nenhuma tarefa pendente para si nesta obra no momento.
          </Text>
        ) : (
          visibleTasks.map((task) => (
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={[styles.taskTitle, { color: colors.textMain }]}>
                    {task.title}
                  </Text>
                  {task.assigned_to_name && (
                    <View style={{ backgroundColor: 'rgba(217, 119, 6, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="lock-closed" size={10} color="#D97706" />
                      <Text style={{ fontSize: 9, color: '#D97706', fontWeight: '700' }}>
                        Exclusiva para si
                      </Text>
                    </View>
                  )}
                </View>

                {task.description ? (
                  <Text style={[styles.taskDesc, { color: colors.textMuted }]}>
                    {task.description}
                  </Text>
                ) : null}

                {/* Fotos enviadas da tarefa se houver */}
                {task.completion_photos && task.completion_photos.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <Ionicons name="camera-outline" size={13} color={colors.primary} />
                    <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '600' }}>
                      {task.completion_photos.length} foto(s) anexada(s)
                    </Text>
                  </View>
                )}

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
                  onPress={() => handleOpenCompleteModal(task)}
                >
                  <Ionicons name="camera" size={13} color="#FFFFFF" />
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

      {/* MODAL CONCLUIR TAREFA COM FOTO OBRIGATÓRIA */}
      <Modal
        visible={!!completingTask}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!uploading) setCompletingTask(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Header Modal */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.textMain }]}>
                  Concluir Tarefa
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  {completingTask?.title}
                </Text>
              </View>
              <TouchableOpacity
                disabled={uploading}
                onPress={() => setCompletingTask(null)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Aviso de Foto Obrigatória */}
            <View
              style={{
                backgroundColor: 'rgba(217, 119, 6, 0.1)',
                borderColor: 'rgba(217, 119, 6, 0.3)',
                borderWidth: 1,
                borderRadius: 6,
                padding: 10,
                marginBottom: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="alert-circle" size={18} color="#D97706" />
              <Text style={{ fontSize: 11, color: '#D97706', flex: 1, fontWeight: '600' }}>
                É obrigatório tirar ou anexar pelo menos 1 foto comprovando a conclusão do serviço. A foto aparecerá para o cliente da obra após aprovação.
              </Text>
            </View>

            {/* Botões de Ação de Foto */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <TouchableOpacity
                style={[styles.photoActionBtn, { backgroundColor: colors.primary }]}
                onPress={handleTakePhoto}
                disabled={uploading}
              >
                <Ionicons name="camera" size={16} color="#FFFFFF" />
                <Text style={styles.photoActionBtnText}>Tirar Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.photoActionBtn,
                  { backgroundColor: colors.cardSubtle, borderColor: colors.border, borderWidth: 1 },
                ]}
                onPress={handlePickFromGallery}
                disabled={uploading}
              >
                <Ionicons name="images" size={16} color={colors.textMain} />
                <Text style={[styles.photoActionBtnText, { color: colors.textMain }]}>
                  Da Galeria
                </Text>
              </TouchableOpacity>
            </View>

            {/* Lista / Grid de Fotos Selecionadas */}
            {completionPhotos.length === 0 ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderStyle: 'dashed',
                  borderRadius: 8,
                  padding: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>
                  Nenhuma foto anexada ainda.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
                contentContainerStyle={{ gap: 8 }}
              >
                {completionPhotos.map((uri, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 6,
                      overflow: 'hidden',
                      position: 'relative',
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                    <TouchableOpacity
                      disabled={uploading}
                      onPress={() => handleRemovePhoto(idx)}
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        borderRadius: 12,
                        width: 20,
                        height: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="close" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Botão Confirmar Conclusão */}
            <TouchableOpacity
              style={[
                styles.btnConfirmModal,
                {
                  backgroundColor:
                    completionPhotos.length > 0 && !uploading ? colors.success : colors.border,
                },
              ]}
              disabled={uploading}
              onPress={handleConfirmCompletion}
            >
              {uploading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.btnConfirmModalText}>A enviar foto(s)...</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.btnConfirmModalText}>
                    {completionPhotos.length === 0
                      ? 'Anexe pelo menos 1 foto para concluir'
                      : `Confirmar Conclusão (${completionPhotos.length} foto${completionPhotos.length > 1 ? 's' : ''})`}
                  </Text>
                </View>
              )}
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  photoActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  btnConfirmModal: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirmModalText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

