import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';

interface ModalScoreGaugeHeroProps {
  score: number;
  scoreColor: string;
  riskLevel: string;
  category?: string;
  productName: string;
  onOpenEdit: () => void;
}

export const ModalScoreGaugeHero = React.memo(function ModalScoreGaugeHero({
  score,
  scoreColor,
  riskLevel,
  category,
  productName,
  onOpenEdit,
}: ModalScoreGaugeHeroProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.gaugeHeroCard}>
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
          <Text style={styles.gaugeRiskLabel}>
            {riskLevel === 'Safe' ? 'Safe & Clean' : riskLevel}
          </Text>
          {category ? (
            <View style={styles.gaugeCategoryBadge}>
              <Text style={styles.gaugeCategoryText}>{category}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.productNameRowClean}>
        <Text style={styles.productNameClean} numberOfLines={2}>
          {productName}
        </Text>
        <Pressable
          style={styles.inlineEditBtnClean}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onOpenEdit}
        >
          <Ionicons name="pencil" size={13} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    gaugeHeroCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 24,
      alignItems: 'center',
      marginBottom: 16,
    },
    gaugeRingWrapper: {
      width: 156,
      height: 156,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    gaugeCenterAbsolute: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
      width: 120,
    },
    gaugeScoreHuge: {
      fontSize: 48,
      fontWeight: '900',
      letterSpacing: -1,
      lineHeight: 52,
    },
    gaugeRiskLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    gaugeCategoryBadge: {
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    gaugeCategoryText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    productNameRowClean: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '90%',
    },
    productNameClean: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    inlineEditBtnClean: {
      padding: 4,
    },
  });
}
