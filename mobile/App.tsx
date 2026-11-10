import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
} from './src/lib/supabase';
import { ConstructionSite, EmployeeProfile, EntryType, TimeEntry } from './src/types';
import { HomeScreen } from './src/screens/HomeScreen';
import { ObrasScreen } from './src/screens/ObrasScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SiteDetailScreen } from './src/screens/SiteDetailScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { setupAlarmNotifications } from './src/utils/alarmService';

type TabKey = 'inicio' | 'obras' | 'calendario' | 'perfil';

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
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [hasBiometricsSaved, setHasBiometricsSaved] = useState<boolean>(false);

  const colors = {
    bg: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    border: isDark ? '#334155' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#94A3B8' : '#64748B',
    primary: '#2563EB',
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
        const empEntries = await fetchEmployeeTimeEntries(activeEmp.id);
        setEntries(empEntries);
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
    const empEntries = await fetchEmployeeTimeEntries(emp.id);
    setEntries(empEntries);
    return true;
  };

  // Login biométrico (após o 1º login com credenciais)
  const handleBiometricLogin = async (): Promise<boolean> => {
    const creds = await getSavedBiometricCredentials();
    if (!creds) return false;
    // Autentica usando as credenciais preservadas
    const emp = await authenticateEmployee(creds.email, creds.code);
    if (!emp) return false;
    setCurrentEmployee(emp);
    const empEntries = await fetchEmployeeTimeEntries(emp.id);
    setEntries(empEntries);
    return true;
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

      {/* Top Header Flat */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>C</Text>
          </View>
          <View>
            <Text style={[styles.appTitle, { color: colors.textMain }]}>
              castello
            </Text>
            <Text style={[styles.employeeSubtitle, { color: colors.textMuted }]}>
              {currentEmployee.full_name}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
          <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
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
          <CalendarScreen entries={entries} theme={theme} />
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  employeeSubtitle: {
    fontSize: 11,
  },
  refreshBtn: {
    padding: 6,
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
});
