import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/theme';

export interface DataBackupSectionProps {
  workoutCount: number;
  mealCount: number;
  isRestoring: boolean;
  onExportWorkoutsCsv: () => void;
  onExportMealsCsv: () => void;
  onExportJsonBackup: () => void;
  onRestoreBackup: () => void;
  onClearCorrections: () => void;
}

export const DataBackupSection = React.memo(function DataBackupSection({
  workoutCount,
  mealCount,
  isRestoring,
  onExportWorkoutsCsv,
  onExportMealsCsv,
  onExportJsonBackup,
  onRestoreBackup,
  onClearCorrections,
}: DataBackupSectionProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]} allowFontScaling>
        DATA BACKUP & EXPORT
      </Text>
      <View
        style={[
          styles.cardGroup,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
          onPress={onExportWorkoutsCsv}
          accessibilityRole="button"
          accessibilityLabel="Export workouts data to CSV spreadsheet"
        >
          <View style={[styles.iconBadge, { backgroundColor: colors.primaryMuted }]}>
            <Ionicons name="barbell-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.navRowMeta}>
            <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
              Export Workouts (CSV)
            </Text>
            <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
              Excel / Sheets compatible log ({workoutCount} sessions)
            </Text>
          </View>
          <Ionicons name="download-outline" size={18} color={colors.primary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
          onPress={onExportMealsCsv}
          accessibilityRole="button"
          accessibilityLabel="Export meals data to CSV spreadsheet"
        >
          <View style={[styles.iconBadge, { backgroundColor: colors.softOrange }]}>
            <Ionicons name="restaurant-outline" size={18} color={colors.calories} />
          </View>
          <View style={styles.navRowMeta}>
            <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
              Export Meals (CSV)
            </Text>
            <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
              Nutrition & macro history ({mealCount} meals)
            </Text>
          </View>
          <Ionicons name="download-outline" size={18} color={colors.calories} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
          onPress={onExportJsonBackup}
          accessibilityRole="button"
          accessibilityLabel="Export complete JSON database backup"
        >
          <View style={[styles.iconBadge, { backgroundColor: colors.surfaceSubtle }]}>
            <Ionicons name="server-outline" size={18} color={colors.secondary} />
          </View>
          <View style={styles.navRowMeta}>
            <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
              Full Database Backup (JSON)
            </Text>
            <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
              Export workouts, meals, and goals for backup
            </Text>
          </View>
          <Ionicons name="download-outline" size={18} color={colors.secondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.navRow, (pressed || isRestoring) && styles.pressed]}
          onPress={onRestoreBackup}
          disabled={isRestoring}
          accessibilityRole="button"
          accessibilityLabel="Restore meals and workouts from JSON backup file"
        >
          <View style={[styles.iconBadge, { backgroundColor: colors.softGreen }]}>
            <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.navRowMeta}>
            <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
              {isRestoring ? 'Restoring Backup...' : 'Restore from Backup (JSON)'}
            </Text>
            <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
              Import meals, workouts & goals (Merge or Replace)
            </Text>
          </View>
          <Ionicons name="arrow-up-circle-outline" size={18} color={colors.primary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
          onPress={onClearCorrections}
          accessibilityRole="button"
          accessibilityLabel="Clear learned food macro corrections"
        >
          <View style={[styles.iconBadge, { backgroundColor: colors.surfaceSubtle }]}>
            <Ionicons name="trash-outline" size={18} color={colors.warning} />
          </View>
          <View style={styles.navRowMeta}>
            <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
              Clear Learned Corrections
            </Text>
            <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
              Reset custom meal macro adjustments & priors
            </Text>
          </View>
          <Ionicons name="refresh-outline" size={18} color={colors.warning} />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  cardGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRowMeta: {
    flex: 1,
  },
  navRowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  navRowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
