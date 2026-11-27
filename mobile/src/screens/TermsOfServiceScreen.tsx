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

interface TermsOfServiceScreenProps {
  visible: boolean;
  onClose: () => void;
  onOpenPrivacy?: () => void;
  theme?: 'light' | 'dark';
}

export const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({
  visible,
  onClose,
  onOpenPrivacy,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    border: isDark ? '#334155' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#94A3B8' : '#64748B',
    primary: '#2563EB',
    badgeBg: isDark ? '#172554' : '#EFF6FF',
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
                Termos de Serviço
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
                CONDIÇÕES DE UTILIZAÇÃO • ATUALIZADO EM 27/11/2026
              </Text>
            </View>
            <Text style={[styles.introTitle, { color: colors.textMain }]}>
              Termos de Uso do Sistema Castello
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted }]}>
              Estes Termos de Serviço regulam a utilização da aplicação móvel Castello Mobile e da
              plataforma Web Castello ERP por empresas de construção civil e seus colaboradores.
            </Text>
          </View>

          {/* Secções */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="key-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                1. Credenciais e Código PIN
              </Text>
            </View>
            <Text style={[styles.paragraph, { color: colors.textMuted }]}>
              O acesso à aplicação móvel é realizado através do e-mail de trabalho e do código PIN
              atribuído pela firma empregadora. O PIN é pessoal, intransmissível e bloqueado contra
              alterações não autorizadas.
            </Text>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                2. Registo de Ponto e Obrigações do Colaborador
              </Text>
            </View>
            <Text style={[styles.paragraph, { color: colors.textMuted }]}>
              • Os registos de entrada, pausa de almoço, saída e sessões em obra devem corresponder
              exatamente à jornada real de trabalho.{'\n'}
              • É proibido registar ponto em nome de terceiros ou anexar comprovativos de falta
              inverídicos.{'\n'}
              • Todas as picagens e justificações ficam sujeitas à conferência e aprovação da
              administração da firma.
            </Text>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="car-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                3. Gestão de Obras, Viaturas e Inventário
              </Text>
            </View>
            <Text style={[styles.paragraph, { color: colors.textMuted }]}>
              As ferramentas de reporte de viaturas, ferramentas e acompanhamento de obras destinam-se
              exclusivamente ao uso profissional autorizado pela empresa titular da conta.
            </Text>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                4. Disponibilidade e Suporte
              </Text>
            </View>
            <Text style={[styles.paragraph, { color: colors.textMuted }]}>
              O Castello opera como plataforma SaaS de apoio à gestão operacional de obras. Para
              suporte técnico ou questões contratuais, contacte a administração da sua firma ou{' '}
              <Text style={{ color: colors.textMain, fontWeight: '700' }}>
                suporte@erpcastle.com
              </Text>
              .
            </Text>
          </View>

          {/* Ações de Rodapé */}
          <View style={styles.footerBtns}>
            {onOpenPrivacy && (
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={onOpenPrivacy}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
                <Text style={[styles.secondaryBtnText, { color: colors.textMain }]}>
                  Ver Política de Privacidade
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
