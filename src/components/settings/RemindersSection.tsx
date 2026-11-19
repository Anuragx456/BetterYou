import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/theme';

export interface RemindersSectionProps {
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  weeklyReviewEnabled: boolean;
  weeklyReviewTime: string;
  onToggleDailyReminder: (val: boolean) => void;
  onChangeDailyReminderTime: () => void;
  onToggleWeeklyReview: (val: boolean) => void;
  onChangeWeeklyReviewTime: () => void;
}

export const RemindersSection = React.memo(function RemindersSection({
  dailyReminderEnabled,
  dailyReminderTime,
  weeklyReviewEnabled,
  weeklyReviewTime,
  onToggleDailyReminder,
  onChangeDailyReminderTime,
  onToggleWeeklyReview,
  onChangeWeeklyReviewTime,
}: RemindersSectionProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]} allowFontScaling>
        REMINDERS & NOTIFICATIONS
      </Text>
      <View
        style={[
          styles.cardGroup,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        {/* Daily Meal Log Reminder */}
        <View style={styles.navRow}>
          <View style={[styles.iconBadge, { backgroundColor: colors.softOrange }]}>
            <Ionicons name="notifications-outline" size={18} color={colors.calories} />
          </View>
          <View style={styles.navRowMeta}>
            <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
              Daily Meal Log Reminder
            </Text>
            <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
              {dailyReminderEnabled ? `Active daily at ${dailyReminderTime}` : 'Disabled (opt-in only)'}
            </Text>
          </View>
          <Switch
            value={dailyReminderEnabled}
            onValueChange={onToggleDailyReminder}
            trackColor={{ false: colors.cardBorder, true: colors.primary }}
            thumbColor={colors.white}
            accessibilityRole="switch"
            accessibilityLabel="Toggle daily meal log reminder"
          />
        </View>

        {dailyReminderEnabled && (
          <>
            <View style={[styles.rowDivider, { backgroundColor: colors.hairline }]} />
            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={onChangeDailyReminderTime}
              accessibilityRole="button"
              accessibilityLabel="Change daily reminder time"
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
                  Reminder Time
                </Text>
                <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
                  Scheduled for {dailyReminderTime}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </>
        )}

        <View style={[styles.rowDivider, { backgroundColor: colors.hairline }]} />

        {/* Sunday Weekly Review */}
        <View style={styles.navRow}>
          <View style={[styles.iconBadge, { backgroundColor: colors.softGreen }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.success} />
          </View>
          <View style={styles.navRowMeta}>
            <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
              Sunday Weekly Recap
            </Text>
            <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
              {weeklyReviewEnabled ? `Sundays at ${weeklyReviewTime}` : 'Disabled (opt-in only)'}
            </Text>
          </View>
          <Switch
            value={weeklyReviewEnabled}
            onValueChange={onToggleWeeklyReview}
            trackColor={{ false: colors.cardBorder, true: colors.success }}
            thumbColor={colors.white}
            accessibilityRole="switch"
            accessibilityLabel="Toggle Sunday weekly recap reminder"
          />
        </View>

        {weeklyReviewEnabled && (
          <>
            <View style={[styles.rowDivider, { backgroundColor: colors.hairline }]} />
            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={onChangeWeeklyReviewTime}
              accessibilityRole="button"
              accessibilityLabel="Change weekly review reminder time"
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
                  Review Prompt Time
                </Text>
                <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
                  Scheduled for {weeklyReviewTime}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  cardGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRowMeta: {
    flex: 1,
  },
  navRowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  navRowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
