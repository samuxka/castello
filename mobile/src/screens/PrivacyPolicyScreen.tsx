import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PrivacyPolicyScreenProps {
  visible: boolean;
  onClose: () => void;
  onOpenTerms?: () => void;
  theme?: 'light' | 'dark';
}

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({
  visible,
  onClose,
  onOpenTerms,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#010106' : '#F5F7FB',
    card: isDark ? '#111525' : '#FFFFFF',
    border: isDark ? '#30374A' : '#D2D8E4',
    textMain: isDark ? '#F1F4FA' : '#010106',
    textMuted: isDark ? '#AAB4C8' : '#64748B',
    primary: isDark ? '#5C7FFB' : '#0015D4',
    badgeBg: isDark ? '#010F6B' : '#EEF1FF',
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Cabeçalho */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <View style={styles.brandRow}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.textMain }]}>
                Política de Privacidade
              </Text>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>
                Castello • Documento Público Oficial
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textMain} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Banner de Atualização */}
          <View
            style={[
              styles.introCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderLeftColor: colors.primary,
              },
            ]}
          >
            <View style={[styles.badge, { backgroundColor: colors.badgeBg }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                RGPD / GDPR & LGPD • ATUALIZADO EM 27/11/2026
              </Text>
            </View>
            <Text style={[styles.introTitle, { color: colors.textMain }]}>
              Proteção de Dados e Privacidade
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted }]}>
              Esta Política de Privacidade aplica-se à aplicação móvel Castello Mobile e ao painel
              Web Castello ERP, detalhando como os dados operacionais e de assiduidade são
              protegidos.
            </Text>
          </View>

          {/* Secções */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                1. Dados Recolhidos
              </Text>
            </View>
            <Text style={[styles.paragraph, { color: colors.textMuted }]}>
              • <Text style={{ color: colors.textMain, fontWeight: '700' }}>Perfil Laboral:</Text>{' '}
              nome completo, e-mail de trabalho, código PIN de acesso, cargo/função, telefone e
              foto de perfil opcional.{'\n'}
              • <Text style={{ color: colors.textMain, fontWeight: '700' }}>Picagens de Ponto:</Text>{' '}
              horários de entrada, pausa de almoço, saída, sessões de trabalho por obra e
              justificações de falta.{'\n'}
              • <Text style={{ color: colors.textMain, fontWeight: '700' }}>Fotos e Comprovativos:</Text>{' '}
              imagens enviadas voluntariamente pelo colaborador para comprovar faltas, evolução de
              obra ou estado de viaturas.
            </Text>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="finger-print-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                2. Biometria, Câmara e Notificações
              </Text>
            </View>
            <Text style={[styles.paragraph, { color: colors.textMuted }]}>
              • <Text style={{ color: colors.textMain, fontWeight: '700' }}>Biometria Local:</Text>{' '}
              a validação por impressão digital ou Face ID ocorre exclusivamente no sistema
              operativo do seu telemóvel. Nenhum dado biométrico é enviado ou guardado em servidores
              externos.{'\n'}
              • <Text style={{ color: colors.textMain, fontWeight: '700' }}>Câmara e Galeria:</Text>{' '}
              utilizadas apenas quando seleciona ou tira uma foto dentro da app.{'\n'}
              • <Text style={{ color: colors.textMain, fontWeight: '700' }}>Notificações Locais:</Text>{' '}
              usadas para o alarme de término da hora de almoço e avisos da empresa.
            </Text>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                3. Isolamento por Firma e Segurança
              </Text>
            </View>
            <Text style={[styles.paragraph, { color: colors.textMuted }]}>
              Os dados são protegidos com autenticação criptográfica JWT, políticas de isolamento
              Row-Level Security (RLS) por empresa e encriptação HTTPS/TLS em trânsito. Nenhuma
              firma externa tem acesso aos registos da sua organização, e os seus dados nunca são
              vendidos ou usados para publicidade.
            </Text>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                4. Direitos do Utilizador e Contacto
              </Text>
            </View>
            <Text style={[styles.paragraph, { color: colors.textMuted }]}>
              Pode solicitar o acesso, correção ou eliminação dos seus dados pessoais junto à
              administração da sua firma empregadora ou através do canal de suporte oficial:{' '}
              <Text style={{ color: colors.textMain, fontWeight: '700' }}>
                suporte@erpcastle.com
              </Text>
              .
            </Text>
          </View>

          {/* Ações de Rodapé */}
          <View style={styles.footerBtns}>
            {onOpenTerms && (
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={onOpenTerms}
              >
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                <Text style={[styles.secondaryBtnText, { color: colors.textMain }]}>
                  Ver Termos de Serviço
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={onClose}
            >
              <Text style={styles.primaryBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: 32, height: 32 },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  headerSub: { fontSize: 11 },
  closeBtn: { padding: 6 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 36, gap: 14 },
  introCard: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  introTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  sectionCard: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  paragraph: { fontSize: 13, lineHeight: 20 },
  footerBtns: { marginTop: 8, gap: 10 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '700' },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
