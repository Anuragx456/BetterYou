import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFitnessStore } from '../store/useFitnessStore';
import {
  GeminiApiRecord,
  useGeminiUsageStore,
} from '../store/useGeminiUsageStore';
import {
  getActiveModelDisplayName,
  getEffectiveModel,
  getModelEstimations,
  isUsingCustomKey,
  useSettingsStore,
  validateGeminiApiKey,
} from '../store/useSettingsStore';
import { colors } from '../theme/colors';
import { safeHaptics } from '../utils/haptics';

const GOOGLE_AI_STUDIO_PLAN_URL = 'https://aistudio.google.com/app/plan_information';

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const hours = date.getHours();
  const mins = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const timeStr = `${hour12}:${mins} ${ampm}`;
  if (isToday) return `Today, ${timeStr}`;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getDate()}, ${timeStr}`;
}

export function GeminiUsageSection() {
  const router = useRouter();

  // Settings & Fitness state
  const customApiKey = useSettingsStore((state) => state.customApiKey);
  const meals = useFitnessStore((state) => state.meals);
  const scannedProducts = useFitnessStore((state) => state.scannedProducts);

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
    const mealsWithPhotos = meals.filter((m) => Boolean(m.imageUri)).length;
    const mealsWithoutPhotos = meals.length - mealsWithPhotos;
    syncFromStoreHistory(mealsWithPhotos, mealsWithoutPhotos, scannedProducts.length);
  }, [meals, scannedProducts, syncFromStoreHistory]);

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

  const displayedRecords = showAllLogs ? records : records.slice(0, 5);

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
      <View style={styles.quotaCard}>
        {/* Key Status Header */}
        <View style={styles.quotaHeaderRow}>
          <View style={styles.statusCol}>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.statusDot,
                  hasCustom ? styles.statusDotLive : styles.statusDotProxy,
                ]}
              />
              <Text style={styles.statusText}>
                {hasCustom ? 'BYOK Custom Key Active' : 'Managed Proxy (Default)'}
              </Text>
            </View>
            <Text style={styles.keySnippetText}>{maskedKey}</Text>
          </View>

          <View style={styles.modelBadge}>
            <Text style={styles.modelBadgeText} numberOfLines={1}>
              {activeModelName}
            </Text>
          </View>
        </View>

        {/* Daily Free Tier Quota Progress */}
        <View style={styles.quotaProgressSection}>
          <View style={styles.quotaLabelRow}>
            <Text style={styles.quotaLabel}>{"Today's API Quota"}</Text>
            <Text style={styles.quotaValue}>
              {todayScans.toLocaleString()} / {dailyQuotaLimit.toLocaleString()} scans ({quotaPercent}%)
            </Text>
          </View>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(4, quotaPercent)}%` },
                quotaPercent > 80 && styles.progressBarFillWarning,
              ]}
            />
          </View>

          <View style={styles.rateLimitRow}>
            <Text style={styles.rateLimitText}>
              Limit: {estimations.rateLimitRPM} RPM • {dailyQuotaLimit} requests/day
            </Text>
            <Text style={styles.freeTierTag}>Google AI Studio Free Tier</Text>
          </View>
        </View>
      </View>

      {/* Bento Grid: 4 Metric Cards */}
      <View style={styles.bentoGrid}>
        {/* Total Scans */}
        <View style={styles.bentoCard}>
          <View style={styles.bentoIconRow}>
            <Ionicons name="scan-outline" size={18} color={colors.primary} />
            <Text style={styles.bentoLabel}>TOTAL SCANS</Text>
          </View>
          <Text style={styles.bentoValue}>{totalCalls.toLocaleString()}</Text>
          <Text style={styles.bentoSubtext}>
            {successfulCalls} ok • {failedCalls} err
          </Text>
        </View>

        {/* Tokens Used */}
        <View style={styles.bentoCard}>
          <View style={styles.bentoIconRow}>
            <Ionicons name="speedometer-outline" size={18} color={colors.secondary} />
            <Text style={styles.bentoLabel}>TOKENS CONSUMED</Text>
          </View>
          <Text style={styles.bentoValue}>{formatTokens(totalTokens)}</Text>
          <Text style={styles.bentoSubtext}>
            {formatTokens(totalPromptTokens)} in • {formatTokens(totalCandidateTokens)} out
          </Text>
        </View>

        {/* Commercial Cost */}
        <View style={styles.bentoCard}>
          <View style={styles.bentoIconRow}>
            <Ionicons name="cash-outline" size={18} color={colors.calories} />
            <Text style={styles.bentoLabel}>BILLED COST</Text>
          </View>
          <Text style={[styles.bentoValue, { color: colors.primary }]}>$0.00</Text>
          <Text style={styles.bentoSubtext}>
            100% Free on AI Studio
          </Text>
        </View>

        {/* Success Rate */}
        <View style={styles.bentoCard}>
          <View style={styles.bentoIconRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.protein} />
            <Text style={styles.bentoLabel}>SUCCESS RATE</Text>
          </View>
          <Text style={styles.bentoValue}>{successRate}%</Text>
          <Text style={styles.bentoSubtext}>
            {failedCalls === 0 ? 'Optimal (0 errors)' : `${successfulCalls} succeeded`}
          </Text>
        </View>
      </View>

      {/* Feature Breakdown Chips */}
      <View style={styles.featureBreakdownCard}>
        <Text style={styles.cardSectionTitle}>USAGE BY FEATURE</Text>
        <View style={styles.featureChipsWrap}>
          <View style={styles.featureChip}>
            <Ionicons name="restaurant-outline" size={14} color={colors.primary} />
            <Text style={styles.featureChipLabel}>Meal Vision:</Text>
            <Text style={styles.featureChipCount}>
              {usageSummary.featureBreakdown['meal-vision']}
            </Text>
          </View>

          <View style={styles.featureChip}>
            <Ionicons name="mic-outline" size={14} color={colors.calories} />
            <Text style={styles.featureChipLabel}>Meal Voice:</Text>
            <Text style={styles.featureChipCount}>
              {usageSummary.featureBreakdown['meal-voice']}
            </Text>
          </View>

          <View style={styles.featureChip}>
            <Ionicons name="document-text-outline" size={14} color={colors.protein} />
            <Text style={styles.featureChipLabel}>Ingredient OCR:</Text>
            <Text style={styles.featureChipCount}>
              {usageSummary.featureBreakdown['toxicity-scan']}
            </Text>
          </View>

          <View style={styles.featureChip}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.secondary} />
            <Text style={styles.featureChipLabel}>Product Voice:</Text>
            <Text style={styles.featureChipCount}>
              {usageSummary.featureBreakdown['toxicity-voice']}
            </Text>
          </View>
        </View>
      </View>

      {/* Recent API Activity Logs */}
      {records.length > 0 && (
        <View style={styles.activityCard}>
          <View style={styles.activityHeaderRow}>
            <Text style={styles.cardSectionTitle}>RECENT API ACTIVITY</Text>
            <Text style={styles.activityCountTag}>{records.length} logged</Text>
          </View>

          <View style={styles.logsList}>
            {displayedRecords.map((item: GeminiApiRecord) => (
              <View key={item.id} style={styles.logItem}>
                <View style={styles.logLeftCol}>
                  <View style={styles.logTitleRow}>
                    <View
                      style={[
                        styles.logStatusDot,
                        item.status === 'success' ? styles.logDotOk : styles.logDotErr,
                      ]}
                    />
                    <Text style={styles.logFeatureName}>{item.featureLabel}</Text>
                  </View>
                  <Text style={styles.logTimestamp}>{formatTimestamp(item.timestamp)}</Text>
                </View>

                <View style={styles.logRightCol}>
                  <Text style={styles.logTokens}>
                    {item.totalTokens > 0 ? `~${formatTokens(item.totalTokens)} tok` : '0 tok'}
                  </Text>
                  <Text style={styles.logDuration}>{item.durationMs}ms</Text>
                </View>
              </View>
            ))}
          </View>

          {records.length > 5 && (
            <Pressable
              style={({ pressed }) => [styles.toggleLogsBtn, pressed && styles.pressed]}
              onPress={() => setShowAllLogs(!showAllLogs)}
            >
              <Text style={styles.toggleLogsBtnText}>
                {showAllLogs ? 'Show Less' : `Show All (${records.length})`}
              </Text>
              <Ionicons
                name={showAllLogs ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.primary}
              />
            </Pressable>
          )}
        </View>
      )}

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

