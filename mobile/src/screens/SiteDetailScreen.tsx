import { showCustomAlert, showCustomConfirm } from '../context/DialogContext';
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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  AccidentSeverity,
  ConstructionSite,
  EmployeeProfile,
  InventoryItem,
  SiteAccident,
  SiteTask,
  SiteWorkSession,
  Team,
} from '../types';
import {
  completeTaskByWorker,
  fetchEmployees,
  fetchSiteAccidentsMobile,
  fetchSiteInventoryMobile,
  fetchSiteTasks,
  fetchSiteWorkSessionsMobile,
  fetchTeamsMobile,
  saveSiteAccidentMobile,
  saveSiteWorkSessionMobile,
  stripSessionMetaMobile,
} from '../lib/supabase';
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

  // Registro de Horas de Equipa (Líder / Encarregado da Obra)
  const [teamSessions, setTeamSessions] = useState<SiteWorkSession[]>([]);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [expandedTeamSessions, setExpandedTeamSessions] = useState(false);
  const [teamName, setTeamName] = useState('Equipa 1');
  const [hoursWorked, setHoursWorked] = useState('4');
  const [workersCount, setWorkersCount] = useState('3');
  const [sessionDesc, setSessionDesc] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  // Segurança & Registo de Acidentes
  const [accidents, setAccidents] = useState<SiteAccident[]>([]);
  const [accidentModalOpen, setAccidentModalOpen] = useState(false);
  const [expandedAccidents, setExpandedAccidents] = useState(false);
  const [accTitle, setAccTitle] = useState('');
  const [accType, setAccType] = useState('Queda em Altura');
  const [accSeverity, setAccSeverity] = useState<AccidentSeverity>('leve');
  const [accVictimName, setAccVictimName] = useState('');
  const [accVictimRole, setAccVictimRole] = useState('');
  const [showVictimDropdown, setShowVictimDropdown] = useState(false);
  const [isExternalVictim, setIsExternalVictim] = useState(false);
  const [accDate, setAccDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [accTime, setAccTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [accDesc, setAccDesc] = useState('');
  const [accFirstAid, setAccFirstAid] = useState(false);
  const [accHospital, setAccHospital] = useState(false);
  const [savingAccident, setSavingAccident] = useState(false);

  // Lista de Funcionários e Equipas para Seleção Inteligente
  const [allEmployees, setAllEmployees] = useState<EmployeeProfile[]>([]);
  const [siteTeams, setSiteTeams] = useState<Team[]>([]);

  // Materiais Alocados na Obra
  const [siteMaterials, setSiteMaterials] = useState<InventoryItem[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const [tasksData, sessionsData, materialsData, accidentsData, employeesData, teamsData] =
        await Promise.all([
          fetchSiteTasks(site.id),
          fetchSiteWorkSessionsMobile(site.id),
          fetchSiteInventoryMobile(site.id, site.company_id || employee.company_id || undefined),
          fetchSiteAccidentsMobile(site.id, site.company_id || employee.company_id || undefined),
          fetchEmployees(),
          fetchTeamsMobile(site.company_id || employee.company_id || undefined),
        ]);
      setTasks(tasksData);
      setTeamSessions(sessionsData);
      setSiteMaterials(materialsData || []);
      setAccidents(accidentsData || []);
      setAllEmployees(employeesData || []);
      setSiteTeams(teamsData || []);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleSaveTeamSession = async () => {
    const hoursNum = parseFloat(hoursWorked.replace(',', '.'));
    const workersNum = parseInt(workersCount, 10);
    if (isNaN(hoursNum) || hoursNum <= 0) {
      showCustomAlert('Atenção', 'Informe a quantidade válida de horas trabalhadas.');
      return;
    }

    setSavingSession(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const newSession = await saveSiteWorkSessionMobile({
        site_id: site.id,
        company_id: site.company_id || employee.company_id || null,
        team_name: teamName.trim() || 'Equipa 1',
        leader_id: employee.id,
        leader_name: employee.full_name,
        workers_count: isNaN(workersNum) || workersNum < 1 ? 1 : workersNum,
        work_date: today,
        hours_worked: hoursNum,
        description: sessionDesc.trim() || undefined,
      });

      setTeamSessions((prev) => [newSession, ...prev]);
      setTeamModalOpen(false);
      setSessionDesc('');
      showCustomAlert(
        'Sucesso',
        `Foram registadas ${hoursNum}h da ${teamName} nesta obra! As horas já estão visíveis no portal do cliente.`
      );
    } catch {
      showCustomAlert('Erro', 'Não foi possível gravar o registo de horas da equipa.');
    } finally {
      setSavingSession(false);
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
        showCustomAlert(
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
      showCustomAlert('Erro', e.message || 'Falha ao aceder à câmara.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showCustomAlert(
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
      showCustomAlert('Erro', e.message || 'Falha ao aceder à galeria.');
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setCompletionPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmCompletion = async () => {
    if (!completingTask) return;

    // REGRA OBRIGATÓRIA: Enviar foto (ou mais) do serviço
    if (completionPhotos.length === 0) {
      showCustomAlert(
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

      showCustomAlert(
        'Tarefa Concluída!',
        'Fotos enviadas com sucesso! A tarefa agora aguarda validação do encarregado. Após aprovada, as fotos aparecerão no acompanhamento do cliente.'
      );
    } catch (err: any) {
      showCustomAlert('Erro', err.message || 'Falha ao registrar conclusão da tarefa.');
    } finally {
      setUploading(false);
    }
  };

  // Mapeamento dos trabalhadores associados a esta obra (equipa atual, tarefas, encarregado)
  const siteWorkerIds = React.useMemo(() => {
    const ids = new Set<string>();
    const names = new Set<string>();

    if (site.manager_id) ids.add(site.manager_id);
    if (site.manager_name) names.add(site.manager_name.trim().toLowerCase());

    // Líderes e membros de equipas alocadas a esta obra
    siteTeams
      .filter((t) => t.current_site_id === site.id && !t.is_archived)
      .forEach((t) => {
        if (t.leader_id) ids.add(t.leader_id);
        if (t.leader_name) names.add(t.leader_name.trim().toLowerCase());
        t.member_ids?.forEach((mId) => ids.add(mId));
        t.member_names?.forEach((mName) => names.add(mName.trim().toLowerCase()));
      });

    // Colaboradores com tarefas na obra
    tasks.forEach((t) => {
      if (t.assigned_to_id) ids.add(t.assigned_to_id);
      if (t.assigned_to_name) names.add(t.assigned_to_name.trim().toLowerCase());
    });

    return { ids, names };
  }, [site, siteTeams, tasks]);

  // Lista ordenada de colaboradores (prioriza os que estão na obra)
  const candidateEmployees = React.useMemo(() => {
    return allEmployees
      .map((emp) => {
        const isOnSite =
          siteWorkerIds.ids.has(emp.id) ||
          siteWorkerIds.names.has(emp.full_name.trim().toLowerCase());
        return {
          ...emp,
          isOnSite,
        };
      })
      .sort((a, b) => {
        if (a.isOnSite && !b.isOnSite) return -1;
        if (!a.isOnSite && b.isOnSite) return 1;
        return a.full_name.localeCompare(b.full_name, 'pt');
      });
  }, [allEmployees, siteWorkerIds]);

  // Filtragem interativa conforme o utilizador digita
  const filteredEmployees = React.useMemo(() => {
    const query = accVictimName.trim().toLowerCase();
    if (!query) {
      // Se não digitou nada, mostra os colaboradores da obra no topo
      return candidateEmployees.slice(0, 10);
    }
    return candidateEmployees.filter(
      (emp) =>
        emp.full_name.toLowerCase().includes(query) ||
        (emp.job_title && emp.job_title.toLowerCase().includes(query))
    );
  }, [candidateEmployees, accVictimName]);

  const handleSelectEmployeeVictim = (emp: EmployeeProfile & { isOnSite: boolean }) => {
    setAccVictimName(emp.full_name);
    setAccVictimRole(emp.job_title || 'Colaborador da Obra');
    setIsExternalVictim(false);
    setShowVictimDropdown(false);
  };

  const handleSelectExternalVictim = () => {
    setIsExternalVictim(true);
    if (!accVictimRole || accVictimRole === 'Colaborador da Obra') {
      setAccVictimRole('Visitante / Externo');
    }
    setShowVictimDropdown(false);
  };

  const handleSaveAccident = async () => {
    if (!accVictimName.trim()) {
      showCustomAlert('Atenção', 'Informe o nome do trabalhador ou visitante que sofreu o acidente.');
      return;
    }
    if (!accDesc.trim()) {
      showCustomAlert('Atenção', 'Descreva o que ocorreu no acidente.');
      return;
    }

    setSavingAccident(true);
    try {
      const newAcc = await saveSiteAccidentMobile({
        company_id: site.company_id || employee.company_id || null,
        site_id: site.id,
        site_name: site.name,
        title: accTitle.trim() || `${accType} - ${accVictimName.trim()}`,
        accident_type: accType,
        severity: accSeverity,
        accident_date: accDate || new Date().toISOString().slice(0, 10),
        accident_time: accTime || null,
        victim_name: accVictimName.trim(),
        victim_role: accVictimRole.trim() || (isExternalVictim ? 'Visitante / Externo' : null),
        description: accDesc.trim(),
        first_aid_provided: accFirstAid,
        hospital_referral: accHospital,
        reported_by_id: employee.id,
        reported_by_name: employee.full_name,
        status: 'registado',
      });

      setAccidents((prev) => [newAcc, ...prev]);
      setAccidentModalOpen(false);

      // Limpar formulário
      setAccTitle('');
      setAccType('Queda em Altura');
      setAccSeverity('leve');
      setAccVictimName('');
      setAccVictimRole('');
      setIsExternalVictim(false);
      setShowVictimDropdown(false);
      setAccDesc('');
      setAccFirstAid(false);
      setAccHospital(false);

      showCustomAlert(
        'Acidente Registado',
        'O registo de segurança foi gravado com sucesso. Foi atualizado no histórico e nos indicadores de SST da obra.'
      );
    } catch (e: any) {
      showCustomAlert('Erro', e.message || 'Não foi possível gravar o registo do acidente.');
    } finally {
      setSavingAccident(false);
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

      {/* Seção Exclusiva Encarregado / Líder: Registar Horas da Equipa na Obra (Portal do Cliente) */}
      {isSiteEncarregado && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="people" size={17} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                  Horas da Equipa na Obra
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                Visível no portal do cliente e no mapa de calor
              </Text>
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              }}
              onPress={() => setTeamModalOpen(true)}
            >
              <Ionicons name="time" size={14} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                + Registar Horas
              </Text>
            </TouchableOpacity>
          </View>

          {teamSessions.length === 0 ? (
            <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 6 }}>
              Nenhuma sessão de trabalho de equipa registada ainda nesta obra.
            </Text>
          ) : (
            <View style={{ marginTop: 8, gap: 6 }}>
              {(expandedTeamSessions ? teamSessions : teamSessions.slice(0, 3)).map((sess) => {
                const cleanedDesc = stripSessionMetaMobile(sess.description);
                return (
                  <View
                    key={sess.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor: colors.cardSubtle,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMain }}>
                        {sess.team_name} ({sess.workers_count} trab.)
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 16 }}>
                        {sess.work_date.split('-').reverse().join('/')} • Por {sess.leader_name}
                        {cleanedDesc ? ` • ${cleanedDesc}` : ''}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 46,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                        {sess.hours_worked}h
                      </Text>
                    </View>
                  </View>
                );
              })}

              {teamSessions.length > 3 && (
                <TouchableOpacity
                  style={{
                    alignItems: 'center',
                    paddingVertical: 6,
                    marginTop: 4,
                  }}
                  onPress={() => setExpandedTeamSessions((prev) => !prev)}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
                    {expandedTeamSessions
                      ? 'Ver menos'
                      : `Ver todas (${teamSessions.length} sessões)`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Seção de Segurança & Registo de Acidentes na Obra */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="shield-checkmark" size={17} color="#EF4444" />
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                Segurança & Acidentes
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              Registo de ocorrências de SST na obra ({accidents.length})
            </Text>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: '#EF4444',
              paddingHorizontal: 7,
              paddingVertical: 7,
              borderRadius: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
            onPress={() => setAccidentModalOpen(true)}
          >
            <Ionicons name="warning" size={10} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
              Reportar Acidente
            </Text>
          </TouchableOpacity>
        </View>

        {accidents.length === 0 ? (
          <View
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 8,
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ECFDF5',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#A7F3D0',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Ionicons name="shield-checkmark" size={22} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>
                Zero Acidentes Registados
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                Esta obra não possui nenhum registo de acidente de trabalho ativo.
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 8, gap: 8 }}>
            {(expandedAccidents ? accidents : accidents.slice(0, 3)).map((acc) => {
              const severityBg =
                acc.severity === 'critico'
                  ? '#EF4444'
                  : acc.severity === 'grave'
                  ? '#F97316'
                  : acc.severity === 'moderado'
                  ? '#F59E0B'
                  : '#10B981';

              const severityLabel =
                acc.severity === 'critico'
                  ? 'Crítico'
                  : acc.severity === 'grave'
                  ? 'Grave'
                  : acc.severity === 'moderado'
                  ? 'Moderado'
                  : 'Leve';

              return (
                <View
                  key={acc.id}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: colors.cardSubtle,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMain }}>
                        {acc.title || acc.accident_type}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                        {acc.accident_date.split('-').reverse().join('/')}
                        {acc.accident_time ? ` às ${acc.accident_time}` : ''} • Por {acc.reported_by_name}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 4,
                        backgroundColor: severityBg,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' }}>
                        {severityLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 2 }}>
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 10, color: colors.textMain }}>
                        Vítima: <Text style={{ fontWeight: '700' }}>{acc.victim_name}</Text>
                        {acc.victim_role ? ` (${acc.victim_role})` : ''}
                      </Text>
                    </View>

                    {acc.first_aid_provided && (
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          borderWidth: 1,
                          borderColor: '#10B981',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#10B981' }}>
                          ✓ Primeiros Socorros
                        </Text>
                      </View>
                    )}

                    {acc.hospital_referral && (
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          borderWidth: 1,
                          borderColor: '#EF4444',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#EF4444' }}>
                          + Urgências/Hospital
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={{ fontSize: 12, color: colors.textMain, lineHeight: 17 }}>
                    {acc.description}
                  </Text>
                </View>
              );
            })}

            {accidents.length > 3 && (
              <TouchableOpacity
                style={{
                  alignItems: 'center',
                  paddingVertical: 6,
                  marginTop: 4,
                }}
                onPress={() => setExpandedAccidents((prev) => !prev)}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
                  {expandedAccidents
                    ? 'Ver menos'
                    : `Ver todos (${accidents.length} registos)`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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

      {/* SEÇÃO: MATERIAIS E FERRAMENTAS NA OBRA */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="cube-outline" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
              Materiais & Equipamentos ({siteMaterials.length})
            </Text>
          </View>
          <TouchableOpacity onPress={loadTasks}>
            <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {siteMaterials.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Nenhum material alocado a esta obra no momento.
          </Text>
        ) : (
          <View style={{ gap: 8, marginTop: 4 }}>
            {siteMaterials.map((mat) => (
              <View
                key={mat.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: colors.cardSubtle,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMain }}>
                    {mat.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    {mat.category} {mat.condition ? `• Estado: ${mat.condition}` : ''}
                    {mat.serial_number ? ` • S/N: ${mat.serial_number}` : ''}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: colors.primary,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                    {mat.allocated_quantity} un.
                  </Text>
                </View>
              </View>
            ))}
          </View>
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

      {/* Modal: Registar Horas da Equipa nesta Obra (Líder / Encarregado) */}
      <Modal
        visible={teamModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTeamModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="time" size={18} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.textMain }]}>
                  Registar Horas da Equipa
                </Text>
              </View>
              <TouchableOpacity onPress={() => setTeamModalOpen(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 14 }}>
              Registe as horas trabalhadas pela sua equipa nesta obra ({site.name}) antes de se deslocarem para outro local.
            </Text>

            <View style={{ gap: 12, marginBottom: 18 }}>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 4 }}>
                  Nome da Equipa
                </Text>
                <TextInput
                  value={teamName}
                  onChangeText={setTeamName}
                  placeholder="Ex: Equipa 1, Equipa Alvenaria..."
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.cardSubtle,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontSize: 13,
                    color: colors.textMain,
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 4 }}>
                    Horas Trabalhadas
                  </Text>
                  <TextInput
                    value={hoursWorked}
                    onChangeText={setHoursWorked}
                    placeholder="Ex: 4"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      backgroundColor: colors.cardSubtle,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 13,
                      color: colors.textMain,
                    }}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 4 }}>
                    Nº Trabalhadores
                  </Text>
                  <TextInput
                    value={workersCount}
                    onChangeText={setWorkersCount}
                    placeholder="Ex: 3"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      backgroundColor: colors.cardSubtle,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 13,
                      color: colors.textMain,
                    }}
                  />
                </View>
              </View>

              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 4 }}>
                  Descrição dos Trabalhos Realizados (Opcional)
                </Text>
                <TextInput
                  value={sessionDesc}
                  onChangeText={setSessionDesc}
                  placeholder="Ex: Cofragem e betonagem da laje piso 1..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={2}
                  style={{
                    backgroundColor: colors.cardSubtle,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontSize: 13,
                    color: colors.textMain,
                    minHeight: 50,
                  }}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.btnConfirmModal,
                { backgroundColor: savingSession ? colors.border : colors.primary },
              ]}
              disabled={savingSession}
              onPress={handleSaveTeamSession}
            >
              {savingSession ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.btnConfirmModalText}>A gravar horas...</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="save" size={16} color="#FFFFFF" />
                  <Text style={styles.btnConfirmModalText}>Gravar Horas da Equipa</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Reportar Acidente na Obra (SST) */}
      <Modal
        visible={accidentModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAccidentModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                maxHeight: '90%',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="warning" size={18} color="#EF4444" />
                <Text style={[styles.modalTitle, { color: colors.textMain }]}>
                  Reportar Acidente na Obra
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAccidentModalOpen(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 6 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 14 }}>
                Registe a ocorrência com precisão para salvaguarda da equipa e cumprimento das normas de Segurança no Trabalho (SST).
              </Text>

              <View style={{ gap: 12, marginBottom: 14 }}>
                {/* Tipo de Acidente */}
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 6 }}>
                    Tipo de Ocorrência
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      'Queda em Altura',
                      'Corte / Perfuração',
                      'Pancada / Esmagamento',
                      'Queda de Objetos',
                      'Entorse / Lesão',
                      'Choque Elétrico',
                      'Queimadura',
                      'Outro Acidente',
                    ].map((type) => {
                      const isSelected = accType === type;
                      return (
                        <TouchableOpacity
                          key={type}
                          onPress={() => setAccType(type)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 6,
                            backgroundColor: isSelected ? colors.primary : colors.cardSubtle,
                            borderWidth: 1,
                            borderColor: isSelected ? colors.primary : colors.border,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: isSelected ? '700' : '500',
                              color: isSelected ? '#FFFFFF' : colors.textMain,
                            }}
                          >
                            {type}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Severidade */}
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 6 }}>
                    Gravidade do Acidente
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(
                      [
                        { key: 'leve', label: 'Leve', color: '#10B981' },
                        { key: 'moderado', label: 'Moderado', color: '#F59E0B' },
                        { key: 'grave', label: 'Grave', color: '#F97316' },
                        { key: 'critico', label: 'Crítico', color: '#EF4444' },
                      ] as const
                    ).map((sev) => {
                      const isSelected = accSeverity === sev.key;
                      return (
                        <TouchableOpacity
                          key={sev.key}
                          onPress={() => setAccSeverity(sev.key)}
                          style={{
                            flex: 1,
                            paddingVertical: 7,
                            borderRadius: 6,
                            alignItems: 'center',
                            backgroundColor: isSelected ? sev.color : colors.cardSubtle,
                            borderWidth: 1,
                            borderColor: isSelected ? sev.color : colors.border,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: isSelected ? '#FFFFFF' : colors.textMain,
                            }}
                          >
                            {sev.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Quem sofreu o acidente (Vítima) com busca/dropdown e opção Não Trabalha na Obra */}
                <View style={{ zIndex: 50 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain }}>
                      Quem sofreu o acidente? *
                    </Text>
                    {isExternalVictim ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
                            borderWidth: 1,
                            borderColor: '#F59E0B',
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706' }}>
                            Visitante / Externo
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            setIsExternalVictim(false);
                            setAccVictimRole('');
                          }}
                        >
                          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ position: 'relative' }}>
                    <TextInput
                      value={accVictimName}
                      onChangeText={(text) => {
                        setAccVictimName(text);
                        setShowVictimDropdown(true);
                        if (isExternalVictim && text.length === 0) {
                          setIsExternalVictim(false);
                        }
                      }}
                      onFocus={() => setShowVictimDropdown(true)}
                      placeholder="Comece a digitar o nome..."
                      placeholderTextColor={colors.textMuted}
                      style={{
                        backgroundColor: colors.cardSubtle,
                        borderColor: showVictimDropdown ? colors.primary : colors.border,
                        borderWidth: 1,
                        borderRadius: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        fontSize: 13,
                        color: colors.textMain,
                        paddingRight: 32,
                      }}
                    />
                    {accVictimName ? (
                      <TouchableOpacity
                        onPress={() => {
                          setAccVictimName('');
                          setAccVictimRole('');
                          setIsExternalVictim(false);
                          setShowVictimDropdown(true);
                        }}
                        style={{ position: 'absolute', right: 10, top: 10 }}
                      >
                        <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Dropdown de sugestões interativas */}
                  {showVictimDropdown && (
                    <View
                      style={{
                        marginTop: 4,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 8,
                        maxHeight: 220,
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.15,
                        shadowRadius: 5,
                        elevation: 5,
                      }}
                    >
                      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {filteredEmployees.length > 0 ? (
                          filteredEmployees.map((emp) => (
                            <TouchableOpacity
                              key={emp.id}
                              onPress={() => handleSelectEmployeeVictim(emp)}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.border,
                              }}
                            >
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMain }}>
                                  {emp.full_name}
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                  {emp.job_title || 'Colaborador'}
                                </Text>
                              </View>
                              {emp.isOnSite ? (
                                <View
                                  style={{
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                    borderWidth: 1,
                                    borderColor: '#10B981',
                                  }}
                                >
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#10B981' }}>
                                    Na Obra
                                  </Text>
                                </View>
                              ) : null}
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={{ padding: 12 }}>
                            <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' }}>
                              Nenhum funcionário encontrado com este nome.
                            </Text>
                          </View>
                        )}

                        {/* Botão "Não trabalha na obra" */}
                        {accVictimName.trim().length > 0 && (
                          <TouchableOpacity
                            onPress={handleSelectExternalVictim}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              padding: 10,
                              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
                              borderTopWidth: 1,
                              borderTopColor: colors.border,
                            }}
                          >
                            <Ionicons name="person-add" size={16} color="#D97706" />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#D97706' }}>
                                Não trabalha na obra
                              </Text>
                              <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                Registar "{accVictimName.trim()}" como visitante ou externo
                              </Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Função / Especialidade / Relação */}
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 4 }}>
                    {isExternalVictim
                      ? 'Relação com a Obra (Visitante / Cliente / etc.)'
                      : 'Função / Especialidade da Vítima'}
                  </Text>
                  <TextInput
                    value={accVictimRole}
                    onChangeText={setAccVictimRole}
                    placeholder={
                      isExternalVictim
                        ? 'Ex: Visitante, Cliente, Fiscal, Subempreiteiro...'
                        : 'Ex: Pedreiro, Servente, Eletricista...'
                    }
                    placeholderTextColor={colors.textMuted}
                    style={{
                      backgroundColor: colors.cardSubtle,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 13,
                      color: colors.textMain,
                    }}
                  />
                </View>

                {/* Data e Hora */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 4 }}>
                      Data (AAAA-MM-DD)
                    </Text>
                    <TextInput
                      value={accDate}
                      onChangeText={setAccDate}
                      placeholder="2026-11-15"
                      placeholderTextColor={colors.textMuted}
                      style={{
                        backgroundColor: colors.cardSubtle,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        fontSize: 13,
                        color: colors.textMain,
                      }}
                    />
                  </View>
                  <View style={{ width: 100 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 4 }}>
                      Hora (HH:mm)
                    </Text>
                    <TextInput
                      value={accTime}
                      onChangeText={setAccTime}
                      placeholder="14:30"
                      placeholderTextColor={colors.textMuted}
                      style={{
                        backgroundColor: colors.cardSubtle,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        fontSize: 13,
                        color: colors.textMain,
                      }}
                    />
                  </View>
                </View>

                {/* Descrição */}
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMain, marginBottom: 4 }}>
                    Descrição da Ocorrência *
                  </Text>
                  <TextInput
                    value={accDesc}
                    onChangeText={setAccDesc}
                    placeholder="Explique o que aconteceu, local exato e causas identificadas..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={{
                      backgroundColor: colors.cardSubtle,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 13,
                      color: colors.textMain,
                      minHeight: 65,
                    }}
                  />
                </View>

                {/* Toggles de Socorro */}
                <View style={{ gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setAccFirstAid((prev) => !prev)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      padding: 10,
                      borderRadius: 6,
                      backgroundColor: accFirstAid ? 'rgba(16, 185, 129, 0.15)' : colors.cardSubtle,
                      borderWidth: 1,
                      borderColor: accFirstAid ? '#10B981' : colors.border,
                    }}
                  >
                    <Ionicons
                      name={accFirstAid ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={accFirstAid ? '#10B981' : colors.textMuted}
                    />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMain }}>
                      Prestados primeiros socorros no local
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setAccHospital((prev) => !prev)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      padding: 10,
                      borderRadius: 6,
                      backgroundColor: accHospital ? 'rgba(239, 68, 68, 0.15)' : colors.cardSubtle,
                      borderWidth: 1,
                      borderColor: accHospital ? '#EF4444' : colors.border,
                    }}
                  >
                    <Ionicons
                      name={accHospital ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={accHospital ? '#EF4444' : colors.textMuted}
                    />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMain }}>
                      Encaminhado para urgências / centro médico
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.btnConfirmModal,
                  { backgroundColor: savingAccident ? colors.border : '#EF4444', marginTop: 10 },
                ]}
                disabled={savingAccident}
                onPress={handleSaveAccident}
              >
                {savingAccident ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.btnConfirmModalText}>A gravar registo de segurança...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.btnConfirmModalText}>Registar Ocorrência / Acidente</Text>
                  </View>
                )}
              </TouchableOpacity>
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

