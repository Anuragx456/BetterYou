import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
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
import { getAppLanguage, setAppLanguage, SupportedLanguage } from '../../i18n';
import { useFitnessStore } from '../../store/useFitnessStore';
import {
  AVAILABLE_GEMINI_MODELS,
  getActiveModelDisplayName,
  useSettingsStore,
} from '../../store/useSettingsStore';
import { safeHaptics } from '../../utils/haptics';
import { useGeminiUsageStore } from '../../store/useGeminiUsageStore';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';

export default function SettingsScreen() {
  const colors = useThemeColors();
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

  const [currentLang, setCurrentLangState] = useState<SupportedLanguage>(getAppLanguage());

  const hasCustom = Boolean(customApiKey?.trim());
  const activeModelTitle = getActiveModelDisplayName();

  const handleToggleLanguage = (lang: SupportedLanguage) => {
    setAppLanguage(lang);
    setCurrentLangState(lang);
    Alert.alert(
      lang === 'hi' ? 'भाषा बदली गई' : 'Language Changed',
      lang === 'hi' ? 'ऐप भाषा अब हिंदी में सेट है।' : 'App language is now set to English.'
    );
  };

  const handleExportWorkoutsCsv = async () => {
    const workouts = await dbGetAllWorkouts();
    const csv = generateWorkoutsCsv(workouts);
    const status = await shareOrCopyData(csv, 'BetterYou_Workouts.csv');
    Alert.alert(
      status === 'shared' ? 'Workouts Exported' : 'CSV Copied',
      `Exported ${workouts.length} workout sessions.`
    );
  };

  const handleExportMealsCsv = async () => {
    const meals = await dbGetAllMeals();
    const csv = generateMealsCsv(meals);
    const status = await shareOrCopyData(csv, 'BetterYou_Meals.csv');
    Alert.alert(
      status === 'shared' ? 'Meals Exported' : 'CSV Copied',
      `Exported ${meals.length} meal logs.`
    );
  };

  const [isRestoring, setIsRestoring] = useState(false);
  const refreshLoadedData = useFitnessStore((state) => state.refreshLoadedData);

  const handleExportJsonBackup = async () => {
    const [workouts, meals, products] = await Promise.all([
      dbGetAllWorkouts(),
      dbGetAllMeals(),
      dbGetAllScannedProducts(),
    ]);
    const json = generateJsonBackup(workouts, meals, dailyGoals, products);
    const status = await shareOrCopyData(json, 'BetterYou_Backup.json');
    Alert.alert(
      status === 'shared' ? 'Backup Shared' : 'Backup Copied',
      'Complete JSON database backup exported.'
    );
  };

  const handleRestoreBackup = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        return;
      }

      const fileAsset = res.assets[0];
      let rawContent = '';
      try {
        if (fileAsset.uri) {
          const file = new ExpoFile(fileAsset.uri);
          rawContent = await file.text();
        }
      } catch {
        const response = await fetch(fileAsset.uri);
        rawContent = await response.text();
      }

      const validation = parseAndValidateBackup(rawContent);
      if (!validation.success) {
        safeHaptics.error();
        Alert.alert('Invalid Backup File', validation.error);
        return;
      }

      const { payload } = validation;
      const exportDate = payload.exportedAt ? new Date(payload.exportedAt).toLocaleDateString() : 'Unknown';
      const wCount = payload.workouts?.length ?? 0;
      const mCount = payload.meals?.length ?? 0;
      const pCount = payload.scannedProducts?.length ?? 0;
      const hasGoals = Boolean(payload.dailyGoals);

      const summaryMessage =
        `Backup Exported: ${exportDate}\n` +
        `• ${wCount} Workouts\n` +
        `• ${mCount} Meals\n` +
        `• ${pCount} Products\n` +
        `• Daily Goals: ${hasGoals ? 'Included' : 'None'}\n\n` +
        `Notice: Photos and scan images are stored locally and are NOT included in backups.\n\n` +
        `Choose restore strategy:`;

      Alert.alert(
        'Restore from Backup',
        summaryMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Merge (Keep Existing)',
            onPress: async () => {
              await executeRestore(payload, 'merge');
            },
          },
          {
            text: 'Replace All (Wipe)',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Destructive Action Warning',
                'Are you sure you want to replace all data? All current meals, workouts, and products on this device will be permanently deleted and replaced with this backup.',
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

  // Reset all settings
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

        <View style={styles.section}>
          <Text style={styles.sectionHeader} allowFontScaling>
            APPEARANCE
          </Text>
          <View style={styles.cardGroup}>
            <View style={styles.navRow}>
              <View style={[styles.iconBadge, { backgroundColor: colors.primaryMuted }]}>
                <Ionicons
                  name={colorScheme === 'dark' ? 'moon' : 'sunny-outline'}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  Dark mode
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  Dim the dashboard, scans, and workouts
                </Text>
              </View>
              <Switch
                value={colorScheme === 'dark'}
                onValueChange={(enabled) => setColorScheme(enabled ? 'dark' : 'light')}
                trackColor={{ false: colors.hairline, true: colors.primary }}
                thumbColor={colors.white}
                accessibilityLabel="Dark mode"
              />
            </View>
          </View>
        </View>

        {/* Section: Language Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader} allowFontScaling>
            LANGUAGE / भाषा
          </Text>
          <View style={styles.langRow}>
            <Pressable
              style={({ pressed }) => [
                styles.langBtn,
                currentLang === 'en' && styles.langBtnActive,
                pressed && styles.pressed,
              ]}
              onPress={() => handleToggleLanguage('en')}
              accessibilityRole="button"
              accessibilityLabel="Select English language"
            >
              <Text
                style={[
                  styles.langBtnText,
                  currentLang === 'en' && styles.langBtnTextActive,
                ]}
                allowFontScaling
              >
                English
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.langBtn,
                currentLang === 'hi' && styles.langBtnActive,
                pressed && styles.pressed,
              ]}
              onPress={() => handleToggleLanguage('hi')}
              accessibilityRole="button"
              accessibilityLabel="हिंदी भाषा चुनें"
            >
              <Text
                style={[
                  styles.langBtnText,
                  currentLang === 'hi' && styles.langBtnTextActive,
                ]}
                allowFontScaling
              >
                हिंदी (Hindi)
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Section: Nutrition & Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader} allowFontScaling>
            NUTRITION & GOALS
          </Text>
          <View style={styles.cardGroup}>
            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={() => router.push('/nutrition-target')}
              accessibilityRole="button"
              accessibilityLabel="Edit daily nutrition targets"
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.softOrange }]}>
                <Ionicons name="flame" size={18} color={colors.calories} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  Daily Nutrition Target
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  Calorie and macronutrient goals
                </Text>
              </View>
              <View style={styles.navRight}>
                <View style={styles.valueBadge}>
                  <Text style={[styles.valueBadgeText, { color: colors.calories }]} allowFontScaling>
                    {dailyGoals?.calorieTarget?.toLocaleString() ?? 2200} kcal
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Section: AI Intelligence */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader} allowFontScaling>
              AI & INTELLIGENCE
            </Text>
            <View style={styles.modelHeaderBadge}>
              <Ionicons name="sparkles" size={11} color={colors.primary} />
              <Text style={styles.modelHeaderBadgeText}>{activeModelTitle}</Text>
            </View>
          </View>

          {/* Direct Model Selection in Settings */}
          <View style={styles.modelPickerCard}>
            <Text style={styles.modelPickerSubtext}>
              Select active Gemini model for Meal Vision & Product Screening:
            </Text>
            <View style={styles.modelChipsGrid}>
              {AVAILABLE_GEMINI_MODELS.map((model) => {
                const isSelected = !isCustomModel && selectedModel === model.id;
                return (
                  <Pressable
                    key={model.id}
                    style={({ pressed }) => [
                      styles.modelChip,
                      isSelected && styles.modelChipActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      safeHaptics.selection();
                      setSelectedModel(model.id);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Select ${model.name} for meal vision and product screening`}
                  >
                    <View style={styles.modelChipTop}>
                      <View style={[styles.modelRadio, isSelected && styles.modelRadioActive]}>
                        {isSelected && <View style={styles.modelRadioDot} />}
                      </View>
                      <Text
                        style={[styles.modelChipTitle, isSelected && styles.modelChipTitleActive]}
                        numberOfLines={1}
                      >
                        {model.name}
                      </Text>
                    </View>
                    <View style={styles.modelChipMeta}>
                      <View style={styles.modelBadgeWrap}>
                        <Text style={styles.modelChipBadge}>{model.badge}</Text>
                      </View>
                      <Text style={styles.modelChipSpeed}>{model.speed}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {isCustomModel && customModelName ? (
              <View style={styles.customModelNotice}>
                <Ionicons name="code-slash" size={13} color={colors.primary} />
                <Text style={styles.customModelNoticeText}>
                  Custom Model Active: {customModelName}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.cardGroup}>
            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={() => router.push('/ai-settings')}
              accessibilityRole="button"
              accessibilityLabel="Configure Gemini API settings and model"
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.softGreen }]}>
                <Ionicons name="hardware-chip-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  API Key & Custom Model (BYOK)
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  {hasCustom ? 'Hardware-backed custom key active' : 'Managed Proxy (Google AI Studio)'}
                </Text>
              </View>
              <View style={styles.navRight}>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={() => router.push('/api-usage')}
              accessibilityRole="button"
              accessibilityLabel="View detailed Gemini API usage and quota"
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.softBlue }]}>
                <Ionicons name="speedometer-outline" size={18} color={colors.protein} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  API Key Usage & Quota
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  Scans, tokens, costs & rate limits
                </Text>
              </View>
              <View style={styles.navRight}>
                <View style={styles.valueBadge}>
                  <Text style={[styles.valueBadgeText, { color: colors.protein }]} allowFontScaling>
                    {totalCalls > 0 ? `${totalCalls} scans` : 'Free Tier'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Section: Data Backup & Export */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader} allowFontScaling>
            DATA BACKUP & EXPORT
          </Text>
          <View style={styles.cardGroup}>
            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={handleExportWorkoutsCsv}
              accessibilityRole="button"
              accessibilityLabel="Export workouts data to CSV spreadsheet"
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.primaryMuted }]}>
                <Ionicons name="barbell-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  Export Workouts (CSV)
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  Excel / Sheets compatible log ({workoutCount} sessions)
                </Text>
              </View>
              <Ionicons name="download-outline" size={18} color={colors.primary} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={handleExportMealsCsv}
              accessibilityRole="button"
              accessibilityLabel="Export meals data to CSV spreadsheet"
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.softOrange }]}>
                <Ionicons name="restaurant-outline" size={18} color={colors.calories} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  Export Meals (CSV)
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  Nutrition & macro history ({mealCount} meals)
                </Text>
              </View>
              <Ionicons name="download-outline" size={18} color={colors.calories} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={handleExportJsonBackup}
              accessibilityRole="button"
              accessibilityLabel="Export complete JSON database backup"
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="server-outline" size={18} color={colors.secondary} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  Full Database Backup (JSON)
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  Export workouts, meals, and goals for backup
                </Text>
              </View>
              <Ionicons name="download-outline" size={18} color={colors.secondary} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.navRow, (pressed || isRestoring) && styles.pressed]}
              onPress={handleRestoreBackup}
              disabled={isRestoring}
              accessibilityRole="button"
              accessibilityLabel="Restore meals and workouts from JSON backup file"
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.softGreen }]}>
                <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  {isRestoring ? 'Restoring Backup...' : 'Restore from Backup (JSON)'}
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  Import meals, workouts & goals (Merge or Replace)
                </Text>
              </View>
              <Ionicons name="arrow-up-circle-outline" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* Section: Diagnostics & System */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader} allowFontScaling>
            SYSTEM HEALTH
          </Text>
          <View style={styles.cardGroup}>
            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={() => router.push('/onboarding')}
              accessibilityRole="button"
              accessibilityLabel="View app introduction tour and onboarding walkthrough"
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.softGreen }]}>
                <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  App Tour & Onboarding
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  Feature walkthrough and setup guide
                </Text>
              </View>
              <View style={styles.navRight}>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={() => router.push('/diagnostics')}
              accessibilityRole="button"
              accessibilityLabel="Open diagnostics and system health screen"
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.softBlue }]}>
                <Ionicons name="pulse" size={18} color={colors.secondary} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  Diagnostics
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  API latency test & connection ping
                </Text>
              </View>
              <View style={styles.navRight}>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Section: Reset */}
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
            onPress={handleResetSettings}
            accessibilityRole="button"
            accessibilityLabel="Reset all settings to defaults"
          >
            <Ionicons name="refresh-outline" size={16} color={colors.danger} />
            <Text style={styles.resetBtnText} allowFontScaling>
              Reset to Default Settings
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerVersion} allowFontScaling>
            BetterYou v1.0.0 • Obsidian Theme
          </Text>
          <Text style={styles.footerSub} allowFontScaling>
            Powered by {activeModelTitle}
          </Text>
        </View>
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
  statusPillDemo: {
    borderColor: colors.softOrangeBorder,
    backgroundColor: colors.softOrange,
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
  statusDotDemo: {
    backgroundColor: colors.warning,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 20,
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 48,
  },
  langBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  langBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  langBtnTextActive: {
    color: colors.primary,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  modelHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modelHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  modelPickerCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    marginBottom: 10,
  },
  modelPickerSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 10,
    fontWeight: '500',
  },
  modelChipsGrid: {
    gap: 8,
  },
  modelChip: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modelChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  modelChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modelRadio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelRadioActive: {
    borderColor: colors.primary,
  },
  modelRadioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  modelChipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  modelChipTitleActive: {
    color: colors.primary,
  },
  modelChipMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingLeft: 22,
  },
  modelBadgeWrap: {
    backgroundColor: colors.card,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modelChipBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modelChipSpeed: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  customModelNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  customModelNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  cardGroup: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  navRowMeta: {
    flex: 1,
  },
  navRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  navRowSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  valueBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.fatMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
  footerContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 24,
  },
  footerVersion: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  footerSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
}

