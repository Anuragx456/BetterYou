import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { ScannedProduct } from '../../types';

interface SavedScanItemProps {
  item: ScannedProduct;
  onSelect: (item: ScannedProduct) => void;
}

export const SavedScanItem = React.memo(function SavedScanItem({
  item,
  onSelect,
}: SavedScanItemProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const score = item.report.overallSafetyScore;
  const badgeColor =
    score >= 71
      ? colors.safetyClean
      : score >= 40
      ? colors.safetyModerate
      : colors.safetyHighRisk;

  return (
    <Pressable
      style={({ pressed }) => [styles.scannedCard, pressed && styles.pressed]}
      onPress={() => onSelect(item)}
    >
      <View style={styles.scannedCardHeader}>
        <View style={styles.scannedProductTitleCol}>
          <Text style={styles.scannedProductName} numberOfLines={1}>
            {item.productName}
          </Text>
          <View style={styles.scannedMetaRow}>
            {item.report.category ? (
              <View style={styles.scannedCategoryBadge}>
                <Text style={styles.scannedCategoryText}>{item.report.category}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View
          style={[
            styles.safetyScoreBadge,
            { backgroundColor: `${badgeColor}20`, borderColor: badgeColor },
          ]}
        >
          <Text style={[styles.safetyScoreNumber, { color: badgeColor }]}>{score}</Text>
          <Text style={[styles.safetyScoreLabel, { color: badgeColor }]}>
            {item.report.riskLevel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

interface RecentScansProps {
  scans: ScannedProduct[];
  scannedProductCount: number;
  onScan: () => void;
  onOpen: (item: ScannedProduct) => void;
  onViewAll: () => void;
}

export const RecentScans = React.memo(function RecentScans({
  scans,
  scannedProductCount,
  onScan,
  onOpen,
  onViewAll,
}: RecentScansProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  if (scans.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleWithIcon}>
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.cardTitle}>Recent Ingredient Checks</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.cleanLinkBtn, pressed && styles.pressed]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={onScan}
        >
          <Text style={styles.cleanLinkText}>Scan</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.scannedCleanList}>
        {scans.map((item: ScannedProduct, idx) => {
          const isLast = idx === scans.length - 1;
          const score = item.report.overallSafetyScore;
          const badgeColor =
            score >= 71
              ? colors.safetyClean
              : score >= 40
              ? colors.safetyModerate
              : colors.safetyHighRisk;

          return (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.scannedCleanItem,
                !isLast && styles.mealCleanItemBorder,
                pressed && styles.pressed,
              ]}
              onPress={() => onOpen(item)}
            >
              <View style={styles.scannedCleanLeft}>
                <View
                  style={[
                    styles.safetyScoreBadgeClean,
                    { borderColor: badgeColor, backgroundColor: `${badgeColor}15` },
                  ]}
                >
                  <Text style={[styles.safetyScoreNumberClean, { color: badgeColor }]}>
                    {score}
                  </Text>
                </View>
                <View style={styles.scannedCleanInfo}>
                  <Text style={styles.scannedCleanName} numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text style={styles.scannedCleanSub}>
                    {(item.flaggedCount ?? (item.reportComplete ? item.report.harmfulIngredients.length : 0)) > 0
                      ? `Flagged ${
                          item.flaggedCount ??
                          (item.reportComplete ? item.report.harmfulIngredients.length : 0)
                        } harmful additives`
                      : item.report.riskLevel}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      {scannedProductCount > 3 && (
        <Pressable
          style={({ pressed }) => [styles.viewAllHistoryBtnClean, pressed && styles.pressed]}
          onPress={onViewAll}
        >
          <Text style={styles.viewAllHistoryTextClean}>
            View All Saved ({scannedProductCount})
          </Text>
        </Pressable>
      )}
    </View>
  );
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    cardTitleWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    cleanLinkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    cleanLinkText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    scannedCleanList: {
      gap: 0,
    },
    scannedCleanItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    mealCleanItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    scannedCleanLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    safetyScoreBadgeClean: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    safetyScoreNumberClean: {
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    scannedCleanInfo: {
      flex: 1,
      gap: 2,
    },
    scannedCleanName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    scannedCleanSub: {
      fontSize: 12,
      color: colors.textMuted,
    },
    viewAllHistoryBtnClean: {
      marginTop: 12,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 12,
      backgroundColor: colors.surfaceSubtle,
    },
    viewAllHistoryTextClean: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    scannedCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    scannedCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    scannedProductTitleCol: {
      flex: 1,
      marginRight: 12,
    },
    scannedProductName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    scannedMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    scannedCategoryBadge: {
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    scannedCategoryText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    safetyScoreBadge: {
      width: 48,
      height: 48,
      borderRadius: 12,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    safetyScoreNumber: {
      fontSize: 18,
      fontWeight: '800',
    },
    safetyScoreLabel: {
      fontSize: 9,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
