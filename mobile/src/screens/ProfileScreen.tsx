import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConstructionSite, EmployeeProfile, TimeEntry } from '../types';
import { calculateMonthlySummaries } from '../utils/timeCalculations';
import { uploadImageToCloudinary } from '../services/cloudinary';

interface ProfileScreenProps {
  employee: EmployeeProfile;
  currentSite: ConstructionSite | null;
  entries: TimeEntry[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
  onUpdateAvatar: (avatarUri: string) => Promise<void>;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  employee,
  currentSite,
  entries,
  theme,
  onToggleTheme,
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
  };

  const [uploading, setUploading] = useState(false);
  const now = new Date();
  const stats = calculateMonthlySummaries(entries, now.getFullYear(), now.getMonth());
  const earnedEuro = ((stats.totalMinutes / 60) * (employee.hourly_rate || 0)).toFixed(2);

  /**
   * Abre o seletor nativo de fotos do aparelho do usuário
   * e faz o upload direto para o Cloudinary
   */
  const handlePickAndUploadCustomPhoto = async () => {
    try {
      // Import dinâmico do expo-image-picker se disponível
      let ImagePicker: any;
      try {
        ImagePicker = require('expo-image-picker');
      } catch {
        ImagePicker = null;
      }

      if (ImagePicker && ImagePicker.launchImageLibraryAsync) {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permissão Necessária',
            'É necessária permissão de acesso à galeria para enviar a sua foto.'
          );
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setUploading(true);
          const fileToUpload = asset.base64
            ? `data:image/jpeg;base64,${asset.base64}`
            : asset.uri;

          const secureUrl = await uploadImageToCloudinary(fileToUpload, 'castello_profiles');
          await onUpdateAvatar(secureUrl);
          Alert.alert('Sucesso', 'Foto própria enviada para o Cloudinary e atualizada no perfil!');
          return;
        }
      } else {
        // Fallback Web / Prompt de URL ou foto caso o módulo nativo não esteja instalado
        Alert.prompt
          ? Alert.prompt(
              'Foto de Perfil',
              'Insira a URL ou link da sua foto:',
              async (urlText) => {
                if (urlText && urlText.trim()) {
                  setUploading(true);
                  try {
                    const secureUrl = await uploadImageToCloudinary(urlText.trim(), 'castello_profiles');
                    await onUpdateAvatar(secureUrl);
                    Alert.alert('Sucesso', 'Foto atualizada!');
                  } catch {
                    await onUpdateAvatar(urlText.trim());
                  } finally {
                    setUploading(false);
                  }
                }
              }
            )
          : Alert.alert(
              'Foto de Perfil',
              'Para selecionar arquivos da sua galeria no Expo Go, instale: npx expo install expo-image-picker'
            );
      }
    } catch (err: any) {
      console.error('Erro no upload de foto:', err);
      Alert.alert('Erro', err.message || 'Falha ao enviar a foto para o Cloudinary.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Card Perfil Flat com Foto Própria */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.avatarTouchable}
          activeOpacity={0.8}
          disabled={uploading}
          onPress={handlePickAndUploadCustomPhoto}
        >
          {employee.avatar_url ? (
            <Image
              source={{ uri: employee.avatar_url }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarFlat}>
              <Text style={styles.avatarFlatText}>
                {employee.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.cameraIconPill}>
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnUploadText}
          disabled={uploading}
          onPress={handlePickAndUploadCustomPhoto}
        >
          <Ionicons name="cloud-upload-outline" size={15} color="#2563EB" />
          <Text style={{ color: '#2563EB', fontSize: 13, fontWeight: '600' }}>
            {uploading ? 'A enviar para Cloudinary...' : 'Alterar Foto de Perfil'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.name, { color: colors.textMain }]}>
          {employee.full_name}
        </Text>
        <Text style={[styles.job, { color: colors.primary }]}>
          {employee.job_title}
        </Text>

        <View style={[styles.infoList, { borderTopColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              E-mail:
            </Text>
            <Text style={[styles.infoVal, { color: colors.textMain }]}>
              {employee.email}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Taxa / Hora:
            </Text>
            <Text style={[styles.infoVal, { color: colors.textMain }]}>
              {Number(employee.hourly_rate).toFixed(2)} €/h
            </Text>
          </View>
        </View>
      </View>

      {/* Resumo do Mês em Euros */}
      <View
        style={[
          styles.kpiRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.kpiBox}>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>
            Horas Mês
          </Text>
          <Text style={[styles.kpiVal, { color: colors.textMain }]}>
            {stats.totalFormatted}
          </Text>
        </View>

        <View
          style={[
            styles.kpiBox,
            { borderLeftWidth: 1, borderLeftColor: colors.border },
          ]}
        >
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>
            Previsão (€)
          </Text>
          <Text style={[styles.kpiVal, { color: colors.primary }]}>
            € {earnedEuro}
          </Text>
        </View>
      </View>

      {/* Alternância de Tema Claro / Escuro */}
      <TouchableOpacity
        style={[
          styles.actionButton,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={onToggleTheme}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons
            name={isDark ? 'sunny-outline' : 'moon-outline'}
            size={18}
            color={colors.textMain}
          />
          <Text style={[styles.actionButtonText, { color: colors.textMain }]}>
            Modo {isDark ? 'Claro' : 'Escuro'}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.textMuted }}>
          {isDark ? 'Ativar Claro' : 'Ativar Escuro'}
        </Text>
      </TouchableOpacity>

      {/* Terminar Sessão */}
      <TouchableOpacity
        style={[styles.btnLogout, { borderColor: colors.border }]}
        onPress={onLogout}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 13 }}>
          Terminar Sessão
        </Text>
      </TouchableOpacity>
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
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarTouchable: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 8,
  },
  avatarFlat: {
    width: 76,
    height: 76,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFlatText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  cameraIconPill: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#2563EB',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  btnUploadText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    marginBottom: 14,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
  },
  job: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 14,
  },
  infoList: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 12,
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  kpiRow: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
  },
  kpiBox: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  btnLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
});
