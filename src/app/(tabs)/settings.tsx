import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFitnessStore } from '../../store/useFitnessStore';
import {
  getActiveModelDisplayName,
  getEffectiveApiKey,
  isUsingCustomKey,
  useSettingsStore,
} from '../../store/useSettingsStore';
import { colors } from '../../theme/colors';

export default function SettingsScreen() {
  const router = useRouter();

  // Store hooks
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const dailyGoals = useFitnessStore((state) => state.dailyGoals);

  const effectiveKey = getEffectiveApiKey();
  const activeModelTitle = getActiveModelDisplayName();
  const hasCustom = isUsingCustomKey();
  const hasAnyKey = Boolean(effectiveKey);

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
            <Text style={styles.screenTitle}>Settings</Text>
            <Text style={styles.screenTag}>PREFERENCES & SYSTEM</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              hasCustom
                ? styles.statusPillLive
                : hasAnyKey
                ? styles.statusPillEnv
                : styles.statusPillDemo,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                hasCustom
                  ? styles.statusDotLive
                  : hasAnyKey
                  ? styles.statusDotEnv
                  : styles.statusDotDemo,
              ]}
            />
            <Text style={styles.statusPillText}>
              {hasCustom ? 'Custom Key' : hasAnyKey ? 'Default Key' : 'Demo Mode'}
            </Text>
          </View>
        </View>

        {/* Section: Nutrition & Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>NUTRITION & GOALS</Text>
          <View style={styles.cardGroup}>
            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={() => router.push('/nutrition-target')}
            >
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <Ionicons name="flame" size={18} color={colors.calories} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle}>Daily Nutrition Target</Text>
                <Text style={styles.navRowSubtitle}>Calorie and macronutrient goals</Text>
              </View>
              <View style={styles.navRight}>
                <View style={styles.valueBadge}>
                  <Text style={[styles.valueBadgeText, { color: colors.calories }]}>
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
          <Text style={styles.sectionHeader}>AI & INTELLIGENCE</Text>
          <View style={styles.cardGroup}>
            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={() => router.push('/ai-settings')}
            >
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle}>AI Settings</Text>
                <Text style={styles.navRowSubtitle}>Gemini API key & active model</Text>
              </View>
              <View style={styles.navRight}>
                <View style={styles.valueBadge}>
                  <Text style={styles.valueBadgeText}>{activeModelTitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Section: Diagnostics & System */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SYSTEM HEALTH</Text>
          <View style={styles.cardGroup}>
            <Pressable
              style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
              onPress={() => router.push('/diagnostics')}
            >
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                <Ionicons name="pulse" size={18} color={colors.secondary} />
              </View>
              <View style={styles.navRowMeta}>
                <Text style={styles.navRowTitle}>Diagnostics</Text>
                <Text style={styles.navRowSubtitle}>API latency test & connection ping</Text>
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
          >
            <Ionicons name="refresh-outline" size={16} color={colors.danger} />
            <Text style={styles.resetBtnText}>Reset to Default Settings</Text>
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerVersion}>BetterYou v1.0.0 • Obsidian Theme</Text>
          <Text style={styles.footerSub}>Powered by Google Gemini 3.6 Flash</Text>
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
    fontFamily: 'monospace',
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
