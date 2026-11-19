import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useThemeColors } from '../../theme/theme';
import type { ToxicityReport } from '../../types';
import { safeHaptics } from '../../utils/haptics';

export interface SafetyScoreGaugeHeroProps {
  report: ToxicityReport;
  onOpenEditProduct: () => void;
  onOpenRetryProduct: () => void;
}

export const SafetyScoreGaugeHero = React.memo(function SafetyScoreGaugeHero({
  report,
  onOpenEditProduct,
  onOpenRetryProduct,
}: SafetyScoreGaugeHeroProps) {
  const colors = useThemeColors();

  const score = report.overallSafetyScore;
  const scoreColor =
    score >= 71
      ? colors.safetyClean
      : score >= 40
      ? colors.safetyModerate
      : colors.safetyHighRisk;

  return (
    <View
      style={[
        styles.gaugeHeroCard,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
    >
      <View style={styles.gaugeRingWrapper}>
        <Svg width={156} height={156}>
          <Circle
            cx={78}
            cy={78}
            r={68}
            stroke={colors.surfaceSubtle}
            strokeWidth={10}
            fill="none"
          />
          <Circle
            cx={78}
            cy={78}
            r={68}
            stroke={scoreColor}
            strokeWidth={10}
            strokeDasharray={`${(2 * Math.PI * 68).toFixed(2)} ${(2 * Math.PI * 68).toFixed(2)}`}
            strokeDashoffset={(2 * Math.PI * 68 * (1 - Math.min(1, Math.max(0, score / 100)))).toFixed(2)}
            strokeLinecap="round"
            fill="none"
            transform="rotate(-90 78 78)"
          />
        </Svg>
        <View style={styles.gaugeCenterAbsolute} pointerEvents="none">
          <Text style={[styles.gaugeScoreHuge, { color: scoreColor }]}>{score}</Text>
          <Text style={[styles.gaugeRiskLabel, { color: colors.textSecondary }]}>
            {report.riskLevel === 'Safe' ? 'Safe & Clean' : report.riskLevel}
          </Text>
          {report.category ? (
            <View
              style={[
                styles.gaugeCategoryBadge,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.hairline },
              ]}
            >
              <Text style={[styles.gaugeCategoryText, { color: colors.textSecondary }]}>
                {report.category}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.productNameRowClean}>
        <Text style={[styles.productNameClean, { color: colors.text }]} numberOfLines={2}>
          {report.productName || 'Inspected Product'}
        </Text>
        <Pressable
          style={styles.inlineEditBtnClean}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onOpenEditProduct}
        >
          <Ionicons name="pencil" size={12} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Retry with Different Product Name */}
      <Pressable
        style={({ pressed }) => [
          styles.retryProductBtnClean,
          {
            backgroundColor: colors.primaryMuted,
            borderColor: colors.primary,
          },
          pressed && styles.pressed,
        ]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => {
          safeHaptics.selection();
          onOpenRetryProduct();
        }}
        accessibilityRole="button"
        accessibilityLabel="Wrong product detected? Retry with actual product name"
      >
        <Ionicons name="swap-horizontal" size={13} color={colors.primary} />
        <Text style={[styles.retryProductBtnTextClean, { color: colors.primary }]} allowFontScaling>
          Wrong product? Retry with actual name
        </Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  gaugeHeroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  gaugeRingWrapper: {
    width: 156,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 8,
  },
  gaugeCenterAbsolute: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScoreHuge: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  gaugeRiskLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  gaugeCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
  },
  gaugeCategoryText: {
    fontSize: 10,
    fontWeight: '500',
  },
  productNameRowClean: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  productNameClean: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  inlineEditBtnClean: {
    padding: 4,
  },
  retryProductBtnClean: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    alignSelf: 'center',
  },
  retryProductBtnTextClean: {
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});
