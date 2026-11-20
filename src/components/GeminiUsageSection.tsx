import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFitnessStore } from '../store/useFitnessStore';
import { useGeminiUsageStore } from '../store/useGeminiUsageStore';
import {
  getActiveModelDisplayName,
  getEffectiveModel,
  getModelEstimations,
  isUsingCustomKey,
  useSettingsStore,
  validateGeminiApiKey,
} from '../store/useSettingsStore';
import type { ThemeColors } from '../theme/colors';
import { useThemeColors, useThemedStyles } from '../theme/theme';
import { safeHaptics } from '../utils/haptics';
import { FeatureBreakdownCard } from './settings/FeatureBreakdownCard';
import { QuotaStatusCard } from './settings/QuotaStatusCard';
import { RecentApiActivityCard } from './settings/RecentApiActivityCard';
import { UsageBentoGrid } from './settings/UsageBentoGrid';

const GOOGLE_AI_STUDIO_PLAN_URL = 'https://aistudio.google.com/app/plan_information';

export function GeminiUsageSection() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  // Settings & Fitness state
  const customApiKey = useSettingsStore((state) => state.customApiKey);
  const mealCount = useFitnessStore((state) => state.mealCount);
  const mealPhotoCount = useFitnessStore((state) => state.mealPhotoCount);
  const scannedProductCount = useFitnessStore((state) => state.scannedProductCount);

  // Usage Store state
  const totalCalls = useGeminiUsageStore((state) => state.totalCalls);
  const successfulCalls = useGeminiUsageStore((state) => state.successfulCalls);
  const failedCalls = useGeminiUsageStore((state) => state.failedCalls);
  const totalTokens = useGeminiUsageStore((state) => state.totalTokens);
  const totalPromptTokens = useGeminiUsageStore((state) => state.totalPromptTokens);
  const totalCandidateTokens = useGeminiUsageStore((state) => state.totalCandidateTokens);
  const records = useGeminiUsageStore((state) => state.records);
  const clearUsage = useGeminiUsageStore((state) => state.clearUsage);
  const syncFromStoreHistory = useGeminiUsageStore((state) => state.syncFromStoreHistory);

  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [showAllLogs, setShowAllLogs] = useState<boolean>(false);

  // Auto-sync initial scan count from existing meals and scanned products if clean
  useEffect(() => {
    const mealsWithoutPhotos = Math.max(0, mealCount - mealPhotoCount);
    syncFromStoreHistory(mealPhotoCount, mealsWithoutPhotos, scannedProductCount);
  }, [mealCount, mealPhotoCount, scannedProductCount, syncFromStoreHistory]);

  const hasCustom = isUsingCustomKey();
  const activeModelId = getEffectiveModel();
  const activeModelName = getActiveModelDisplayName();
  const estimations = useMemo(() => getModelEstimations(activeModelId), [activeModelId]);

  const usageSummary = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayRecords = records.filter((r) => r.timestamp >= startOfToday);
    const todayCalls = todayRecords.length;
    const todayTokens = todayRecords.reduce((sum, r) => sum + r.totalTokens, 0);

    const featureBreakdown: Record<string, number> = {
      'meal-vision': 0,
      'meal-voice': 0,
      'toxicity-scan': 0,
      'toxicity-voice': 0,
      'barcode-enrichment': 0,
      'key-validation': 0,
    };

    for (const r of records) {
      featureBreakdown[r.feature] = (featureBreakdown[r.feature] || 0) + 1;
    }

    const commercialCost = (totalPromptTokens / 1_000_000) * 0.075 + (totalCandidateTokens / 1_000_000) * 0.30;
    const formattedCommercialValue = commercialCost < 0.01 ? '< $0.01' : `$${commercialCost.toFixed(2)}`;

    return {
      todayCalls,
      todayTokens,
      featureBreakdown,
      commercialCost,
      formattedCommercialValue,
    };
  }, [totalPromptTokens, totalCandidateTokens, records]);

  // Daily rate limits for current model
  const dailyQuotaLimit = activeModelId.includes('3.6') ? 750 : 1500;
  const todayScans = usageSummary.todayCalls;
  const quotaPercent = Math.min(100, Math.round((todayScans / dailyQuotaLimit) * 100));

  // Masked key display
  const maskedKey = useMemo(() => {
    if (!customApiKey) return 'Not configured (using proxy)';
    if (customApiKey.length <= 8) return '••••••••';
    return `${customApiKey.slice(0, 6)}••••••••${customApiKey.slice(-4)}`;
  }, [customApiKey]);

  // Success rate percentage
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 100;

  // Open Google AI Studio in-app browser
  const handleOpenAiStudio = async () => {
    safeHaptics.impactLight();
    try {
      await WebBrowser.openBrowserAsync(GOOGLE_AI_STUDIO_PLAN_URL, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: colors.card,
        controlsColor: colors.primary,
      });
    } catch {
      Linking.openURL(GOOGLE_AI_STUDIO_PLAN_URL).catch(() => {
        Alert.alert('Unable to open link', `Please navigate to: ${GOOGLE_AI_STUDIO_PLAN_URL}`);
      });
    }
  };

  // Test live connection to Google Gemini API
  const handleTestConnection = async () => {
    if (!hasCustom) {
      Alert.alert(
        'Managed Proxy Active',
        'You are currently routing through the BetterYou proxy server. Add a custom Gemini API key to monitor direct Google AI Studio quota and token usage.',
        [
          { text: 'Add API Key', onPress: () => router.push('/ai-settings') },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }

    setIsTesting(true);
    safeHaptics.impactMedium();
    const startTime = Date.now();

    try {
      const result = await validateGeminiApiKey(customApiKey);
      const latencyMs = Date.now() - startTime;
      if (result.isValid) {
        safeHaptics.success();
        Alert.alert(
          'Gemini API Key Verified',
          `✓ Ping Latency: ${latencyMs}ms\n✓ Accessible Models: ${result.modelCount ?? 0}\n✓ Key Status: Active & Operational\n\nYour key is fully provisioned with 1,500 free requests per day.`
        );
      } else {
        safeHaptics.error();
        Alert.alert('Verification Issue', result.message || 'Key failed validation test.');
      }
    } catch (err: unknown) {
      safeHaptics.error();
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Connection Failed', msg);
    } finally {
      setIsTesting(false);
    }
  };

  // Confirm Reset Stats
  const handleResetUsage = () => {
    safeHaptics.selection();
    Alert.alert(
      'Reset Usage Metrics',
      'Are you sure you want to reset all tracked Gemini API calls, token counts, and recent activity logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            clearUsage();
            safeHaptics.impactHeavy();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          <Ionicons name="hardware-chip-outline" size={16} color={colors.primary} />
          <Text style={styles.sectionHeaderText} allowFontScaling>
            GEMINI API KEY USAGE & QUOTA
          </Text>
        </View>
        <Pressable
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => router.push('/ai-settings')}
        >
          <Text style={styles.configureLink}>Configure</Text>
        </Pressable>
      </View>

      {/* Main Quota & Status Card */}
      <QuotaStatusCard
        hasCustom={hasCustom}
        maskedKey={maskedKey}
        activeModelName={activeModelName}
        todayScans={todayScans}
        dailyQuotaLimit={dailyQuotaLimit}
        quotaPercent={quotaPercent}
        rateLimitRPM={estimations.rateLimitRPM}
      />

      {/* Bento Grid: 4 Metric Cards */}
      <UsageBentoGrid
        totalCalls={totalCalls}
        successfulCalls={successfulCalls}
        failedCalls={failedCalls}
        totalTokens={totalTokens}
        totalPromptTokens={totalPromptTokens}
        totalCandidateTokens={totalCandidateTokens}
        successRate={successRate}
      />

      {/* Feature Breakdown Chips */}
      <FeatureBreakdownCard featureBreakdown={usageSummary.featureBreakdown} />

      {/* Recent API Activity Logs */}
      <RecentApiActivityCard
        records={records}
        showAllLogs={showAllLogs}
        setShowAllLogs={setShowAllLogs}
      />

      {/* Action Buttons Row */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnPrimary,
            isTesting && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
          onPress={handleTestConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <>
              <Ionicons name="pulse-outline" size={16} color={colors.textInverse} />
              <Text style={styles.actionBtnTextPrimary}>Test Connection</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnSecondary,
            pressed && styles.pressed,
          ]}
          onPress={handleOpenAiStudio}
        >
          <Ionicons name="open-outline" size={15} color={colors.text} />
          <Text style={styles.actionBtnTextSecondary}>AI Studio Plan</Text>
        </Pressable>

        {totalCalls > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtnReset,
              pressed && styles.pressed,
            ]}
            onPress={handleResetUsage}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginTop: 8,
      marginBottom: 16,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sectionHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    configureLink: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    actionBtnPrimary: {
      flex: 1,
      backgroundColor: colors.primary,
    },
    actionBtnSecondary: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    actionBtnReset: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnTextPrimary: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textInverse,
    },
    actionBtnTextSecondary: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
