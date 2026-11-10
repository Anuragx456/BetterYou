import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  generateJsonBackup,
  generateMealsCsv,
  generateWorkoutsCsv,
  shareOrCopyData,
} from '../../services/backupService';
import { getAppLanguage, setAppLanguage, SupportedLanguage } from '../../i18n';
import { useFitnessStore } from '../../store/useFitnessStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useGeminiUsageStore } from '../../store/useGeminiUsageStore';
import { colors } from '../../theme/colors';

export default function SettingsScreen() {
  const router = useRouter();

  // Store hooks
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const dailyGoals = useFitnessStore((state) => state.dailyGoals);
  const workouts = useFitnessStore((state) => state.workouts);
  const meals = useFitnessStore((state) => state.meals);

  const customApiKey = useSettingsStore((state) => state.customApiKey);
  const selectedModel = useSettingsStore((state) => state.selectedModel);
  const isCustomModel = useSettingsStore((state) => state.isCustomModel);
  const customModelName = useSettingsStore((state) => state.customModelName);
  const totalCalls = useGeminiUsageStore((state) => state.totalCalls);

  const [currentLang, setCurrentLangState] = useState<SupportedLanguage>(getAppLanguage());

  const hasCustom = Boolean(customApiKey?.trim());
  const activeModelTitle = isCustomModel && customModelName ? customModelName : selectedModel;

  const handleToggleLanguage = (lang: SupportedLanguage) => {
    setAppLanguage(lang);
    setCurrentLangState(lang);
    Alert.alert(
      lang === 'hi' ? 'भाषा बदली गई' : 'Language Changed',
      lang === 'hi' ? 'ऐप भाषा अब हिंदी में सेट है।' : 'App language is now set to English.'
    );
  };

  const handleExportWorkoutsCsv = async () => {
    const csv = generateWorkoutsCsv(workouts);
    const status = await shareOrCopyData(csv, 'BetterYou_Workouts.csv');
    Alert.alert(
      status === 'shared' ? 'Workouts Exported' : 'CSV Copied',
      `Exported ${workouts.length} workout sessions.`
    );
  };

  const handleExportMealsCsv = async () => {
    const csv = generateMealsCsv(meals);
    const status = await shareOrCopyData(csv, 'BetterYou_Meals.csv');
    Alert.alert(
      status === 'shared' ? 'Meals Exported' : 'CSV Copied',
      `Exported ${meals.length} meal logs.`
    );
  };

  const handleExportJsonBackup = async () => {
    const json = generateJsonBackup(workouts, meals, dailyGoals);
    const status = await shareOrCopyData(json, 'BetterYou_Backup.json');
    Alert.alert(
      status === 'shared' ? 'Backup Shared' : 'Backup Copied',
      'Complete JSON database backup exported.'
    );
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
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
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
          <Text style={styles.sectionHeader} allowFontScaling>
            AI & INTELLIGENCE
          </Text>
          <View style={styles.cardGroup}>
            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={() => router.push('/ai-settings')}
              accessibilityRole="button"
              accessibilityLabel="Configure Gemini API settings and model"
            >
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  AI Model & Key Settings
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  Gemini API key & model selection
                </Text>
              </View>
              <View style={styles.navRight}>
                <View style={styles.valueBadge}>
                  <Text style={styles.valueBadgeText} allowFontScaling>
                    {activeModelTitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={() => router.push('/api-usage')}
              accessibilityRole="button"
              accessibilityLabel="View detailed Gemini API usage and quota"
            >
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
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
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(0, 229, 255, 0.12)' }]}>
                <Ionicons name="barbell-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  Export Workouts (CSV)
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  Excel / Sheets compatible log ({workouts.length} sessions)
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
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <Ionicons name="restaurant-outline" size={18} color={colors.calories} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  Export Meals (CSV)
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  Nutrition & macro history ({meals.length} meals)
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
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(168, 85, 247, 0.12)' }]}>
                <Ionicons name="server-outline" size={18} color="#A855F7" />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle} allowFontScaling>
                  Full Database Backup (JSON)
                </Text>
                <Text style={styles.navRowSubtitle} allowFontScaling>
                  Export workouts, meals, and goals for backup
                </Text>
              </View>
              <Ionicons name="download-outline" size={18} color="#A855F7" />
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
              onPress={() => router.push('/diagnostics')}
              accessibilityRole="button"
              accessibilityLabel="Open diagnostics and system health screen"
            >
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
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

const styles = StyleSheet.create({
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
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  statusPillEnv: {
    borderColor: 'rgba(99, 102, 241, 0.3)',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  statusPillDemo: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
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
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
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
  cardGroup: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pressed: {
    opacity: 0.7,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.cardHover,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  valueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
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
