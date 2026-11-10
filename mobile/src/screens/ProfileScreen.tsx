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
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
  const [urlModalVisible, setUrlModalVisible] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');

  const now = new Date();
  const stats = calculateMonthlySummaries(entries, now.getFullYear(), now.getMonth());
  const earnedEuro = ((stats.totalMinutes / 60) * (employee.hourly_rate || 0)).toFixed(2);

  /**
   * Processa o asset retornado pelo ImagePicker e envia para o Cloudinary
   */
  const processAndUploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
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
    } catch (err: any) {
      console.error('Erro no upload de foto:', err);
      Alert.alert('Erro no Upload', err.message || 'Falha ao enviar a foto para o Cloudinary.');
    } finally {
      setUploading(false);
    }
  };

  /**
   * Tira uma nova foto com a câmara
   */
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'É necessária permissão de acesso à câmara para tirar uma foto.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await processAndUploadAsset(result.assets[0]);
      }
    } catch (err: any) {
      console.error('Erro na câmara:', err);
      Alert.alert('Erro', err.message || 'Falha ao aceder à câmara.');
    }
  };

  /**
   * Escolhe uma foto da galeria do dispositivo
   */
  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'É necessária permissão de acesso à galeria para escolher uma foto.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await processAndUploadAsset(result.assets[0]);
      }
    } catch (err: any) {
      console.error('Erro na galeria:', err);
      Alert.alert('Erro', err.message || 'Falha ao aceder à galeria.');
    }
  };

  /**
   * Abre opções de carregamento de foto
   */
  const handleOpenPhotoOptions = () => {
    Alert.alert(
      'Foto de Perfil',
      'Como deseja carregar a sua foto?',
      [
        {
          text: 'Tirar Foto (Câmara)',
          onPress: handleTakePhoto,
        },
        {
          text: 'Escolher da Galeria',
          onPress: handlePickFromGallery,
        },
        {
          text: 'Inserir Link de Foto',
          onPress: () => setUrlModalVisible(true),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  };

  const handleSaveUrlPhoto = async () => {
    if (!customUrlInput.trim()) return;
    setUploading(true);
    setUrlModalVisible(false);
    try {
      const secureUrl = await uploadImageToCloudinary(customUrlInput.trim(), 'castello_profiles');
      await onUpdateAvatar(secureUrl);
      Alert.alert('Sucesso', 'Foto atualizada com sucesso!');
      setCustomUrlInput('');
    } catch (e: any) {
      try {
        await onUpdateAvatar(customUrlInput.trim());
        Alert.alert('Sucesso', 'Foto associada ao perfil!');
        setCustomUrlInput('');
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar a imagem informada.');
      }
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
          onPress={handleOpenPhotoOptions}
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
          onPress={handleOpenPhotoOptions}
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

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Admissão:
            </Text>
            <Text style={[styles.infoVal, { color: '#10B981', fontWeight: '700' }]}>
              {employee.admission_date
                ? employee.admission_date.split('-').reverse().join('/')
                : employee.created_at
                ? employee.created_at.slice(0, 10).split('-').reverse().join('/')
                : '-'}
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

      {/* Modal para Colar Link de Foto (Fallback Web/URL) */}
      <Modal
        visible={urlModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUrlModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textMain }]}>
              Inserir Link da Foto
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12 }}>
              Cole a URL pública da sua foto de perfil:
            </Text>

            <TextInput
              style={[
                styles.urlInput,
                { backgroundColor: colors.cardSubtle, borderColor: colors.border, color: colors.textMain },
              ]}
              placeholder="https://exemplo.com/minha-foto.jpg"
              placeholderTextColor={colors.textMuted}
              value={customUrlInput}
              onChangeText={setCustomUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtnSecondary, { borderColor: colors.border }]}
                onPress={() => setUrlModalVisible(false)}
              >
                <Text style={{ color: colors.textMain, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={handleSaveUrlPhoto}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Gravar Foto</Text>
              </TouchableOpacity>
            </View>
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
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarTouchable: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  avatarFlat: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFlatText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  cameraIconPill: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2563EB',
    width: 28,
    height: 28,
    borderRadius: 14,
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
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    marginBottom: 14,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  job: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  infoList: {
    width: '100%',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 13,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  kpiRow: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  kpiBox: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
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
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtnSecondary: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modalBtnPrimary: {
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
