import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AiIntelligenceSection } from '../../components/settings/AiIntelligenceSection';
import { AppearanceSection } from '../../components/settings/AppearanceSection';
import { DataBackupSection } from '../../components/settings/DataBackupSection';
import { NutritionGoalsSection } from '../../components/settings/NutritionGoalsSection';
import { RemindersSection } from '../../components/settings/RemindersSection';
import { SystemHealthSection } from '../../components/settings/SystemHealthSection';
import {
  dbClearCorrections,
  dbGetAllMeals,
  dbGetAllScannedProducts,
  dbGetAllWorkouts,
} from '../../db/client';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import {
  BackupPayload,
  generateJsonBackup,
  generateMealsCsv,
  generateWorkoutsCsv,
  importBackup,
  parseAndValidateBackup,
  shareOrCopyData,
} from '../../services/backupService';
import {
  cancelDailyMealReminder,
  cancelSundayWeeklyReview,
  scheduleDailyMealReminder,
  scheduleSundayWeeklyReview,
} from '../../services/notificationService';
import { getAppLanguage, setAppLanguage, SupportedLanguage } from '../../i18n';
import { useFitnessStore } from '../../store/useFitnessStore';
import {
  getActiveModelDisplayName,
  useSettingsStore,
} from '../../store/useSettingsStore';
import { safeHaptics } from '../../utils/haptics';
import { useGeminiUsageStore } from '../../store/useGeminiUsageStore';
import type { ThemeColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/theme';

export default function SettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  // Store hooks
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const dailyGoals = useFitnessStore((state) => state.dailyGoals);
  const workoutCount = useFitnessStore((state) => state.workoutCount);
  const mealCount = useFitnessStore((state) => state.mealCount);

  const customApiKey = useSettingsStore((state) => state.customApiKey);
  const colorScheme = useSettingsStore((state) => state.colorScheme);
  const setColorScheme = useSettingsStore((state) => state.setColorScheme);
  const selectedModel = useSettingsStore((state) => state.selectedModel);
  const setSelectedModel = useSettingsStore((state) => state.setSelectedModel);
  const isCustomModel = useSettingsStore((state) => state.isCustomModel);
  const customModelName = useSettingsStore((state) => state.customModelName);
  const totalCalls = useGeminiUsageStore((state) => state.totalCalls);

  // Reminders state
  const dailyReminderEnabled = useSettingsStore((state) => state.dailyReminderEnabled);
  const dailyReminderTime = useSettingsStore((state) => state.dailyReminderTime);
  const weeklyReviewEnabled = useSettingsStore((state) => state.weeklyReviewEnabled);
  const weeklyReviewTime = useSettingsStore((state) => state.weeklyReviewTime);

  const setDailyReminderEnabled = useSettingsStore((state) => state.setDailyReminderEnabled);
  const setDailyReminderTime = useSettingsStore((state) => state.setDailyReminderTime);
  const setWeeklyReviewEnabled = useSettingsStore((state) => state.setWeeklyReviewEnabled);
  const setWeeklyReviewTime = useSettingsStore((state) => state.setWeeklyReviewTime);

  const handleToggleDailyReminder = async (val: boolean) => {
    safeHaptics.selection();
    if (val) {
      const ok = await scheduleDailyMealReminder(dailyReminderTime);
      if (ok) {
        setDailyReminderEnabled(true);
      } else {
        Alert.alert(
          'Notifications Required',
          'Please enable notifications in system settings to receive your daily meal log reminder.'
        );
        setDailyReminderEnabled(false);
      }
    } else {
      await cancelDailyMealReminder();
      setDailyReminderEnabled(false);
    }
  };

  const handleToggleWeeklyReview = async (val: boolean) => {
    safeHaptics.selection();
    if (val) {
      const ok = await scheduleSundayWeeklyReview(weeklyReviewTime);
      if (ok) {
        setWeeklyReviewEnabled(true);
      } else {
        Alert.alert(
          'Notifications Required',
          'Please enable notifications in system settings to receive your Sunday weekly review.'
        );
        setWeeklyReviewEnabled(false);
      }
    } else {
      await cancelSundayWeeklyReview();
      setWeeklyReviewEnabled(false);
    }
  };

  const handleChangeDailyReminderTime = () => {
    Alert.alert(
      'Daily Reminder Time',
      'Choose when to receive your daily meal log reminder:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '7:00 PM (19:00)',
          onPress: async () => {
            setDailyReminderTime('19:00');
            if (dailyReminderEnabled) await scheduleDailyMealReminder('19:00');
          },
        },
        {
          text: '8:00 PM (20:00 - Recommended)',
          onPress: async () => {
            setDailyReminderTime('20:00');
            if (dailyReminderEnabled) await scheduleDailyMealReminder('20:00');
          },
        },
        {
          text: '9:00 PM (21:00)',
          onPress: async () => {
            setDailyReminderTime('21:00');
            if (dailyReminderEnabled) await scheduleDailyMealReminder('21:00');
          },
        },
      ]
    );
  };

  const handleChangeWeeklyReviewTime = () => {
    Alert.alert(
      'Sunday Review Time',
      'Choose when to receive your weekly fitness & nutrition summary on Sundays:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '6:00 PM (18:00)',
          onPress: async () => {
            setWeeklyReviewTime('18:00');
            if (weeklyReviewEnabled) await scheduleSundayWeeklyReview('18:00');
          },
        },
        {
          text: '7:00 PM (19:00 - Recommended)',
          onPress: async () => {
            setWeeklyReviewTime('19:00');
            if (weeklyReviewEnabled) await scheduleSundayWeeklyReview('19:00');
          },
        },
        {
          text: '8:00 PM (20:00)',
          onPress: async () => {
            setWeeklyReviewTime('20:00');
            if (weeklyReviewEnabled) await scheduleSundayWeeklyReview('20:00');
          },
        },
      ]
    );
  };

  const [currentLang, setCurrentLanguageState] = useState<SupportedLanguage>(getAppLanguage());
  const [isRestoring, setIsRestoring] = useState(false);

  const handleToggleLanguage = (lang: SupportedLanguage) => {
    safeHaptics.selection();
    setAppLanguage(lang);
    setCurrentLanguageState(lang);
  };

  const hasCustom = Boolean(customApiKey && customApiKey.trim().length > 0);
  const activeModelTitle = getActiveModelDisplayName();

  const refreshLoadedData = async () => {
    await useFitnessStore.getState().refreshLoadedData();
  };

  // Export Workouts as CSV
  const handleExportWorkoutsCsv = useCallback(async () => {
    try {
      safeHaptics.selection();
      const workouts = await dbGetAllWorkouts();
      if (workouts.length === 0) {
        Alert.alert('No Data', 'You have not logged any workouts yet.');
        return;
      }
      const csv = generateWorkoutsCsv(workouts);
      const filename = `betteryou_workouts_${new Date().toISOString().slice(0, 10)}.csv`;
      await shareOrCopyData(csv, filename);
    } catch {
      Alert.alert('Export Failed', 'Unable to export workouts. Please try again.');
    }
  }, []);

  // Export Meals as CSV
  const handleExportMealsCsv = useCallback(async () => {
    try {
      safeHaptics.selection();
      const meals = await dbGetAllMeals();
      if (meals.length === 0) {
        Alert.alert('No Data', 'You have not logged any meals yet.');
        return;
      }
      const csv = generateMealsCsv(meals);
      const filename = `betteryou_meals_${new Date().toISOString().slice(0, 10)}.csv`;
      await shareOrCopyData(csv, filename);
    } catch {
      Alert.alert('Export Failed', 'Unable to export meals. Please try again.');
    }
  }, []);

  // Export Full JSON Backup
  const handleExportJsonBackup = useCallback(async () => {
    try {
      safeHaptics.selection();
      const [workouts, meals, products] = await Promise.all([
        dbGetAllWorkouts(),
        dbGetAllMeals(),
        dbGetAllScannedProducts(),
      ]);
      const json = generateJsonBackup(workouts, meals, dailyGoals ?? undefined, products);
      const filename = `betteryou_backup_${new Date().toISOString().slice(0, 10)}.json`;
      await shareOrCopyData(json, filename);
    } catch {
      Alert.alert('Export Failed', 'Unable to generate backup file. Please try again.');
    }
  }, [dailyGoals]);

  // Restore Backup
  const handleRestoreBackup = async () => {
    try {
      safeHaptics.selection();
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileAsset = result.assets[0];
      const file = new ExpoFile(fileAsset.uri);
      const content = await file.text();

      const validation = parseAndValidateBackup(content);
      if (!validation.success) {
        Alert.alert('Invalid Backup', validation.error);
        return;
      }

      const payload = validation.payload;
      const mealCountImport = payload.meals.length;
      const workoutCountImport = payload.workouts.length;
      const productCountImport = payload.scannedProducts?.length ?? 0;

      Alert.alert(
        'Restore Backup',
        `Backup dated: ${new Date(payload.exportedAt).toLocaleDateString()}\n\nContains:\n• ${workoutCountImport} workouts\n• ${mealCountImport} meals\n• ${productCountImport} scanned products\n\nNote: Scanned product & meal photos are local-only and not stored in backups.\n\nChoose restore strategy:`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Merge',
            onPress: async () => {
              await executeRestore(payload, 'merge');
            },
          },
          {
            text: 'Replace All Data',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Confirm Replace',
                'This will permanently delete your existing local workouts, meals, and scans, and replace them with this backup. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Erase & Replace',
                    style: 'destructive',
                    onPress: async () => {
                      await executeRestore(payload, 'replace');
                    },
                  },
                ]
              );
            },
          },
        ]
      );
    } catch (err: unknown) {
      safeHaptics.error();
      Alert.alert('Restore Error', `Failed to open or read backup: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const executeRestore = async (payload: BackupPayload, strategy: 'replace' | 'merge') => {
    setIsRestoring(true);
    try {
      const summary = await importBackup(payload, strategy);
      await refreshLoadedData();
      safeHaptics.success();
      Alert.alert(
        'Restore Complete',
        `Successfully restored ${summary.workoutsImported} workouts, ${summary.mealsImported} meals, and ${summary.productsImported} products.\n\n(Photos and scans are not included in backups).`
      );
    } catch (err: unknown) {
      safeHaptics.error();
      Alert.alert('Restore Failed', `Restore was cancelled with no data lost: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClearCorrections = useCallback(() => {
    Alert.alert(
      'Clear Learned Corrections',
      'This will delete all personalized meal macro corrections learned from your previous edits. Reference databases (IFCT 2017) will still be active.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await dbClearCorrections();
              safeHaptics.success();
              Alert.alert('Cleared', 'All learned food corrections have been reset.');
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              Alert.alert('Error', `Failed to clear corrections: ${msg}`);
            }
          },
        },
      ]
    );
  }, []);

  const handleResetSettings = useCallback(() => {
    Alert.alert(
      'Reset Settings',
      'Reset API key and selected model back to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetSettings();
            Alert.alert('Reset Complete', 'Settings have been restored to defaults.');
          },
        },
      ]
    );
  }, [resetSettings]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.screenTitle} allowFontScaling>
              Settings
            </Text>
            <Text style={styles.screenTag} allowFontScaling>
              PREFERENCES & SYSTEM
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              hasCustom ? styles.statusPillLive : styles.statusPillEnv,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                hasCustom ? styles.statusDotLive : styles.statusDotEnv,
              ]}
            />
            <Text style={styles.statusPillText} allowFontScaling>
              {hasCustom ? 'BYOK Mode' : 'Proxy Mode'}
            </Text>
          </View>
        </View>

        {/* Section: Appearance & Language */}
        <AppearanceSection
          colorScheme={colorScheme}
          onToggleColorScheme={setColorScheme}
          currentLang={currentLang}
          onSelectLanguage={handleToggleLanguage}
        />

        {/* Section: Nutrition & Goals */}
        <NutritionGoalsSection
          calorieTarget={dailyGoals?.calorieTarget ?? 2200}
          onNavigateNutritionTarget={() => router.push('/nutrition-target')}
          onNavigateRecalculateBmr={() => router.push('/onboarding?recalculate=true')}
        />

        {/* Section: Reminders & Notifications */}
        <RemindersSection
          dailyReminderEnabled={dailyReminderEnabled}
          dailyReminderTime={dailyReminderTime}
          weeklyReviewEnabled={weeklyReviewEnabled}
          weeklyReviewTime={weeklyReviewTime}
          onToggleDailyReminder={handleToggleDailyReminder}
          onChangeDailyReminderTime={handleChangeDailyReminderTime}
          onToggleWeeklyReview={handleToggleWeeklyReview}
          onChangeWeeklyReviewTime={handleChangeWeeklyReviewTime}
        />

        {/* Section: AI Intelligence */}
        <AiIntelligenceSection
          activeModelTitle={activeModelTitle}
          selectedModel={selectedModel}
          isCustomModel={isCustomModel}
          customModelName={customModelName}
          hasCustom={hasCustom}
          totalCalls={totalCalls}
          onSelectModel={(modelId) => setSelectedModel(modelId)}
          onNavigateAiSettings={() => router.push('/ai-settings')}
          onNavigateApiUsage={() => router.push('/api-usage')}
        />

        {/* Section: Data Backup & Export */}
        <DataBackupSection
          workoutCount={workoutCount}
          mealCount={mealCount}
          isRestoring={isRestoring}
          onExportWorkoutsCsv={handleExportWorkoutsCsv}
          onExportMealsCsv={handleExportMealsCsv}
          onExportJsonBackup={handleExportJsonBackup}
          onRestoreBackup={handleRestoreBackup}
          onClearCorrections={handleClearCorrections}
        />

        {/* Section: Diagnostics & System Health */}
        <SystemHealthSection
          activeModelTitle={activeModelTitle}
          onNavigateOnboarding={() => router.push('/onboarding')}
          onNavigateDiagnostics={() => router.push('/diagnostics')}
          onResetSettings={handleResetSettings}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 48,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    screenTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
    },
    screenTag: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: colors.primary,
      marginTop: 2,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    statusPillLive: {
      borderColor: colors.softGreenBorder,
      backgroundColor: colors.softGreen,
    },
    statusPillEnv: {
      borderColor: colors.softBlueBorder,
      backgroundColor: colors.softBlue,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusDotLive: {
      backgroundColor: colors.success,
    },
    statusDotEnv: {
      backgroundColor: colors.secondary,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
}
