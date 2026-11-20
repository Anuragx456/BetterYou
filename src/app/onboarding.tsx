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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header with step progress indicator */}
        <View style={styles.header}>
          {isRecalculating || hasCompletedOnboarding || currentStep > 0 ? (
            <Pressable
              onPress={() => {
                if (currentStep > 0) {
                  safeHaptics.selection();
                  setCurrentStep((prev) => prev - 1);
                } else {
                  router.back();
                }
              }}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}

          <View style={styles.stepIndicatorContainer}>
            {[0, 1, 2, 3].map((stepIdx) => (
              <View
                key={stepIdx}
                style={[
                  styles.stepBar,
                  stepIdx <= currentStep ? styles.stepBarActive : styles.stepBarInactive,
                ]}
              />
            ))}
          </View>

          <Text style={styles.stepLabel}>Step {currentStep + 1} of 4</Text>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    stepIndicatorContainer: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 12,
    },
    stepBar: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },
    stepBarActive: {
      backgroundColor: colors.primary,
    },
    stepBarInactive: {
      backgroundColor: colors.cardBorder,
    },
    stepLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    scrollContent: {
      flex: 1,
    },
    scrollContainer: {
      padding: 20,
      paddingBottom: 40,
    },
  });
}
