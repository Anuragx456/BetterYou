import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import type { HarmfulAdditive } from '../../types';
import { HarmfulIngredientItem } from './HarmfulIngredientItem';

interface IngredientBreakdownSectionProps {
  allIngredients?: string[];
  harmfulIngredients: HarmfulAdditive[];
  onOpenEdit: () => void;
}

export const IngredientBreakdownSection = React.memo(function IngredientBreakdownSection({
  allIngredients,
  harmfulIngredients,
  onOpenEdit,
}: IngredientBreakdownSectionProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.ingredientsSectionClean}>
      <View style={styles.ingredientsHeaderRowClean}>
        <Text style={styles.ingredientsTitleClean}>
          Ingredients Breakdown {allIngredients ? `(${allIngredients.length})` : ''}
        </Text>
        <Pressable
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onOpenEdit}
        >
          <Text style={styles.editLinkTextClean}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.ingredientsListClean}>
        {/* Flagged Harmful Additives first */}
        {harmfulIngredients.map((item, idx) => (
          <HarmfulIngredientItem key={`harmful-${idx}`} item={item} />
        ))}

        {/* Clean / Unflagged Ingredients */}
        {allIngredients
          ? allIngredients.map((ing, idx) => {
              const isFlagged = harmfulIngredients.some(
                (h) =>
                  h.name.toLowerCase().includes(ing.toLowerCase()) ||
                  ing.toLowerCase().includes(h.name.toLowerCase())
              );
              if (isFlagged) return null;

              return (
                <View key={`clean-${idx}`} style={styles.ingredientRowClean}>
                  <View style={styles.ingredientRowLeft}>
                    <View
                      style={[
                        styles.statusDotClean,
                        { backgroundColor: colors.safetyClean },
                      ]}
                    />
                    <Text style={styles.ingredientNameClean}>{ing}</Text>
                  </View>
                </View>
              );
            })
          : null}
      </View>
    </View>
  );
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    ingredientsSectionClean: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
      marginBottom: 16,
    },
    ingredientsHeaderRowClean: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    ingredientsTitleClean: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    editLinkTextClean: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    ingredientsListClean: {
      gap: 12,
    },
    ingredientRowClean: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.hairline,
    },
    ingredientRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    statusDotClean: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    ingredientNameClean: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
  });
}
