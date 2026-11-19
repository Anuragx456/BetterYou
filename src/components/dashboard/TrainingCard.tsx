import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { formatDateLabel } from '../../utils/date';

interface TrainingCardProps {
  isViewingToday: boolean;
  selectedDate: string;
  hasActiveWorkout: boolean;
  activeWorkoutTitle: string;
  activeWorkoutExercisesCount: number;
  todayVolumeKg: number;
  todayWorkouts: { length: number };
  todayCaloriesBurned: number;
  onOpenWorkouts: () => void;
}

export const TrainingCard = React.memo(function TrainingCard({
  isViewingToday,
  selectedDate,
  hasActiveWorkout,
  activeWorkoutTitle,
  activeWorkoutExercisesCount,
  todayVolumeKg,
  todayWorkouts,
  todayCaloriesBurned,
  onOpenWorkouts,
}: TrainingCardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleWithIcon}>
          <Ionicons name="barbell-outline" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>
            {isViewingToday ? "Today's Training" : `${formatDateLabel(selectedDate)} Training`}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.cleanLinkBtn, pressed && styles.pressed]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={onOpenWorkouts}
        >
          <Text style={styles.cleanLinkText}>Open</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.primary} />
        </Pressable>
      </View>

      {hasActiveWorkout && isViewingToday ? (
        <View style={styles.activeWorkoutBanner}>
          <View style={styles.activeWorkoutLeft}>
            <View style={styles.pulseDot} />
            <View>
              <Text style={styles.activeWorkoutTitle}>{activeWorkoutTitle}</Text>
              <Text style={styles.activeWorkoutSub}>
                {activeWorkoutExercisesCount} Exercises in progress
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.resumeWorkoutBtn, pressed && styles.pressed]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            onPress={onOpenWorkouts}
          >
            <Text style={styles.resumeWorkoutText}>Resume</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.workoutStatsRow}>
          <View style={styles.workoutStatBlock}>
            <Text style={styles.workoutStatNum}>{todayVolumeKg.toLocaleString()}</Text>
            <Text style={styles.workoutStatDesc}>Volume (kg)</Text>
          </View>
          <View style={styles.workoutStatBlock}>
            <Text style={styles.workoutStatNum}>{todayWorkouts.length}</Text>
            <Text style={styles.workoutStatDesc}>Sessions</Text>
          </View>
          <View style={styles.workoutStatBlock}>
            <Text style={styles.workoutStatNum}>{todayCaloriesBurned}</Text>
            <Text style={styles.workoutStatDesc}>Burn (kcal)</Text>
          </View>
        </View>
      )}

      {!hasActiveWorkout && todayWorkouts.length === 0 && (
        <Pressable
          style={({ pressed }) => [styles.startWorkoutCta, pressed && styles.pressed]}
          onPress={onOpenWorkouts}
        >
          <Ionicons name="add" size={17} color={colors.primary} />
          <Text style={styles.startWorkoutCtaText}>Start Workout</Text>
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
    activeWorkoutBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primaryMuted,
      borderRadius: 14,
      padding: 12,
    },
    activeWorkoutLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    pulseDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    activeWorkoutTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    activeWorkoutSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    resumeWorkoutBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
    },
    resumeWorkoutText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: '700',
    },
    workoutStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 8,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 14,
    },
    workoutStatBlock: {
      alignItems: 'center',
    },
    workoutStatNum: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    workoutStatDesc: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 2,
    },
    startWorkoutCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primaryMuted,
    },
    startWorkoutCtaText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
