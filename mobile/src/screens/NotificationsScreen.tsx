import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CompanyNotification } from '../types';

interface NotificationsScreenProps {
  notifications: CompanyNotification[];
  theme: 'light' | 'dark';
  onBack: () => void;
  onNotificationRead?: (id: string) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  notifications,
  theme,
  onBack,
  onNotificationRead,
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
    warning: '#D97706',
  };

  const [selectedNotification, setSelectedNotification] =
    useState<CompanyNotification | null>(null);

  const handleSelectNotification = (item: CompanyNotification) => {
    setSelectedNotification(item);
    if (onNotificationRead && !item.is_read) {
      onNotificationRead(item.id);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Barra de Topo */}
      <View
        style={[
          styles.headerBar,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textMain} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.textMain }]}>
            Avisos da Empresa
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Comunicações oficiais e avisos da administração
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* Lista de Mensagens */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <View style={[styles.emptyBox, { borderColor: colors.border }]}>
            <Ionicons
              name="notifications-off-outline"
              size={36}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyTitle, { color: colors.textMain }]}>
              Sem mensagens no momento
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Quando a empresa emitir comunicados ou ordens de serviço, eles aparecerão aqui.
            </Text>
          </View>
        ) : (
          notifications.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.itemCard,
                {
                  backgroundColor: colors.card,
                  borderColor: item.is_read ? colors.border : colors.primary,
                  borderLeftWidth: item.is_read ? 1 : 4,
                },
              ]}
              onPress={() => handleSelectNotification(item)}
              activeOpacity={0.7}
            >
              <View style={styles.itemHeader}>
                <View style={styles.authorBadge}>
                  <Ionicons name="business-outline" size={12} color={colors.primary} />
                  <Text style={[styles.authorText, { color: colors.primary }]}>
                    {item.author_name || 'Castello Administração'}
                  </Text>
                </View>

                {!item.is_read && (
                  <View style={styles.unreadPill}>
                    <Text style={styles.unreadPillText}>NOVA</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.itemTitle, { color: colors.textMain }]} numberOfLines={1}>
                {item.title}
              </Text>

              <Text style={[styles.itemSnippet, { color: colors.textMuted }]} numberOfLines={2}>
                {item.content}
              </Text>

              <View style={styles.itemFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                  <Text style={[styles.itemDate, { color: colors.textMuted }]}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                    Ler aviso
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal Leitor da Mensagem (Somente Leitura) */}
      <Modal
        visible={Boolean(selectedNotification)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNotification(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Cabeçalho do Leitor */}
            <View style={[styles.readerHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.readerMetaRow}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
                  <Text style={[styles.readerAuthor, { color: colors.primary }]}>
                    {selectedNotification?.author_name || 'Administração Castello'}
                  </Text>
                </View>
                <Text style={[styles.readerDate, { color: colors.textMuted }]}>
                  {selectedNotification ? formatDate(selectedNotification.created_at) : ''}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedNotification(null)}
                style={[styles.closeBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="close" size={18} color={colors.textMain} />
              </TouchableOpacity>
            </View>

            {/* Corpo da Mensagem */}
            <ScrollView style={styles.readerBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.readerTitle, { color: colors.textMain }]}>
                {selectedNotification?.title}
              </Text>

              <Text style={[styles.readerContent, { color: colors.textMain }]}>
                {selectedNotification?.content}
              </Text>

              <View
                style={[
                  styles.readNoticeBox,
                  { backgroundColor: colors.cardSubtle, borderColor: colors.border },
                ]}
              >
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.readNoticeText, { color: colors.textMuted }]}>
                  Esta é uma comunicação oficial da empresa. Não é possível responder a este comunicado por aqui.
                </Text>
              </View>
            </ScrollView>

            {/* Rodapé com botão Fechar */}
            <View style={[styles.readerFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.btnOk, { backgroundColor: colors.primary }]}
                onPress={() => setSelectedNotification(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnOkText}>Fechar Aviso</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  emptyBox: {
    padding: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 260,
  },
  itemCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  authorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  unreadPill: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unreadPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  itemSnippet: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  itemDate: {
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxHeight: '82%',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  readerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readerAuthor: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  readerDate: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerBody: {
    padding: 18,
  },
  readerTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 14,
  },
  readerContent: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  readNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 24,
  },
  readNoticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  readerFooter: {
    padding: 14,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  btnOk: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  btnOkText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});

