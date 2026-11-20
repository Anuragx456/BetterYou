import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';
import type { RestSession } from '../../hooks/useRestTimer';
import { DiaryTimerReadout } from './DiaryTimerReadout';

export interface RoutineTemplatesProps {
  workoutCount: number;
  workoutTab: 'practise' | 'timer' | 'checkin';
  restSession: RestSession | null;
  onSetWorkoutTab: (tab: 'practise' | 'timer' | 'checkin') => void;
  onStartCustomWorkout: () => void;
  onStartTemplate: (templateName: string) => void;
  onExportWorkouts: () => void;
  onToggleRestTimer: () => void;
}

export const RoutineTemplates = React.memo(function RoutineTemplates({
  workoutCount,
  workoutTab,
  restSession,
  onSetWorkoutTab,
  onStartCustomWorkout,
  onStartTemplate,
  onExportWorkouts,
  onToggleRestTimer,
}: RoutineTemplatesProps) {
  const colors = useThemeColors();

  return (
    <View>
      {/* Header - Matching Reference Screen 4 */}
      <View style={styles.inactiveHeaderRow}>
        <View>
          <Text style={[styles.inactiveHeaderTitle, { color: colors.text }]} allowFontScaling>
            Workout Diary
          </Text>
          <Text style={[styles.inactiveHeaderSubtitle, { color: colors.textMuted }]} allowFontScaling>
            TRAINING & PROGRESSION
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Pressable
            style={({ pressed }) => [
              styles.exportBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={onExportWorkouts}
            accessibilityRole="button"
            accessibilityLabel="Export workouts data to CSV or JSON"
          >
            <Ionicons name="create-outline" size={17} color={colors.text} />
          </Pressable>

          <Pressable
            testID="workout-start-btn"
            style={({ pressed }) => [
              styles.startEmptyBtn,
              {
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
              },
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => {
              safeHaptics.impactLight();
              onStartCustomWorkout();
            }}
            accessibilityRole="button"
            accessibilityLabel="Start an empty custom workout"
          >
            <Ionicons name="add" size={16} color={colors.textInverse} />
            <Text style={[styles.startEmptyBtnText, { color: colors.textInverse }]} allowFontScaling>
              Start
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Segmented Pill Tabs: Practise, Timer, Check in */}
      <View
        style={[
          styles.segmentedTabsRow,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          },
        ]}
      >
        <Pressable
          style={[
            styles.segmentedTab,
            workoutTab === 'practise' && [
              styles.segmentedTabActive,
              { backgroundColor: colors.primary, shadowColor: colors.primary },
            ],
          ]}
          onPress={() => {
            safeHaptics.selection();
            onSetWorkoutTab('practise');
          }}
        >
          <Text
            style={[
              styles.segmentedTabText,
              { color: colors.textSecondary },
              workoutTab === 'practise' && { color: colors.textInverse, fontWeight: '700' },
            ]}
          >
            Practise
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.segmentedTab,
            workoutTab === 'timer' && [
              styles.segmentedTabActive,
              { backgroundColor: colors.primary, shadowColor: colors.primary },
            ],
          ]}
          onPress={() => {
            safeHaptics.selection();
            onSetWorkoutTab('timer');
          }}
        >
          <Text
            style={[
              styles.segmentedTabText,
              { color: colors.textSecondary },
              workoutTab === 'timer' && { color: colors.textInverse, fontWeight: '700' },
            ]}
          >
            Timer
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.segmentedTab,
            workoutTab === 'checkin' && [
              styles.segmentedTabActive,
              { backgroundColor: colors.primary, shadowColor: colors.primary },
            ],
          ]}
          onPress={() => {
            safeHaptics.selection();
            onSetWorkoutTab('checkin');
          }}
        >
          <Text
            style={[
              styles.segmentedTabText,
              { color: colors.textSecondary },
              workoutTab === 'checkin' && { color: colors.textInverse, fontWeight: '700' },
            ]}
          >
            Check in
          </Text>
        </Pressable>
      </View>

      {/* Interval Timer Widget Card */}
      <View
        style={[
          styles.intervalTimerCard,
          {
            backgroundColor: colors.cardElevated,
            borderColor: colors.cardBorder,
            shadowColor: colors.black,
          },
        ]}
      >
        <View style={styles.timerCardLeft}>
          <View
            style={[
              styles.timerIconBadge,
              { backgroundColor: colors.surfaceSubtle },
            ]}
          >
            <Ionicons name="stopwatch" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.timerTitleCol}>
            <Text style={[styles.timerTitle, { color: colors.text }]}>Timer</Text>
            <Text style={[styles.timerSubtitle, { color: colors.textSecondary }]}>
              Manage your exercise with Interval Timer
            </Text>
            <DiaryTimerReadout endsAt={restSession?.endsAt ?? null} />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.timerPlayButton,
            {
              borderColor: colors.primary,
              backgroundColor: colors.primaryMuted,
              shadowColor: colors.primary,
            },
            pressed && styles.pressed,
          ]}
          onPress={() => {
            safeHaptics.impactMedium();
            onToggleRestTimer();
          }}
          accessibilityRole="button"
          accessibilityLabel={restSession ? 'Pause timer' : 'Start interval timer'}
        >
          <Ionicons
            name={restSession ? 'pause' : 'play'}
            size={18}
            color="#FFFFFF"
          />
        </Pressable>
      </View>

      {/* 3 Built-In Workout Templates */}
      <View style={styles.templatesSection}>
        <Text
          style={[styles.sectionHeaderTitle, { color: colors.text }]}
          allowFontScaling
        >
          Routine Templates
        </Text>

        <View style={styles.templatesGrid}>
          {/* Push Day */}
          <Pressable
            style={({ pressed }) => [
              styles.templateCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
              pressed && styles.pressed,
            ]}
            onPress={() => {
              safeHaptics.impactLight();
              onStartTemplate('Push Day');
            }}
            accessibilityRole="button"
            accessibilityLabel="Start Push Day routine template"
          >
            <View
              style={[
                styles.templateIconBox,
                { backgroundColor: colors.fatMuted },
              ]}
            >
              <Ionicons name="flame-outline" size={20} color={colors.fat} />
            </View>
            <View style={styles.templateCardInfo}>
              <Text
                style={[styles.templateCardTitle, { color: colors.text }]}
              >
                Push Day
              </Text>
              <Text
                style={[
                  styles.templateCardSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                Chest • Shoulders • Triceps
              </Text>
              <Text
                style={[
                  styles.templateCardExercises,
                  { color: colors.textMuted },
                ]}
              >
                Bench Press, Incline DB, Overhead Tri
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          {/* Pull Day */}
          <Pressable
            style={({ pressed }) => [
              styles.templateCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
              pressed && styles.pressed,
            ]}
            onPress={() => {
              safeHaptics.impactLight();
              onStartTemplate('Pull Day');
            }}
            accessibilityRole="button"
            accessibilityLabel="Start Pull Day routine template"
          >
            <View
              style={[
                styles.templateIconBox,
                { backgroundColor: colors.softBlue },
              ]}
            >
              <Ionicons name="barbell-outline" size={20} color={colors.secondary} />
            </View>
            <View style={styles.templateCardInfo}>
              <Text
                style={[styles.templateCardTitle, { color: colors.text }]}
              >
                Pull Day
              </Text>
              <Text
                style={[
                  styles.templateCardSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                Back • Biceps • Traps
              </Text>
              <Text
                style={[
                  styles.templateCardExercises,
                  { color: colors.textMuted },
                ]}
              >
                Deadlift, Lat Pulldown, DB Bicep Curls
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          {/* Leg Day */}
          <Pressable
            style={({ pressed }) => [
              styles.templateCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
              pressed && styles.pressed,
            ]}
            onPress={() => {
              safeHaptics.impactLight();
              onStartTemplate('Leg Day');
            }}
            accessibilityRole="button"
            accessibilityLabel="Start Leg Day routine template"
          >
            <View
              style={[
                styles.templateIconBox,
                { backgroundColor: colors.softGreen },
              ]}
            >
              <Ionicons name="fitness-outline" size={20} color={colors.carbs} />
            </View>
            <View style={styles.templateCardInfo}>
              <Text
                style={[styles.templateCardTitle, { color: colors.text }]}
              >
                Leg Day
              </Text>
              <Text
                style={[
                  styles.templateCardSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                Quads • Hamstrings • Calves
              </Text>
              <Text
                style={[
                  styles.templateCardExercises,
                  { color: colors.textMuted },
                ]}
              >
                Back Squat, Leg Press, Calf Raises
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Workout History Section Title */}
      <View style={styles.historySection}>
        <Text
          style={[styles.sectionHeaderTitle, { color: colors.text }]}
          allowFontScaling
        >
          History ({workoutCount})
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  inactiveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inactiveHeaderSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  inactiveHeaderTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  exportBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  startEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 38,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  startEmptyBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  segmentedTabsRow: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    gap: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedTabActive: {
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentedTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  intervalTimerCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  timerCardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  timerIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timerTitleCol: {
    flex: 1,
  },
  timerTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  timerSubtitle: {
    fontSize: 11,
    marginBottom: 8,
  },
  timerDurationBig: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  timerPlayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  templatesSection: {
    marginBottom: 24,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  templatesGrid: {
    gap: 10,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 12,
    minHeight: 52,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  templateIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateCardInfo: {
    flex: 1,
  },
  templateCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  templateCardSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  templateCardExercises: {
    fontSize: 11,
    marginTop: 2,
  },
  historySection: {
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
