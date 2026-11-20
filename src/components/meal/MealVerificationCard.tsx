import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AI_NUTRITION_DISCLAIMER } from '../../constants/disclaimers';
import { useThemeColors } from '../../theme/theme';
import type { MealAnalysisResult } from '../../types';
import {
  matchIndianFoodEstimate,
  type UserMealCorrection,
} from '../../utils/indianFoodMatcher';
import { MealDeviationCard } from './MealDeviationCard';
import { MealMacroPills } from './MealMacroPills';
import { MealPortionStepper } from './MealPortionStepper';

export interface MealVerificationCardProps {
  aiResult: MealAnalysisResult;
  capturedImageUri: string | null;
  portionMultiplier: number;
  userCorrections: UserMealCorrection[];
  originalAiResult: MealAnalysisResult | null;
  dismissDeviation: boolean;
  isSaving: boolean;
  onRetake: () => void;
  onAdjustPortion: (delta: number) => void;
  onSetPortion: (multiplier: number) => void;
  onApplyReference: (unscaled: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    provenance: string;
  }) => void;
  onDismissDeviation: () => void;
  onOpenManualMeal: () => void;
  onSaveMeal: () => void;
}

export const MealVerificationCard = React.memo(function MealVerificationCard({
  aiResult,
  capturedImageUri,
  portionMultiplier,
  userCorrections,
  originalAiResult: _originalAiResult,
  dismissDeviation,
  isSaving,
  onRetake,
  onAdjustPortion,
  onSetPortion,
  onApplyReference,
  onDismissDeviation,
  onOpenManualMeal,
  onSaveMeal,
}: MealVerificationCardProps) {
  const colors = useThemeColors();

  const scaledCalories = Math.round(aiResult.calories * portionMultiplier);
  const scaledProtein = Math.round(aiResult.protein * portionMultiplier);
  const scaledCarbs = Math.round(aiResult.carbs * portionMultiplier);
  const scaledFat = Math.round(aiResult.fat * portionMultiplier);
  const scaledGrams = Math.round(aiResult.estimatedWeightGrams * portionMultiplier);

  const indianFoodMatch = matchIndianFoodEstimate(
    aiResult.dishName,
    scaledGrams,
    scaledCalories,
    scaledProtein,
    scaledCarbs,
    scaledFat,
    userCorrections
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.verifyScroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.verifyHeaderRow}>
          <Pressable
            style={({ pressed }) => [
              styles.retakeButton,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={onRetake}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>

          {aiResult.generatedBy === 'offline-demo-mock' ? (
            <View
              style={[
                styles.confidenceBadge,
                { backgroundColor: colors.softOrange, borderColor: colors.softOrangeBorder },
              ]}
            >
              <Ionicons name="flask-outline" size={14} color={colors.softOrangeText} />
              <Text style={[styles.confidenceText, { color: colors.softOrangeText }]}>
                Offline Demo Simulation
              </Text>
            </View>
          ) : aiResult.isPlausible ? (
            <View
              style={[
                styles.confidenceBadge,
                { backgroundColor: colors.primaryMuted },
              ]}
            >
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              <Text style={[styles.confidenceText, { color: colors.primary }]}>
                Macro Balanced (4P+4C+9F)
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.confidenceBadge,
                { backgroundColor: colors.fatMuted, borderColor: colors.danger },
              ]}
            >
              <Ionicons name="warning-outline" size={14} color={colors.danger} />
              <Text style={[styles.confidenceText, { color: colors.danger }]}>
                Macro Discrepancy
              </Text>
            </View>
          )}
        </View>

        {capturedImageUri ? (
          <View style={[styles.previewImageContainer, { borderColor: colors.cardBorder }]}>
            <Image
              source={{ uri: capturedImageUri }}
              style={styles.previewImage}
              contentFit="cover"
            />
          </View>
        ) : null}

        {/* Dish Header, Weight & Provenance */}
        <View style={styles.dishCardClean}>
          <Text style={[styles.dishNameTextClean, { color: colors.text }]}>
            {aiResult.dishName}
          </Text>
          <Text style={[styles.dishWeightSubClean, { color: colors.textSecondary }]}>
            ~{scaledGrams}g
          </Text>
          <View
            style={[
              styles.provenanceBadge,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
            ]}
          >
            <Ionicons
              name={
                indianFoodMatch.provenance === 'from your past corrections'
                  ? 'repeat'
                  : indianFoodMatch.provenance === 'from local database (IFCT 2017)' ||
                    indianFoodMatch.provenance === 'from local database (estimate)'
                  ? 'book-outline'
                  : 'sparkles-outline'
              }
              size={12}
              color={
                indianFoodMatch.provenance === 'from your past corrections'
                  ? colors.secondary
                  : indianFoodMatch.provenance === 'from local database (IFCT 2017)'
                  ? colors.primary
                  : indianFoodMatch.provenance === 'from local database (estimate)'
                  ? colors.primaryLight
                  : colors.textSecondary
              }
            />
            <Text style={[styles.provenanceText, { color: colors.textSecondary }]}>
              {indianFoodMatch.provenance}
            </Text>
          </View>
        </View>

        {/* Deviation Alert Card (>35%) */}
        {indianFoodMatch.isSignificantDeviation && !dismissDeviation && (
          <MealDeviationCard
            deviationMessage={indianFoodMatch.deviationMessage}
            referenceCalories={indianFoodMatch.referenceCalories}
            referenceProtein={indianFoodMatch.referenceProtein}
            referenceCarbs={indianFoodMatch.referenceCarbs}
            referenceFat={indianFoodMatch.referenceFat}
            provenance={indianFoodMatch.provenance}
            portionMultiplier={portionMultiplier}
            onApplyReference={onApplyReference}
            onDismissDeviation={onDismissDeviation}
          />
        )}

        {/* Plausibility Warning Banner */}
        {!aiResult.isPlausible && aiResult.plausibilityWarning ? (
          <View
            style={{
              backgroundColor: colors.fatMuted,
              padding: 12,
              borderRadius: 14,
              marginHorizontal: 20,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <Text style={{ color: colors.danger, fontSize: 12, lineHeight: 16 }}>
              ⚠️ {aiResult.plausibilityWarning}
            </Text>
          </View>
        ) : null}

        {/* Fallback to Manual Entry Prompt */}
        {aiResult.fallbackToManual ? (
          <View
            style={{
              backgroundColor: colors.softOrange,
              padding: 12,
              borderRadius: 14,
              marginHorizontal: 20,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.softOrangeBorder,
            }}
          >
            <Text style={{ color: colors.softOrangeText, fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
              Uncertain Vision Estimate
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginBottom: 8 }}>
              Visual recognition could not confirm high-confidence macros. You can adjust the numbers below or switch to manual entry.
            </Text>
            <Pressable
              style={{
                alignSelf: 'flex-start',
                paddingVertical: 8,
                paddingHorizontal: 14,
                backgroundColor: colors.card,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
              onPress={onOpenManualMeal}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
                Enter Details Manually
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Calorie Hero Metric and 3 Macro Pills */}
        <MealMacroPills
          scaledCalories={scaledCalories}
          scaledProtein={scaledProtein}
          scaledCarbs={scaledCarbs}
          scaledFat={scaledFat}
        />

        {/* Portion Stepper */}
        <MealPortionStepper
          portionMultiplier={portionMultiplier}
          onAdjustPortion={onAdjustPortion}
          onSetPortion={onSetPortion}
        />

        {/* Detected Ingredients Section */}
        {aiResult.ingredientsDetected && aiResult.ingredientsDetected.length > 0 ? (
          <View
            style={[
              styles.ingredientsCleanCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <Text style={[styles.ingredientsCleanHeader, { color: colors.textSecondary }]}>
              Detected Ingredients
            </Text>
            <View style={styles.ingredientsCleanWrap}>
              {aiResult.ingredientsDetected.map((ing, i) => (
                <View
                  key={i}
                  style={[
                    styles.ingredientCleanChip,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
                  ]}
                >
                  <Text style={[styles.ingredientCleanChipText, { color: colors.textSecondary }]}>
                    {ing}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Save Action Button */}
        <Pressable
          testID="meal-save-btn"
          style={({ pressed }) => [
            styles.saveButtonClean,
            { backgroundColor: colors.primary },
            isSaving && styles.saveButtonDisabled,
            pressed && styles.pressed,
          ]}
          onPress={onSaveMeal}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={[styles.saveButtonTextClean, { color: colors.textInverse }]}>
              Log to Today
            </Text>
          )}
        </Pressable>

        <Text style={[styles.disclaimerTextClean, { color: colors.textMuted }]}>
          {AI_NUTRITION_DISCLAIMER}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  verifyScroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  verifyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  retakeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  previewImageContainer: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  dishCardClean: {
    alignItems: 'center',
    marginBottom: 12,
  },
  dishNameTextClean: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  dishWeightSubClean: {
    fontSize: 13,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  provenanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  provenanceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ingredientsCleanCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  ingredientsCleanHeader: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  ingredientsCleanWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ingredientCleanChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  ingredientCleanChipText: {
    fontSize: 11,
  },
  saveButtonClean: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    height: 52,
    marginTop: 4,
    marginBottom: 16,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonTextClean: {
    fontSize: 15,
    fontWeight: '700',
  },
  disclaimerTextClean: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 14,
    paddingHorizontal: 8,
  },
  pressed: {
    opacity: 0.8,
  },
});
