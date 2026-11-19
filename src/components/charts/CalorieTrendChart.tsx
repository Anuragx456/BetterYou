import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { CalorieTrendDay } from '../../utils/nutritionAnalytics';

interface CalorieTrendChartProps {
  days: CalorieTrendDay[];
  targetCalories: number;
  averageCalories: number;
}

export function CalorieTrendChart({
  days,
  targetCalories,
  averageCalories,
}: CalorieTrendChartProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const chartHeight = 120;
  const chartWidth = 320; // Internal coordinate width for SVG viewBox
  const paddingBottom = 20;
  const paddingTop = 16;
  const usableHeight = chartHeight - paddingTop - paddingBottom;

  // Maximum value for scale: max(target * 1.25, highest calorie day, 2500)
  const maxCalorieValue = Math.max(
    targetCalories * 1.25,
    ...days.map((d) => d.totalCalories),
    2000
  );

  const barWidth = 6;
  const totalSlots = days.length; // 28
  const slotWidth = chartWidth / totalSlots;

  // Y-coordinate of target line
  const targetY = paddingTop + usableHeight * (1 - targetCalories / maxCalorieValue);

  const accessibilityLabel = `28-day calorie intake trend. Daily target is ${targetCalories} calories. Your 28-day average is ${averageCalories} calories. ${days.filter((d) => d.hasData).length} days logged.`;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.chartTitle}>28-Day Calorie Trend</Text>
          <Text style={styles.chartSubtitle}>
            Avg: <Text style={styles.boldText}>{averageCalories} kcal</Text> • Target:{' '}
            <Text style={styles.boldText}>{targetCalories} kcal</Text>
          </Text>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.calories }]} />
            <Text style={styles.legendText}>Intake</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: colors.protein }]} />
            <Text style={styles.legendText}>Target</Text>
          </View>
        </View>
      </View>

      <Svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        {/* Target Guideline */}
        <Line
          x1="0"
          y1={targetY}
          x2={chartWidth}
          y2={targetY}
          stroke={colors.protein}
          strokeWidth="1.5"
          strokeDasharray="4, 4"
        />

        {/* Target Value Indicator Text */}
        <SvgText
          x={chartWidth - 4}
          y={targetY - 4}
          fill={colors.protein}
          fontSize="9"
          fontWeight="bold"
          textAnchor="end"
        >
          {targetCalories}
        </SvgText>

        {/* 28 Daily Bars */}
        {days.map((day, idx) => {
          const x = idx * slotWidth + (slotWidth - barWidth) / 2;
          if (!day.hasData || day.totalCalories <= 0) {
            // Unlogged day: tiny dot baseline
            return (
              <Rect
                key={day.date}
                x={x}
                y={chartHeight - paddingBottom - 2}
                width={barWidth}
                height={2}
                rx={1}
                fill={colors.cardBorder}
              />
            );
          }

          const barHeight = Math.min(
            usableHeight,
            Math.max(4, (day.totalCalories / maxCalorieValue) * usableHeight)
          );
          const y = chartHeight - paddingBottom - barHeight;
          const isOverTarget = day.totalCalories > targetCalories + 150;
          const barColor = isOverTarget ? colors.warning : colors.calories;

          return (
            <Rect
              key={day.date}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={2}
              fill={barColor}
            />
          );
        })}

        {/* Axis Labels */}
        <SvgText
          x="2"
          y={chartHeight - 4}
          fill={colors.textMuted}
          fontSize="9"
          fontWeight="600"
        >
          28d ago
        </SvgText>
        <SvgText
          x={chartWidth / 2}
          y={chartHeight - 4}
          fill={colors.textMuted}
          fontSize="9"
          fontWeight="600"
          textAnchor="middle"
        >
          14d ago
        </SvgText>
        <SvgText
          x={chartWidth - 2}
          y={chartHeight - 4}
          fill={colors.textMuted}
          fontSize="9"
          fontWeight="600"
          textAnchor="end"
        >
          Today
        </SvgText>
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
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendLine: {
      width: 12,
      height: 2,
      borderRadius: 1,
    },
    legendText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
    },
  });
}
