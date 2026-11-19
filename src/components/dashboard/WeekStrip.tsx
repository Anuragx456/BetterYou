import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { DayItem, formatDateLabel, formatMonthYear } from '../../utils/date';

interface WeekStripProps {
  selectedDate: string;
  canGoForward: boolean;
  weekDays: DayItem[];
  activityDateSet: Set<string>;
  isViewingToday: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay: (date: string) => void;
  onReturnToday: () => void;
}

export const WeekStrip = React.memo(function WeekStrip({
  selectedDate,
  canGoForward,
  weekDays,
  activityDateSet,
  isViewingToday,
  onPrev,
  onNext,
  onSelectDay,
  onReturnToday,
}: WeekStripProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <>
      {/* Date Navigation Scrubber - Month Pill with Arrows + Day Chips */}
      <View style={styles.calendarStripSection}>
        <View style={styles.monthPillRow}>
          <Pressable
            style={({ pressed }) => [styles.monthNavArrow, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={onPrev}
            accessibilityLabel="Previous day"
          >
            <Ionicons name="arrow-back" size={16} color={colors.text} />
          </Pressable>

          <View style={styles.monthPill}>
            <Text style={styles.monthPillText}>{formatMonthYear(selectedDate)}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.monthNavArrow,
              !canGoForward && styles.dateNavArrowDisabled,
              pressed && canGoForward && styles.pressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={onNext}
            disabled={!canGoForward}
            accessibilityLabel="Next day"
          >
            <Ionicons
              name="arrow-forward"
              size={16}
              color={canGoForward ? colors.text : colors.textMuted}
            />
          </Pressable>
        </View>

        {/* Weekday Row: SUN MON TUE WED THR FRI SAT */}
        <View style={styles.weekDaysGrid}>
          {weekDays.map((day) => {
            const isSelected = day.dateStr === selectedDate;
            const hasData = activityDateSet.has(day.dateStr);

            return (
              <Pressable
                key={day.dateStr}
                style={({ pressed }) => [
                  styles.dayCol,
                  pressed && styles.pressed,
                ]}
                onPress={() => onSelectDay(day.dateStr)}
                accessibilityRole="button"
                accessibilityLabel={`${day.dayName} ${day.dayNum}`}
              >
                <Text
                  style={[
                    styles.dayNameLabel,
                    isSelected && styles.dayNameLabelActive,
                  ]}
                >
                  {day.dayName}
                </Text>
                <View
                  style={[
                    styles.dayCircle,
                    isSelected && styles.dayCircleSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumberLabel,
                      isSelected && styles.dayNumberLabelSelected,
                    ]}
                  >
                    {day.dayNum}
                  </Text>
                </View>
                {hasData && !isSelected && <View style={styles.dayDotIndicator} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Past Date Notice Banner */}
      {!isViewingToday && (
        <View style={styles.pastDateBanner}>
          <View style={styles.pastDateBannerLeft}>
            <Ionicons name="calendar-outline" size={15} color={colors.info} />
            <Text style={styles.pastDateBannerText}>
              Viewing {formatDateLabel(selectedDate)}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.backToTodayBtn, pressed && styles.pressed]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            onPress={onReturnToday}
          >
            <Ionicons name="return-up-back" size={13} color={colors.primary} />
            <Text style={styles.backToTodayBtnText}>Back to Today</Text>
          </Pressable>
        </View>
      )}
    </>
  );
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    calendarStripSection: {
      marginBottom: 16,
    },
    monthPillRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      marginBottom: 12,
    },
    monthPill: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    monthPillText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.1,
    },
    monthNavArrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    dateNavArrowDisabled: {
      opacity: 0.35,
    },
    weekDaysGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 2,
    },
    dayCol: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
    },
    dayNameLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 6,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    dayNameLabelActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    dayCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    dayCircleSelected: {
      backgroundColor: colors.primary,
    },
    dayNumberLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    dayNumberLabelSelected: {
      color: colors.white,
      fontWeight: '700',
    },
    dayDotIndicator: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
      marginTop: 4,
    },
    pastDateBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    pastDateBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    pastDateBannerText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    backToTodayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.primaryMuted,
    },
    backToTodayBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
