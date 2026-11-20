import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { formatTokens } from './usageFormatters';

interface UsageBentoGridProps {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCandidateTokens: number;
  successRate: number;
}

export function UsageBentoGrid({
  totalCalls,
  successfulCalls,
  failedCalls,
  totalTokens,
  totalPromptTokens,
  totalCandidateTokens,
  successRate,
}: UsageBentoGridProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.bentoGrid}>
      {/* Total Scans */}
      <View style={styles.bentoCard}>
        <View style={styles.bentoIconRow}>
          <Ionicons name="scan-outline" size={18} color={colors.primary} />
          <Text style={styles.bentoLabel}>TOTAL SCANS</Text>
        </View>
        <Text style={styles.bentoValue}>{totalCalls.toLocaleString()}</Text>
        <Text style={styles.bentoSubtext}>
          {successfulCalls} ok • {failedCalls} err
        </Text>
      </View>

      {/* Tokens Used */}
      <View style={styles.bentoCard}>
        <View style={styles.bentoIconRow}>
          <Ionicons name="speedometer-outline" size={18} color={colors.secondary} />
          <Text style={styles.bentoLabel}>TOKENS CONSUMED</Text>
        </View>
        <Text style={styles.bentoValue}>{formatTokens(totalTokens)}</Text>
        <Text style={styles.bentoSubtext}>
          {formatTokens(totalPromptTokens)} in • {formatTokens(totalCandidateTokens)} out
        </Text>
      </View>

      {/* Commercial Cost */}
      <View style={styles.bentoCard}>
        <View style={styles.bentoIconRow}>
          <Ionicons name="cash-outline" size={18} color={colors.calories} />
          <Text style={styles.bentoLabel}>BILLED COST</Text>
        </View>
        <Text style={[styles.bentoValue, { color: colors.primary }]}>$0.00</Text>
        <Text style={styles.bentoSubtext}>100% Free on AI Studio</Text>
      </View>

      {/* Success Rate */}
      <View style={styles.bentoCard}>
        <View style={styles.bentoIconRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.protein} />
          <Text style={styles.bentoLabel}>SUCCESS RATE</Text>
        </View>
        <Text style={styles.bentoValue}>{successRate}%</Text>
        <Text style={styles.bentoSubtext}>
          {failedCalls === 0 ? 'Optimal (0 errors)' : `${successfulCalls} succeeded`}
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bentoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 12,
    },
    bentoCard: {
      width: '48.5%',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    bentoIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    bentoLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    bentoValue: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      fontVariant: ['tabular-nums'],
      marginBottom: 4,
    },
    bentoSubtext: {
      fontSize: 11,
      color: colors.textMuted,
    },
  });
}
