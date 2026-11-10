import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { EmployeeProfile } from '../types';
import { uploadImageToCloudinary } from '../services/cloudinary';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  employee: EmployeeProfile;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onRefreshData: () => Promise<void>;
  onLogout: () => void;
  onUpdateAvatar?: (avatarUri: string) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  employee,
  theme,
  onToggleTheme,
  onRefreshData,
  onLogout,
  onUpdateAvatar,
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
    danger: '#DC2626',
    dangerSubtle: isDark ? '#450A0A' : '#FEF2F2',
  };

  const [refreshing, setRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const processAndUploadPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!onUpdateAvatar) return;
    setUploadingAvatar(true);
    try {
      let fileInput: any;
      if (asset.base64) {
        fileInput = `data:image/jpeg;base64,${asset.base64}`;
      } else {
        fileInput = {
          uri: asset.uri,
          name: asset.fileName || 'profile.jpg',
          type: asset.mimeType || 'image/jpeg',
        };
      }
      const secureUrl = await uploadImageToCloudinary(fileInput, 'castello_profiles');
      await onUpdateAvatar(secureUrl);
      Alert.alert('Sucesso', 'Foto de perfil atualizada no Cloudinary com sucesso!');
    } catch (e: any) {
      Alert.alert('Erro no Upload', e.message || 'Falha ao atualizar a foto de perfil.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangeAvatar = () => {
    if (!onUpdateAvatar) return;
    Alert.alert('Foto de Perfil', 'Escolha como pretende alterar a sua foto:', [
      {
        text: 'Tirar Foto (Câmara)',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permissão', 'Permissão de câmara necessária.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
          });
          if (!res.canceled && res.assets && res.assets.length > 0) {
            await processAndUploadPhoto(res.assets[0]);
          }
        },
      },
      {
        text: 'Escolher da Galeria',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permissão', 'Permissão de galeria necessária.');
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
          });
          if (!res.canceled && res.assets && res.assets.length > 0) {
            await processAndUploadPhoto(res.assets[0]);
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshData();
      Alert.alert('Sucesso', 'Dados sincronizados com o servidor.');
    } catch {
      Alert.alert('Aviso', 'Não foi possível sincronizar os dados neste momento.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfirmLogout = () => {
    Alert.alert(
      'Terminar Sessão',
      'Deseja realmente sair da sua conta castello?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => {
            onClose();
            onLogout();
          },
        },
      ]
    );
  };

  // Iniciais do nome para caso não tenha foto
  const initials = employee.full_name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Barra de Topo do Modal de Configurações */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="settings-sharp" size={20} color={colors.primary} />
            <Text style={[styles.headerTitle, { color: colors.textMain }]}>
              Configurações
            </Text>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textMain} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Card do Utilizador */}
          <View
            style={[
              styles.userCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              onPress={handleChangeAvatar}
              disabled={uploadingAvatar}
              activeOpacity={0.7}
              style={{ position: 'relative' }}
            >
              {employee.avatar_url ? (
                <Image source={{ uri: employee.avatar_url }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarFallbackText}>{initials}</Text>
                </View>
              )}
              <View
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  backgroundColor: colors.primary,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: colors.card,
                }}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator size={10} color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={10} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.userName, { color: colors.textMain }]} numberOfLines={1}>
                {employee.full_name}
              </Text>
              <Text style={[styles.userJob, { color: colors.primary }]} numberOfLines={1}>
                {employee.job_title}
              </Text>
              <Text style={[styles.userEmail, { color: colors.textMuted }]} numberOfLines={1}>
                {employee.email}
              </Text>
            </View>
          </View>

          {/* Secção: Aparência e Preferências */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            APARÊNCIA E SISTEMA
          </Text>

          <View
            style={[
              styles.settingsGroup,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Alternar Tema */}
            <View style={styles.settingRow}>
              <View style={styles.settingIconLabel}>
                <View style={[styles.iconWrap, { backgroundColor: colors.cardSubtle }]}>
                  <Ionicons
                    name={isDark ? 'moon' : 'sunny'}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: colors.textMain }]}>
                    Modo Escuro
                  </Text>
                  <Text style={[styles.settingSub, { color: colors.textMuted }]}>
                    {isDark ? 'Ativado (Tema Escuro)' : 'Desativado (Tema Claro)'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={onToggleTheme}
                trackColor={{ false: '#94A3B8', true: '#2563EB' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Sincronização Manual */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              <View style={styles.settingIconLabel}>
                <View style={[styles.iconWrap, { backgroundColor: colors.cardSubtle }]}>
                  {refreshing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="sync-outline" size={18} color={colors.primary} />
                  )}
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: colors.textMain }]}>
                    Sincronizar Dados
                  </Text>
                  <Text style={[styles.settingSub, { color: colors.textMuted }]}>
                    Atualizar picagens e obras com o servidor
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Secção: Recursos de Ponto */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            FUNCIONALIDADES
          </Text>

          <View
            style={[
              styles.settingsGroup,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.settingRow}>
              <View style={styles.settingIconLabel}>
                <View style={[styles.iconWrap, { backgroundColor: colors.cardSubtle }]}>
                  <Ionicons name="alarm-outline" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: colors.textMain }]}>
                    Alarme de Almoço de 1h
                  </Text>
                  <Text style={[styles.settingSub, { color: colors.textMuted }]}>
                    Som e notificações ativas em segundo plano
                  </Text>
                </View>
              </View>
              <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingIconLabel}>
                <View style={[styles.iconWrap, { backgroundColor: colors.cardSubtle }]}>
                  <Ionicons name="finger-print-outline" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: colors.textMain }]}>
                    Login Biométrico
                  </Text>
                  <Text style={[styles.settingSub, { color: colors.textMuted }]}>
                    Suporte a impressão digital / FaceID
                  </Text>
                </View>
              </View>
              <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
            </View>
          </View>

          {/* Secção: Informações do Aplicativo */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            SOBRE O SISTEMA
          </Text>

          <View
            style={[
              styles.settingsGroup,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.textMain }]}>
                Aplicação
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>
                castello mobile
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.textMain }]}>
                Versão
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                1.0.0 (Build APK)
              </Text>
            </View>
          </View>

          {/* Botão Sair da Conta */}
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { backgroundColor: colors.dangerSubtle, borderColor: colors.danger },
            ]}
            onPress={handleConfirmLogout}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={[styles.logoutText, { color: colors.danger }]}>
              Terminar Sessão
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 24,
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
  },
  userJob: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  userEmail: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  settingsGroup: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingSub: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

