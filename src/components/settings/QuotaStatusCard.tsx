import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/theme';

interface QuotaStatusCardProps {
  hasCustom: boolean;
  maskedKey: string;
  activeModelName: string;
  todayScans: number;
  dailyQuotaLimit: number;
  quotaPercent: number;
  rateLimitRPM: number;
}

export function QuotaStatusCard({
  hasCustom,
  maskedKey,
  activeModelName,
  todayScans,
  dailyQuotaLimit,
  quotaPercent,
  rateLimitRPM,
}: QuotaStatusCardProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.quotaCard}>
      {/* Key Status Header */}
      <View style={styles.quotaHeaderRow}>
        <View style={styles.statusCol}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.statusDot,
                hasCustom ? styles.statusDotLive : styles.statusDotProxy,
              ]}
            />
            <Text style={styles.statusText}>
              {hasCustom ? 'BYOK Custom Key Active' : 'Managed Proxy (Default)'}
            </Text>
          </View>
          <Text style={styles.keySnippetText}>{maskedKey}</Text>
        </View>

        <View style={styles.modelBadge}>
          <Text style={styles.modelBadgeText} numberOfLines={1}>
            {activeModelName}
          </Text>
        </View>
      </View>

      {/* Daily Free Tier Quota Progress */}
      <View style={styles.quotaProgressSection}>
        <View style={styles.quotaLabelRow}>
          <Text style={styles.quotaLabel}>{"Today's API Quota"}</Text>
          <Text style={styles.quotaValue}>
            {todayScans.toLocaleString()} / {dailyQuotaLimit.toLocaleString()} scans ({quotaPercent}%)
          </Text>
        </View>

        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.max(4, quotaPercent)}%` },
              quotaPercent > 80 && styles.progressBarFillWarning,
            ]}
          />
        </View>

        <View style={styles.rateLimitRow}>
          <Text style={styles.rateLimitText}>
            Limit: {rateLimitRPM} RPM • {dailyQuotaLimit} requests/day
          </Text>
          <Text style={styles.freeTierTag}>Google AI Studio Free Tier</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    quotaCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 12,
    },
    quotaHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    statusCol: {
      flex: 1,
      marginRight: 12,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusDotLive: {
      backgroundColor: colors.success,
    },
    statusDotProxy: {
      backgroundColor: colors.secondary,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    keySnippetText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontFamily: 'monospace',
    },
    modelBadge: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      maxWidth: '45%',
    },
    modelBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    quotaProgressSection: {
      gap: 6,
    },
    quotaLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    quotaLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    quotaValue: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    progressBarTrack: {
      height: 8,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
    progressBarFillWarning: {
      backgroundColor: colors.warning,
    },
    rateLimitRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2,
    },
    rateLimitText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    freeTierTag: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.success,
    },
  });
}
