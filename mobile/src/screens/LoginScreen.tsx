import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmployeeProfile } from '../types';
import { showCustomAlert } from '../context/DialogContext';
import { PrivacyPolicyScreen } from './PrivacyPolicyScreen';
import { TermsOfServiceScreen } from './TermsOfServiceScreen';

interface LoginScreenProps {
  onLogin: (email: string, code: string) => Promise<boolean>;
  onBiometricLogin: () => Promise<boolean>;
  hasBiometricsSaved: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onBiometricLogin,
  hasBiometricsSaved,
}) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);

  const handleManualLogin = async () => {
    if (!email.trim() || !code.trim()) {
      setErrorMsg('Preencha o e-mail e o código PIN.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const success = await onLogin(email.trim(), code.trim());
      if (!success) {
        setErrorMsg('Credenciais incorretas ou utilizador não encontrado.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro de comunicação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricPress = async () => {
    if (!hasBiometricsSaved) {
      if (email.trim() && code.trim()) {
        setLoading(true);
        setErrorMsg(null);
        try {
          const success = await onLogin(email.trim(), code.trim());
          if (!success) {
            setErrorMsg('Credenciais incorretas ou utilizador não encontrado.');
            return;
          }
          showCustomAlert(
            'Biometria Ativada!',
            'Sessão iniciada com sucesso. A biometria foi ativada para os seus próximos acessos.',
            [{ text: 'Continuar' }],
            'success'
          );
          return;
        } catch (err: any) {
          setErrorMsg(err?.message || 'Erro de comunicação. Tente novamente.');
          return;
        } finally {
          setLoading(false);
        }
      }

      showCustomAlert(
        'Ativação de Biometria',
        'Para ativar o acesso por biometria ou Face ID, preencha o seu e-mail e código PIN e entre pela primeira vez. A partir daí, poderá aceder sempre com apenas um toque.',
        [{ text: 'Entendido' }],
        'info'
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await onBiometricLogin();
    } catch {
      setErrorMsg('Falha na validação biométrica.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.cardBox}>
        {/* Logo Oficial */}
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>castello</Text>
        </View>

        <Text style={styles.formSubtitle}>
          Acesso dos Colaboradores ao Registo de Ponto
        </Text>

        {errorMsg && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>E-mail de Trabalho</Text>
          <TextInput
            style={styles.textInput}
            placeholder="exemplo@castello.pt"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Código PIN / Senha</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Código fornecido pelo patrão"
            placeholderTextColor="#64748B"
            secureTextEntry
            value={code}
            onChangeText={setCode}
          />
        </View>

        <TouchableOpacity
          style={styles.btnPrimary}
          disabled={loading}
          onPress={handleManualLogin}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.btnPrimaryText}>Entrar</Text>
          )}
        </TouchableOpacity>

        {/* Botão de Biometria / Face ID */}
        <TouchableOpacity
          style={styles.btnBiometrics}
          disabled={loading}
          onPress={handleBiometricPress}
        >
          <Ionicons name="finger-print-outline" size={22} color="#2563EB" />
          <Text style={styles.btnBiometricsText}>
            Aceder com Biometria / Face ID
          </Text>
        </TouchableOpacity>

        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            castello • Sistema de Gestão e Picagem de Ponto
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 }}>
            <TouchableOpacity onPress={() => setPrivacyVisible(true)}>
              <Text style={{ color: '#94A3B8', fontSize: 12, textDecorationLine: 'underline', fontWeight: '600' }}>
                Política de Privacidade
              </Text>
            </TouchableOpacity>
            <Text style={{ color: '#475569', fontSize: 12 }}>•</Text>
            <TouchableOpacity onPress={() => setTermsVisible(true)}>
              <Text style={{ color: '#94A3B8', fontSize: 12, textDecorationLine: 'underline', fontWeight: '600' }}>
                Termos de Serviço
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <PrivacyPolicyScreen
        visible={privacyVisible}
        onClose={() => setPrivacyVisible(false)}
        onOpenTerms={() => {
          setPrivacyVisible(false);
          setTermsVisible(true);
        }}
        theme="dark"
      />

      <TermsOfServiceScreen
        visible={termsVisible}
        onClose={() => setTermsVisible(false)}
        onOpenPrivacy={() => {
          setTermsVisible(false);
          setPrivacyVisible(true);
        }}
        theme="dark"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    padding: 20,
  },
  cardBox: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  logoBadge: {
    width: 34,
    height: 34,
    backgroundColor: '#2563EB',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  formSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 20,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  btnBiometrics: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  btnBiometricsText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '600',
  },
  footerNote: {
    marginTop: 22,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 14,
    alignItems: 'center',
  },
  footerNoteText: {
    color: '#64748B',
    fontSize: 11,
  },
});

