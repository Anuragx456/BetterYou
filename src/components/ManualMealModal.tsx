import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyzeMealText } from '../services/aiVisionService';
import { colors } from '../theme/colors';
import { MealAnalysisResult } from '../types';

interface ManualMealModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitResult: (result: MealAnalysisResult) => void;
}

const QUICK_MEAL_PROMPTS = [
  '2 Scrambled Eggs & Whole Wheat Toast',
  'Grilled Chicken with Brown Rice & Broccoli',
  'Rolled Oats with Banana, Almonds & Honey',
  'Whey Protein Shake with Peanut Butter',
  'Paneer Tikka with Mixed Green Salad',
];

export function ManualMealModal({ visible, onClose, onSubmitResult }: ManualMealModalProps) {
  const [tabMode, setTabMode] = useState<'ai' | 'direct'>('ai');

  // AI Description state
  const [description, setDescription] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Direct Macros state
  const [dishName, setDishName] = useState<string>('');
  const [calories, setCalories] = useState<string>('');
  const [protein, setProtein] = useState<string>('');
  const [carbs, setCarbs] = useState<string>('');
  const [fat, setFat] = useState<string>('');
  const [weightGrams, setWeightGrams] = useState<string>('250');

  const handleAiEstimate = async () => {
    const text = description.trim();
    if (!text) {
      Alert.alert('Meal Description Needed', 'Please type what you ate (e.g., 2 eggs and toast).');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeMealText(text);
      onSubmitResult(result);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('AI Estimation Error', msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDirectSubmit = () => {
    const name = dishName.trim() || 'Custom Meal';
    const cals = parseInt(calories, 10);
    if (isNaN(cals) || cals < 0) {
      Alert.alert('Calories Required', 'Please enter a valid calorie amount.');
      return;
    }

    const result: MealAnalysisResult = {
      dishName: name,
      calories: cals,
      protein: Math.max(0, parseInt(protein, 10) || 0),
      carbs: Math.max(0, parseInt(carbs, 10) || 0),
      fat: Math.max(0, parseInt(fat, 10) || 0),
      estimatedWeightGrams: Math.max(10, parseInt(weightGrams, 10) || 250),
      confidenceScore: 1.0,
      ingredientsDetected: [name],
    };

    onSubmitResult(result);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onClose}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>

            <View style={styles.headerTitleCol}>
              <Text style={styles.headerTitle}>Type Meal</Text>
              <Text style={styles.headerSub}>AI Nutrition Estimation or Direct Entry</Text>
            </View>

            <View style={{ width: 40 }} />
          </View>

          {/* Segmented Mode Switcher */}
          <View style={styles.segmentContainer}>
            <Pressable
              style={[styles.segmentBtn, tabMode === 'ai' && styles.segmentBtnActive]}
              onPress={() => setTabMode('ai')}
            >
              <Ionicons
                name="sparkles"
                size={14}
                color={tabMode === 'ai' ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.segmentText, tabMode === 'ai' && styles.segmentTextActive]}>
                Describe (AI)
              </Text>
            </Pressable>

            <Pressable
              style={[styles.segmentBtn, tabMode === 'direct' && styles.segmentBtnActive]}
              onPress={() => setTabMode('direct')}
            >
              <Ionicons
                name="create-outline"
                size={14}
                color={tabMode === 'direct' ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.segmentText, tabMode === 'direct' && styles.segmentTextActive]}>
                Direct Macros
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {tabMode === 'ai' ? (
              /* AI Description Mode */
              <View style={styles.cardGroup}>
                <Text style={styles.inputLabel}>WHAT DID YOU EAT?</Text>
                <TextInput
                  style={styles.textArea}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. 2 parathas with curd and pickle, or 200g grilled salmon with steamed broccoli and quinoa..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  selectionColor={colors.primary}
                />

                {/* Quick Prompts */}
                <Text style={styles.quickLabel}>QUICK SUGGESTIONS</Text>
                <View style={styles.chipsWrap}>
                  {QUICK_MEAL_PROMPTS.map((prompt, i) => (
                    <Pressable
                      key={i}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                      onPress={() => setDescription(prompt)}
                    >
                      <Text style={styles.chipText}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Action Button */}
                <Pressable
                  style={[styles.actionBtn, isAnalyzing && styles.btnDisabled]}
                  onPress={handleAiEstimate}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <View style={styles.actionBtnInner}>
                      <ActivityIndicator size="small" color={colors.textInverse} />
                      <Text style={styles.actionBtnText}>Estimating Nutrition with AI...</Text>
                    </View>
                  ) : (
                    <View style={styles.actionBtnInner}>
                      <Ionicons name="sparkles" size={16} color={colors.textInverse} />
                      <Text style={styles.actionBtnText}>Estimate with Gemini AI</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            ) : (
              /* Direct Macro Input Mode */
              <View style={styles.cardGroup}>
                <View style={styles.fieldSection}>
                  <Text style={styles.inputLabel}>MEAL OR DISH NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    value={dishName}
                    onChangeText={setDishName}
                    placeholder="e.g. Protein Oatmeal"
                    placeholderTextColor={colors.textMuted}
                    selectionColor={colors.primary}
                  />
                </View>

                {/* Row: Calories & Weight */}
                <View style={styles.fieldsRow}>
                  <View style={styles.fieldCol}>
                    <Text style={styles.inputLabel}>CALORIES (KCAL)</Text>
                    <TextInput
                      style={[styles.textInput, styles.monoInput]}
                      value={calories}
                      onChangeText={setCalories}
                      placeholder="450"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      selectionColor={colors.calories}
                    />
                  </View>

                  <View style={styles.fieldCol}>
                    <Text style={styles.inputLabel}>WEIGHT (GRAMS)</Text>
                    <TextInput
                      style={[styles.textInput, styles.monoInput]}
                      value={weightGrams}
                      onChangeText={setWeightGrams}
                      placeholder="250"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      selectionColor={colors.primary}
                    />
                  </View>
                </View>

                {/* Row: Macros (Protein, Carbs, Fat) */}
                <View style={styles.macrosRow}>
                  <View style={styles.macroCol}>
                    <Text style={[styles.inputLabel, { color: colors.protein }]}>PROTEIN (G)</Text>
                    <TextInput
                      style={[styles.textInput, styles.monoInput]}
                      value={protein}
                      onChangeText={setProtein}
                      placeholder="30"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      selectionColor={colors.protein}
                    />
                  </View>

                  <View style={styles.macroCol}>
                    <Text style={[styles.inputLabel, { color: colors.carbs }]}>CARBS (G)</Text>
                    <TextInput
                      style={[styles.textInput, styles.monoInput]}
                      value={carbs}
                      onChangeText={setCarbs}
                      placeholder="45"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      selectionColor={colors.carbs}
                    />
                  </View>

                  <View style={styles.macroCol}>
                    <Text style={[styles.inputLabel, { color: colors.fat }]}>FAT (G)</Text>
                    <TextInput
                      style={[styles.textInput, styles.monoInput]}
                      value={fat}
                      onChangeText={setFat}
                      placeholder="12"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      selectionColor={colors.fat}
                    />
                  </View>
                </View>

                {/* Action Button */}
                <Pressable style={styles.actionBtn} onPress={handleDirectSubmit}>
                  <View style={styles.actionBtnInner}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.textInverse} />
                    <Text style={styles.actionBtnText}>Save & Preview Meal</Text>
                  </View>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  headerTitleCol: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: colors.cardHover,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  cardGroup: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    gap: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
    marginBottom: 6,
  },
  textArea: {
    backgroundColor: colors.cardHover,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.text,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 100,
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.cardHover,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  fieldSection: {
    width: '100%',
  },
  textInput: {
    backgroundColor: colors.cardHover,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  monoInput: {
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  fieldsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldCol: {
    flex: 1,
  },
  macrosRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroCol: {
    flex: 1,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  actionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textInverse,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
