import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  formatWeeklySummaryShareText,
  WeeklySummary,
} from '../services/weeklySummaryService';
import type { ThemeColors } from '../theme/colors';
import { useThemeColors, useThemedStyles } from '../theme/theme';
import { safeHaptics } from '../utils/haptics';

interface WeeklySummaryModalProps {
  visible: boolean;
  onClose: () => void;
  summary: WeeklySummary;
}

export function WeeklySummaryModal({
  visible,
  onClose,
  summary,
}: WeeklySummaryModalProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const handleShare = async () => {
    safeHaptics.selection();
    try {
      const shareText = formatWeeklySummaryShareText(summary);
      await Share.share({
        message: shareText,
        title: 'BetterYou Weekly Summary',
      });
    } catch {
      // Ignored
    }
  };

  const deltaText =
    summary.calorieTargetDelta > 0
      ? `+${summary.calorieTargetDelta} kcal vs target`
      : summary.calorieTargetDelta < 0
      ? `${summary.calorieTargetDelta} kcal vs target`
      : 'On target';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle} allowFontScaling>
                Weekly Recap
              </Text>
              <Text style={styles.headerSubtitle} allowFontScaling>
                {summary.weekStart} to {summary.weekEnd}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Close weekly recap"
              hitSlop={12}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Encouraging Non-Judgmental Message */}
            <View style={styles.encouragementCard}>
              <View style={styles.encouragementIcon}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
              </View>
              <Text style={styles.encouragementText} allowFontScaling>
                Every step forward counts. Consistency is about showing up and tuning in to what your body needs.
              </Text>
            </View>

            {/* Metrics Grid */}
            <View style={styles.grid}>
              {/* Workouts Card */}
              <View style={styles.statCard}>
                <View style={[styles.statIconBadge, { backgroundColor: colors.primaryMuted }]}>
                  <Ionicons name="barbell" size={18} color={colors.primary} />
                </View>
                <Text style={styles.statValue} allowFontScaling>
                  {summary.workoutCount}
                </Text>
                <Text style={styles.statLabel} allowFontScaling>
                  Sessions
                </Text>
                <Text style={styles.statSubtext} allowFontScaling>
                  {summary.totalVolumeKg.toLocaleString()} kg total volume
                </Text>
              </View>

              {/* Nutrition Card */}
              <View style={styles.statCard}>
                <View style={[styles.statIconBadge, { backgroundColor: colors.softOrange }]}>
                  <Ionicons name="restaurant" size={18} color={colors.calories} />
                </View>
                <Text style={styles.statValue} allowFontScaling>
                  {summary.avgDailyCalories}
                </Text>
                <Text style={styles.statLabel} allowFontScaling>
                  Avg Daily kcal
                </Text>
                <Text style={styles.statSubtext} allowFontScaling>
                  {deltaText}
                </Text>
              </View>

              {/* PRs Card */}
              <View style={styles.statCard}>
                <View style={[styles.statIconBadge, { backgroundColor: colors.softGreen }]}>
                  <Ionicons name="trophy" size={18} color={colors.success} />
                </View>
                <Text style={styles.statValue} allowFontScaling>
                  {summary.prsThisWeek}
                </Text>
                <Text style={styles.statLabel} allowFontScaling>
                  New PRs
                </Text>
                <Text style={styles.statSubtext} allowFontScaling>
                  {summary.prsThisWeek > 0
                    ? 'Records broken!'
                    : 'Building foundation'}
                </Text>
              </View>

              {/* Streak Card */}
              <View style={styles.statCard}>
                <View style={[styles.statIconBadge, { backgroundColor: colors.softBlue }]}>
                  <Ionicons name="flash" size={18} color={colors.secondary} />
                </View>
                <Text style={styles.statValue} allowFontScaling>
                  {summary.streakDays}
                </Text>
                <Text style={styles.statLabel} allowFontScaling>
                  Day Streak
                </Text>
                <Text style={styles.statSubtext} allowFontScaling>
                  {summary.streakDays > 0 ? 'Active days' : 'Ready to start'}
                </Text>
              </View>
            </View>

            {/* PR Details List if any */}
            {summary.prDetails && summary.prDetails.length > 0 && (
              <View style={styles.prListCard}>
                <Text style={styles.prListTitle} allowFontScaling>
                  🏆 Personal Records Hit This Week
                </Text>
                {summary.prDetails.map((pr, idx) => (
                  <View key={idx} style={styles.prRow}>
                    <Text style={styles.prExerciseName} allowFontScaling>
                      {pr.exerciseName}
                    </Text>
                    <Text style={styles.prWeights} allowFontScaling>
                      {pr.weightKg} kg (was {pr.previousMaxKg} kg)
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Products Screened */}
            <View style={styles.productBanner}>
              <View style={[styles.statIconBadge, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.secondary} />
              </View>
              <View style={styles.productBannerMeta}>
                <Text style={styles.productBannerTitle} allowFontScaling>
                  {summary.productsScreened} Products Screened
                </Text>
                <Text style={styles.productBannerSub} allowFontScaling>
                  Independent ingredient risk screening
                </Text>
              </View>
            </View>

            {/* Share Card Button */}
            <Pressable
              style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share clean weekly summary card"
            >
              <Ionicons name="share-outline" size={18} color={colors.textInverse} />
              <Text style={styles.shareBtnText} allowFontScaling>
                Share Summary Card
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
      paddingBottom: 32,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: 20,
      gap: 16,
    },
    encouragementCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryMuted,
      borderRadius: 14,
      padding: 14,
      gap: 12,
    },
    encouragementIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    encouragementText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: colors.text,
      fontWeight: '500',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    statCard: {
      width: '48%',
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    statIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    statLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 2,
    },
    statSubtext: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
    },
    prListCard: {
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 8,
    },
    prListTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    prRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    prExerciseName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      textTransform: 'capitalize',
    },
    prWeights: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.success,
    },
    productBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 12,
    },
    productBannerMeta: {
      flex: 1,
    },
    productBannerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    productBannerSub: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      height: 48,
      gap: 8,
      marginTop: 8,
    },
    shareBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textInverse,
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
