import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { MealLog } from '../../types';
import { formatDateLabel } from '../../utils/date';
import { getFullImageUri } from '../../utils/imageManager';

interface MealListItemProps {
  meal: MealLog;
  isLast: boolean;
  onDelete: (meal: MealLog) => void;
  thumbsReady: boolean;
}

export const MealListItem = React.memo(function MealListItem({
  meal,
  isLast,
  onDelete,
  thumbsReady,
}: MealListItemProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [imageError, setImageError] = React.useState(false);
  const source = meal.thumbnailUri || '';
  const resolvedUri = !source
    ? null
    : source.startsWith('file://') || source.startsWith('http://') || source.startsWith('https://')
      ? source
      : thumbsReady
        ? getFullImageUri(source)
        : null;

  return (
    <View style={[styles.mealCleanItem, !isLast && styles.mealCleanItemBorder]}>
      <View style={styles.mealCleanLeft}>
        {resolvedUri && !imageError ? (
          <Image
            source={{ uri: resolvedUri }}
            style={styles.mealCleanThumb}
            contentFit="cover"
            recyclingKey={meal.id}
            onError={() => setImageError(true)}
          />
        ) : null}
        <View style={styles.mealCleanDetails}>
          <View style={styles.mealCleanNameRow}>
            <Text style={styles.mealCleanName} numberOfLines={1}>
              {meal.dishName}
            </Text>
          </View>
          <Text style={styles.mealCleanMacros}>
            <Text style={styles.mealCleanKcal}>{meal.calories} kcal</Text>
            {'  ·  '}
            <Text style={{ color: colors.protein }}>{meal.protein}g P</Text>
            {'  '}
            <Text style={{ color: colors.carbs }}>{meal.carbs}g C</Text>
            {'  '}
            <Text style={{ color: colors.fat }}>{meal.fat}g F</Text>
            {meal.portionMultiplier !== 1 ? (
              <Text style={styles.mealCleanPortion}>  ·  {meal.portionMultiplier}x</Text>
            ) : null}
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.mealDeleteBtn, pressed && styles.pressed]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={() => onDelete(meal)}
      >
        <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
      </Pressable>
    </View>
  );
});

interface MealFeedProps {
  todayMeals: MealLog[];
  isViewingToday: boolean;
  selectedDate: string;
  onDelete: (meal: MealLog) => void;
  onAddMeal: () => void;
  thumbsReady: boolean;
}

export const MealFeed = React.memo(function MealFeed({
  todayMeals,
  isViewingToday,
  selectedDate,
  onDelete,
  onAddMeal,
  thumbsReady,
}: MealFeedProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleWithIcon}>
          <Ionicons name="restaurant-outline" size={18} color={colors.calories} />
          <Text style={styles.cardTitle}>
            {isViewingToday ? "Today's Meals" : `${formatDateLabel(selectedDate)} Meals`}{' '}
            {todayMeals.length > 0 ? `(${todayMeals.length})` : ''}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.cleanLinkBtn, pressed && styles.pressed]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={onAddMeal}
        >
          <Ionicons name="add" size={15} color={colors.primary} />
          <Text style={styles.cleanLinkText}>Add</Text>
        </Pressable>
      </View>

      {todayMeals.length === 0 ? (
        <View style={styles.emptyCardClean}>
          <Text style={styles.emptyTitle}>
            {isViewingToday
              ? 'No meals logged yet today'
              : `No meals logged on ${formatDateLabel(selectedDate)}`}
          </Text>
          <Text style={styles.emptySubtitle}>
            Snap a meal photo or select from gallery for automatic calorie & macro vision.
          </Text>
        </View>
      ) : (
        <View style={styles.mealsCleanList}>
          {todayMeals.map((meal, idx) => (
            <MealListItem
              key={meal.id}
              meal={meal}
              isLast={idx === todayMeals.length - 1}
              onDelete={onDelete}
              thumbsReady={thumbsReady}
            />
          ))}
        </View>
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
    emptyCardClean: {
      paddingVertical: 20,
      alignItems: 'center',
      gap: 6,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    emptySubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 260,
      lineHeight: 16,
    },
    mealsCleanList: {
      gap: 0,
    },
    mealCleanItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    mealCleanItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    mealCleanLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    mealCleanThumb: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: colors.surfaceSubtle,
    },
    mealCleanDetails: {
      flex: 1,
      gap: 2,
    },
    mealCleanNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    mealCleanName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    mealCleanMacros: {
      fontSize: 12,
      color: colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
    mealCleanKcal: {
      fontWeight: '700',
      color: colors.text,
    },
    mealCleanPortion: {
      fontSize: 11,
      color: colors.textMuted,
    },
    mealDeleteBtn: {
      padding: 6,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
