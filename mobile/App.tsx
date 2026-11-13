import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  authenticateEmployee,
  clearActiveEmployee,
  fetchEmployees,
  fetchEmployeeTimeEntries,
  fetchSites,
  getActiveEmployee,
  getSavedBiometricCredentials,
  registerTimeEntry,
  updateEmployeeAvatar,
  fetchCompanyNotifications,
  markNotificationAsRead,
  fetchAbsenceJustifications,
  sendAbsenceReminderEmail,
  fetchAssignedVehicle,
} from './src/lib/supabase';
import {
  CompanyNotification,
  ConstructionSite,
  EmployeeProfile,
  EntryType,
  TimeEntry,
  Vehicle,
} from './src/types';
import { HomeScreen } from './src/screens/HomeScreen';
import { ObrasScreen } from './src/screens/ObrasScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SiteDetailScreen } from './src/screens/SiteDetailScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SettingsModal } from './src/screens/SettingsModal';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { VehicleScreen } from './src/screens/VehicleScreen';
import { setupAlarmNotifications } from './src/utils/alarmService';

type TabKey = 'inicio' | 'obras' | 'carrinha' | 'calendario' | 'perfil';

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

function MainApp() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<TabKey>('inicio');
  const [selectedSiteDetail, setSelectedSiteDetail] = useState<ConstructionSite | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<EmployeeProfile | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [hasBiometricsSaved, setHasBiometricsSaved] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  // Notificações da Empresa & Lembrete de Falta
  const [notifications, setNotifications] = useState<CompanyNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [pendingAbsenceDate, setPendingAbsenceDate] = useState<string | null>(null);
  const [calendarInitialDate, setCalendarInitialDate] = useState<string | null>(null);
  const [calendarAutoOpenJustif, setCalendarAutoOpenJustif] = useState<boolean>(false);

  const unreadNotificationsCount = notifications.filter((n) => !n.is_read).length;

  const checkUnexcusedAbsences = async (
    emp: EmployeeProfile,
    empEntries: TimeEntry[]
  ) => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const admissionStr =
        emp.admission_date ||
        (emp.created_at ? emp.created_at.slice(0, 10) : todayStr);

      const justifs = await fetchAbsenceJustifications(emp.id);

      // Percorre os últimos 30 dias anteriores a hoje
      for (let offset = 1; offset <= 30; offset++) {
        const d = new Date(Date.now() - offset * 86400000);
        const dayOfWeek = d.getDay();
        // Apenas dias úteis de trabalho (Segunda a Sexta)
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const dateStr = d.toISOString().slice(0, 10);
        if (dateStr < admissionStr) break;

        const hasEntry = empEntries.some((e) => e.work_date === dateStr);
        if (!hasEntry) {
          const hasJustif = justifs.some((j) => j.date === dateStr);
          if (!hasJustif) {
            // Falta não justificada encontrada!

            // 1. Envia e-mail de lembrete (uma única vez por falta)
            const emailKey = `@castello:email_sent_${emp.id}_${dateStr}`;
            const emailSent = await AsyncStorage.getItem(emailKey);
            if (!emailSent) {
              await sendAbsenceReminderEmail(emp.email, emp.full_name, dateStr);
              await AsyncStorage.setItem(emailKey, 'true');
            }

            // 2. Verifica se o popup para esta data está adiado (snooze) ou esquecido
            const snoozeKey = `@castello:snooze_${emp.id}_${dateStr}`;
            const snoozeVal = await AsyncStorage.getItem(snoozeKey);
            if (snoozeVal === 'dismissed') {
              continue;
            }
            if (snoozeVal && Date.now() < Number(snoozeVal)) {
              continue;
            }

            // Dispara popup para a falta mais recente
            setPendingAbsenceDate(dateStr);
            break;
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao verificar faltas não justificadas:', e);
    }
  };

  const handleJustifyAbsence = () => {
    if (!pendingAbsenceDate) return;
    const date = pendingAbsenceDate;
    setPendingAbsenceDate(null);
    setActiveTab('calendario');
    setCalendarInitialDate(date);
    setCalendarAutoOpenJustif(true);
  };

  const handleSnoozeAbsence = async () => {
    if (!pendingAbsenceDate || !currentEmployee) return;
    const snoozeUntil = Date.now() + 5 * 60 * 60 * 1000; // 5 horas
    await AsyncStorage.setItem(
      `@castello:snooze_${currentEmployee.id}_${pendingAbsenceDate}`,
      String(snoozeUntil)
    );
    setPendingAbsenceDate(null);
  };

  const handleForgetAbsence = async () => {
    if (!pendingAbsenceDate || !currentEmployee) return;
    await AsyncStorage.setItem(
      `@castello:snooze_${currentEmployee.id}_${pendingAbsenceDate}`,
      'dismissed'
    );
    setPendingAbsenceDate(null);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Bom dia,';
    } else if (hour >= 12 && hour < 18) {
      return 'Boa tarde,';
    } else {
      return 'Boa noite,';
    }
  };

  const getFirstAndLastName = (fullName?: string) => {
    if (!fullName) return 'Colaborador';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  const colors = {
    bg: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    border: isDark ? '#334155' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#94A3B8' : '#64748B',
    primary: '#2563EB',
    cardSubtle: isDark ? '#172554' : '#EFF6FF',
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await setupAlarmNotifications();
      const [loadedSites, activeEmp, bioCreds] = await Promise.all([
        fetchSites(),
        getActiveEmployee(),
        getSavedBiometricCredentials(),
      ]);
      setSites(loadedSites);
      setCurrentEmployee(activeEmp);
      setHasBiometricsSaved(Boolean(bioCreds));

      if (activeEmp) {
        const [empEntries, loadedNotifs, veh] = await Promise.all([
          fetchEmployeeTimeEntries(activeEmp.id),
          fetchCompanyNotifications(activeEmp.company_id),
          fetchAssignedVehicle(activeEmp.id, activeEmp.full_name),
        ]);
        setEntries(empEntries);
        setNotifications(loadedNotifs);
        setAssignedVehicle(veh);
        await checkUnexcusedAbsences(activeEmp, empEntries);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Login manual
  const handleLogin = async (email: string, code: string): Promise<boolean> => {
    const emp = await authenticateEmployee(email, code);
    if (!emp) return false;
    setCurrentEmployee(emp);
    setHasBiometricsSaved(true);
    const [empEntries, veh] = await Promise.all([
      fetchEmployeeTimeEntries(emp.id),
      fetchAssignedVehicle(emp.id, emp.full_name),
    ]);
    setEntries(empEntries);
    setAssignedVehicle(veh);
    return true;
  };

  // Login biométrico (com prompt nativo FaceID / Digital)
  const handleBiometricLogin = async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Biometria Não Disponível',
          'O seu dispositivo não possui suporte a biometria ou nenhuma digital/Face ID foi cadastrada.'
        );
        return false;
      }

      const authRes = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autenticação Castello',
        fallbackLabel: 'Usar Código PIN',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });

      if (!authRes.success) {
        return false;
      }

      const creds = await getSavedBiometricCredentials();
      if (!creds) {
        Alert.alert(
          'Primeiro Acesso',
          'Por favor, inicie sessão com o seu e-mail e código PIN uma primeira vez para ativar o login biométrico.'
        );
        return false;
      }

      // Autentica usando as credenciais preservadas com segurança
      const emp = await authenticateEmployee(creds.email, creds.code);
      if (!emp) return false;
      setCurrentEmployee(emp);
      setHasBiometricsSaved(true);
      const empEntries = await fetchEmployeeTimeEntries(emp.id);
      setEntries(empEntries);
      return true;
    } catch (err: any) {
      console.warn('Erro ao autenticar biometricamente:', err);
      return false;
    }
  };

  const handleLogout = async () => {
    await clearActiveEmployee();
    setCurrentEmployee(null);
  };

  const handleUpdateAvatar = async (avatarUri: string) => {
    if (!currentEmployee) return;
    await updateEmployeeAvatar(currentEmployee.id, avatarUri);
    setCurrentEmployee({ ...currentEmployee, avatar_url: avatarUri });
  };

  const handleRegisterEntry = async (type: EntryType) => {
    if (!currentEmployee) return;
    try {
      await registerTimeEntry(currentEmployee.id, null, type);
      const updated = await fetchEmployeeTimeEntries(currentEmployee.id);
      setEntries(updated);
    } catch (e) {
      console.warn('Erro ao registar ponto:', e);
    }
  };

  const currentSite = sites[0] || null;

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingScreen, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="small" color="#2563EB" />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          A carregar castello...
        </Text>
      </SafeAreaView>
    );
  }

  // TELA DE LOGIN OBRIGATÓRIA SE NÃO AUTENTICADO
  if (!currentEmployee) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LoginScreen
          onLogin={handleLogin}
          onBiometricLogin={handleBiometricLogin}
          hasBiometricsSaved={hasBiometricsSaved}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header do Utilizador (Substitui o antigo quadrado C e barra) */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.userInfoRow}>
          {/* Círculo com foto de perfil */}
          {currentEmployee.avatar_url ? (
            <Image
              source={{ uri: currentEmployee.avatar_url }}
              style={styles.avatarCircle}
            />
          ) : (
            <View style={[styles.avatarCircleFallback, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarCircleText}>
                {currentEmployee.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </Text>
            </View>
          )}

          {/* Cumprimento baseado na hora e Primeiro e Último Nome */}
          <View style={styles.userTextCol}>
            <Text style={[styles.greetingText, { color: colors.textMuted }]}>
              {getGreeting()}
            </Text>
            <Text
              style={[styles.userNameText, { color: colors.textMain }]}
              numberOfLines={1}
            >
              {getFirstAndLastName(currentEmployee.full_name)}
            </Text>
          </View>
        </View>

        {/* Sino de Notificações / Mensagens da Empresa (Substitui o menu hambúrguer) */}
        <TouchableOpacity
          style={[styles.bellBtn, { borderColor: colors.border }]}
          onPress={() => setNotificationsOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={unreadNotificationsCount > 0 ? 'notifications' : 'notifications-outline'}
            size={22}
            color={unreadNotificationsCount > 0 ? colors.primary : colors.textMain}
          />
          {unreadNotificationsCount > 0 && (
            <View style={styles.unreadBadgeDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Navegação entre Telas */}
      <View style={styles.screenArea}>
        {activeTab === 'inicio' && (
          <HomeScreen
            employee={currentEmployee}
            currentSite={currentSite}
            entries={entries}
            onRegisterEntry={handleRegisterEntry}
            theme={theme}
          />
        )}
        {activeTab === 'obras' && (
          selectedSiteDetail ? (
            <SiteDetailScreen
              site={selectedSiteDetail}
              employee={currentEmployee}
              theme={theme}
              onBack={() => setSelectedSiteDetail(null)}
            />
          ) : (
            <ObrasScreen
              sites={sites}
              theme={theme}
              onSelectSite={(site) => setSelectedSiteDetail(site)}
            />
          )
        )}
        {activeTab === 'calendario' && (
          <CalendarScreen
            entries={entries}
            employee={currentEmployee}
            theme={theme}
            initialDate={calendarInitialDate}
            autoOpenJustification={calendarAutoOpenJustif}
            onEntryAdded={(newEntry) => setEntries((prev) => [...prev, newEntry])}
          />
        )}
        {activeTab === 'carrinha' && currentEmployee && (
          <VehicleScreen
            employee={currentEmployee}
            theme={theme}
          />
        )}
        {activeTab === 'perfil' && (
          <ProfileScreen
            employee={currentEmployee}
            currentSite={currentSite}
            entries={entries}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            onLogout={handleLogout}
            onUpdateAvatar={handleUpdateAvatar}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </View>

      {/* Barra de Tabs Flat */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('inicio')}
        >
          <Ionicons
            name={activeTab === 'inicio' ? 'time' : 'time-outline'}
            size={20}
            color={activeTab === 'inicio' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'inicio' ? colors.primary : colors.textMuted },
            ]}
          >
            Início
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            setActiveTab('obras');
            setSelectedSiteDetail(null);
          }}
        >
          <Ionicons
            name={activeTab === 'obras' ? 'business' : 'business-outline'}
            size={20}
            color={activeTab === 'obras' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'obras' ? colors.primary : colors.textMuted },
            ]}
          >
            Obras
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('calendario')}
        >
          <Ionicons
            name={activeTab === 'calendario' ? 'calendar' : 'calendar-outline'}
            size={20}
            color={activeTab === 'calendario' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === 'calendario' ? colors.primary : colors.textMuted,
              },
            ]}
          >
            Calendário
          </Text>
        </TouchableOpacity>

        {/* Tab de Carrinha / Frota */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('carrinha')}
        >
          <Ionicons
            name={activeTab === 'carrinha' ? 'car-sport' : 'car-sport-outline'}
            size={20}
            color={activeTab === 'carrinha' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'carrinha' ? colors.primary : colors.textMuted },
            ]}
          >
            Carrinha
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('perfil')}
        >
          <Ionicons
            name={activeTab === 'perfil' ? 'person' : 'person-outline'}
            size={20}
            color={activeTab === 'perfil' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'perfil' ? colors.primary : colors.textMuted },
            ]}
          >
            Perfil
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal / Página de Configurações */}
      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        employee={currentEmployee}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onRefreshData={loadData}
        onLogout={handleLogout}
        onUpdateAvatar={handleUpdateAvatar}
      />

      {/* Modal Tela de Notificações da Empresa */}
      <Modal
        visible={notificationsOpen}
        animationType="slide"
        onRequestClose={() => setNotificationsOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <NotificationsScreen
            notifications={notifications}
            theme={theme}
            onBack={() => setNotificationsOpen(false)}
            onNotificationRead={async (id) => {
              await markNotificationAsRead(id);
              setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* POPUP DE LEMBRETE DE JUSTIFICATIVA DE FALTA */}
      <Modal
        visible={Boolean(pendingAbsenceDate)}
        transparent
        animationType="fade"
        onRequestClose={handleSnoozeAbsence}
      >
        <View style={styles.popupBackdrop}>
          <View
            style={[
              styles.popupCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.popupHeaderRow}>
              <View style={[styles.popupIconCircle, { backgroundColor: 'rgba(220, 38, 38, 0.15)' }]}>
                <Ionicons name="alert-circle" size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.popupTitle, { color: colors.textMain }]}>
                  Falta Pendente de Justificativa
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                  Aviso do Sistema Castello
                </Text>
              </View>
            </View>

            <Text style={[styles.popupMessage, { color: colors.textMain }]}>
              Identificámos que não houve registo de ponto no dia{' '}
              <Text style={{ fontWeight: '800', color: colors.primary }}>
                {pendingAbsenceDate ? pendingAbsenceDate.split('-').reverse().join('/') : ''}
              </Text>
              . Por favor, submeta a sua justificativa escrita e comprovativos pelo aplicativo.
            </Text>

            <View style={styles.popupActionsCol}>
              {/* Opção 1: Justificar (leva à tela de justificativa da falta) */}
              <TouchableOpacity
                style={[styles.btnPopupPrimary, { backgroundColor: colors.primary }]}
                onPress={handleJustifyAbsence}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                <Text style={styles.btnPopupPrimaryText}>Justificar</Text>
              </TouchableOpacity>

              {/* Opção 2: Lembre-me mais tarde (reaparece após 5h) */}
              <TouchableOpacity
                style={[styles.btnPopupSecondary, { borderColor: colors.border, backgroundColor: colors.cardSubtle }]}
                onPress={handleSnoozeAbsence}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={16} color={colors.textMain} />
                <Text style={[styles.btnPopupSecondaryText, { color: colors.textMain }]}>
                  Lembre-me Mais Tarde
                </Text>
              </TouchableOpacity>

              {/* Opção 3: Esquecer (não exibe mais o popup para esta falta) */}
              <TouchableOpacity
                style={styles.btnPopupDismiss}
                onPress={handleForgetAbsence}
                activeOpacity={0.7}
              >
                <Text style={[styles.btnPopupDismissText, { color: colors.textMuted }]}>
                  Esquecer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarCircleFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  userTextCol: {
    justifyContent: 'center',
    flex: 1,
  },
  greetingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 1,
  },
  hamburgerBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  screenArea: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  popupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  popupIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  popupMessage: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
  },
  popupActionsCol: {
    gap: 10,
  },
  btnPopupPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnPopupPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnPopupSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnPopupSecondaryText: {
    fontWeight: '600',
    fontSize: 13,
  },
  btnPopupDismiss: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  btnPopupDismissText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
