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
    backgroundColor: '#010106',
    justifyContent: 'center',
    padding: 20,
  },
  cardBox: {
    backgroundColor: '#111525',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30374A',
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
    backgroundColor: '#0015D4',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  brandTitle: {
    color: '#F1F4FA',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  formSubtitle: {
    color: '#AAB4C8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  errorBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderColor: '#DC2626',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#AAB4C8',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    minHeight: 44,
    backgroundColor: '#010106',
    borderWidth: 1,
    borderColor: '#30374A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F1F4FA',
    fontSize: 14,
  },
  btnPrimary: {
    minHeight: 48,
    backgroundColor: '#0015D4',
    borderRadius: 8,
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
    minHeight: 44,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#010F6B',
    borderWidth: 1,
    borderColor: '#5C7FFB',
  },
  btnBiometricsText: {
    color: '#8FA6FF',
    fontSize: 14,
    fontWeight: '600',
  },
  footerNote: {
    marginTop: 22,
    borderTopWidth: 1,
    borderTopColor: '#30374A',
    paddingTop: 14,
    alignItems: 'center',
  },
  footerNoteText: {
    color: '#AAB4C8',
    fontSize: 11,
  },
});

