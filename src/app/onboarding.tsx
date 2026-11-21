import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StepActivityGoal } from '../components/onboarding/StepActivityGoal';
import { StepBasics } from '../components/onboarding/StepBasics';
import { StepSummaryCompletion } from '../components/onboarding/StepSummaryCompletion';
import { StepTargetCustomizer } from '../components/onboarding/StepTargetCustomizer';
import { useOnboarding } from '../hooks/useOnboarding';
import type { ThemeColors } from '../theme/colors';
import { useThemeColors, useThemedStyles } from '../theme/theme';
import { safeHaptics } from '../utils/haptics';

const STEP_TITLES = [
  'Physiological Profile',
  'Energy & Goal',
  'Nutrition Targets',
  'Metabolic Blueprint',
];

export default function OnboardingScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  const {
    currentStep,
    setCurrentStep,
    isRecalculating,
    hasCompletedOnboarding,
    sex,
    setSex,
    ageStr,
    setAgeStr,
    heightStr,
    setHeightStr,
    weightStr,
    setWeightStr,
    activityLevel,
    setActivityLevel,
    goalType,
    setGoalType,
    customCalories,
    setCustomCalories,
    customProtein,
    setCustomProtein,
    customCarbs,
    setCustomCarbs,
    customFat,
    setCustomFat,
    setIsTargetsTouched,
    computedTargets,
    handleNextFromStep1,
    handleNextFromStep2,
    handleNextFromStep3,
    handleFinishAndSave,
  } = useOnboarding();

  const canGoBack = currentStep > 0 || isRecalculating || hasCompletedOnboarding;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Navigation & Stage Progress Header */}
        <View style={styles.header}>
          <View style={styles.navRow}>
            {canGoBack ? (
              <Pressable
                onPress={() => {
                  if (currentStep > 0) {
                    safeHaptics.selection();
                    setCurrentStep((prev) => prev - 1);
                  } else {
                    router.back();
                  }
                }}
                style={styles.navBtn}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                testID="onboarding-back-btn"
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Pressable>
            ) : (
              <View style={styles.navBtnPlaceholder} />
            )}

            {/* Stage Pill Indicator */}
            <View style={styles.stagePill}>
              <Text style={styles.stagePillText}>
                STEP {currentStep + 1} OF 4 • {STEP_TITLES[currentStep].toUpperCase()}
              </Text>
            </View>

            {/* Skip or Placeholder */}
            {!isRecalculating && !hasCompletedOnboarding ? (
              <Pressable
                onPress={() => {
                  safeHaptics.impactLight();
                  handleFinishAndSave();
                }}
                style={styles.skipBtn}
                accessibilityRole="button"
                accessibilityLabel="Skip"
                testID="onboarding-skip-btn"
              >
                <Text style={styles.skipBtnText}>Skip</Text>
              </Pressable>
            ) : (
              <View style={styles.navBtnPlaceholder} />
            )}
          </View>

          {/* Segmented Step Progress Bar */}
          <View style={styles.stepTrack}>
            {[0, 1, 2, 3].map((stepIdx) => {
              const isPast = stepIdx < currentStep;
              const isCurrent = stepIdx === currentStep;

              return (
                <View
                  key={stepIdx}
                  style={[
                    styles.stepSegment,
                    isPast && styles.stepSegmentPast,
                    isCurrent && styles.stepSegmentCurrent,
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* Step Body */}
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {currentStep === 0 && (
            <StepBasics
              sex={sex}
              setSex={setSex}
              ageStr={ageStr}
              setAgeStr={setAgeStr}
              heightStr={heightStr}
              setHeightStr={setHeightStr}
              weightStr={weightStr}
              setWeightStr={setWeightStr}
              onNext={handleNextFromStep1}
            />
          )}

          {currentStep === 1 && (
            <StepActivityGoal
              activityLevel={activityLevel}
              setActivityLevel={setActivityLevel}
              goalType={goalType}
              setGoalType={setGoalType}
              onNext={handleNextFromStep2}
            />
          )}

          {currentStep === 2 && (
            <StepTargetCustomizer
              goalType={goalType}
              sex={sex}
              computedTargets={computedTargets}
              customCalories={customCalories}
              setCustomCalories={setCustomCalories}
              customProtein={customProtein}
              setCustomProtein={setCustomProtein}
              customCarbs={customCarbs}
              setCustomCarbs={setCustomCarbs}
              customFat={customFat}
              setCustomFat={setCustomFat}
              setIsTargetsTouched={setIsTargetsTouched}
              onNext={handleNextFromStep3}
            />
          )}

          {currentStep === 3 && (
            <StepSummaryCompletion
              sex={sex}
              ageStr={ageStr}
              heightStr={heightStr}
              weightStr={weightStr}
              activityLevel={activityLevel}
              goalType={goalType}
              customCalories={customCalories}
              customProtein={customProtein}
              customCarbs={customCarbs}
              customFat={customFat}
              isRecalculating={isRecalculating}
              onFinish={handleFinishAndSave}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardAvoid: {
      flex: 1,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      backgroundColor: colors.background,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBtnPlaceholder: {
      width: 36,
      height: 36,
    },
    stagePill: {
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    stagePillText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 0.8,
    },
    skipBtn: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    skipBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    stepTrack: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 2,
    },
    stepSegment: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.cardBorder,
    },
    stepSegmentPast: {
      backgroundColor: colors.primary,
      opacity: 0.6,
    },
    stepSegmentCurrent: {
      backgroundColor: colors.primary,
      opacity: 1,
    },
    scrollContent: {
      flex: 1,
    },
    scrollContainer: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 48,
    },
  });
}
