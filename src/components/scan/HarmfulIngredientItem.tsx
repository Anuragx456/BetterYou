import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/theme';
import type { HarmfulAdditive } from '../../types';

export interface HarmfulIngredientItemProps {
  item: HarmfulAdditive;
}

export const HarmfulIngredientItem = React.memo(function HarmfulIngredientItem({
  item,
}: HarmfulIngredientItemProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.harmfulItemCard, { borderBottomColor: colors.hairline }]}>
      <View style={styles.harmfulItemHeader}>
        <View style={styles.harmfulItemTitleRow}>
          <View style={[styles.statusDotClean, { backgroundColor: colors.danger, marginTop: 4 }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.ingredientNameHarmful, { color: colors.text }]}>{item.name}</Text>
            <View style={styles.harmfulMetaRow}>
              <Text
                style={[
                  styles.harmfulCategoryTag,
                  {
                    color: colors.textSecondary,
                    backgroundColor: colors.surfaceSubtle,
                  },
                ]}
              >
                {item.category}
              </Text>
              {item.concentrationRank ? (
                <Text
                  style={[
                    styles.harmfulRankTag,
                    {
                      color: colors.softOrangeText,
                      backgroundColor: colors.softOrange,
                    },
                  ]}
                >
                  {item.concentrationRank}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.badgeGroup}>
          <View
            style={[
              styles.severityBadgeClean,
              {
                backgroundColor: colors.fatMuted,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <Text style={[styles.severityBadgeText, { color: colors.danger }]}>
              {item.severity}
            </Text>
          </View>
          {typeof item.deduction === 'number' && item.deduction > 0 ? (
            <View style={[styles.deductionBadge, { backgroundColor: colors.fatMuted }]}>
              <Text style={[styles.deductionBadgeText, { color: colors.danger }]}>
                -{item.deduction} pts
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={[styles.ingredientHarmSub, { color: colors.danger }]}>
        {item.healthImpact}
      </Text>

      {/* Scientific Rationale */}
      {item.rationale ? (
        <View
          style={[
            styles.rationaleBox,
            {
              backgroundColor: colors.surfaceSubtle,
              borderLeftColor: colors.primary,
            },
          ]}
        >
          <Text style={[styles.rationaleLabel, { color: colors.primary }]}>
            Why it&apos;s flagged:
          </Text>
          <Text style={[styles.rationaleText, { color: colors.textSecondary }]}>
            {item.rationale}
          </Text>
        </View>
      ) : null}

      {/* Regulatory Source */}
      {(item.source || item.sourceUrl) ? (
        <View style={styles.sourceCitationRow}>
          <View style={styles.sourcePill}>
            <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
            <Text style={[styles.sourcePillText, { color: colors.primary }]}>
              Source: {item.source || 'Regulatory Monograph'}
            </Text>
          </View>
          {item.sourceUrl ? (
            <Pressable
              style={({ pressed }) => [styles.sourceLinkBtn, pressed && styles.pressed]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              onPress={() => Linking.openURL(item.sourceUrl!).catch(() => {})}
            >
              <Text style={[styles.sourceLinkText, { color: colors.primary }]}>
                View standard
              </Text>
              <Ionicons name="open-outline" size={12} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  harmfulItemCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  harmfulItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  harmfulItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  statusDotClean: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  ingredientNameHarmful: {
    fontSize: 13,
    fontWeight: '600',
  },
  harmfulMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  harmfulCategoryTag: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  harmfulRankTag: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  severityBadgeClean: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  severityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  deductionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deductionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  ingredientHarmSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  rationaleBox: {
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderLeftWidth: 2,
  },
  rationaleLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rationaleText: {
    fontSize: 11,
    lineHeight: 16,
  },
  sourceCitationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  sourceLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sourceLinkText: {
    fontSize: 10,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.8,
  },
});
