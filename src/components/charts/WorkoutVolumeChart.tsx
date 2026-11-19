import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { WorkoutSession } from '../../types';
import { addLocalDays, getLocalDateString } from '../../utils/date';

interface WorkoutVolumeChartProps {
  workouts: WorkoutSession[];
  todayDate?: string;
}

interface WeekVolume {
  weekIndex: number;
  label: string;
  startDate: string;
  endDate: string;
  volumeKg: number;
  sessionCount: number;
}

export function WorkoutVolumeChart({
  workouts,
  todayDate = getLocalDateString(),
}: WorkoutVolumeChartProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  // Group workouts into 8 weeks (7 days each, ending in todayDate)
  const weekBuckets: WeekVolume[] = useMemo(() => {
    const buckets: WeekVolume[] = [];

    for (let w = 7; w >= 0; w--) {
      const endDaysAgo = w * 7;
      const startDaysAgo = endDaysAgo + 6;
      const startDate = addLocalDays(todayDate, -startDaysAgo);
      const endDate = addLocalDays(todayDate, -endDaysAgo);

      const label = w === 0 ? 'This Wk' : `W-${w}`;

      let volumeKg = 0;
      let sessionCount = 0;

      for (const session of workouts) {
        const sDate = session.date || (session.completedAt || session.startedAt || '').split('T')[0];
        if (sDate >= startDate && sDate <= endDate) {
          volumeKg += session.totalVolumeKg || 0;
          sessionCount++;
        }
      }

      buckets.push({
        weekIndex: 7 - w,
        label,
        startDate,
        endDate,
        volumeKg: Math.round(volumeKg),
        sessionCount,
      });
    }

    return buckets;
  }, [workouts, todayDate]);

  const maxVolume = Math.max(1000, ...weekBuckets.map((b) => b.volumeKg));
  const currentWeekVolume = weekBuckets[7]?.volumeKg || 0;
  const totalVolume = weekBuckets.reduce((acc, b) => acc + b.volumeKg, 0);
  const avgWeeklyVolume = Math.round(totalVolume / 8);

  const chartHeight = 120;
  const chartWidth = 320;
  const paddingBottom = 22;
  const paddingTop = 16;
  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const barWidth = 18;
  const slotWidth = chartWidth / 8;

  const accessibilityLabel = `8-week training volume trend. Current week volume is ${currentWeekVolume.toLocaleString()} kilograms across ${weekBuckets[7]?.sessionCount || 0} sessions. 8-week weekly average is ${avgWeeklyVolume.toLocaleString()} kilograms.`;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.chartTitle}>8-Week Workout Volume</Text>
          <Text style={styles.chartSubtitle}>
            This Wk: <Text style={styles.boldText}>{currentWeekVolume.toLocaleString()} kg</Text> •
            Avg: <Text style={styles.boldText}>{avgWeeklyVolume.toLocaleString()} kg/wk</Text>
          </Text>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>Tonnage (kg)</Text>
        </View>
      </View>

      <Svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        {weekBuckets.map((bucket, idx) => {
          const x = idx * slotWidth + (slotWidth - barWidth) / 2;
          const isCurrentWeek = idx === 7;

          if (bucket.volumeKg <= 0) {
            return (
              <React.Fragment key={bucket.startDate}>
                <Rect
                  x={x}
                  y={chartHeight - paddingBottom - 2}
                  width={barWidth}
                  height={2}
                  rx={1}
                  fill={colors.cardBorder}
                />
                <SvgText
                  x={x + barWidth / 2}
                  y={chartHeight - 6}
                  fill={isCurrentWeek ? colors.primary : colors.textMuted}
                  fontSize="8"
                  fontWeight={isCurrentWeek ? 'bold' : 'normal'}
                  textAnchor="middle"
                >
                  {bucket.label}
                </SvgText>
              </React.Fragment>
            );
          }

          const barHeight = Math.min(
            usableHeight,
            Math.max(6, (bucket.volumeKg / maxVolume) * usableHeight)
          );
          const y = chartHeight - paddingBottom - barHeight;
          const barColor = isCurrentWeek ? colors.primary : colors.secondary;

          return (
            <React.Fragment key={bucket.startDate}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                fill={barColor}
              />
              {/* Optional tiny volume label on top of bar */}
              {bucket.volumeKg >= 1000 && (
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 3}
                  fill={colors.textSecondary}
                  fontSize="7"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {`${Math.round(bucket.volumeKg / 100) / 10}k`}
                </SvgText>
              )}
              {/* Week label under bar */}
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight - 6}
                fill={isCurrentWeek ? colors.primary : colors.textMuted}
                fontSize="8"
                fontWeight={isCurrentWeek ? 'bold' : '500'}
                textAnchor="middle"
              >
                {bucket.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      padding: 14,
      marginVertical: 6,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    chartTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    chartSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    boldText: {
      color: colors.text,
      fontWeight: '700',
    },
    badge: {
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    badgeText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
    },
  });
}
