import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WorkoutSession } from '../../types';
import { useThemeColors } from '../../theme/theme';

export interface WorkoutHistoryCardProps {
  session: WorkoutSession;
  onDelete: (workout: WorkoutSession) => void;
  onEdit: (workout: WorkoutSession) => void;
}

const workoutDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const WorkoutHistoryCard = React.memo(function WorkoutHistoryCard({
  session,
  onDelete,
  onEdit,
}: WorkoutHistoryCardProps) {
  const colors = useThemeColors();
  const dateStr = workoutDateFormatter.format(
    new Date(session.completedAt || session.startedAt)
  );
  const durationMin = Math.round(session.durationSeconds / 60);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.historyCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
        },
        pressed && styles.pressed,
      ]}
      onPress={() => onEdit(session)}
      accessibilityRole="button"
      accessibilityLabel={`Workout: ${session.title}, ${dateStr}`}
    >
      <View style={styles.historyTopRow}>
        <View>
          <Text
            style={[styles.historySessionTitle, { color: colors.text }]}
            allowFontScaling
          >
            {session.title}
          </Text>
          <Text
            style={[styles.historyDateText, { color: colors.textMuted }]}
            allowFontScaling
          >
            {dateStr}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => onEdit(session)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${session.title}`}
          >
            <Ionicons name="pencil-outline" size={15} color={colors.primary} />
          </Pressable>
          <Pressable
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => onDelete(session)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${session.title}`}
          >
            <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.historyMetricsRow,
          {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.hairline,
          },
        ]}
      >
        <View style={styles.historyMetric}>
          <Text
            style={[styles.historyMetricVal, { color: colors.text }]}
            allowFontScaling
          >
            {session.totalVolumeKg.toLocaleString()} kg
          </Text>
          <Text style={[styles.historyMetricLabel, { color: colors.textMuted }]}>
            Volume
          </Text>
        </View>

        <View
          style={[styles.historyMetricDivider, { backgroundColor: colors.hairline }]}
        />

        <View style={styles.historyMetric}>
          <Text
            style={[styles.historyMetricVal, { color: colors.text }]}
            allowFontScaling
          >
            {durationMin > 0 ? `${durationMin}m` : '<1m'}
          </Text>
          <Text style={[styles.historyMetricLabel, { color: colors.textMuted }]}>
            Duration
          </Text>
        </View>

        <View
          style={[styles.historyMetricDivider, { backgroundColor: colors.hairline }]}
        />

        <View style={styles.historyMetric}>
          <Text
            style={[styles.historyMetricVal, { color: colors.text }]}
            allowFontScaling
          >
            {session.exercises.length}
          </Text>
          <Text style={[styles.historyMetricLabel, { color: colors.textMuted }]}>
            Exercises
          </Text>
        </View>
      </View>

      {/* Exercises bullet preview */}
      <View style={styles.historyExercisesWrap}>
        {session.exercises.map((ex, i) => (
          <View
            key={ex.id || i}
            style={[
              styles.historyExercisePill,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.hairline,
              },
            ]}
          >
            <Text
              style={[
                styles.historyExercisePillText,
                { color: colors.textSecondary },
              ]}
              allowFontScaling
            >
              {ex.name} • {ex.sets.filter((s) => s.completed).length} sets
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  historyCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  historySessionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  historyDateText: {
    fontSize: 11,
    marginTop: 1,
  },
  historyMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  historyMetric: {
    alignItems: 'center',
    flex: 1,
  },
  historyMetricVal: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  historyMetricLabel: {
    fontSize: 9,
    marginTop: 1,
    fontWeight: '500',
  },
  historyMetricDivider: {
    width: 1,
    height: 16,
  },
  historyExercisesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  historyExercisePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  historyExercisePillText: {
    fontSize: 10,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
