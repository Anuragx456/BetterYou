import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';

export const QUICK_MEAL_PROMPTS = [
  '2 Paneer Parathas with Curd',
  '1 Bowl Chicken Biryani & Salad',
  'Masala Dosa with Sambar & Coconut Chutney',
  '3 Boiled Eggs & Whole Wheat Toast',
  'Dal Tadka, 2 Phulkas & Jeera Rice',
  'Whey Protein Shake with Peanut Butter',
  'Oatmeal with Almonds & Banana',
];

export const QUICK_PRODUCT_PROMPTS = [
  'Bajaj Almond Drops Hair Oil',
  'Maggi 2-Minute Masala Noodles',
  'Dettol Original Bath Soap',
  'Good Knight Mosquito Vaporizer',
  'Colgate Strong Teeth Toothpaste',
  'Lizol Citrus Disinfectant Floor Cleaner',
  'Patanjali Dant Kanti Toothpaste',
  'Kurkure Masala Munch',
  "Johnson's Baby Powder",
];

interface VoicePromptSuggestionsProps {
  isMeal: boolean;
  onSelectPrompt: (prompt: string) => void;
}

export function VoicePromptSuggestions({
  isMeal,
  onSelectPrompt,
}: VoicePromptSuggestionsProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const prompts = isMeal ? QUICK_MEAL_PROMPTS : QUICK_PRODUCT_PROMPTS;

  return (
    <View style={styles.suggestionsContainer}>
      <View style={styles.suggestionsHeaderRow}>
        <Text style={styles.suggestionsTitle}>
          {isMeal ? 'Quick Meal Examples' : 'Popular Indian Products'}
        </Text>
        <Text style={styles.suggestionsSubtitle}>Tap to insert</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScrollRow}
      >
        {prompts.map((prompt, idx) => (
          <Pressable
            key={idx}
            style={({ pressed }) => [styles.chipBtn, pressed && styles.pressed]}
            onPress={() => {
              safeHaptics.selection();
              onSelectPrompt(prompt);
            }}
          >
            <Ionicons
              name={isMeal ? 'fast-food-outline' : 'barcode-outline'}
              size={13}
              color={colors.primary}
            />
            <Text style={styles.chipText} numberOfLines={1}>
              {prompt}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    suggestionsContainer: {
      marginTop: 20,
    },
    suggestionsHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    suggestionsTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    suggestionsSubtitle: {
      fontSize: 11,
      color: colors.textMuted,
    },
    chipsScrollRow: {
      gap: 8,
      paddingRight: 20,
    },
    chipBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
