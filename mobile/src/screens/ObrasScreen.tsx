import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConstructionSite, SiteStatus } from '../types';

interface ObrasScreenProps {
  sites: ConstructionSite[];
  theme: 'light' | 'dark';
  onSelectSite?: (site: ConstructionSite) => void;
}

export const ObrasScreen: React.FC<ObrasScreenProps> = ({
  sites,
  theme,
  onSelectSite,
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
  };

  const [filter, setFilter] = useState<'todas' | SiteStatus>('todas');

  const filtered = sites.filter((s) =>
    filter === 'todas' ? true : s.status === filter
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textMain }]}>
          Obras da Empresa
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Estaleiros ativos e frentes operacionais disponíveis para a equipa
        </Text>
      </View>

      <View style={styles.filterRow}>
        {(['todas', 'ativa', 'pausada', 'concluida'] as const).map((item) => {
          const active = filter === item;
          const label =
            item === 'todas'
              ? 'Todas'
              : item === 'ativa'
              ? 'Ativas'
              : item === 'pausada'
              ? 'Pausadas'
              : 'Concluídas';
          return (
            <TouchableOpacity
              key={item}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilter(item)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? '#FFFFFF' : colors.textMuted },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filtered.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
            Nenhuma obra registada para a sua empresa no momento.
          </Text>
        </View>
      ) : (
        filtered.map((site) => (
          <TouchableOpacity
            key={site.id}
            activeOpacity={0.85}
            onPress={() => onSelectSite && onSelectSite(site)}
            style={[
              styles.siteCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.siteName, { color: colors.textMain }]}>
                    {site.name} →
                  </Text>
                  {site.share_code && (
                    <Text style={[styles.codeTag, { color: colors.primary }]}>
                      #{site.share_code}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 11, color: colors.primary, marginTop: 2, fontWeight: '600' }}>
                  Toque para ver informações e tarefas
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      site.status === 'ativa'
                        ? 'rgba(22, 163, 74, 0.15)'
                        : site.status === 'pausada'
                        ? 'rgba(217, 119, 6, 0.15)'
                        : 'rgba(37, 99, 235, 0.15)',
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color:
                      site.status === 'ativa'
                        ? '#16A34A'
                        : site.status === 'pausada'
                        ? '#D97706'
                        : '#2563EB',
                  }}
                >
                  {site.status.toUpperCase()}
                </Text>
              </View>
            </View>

            {site.description && (
              <Text style={[styles.siteDesc, { color: colors.textMuted }]}>
                {site.description}
              </Text>
            )}

            <View style={[styles.infoFooter, { borderTopColor: colors.border }]}>
              <View style={styles.infoLine}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  {site.address}
                </Text>
              </View>

              {site.manager_name && (
                <View style={styles.infoLine}>
                  <Ionicons name="person-outline" size={14} color={colors.textMuted} />
                  <Text style={[styles.infoText, { color: colors.textMuted }]}>
                    Encarregado: {site.manager_name}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))
      )}
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
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 10,
  },
  siteCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  siteName: {
    fontSize: 15,
    fontWeight: '700',
  },
  codeTag: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  siteDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  infoFooter: {
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
  },
});