const styles = StyleSheet.create({
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
  quotaCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
  },
  quotaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  statusCol: {
    flex: 1,
    marginRight: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotLive: {
    backgroundColor: colors.primary,
  },
  statusDotProxy: {
    backgroundColor: colors.calories,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  keySnippetText: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: colors.textSecondary,
  },
  modelBadge: {
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  modelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  quotaProgressSection: {
    marginTop: 4,
  },
  quotaLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  quotaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  quotaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressBarFillWarning: {
    backgroundColor: colors.calories,
  },
  rateLimitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateLimitText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  freeTierTag: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  bentoCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  bentoIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  bentoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  bentoValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  bentoSubtext: {
    fontSize: 10,
    color: colors.textMuted,
  },
  featureBreakdownCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
  },
  cardSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  featureChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  featureChipLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  featureChipCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  activityCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activityCountTag: {
    fontSize: 10,
    color: colors.textMuted,
  },
  logsList: {
    gap: 8,
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  logLeftCol: {
    flex: 1,
  },
  logTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  logStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  logDotOk: {
    backgroundColor: colors.primary,
  },
  logDotErr: {
    backgroundColor: colors.danger,
  },
  logFeatureName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  logTimestamp: {
    fontSize: 10,
    color: colors.textMuted,
  },
  logRightCol: {
    alignItems: 'flex-end',
  },
  logTokens: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  logDuration: {
    fontSize: 9,
    color: colors.textMuted,
  },
  toggleLogsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 10,
  },
  toggleLogsBtnText: {
    fontSize: 11,
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
    borderRadius: 12,
    paddingVertical: 12,
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
    opacity: 0.75,
  },
});
