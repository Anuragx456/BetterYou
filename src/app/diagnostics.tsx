import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getActiveModelDisplayName,
  getEffectiveApiKey,
  getEffectiveModel,
  isUsingCustomKey,
  testGeminiModelConnectivity,
} from '../store/useSettingsStore';
import { colors } from '../theme/colors';

export default function DiagnosticsScreen() {
  const router = useRouter();

  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<{
    success: boolean | null;
    message: string;
    latencyMs?: number;
    testedAt?: string;
  }>({ success: null, message: '' });

  const effectiveKey = getEffectiveApiKey();
  const effectiveModel = getEffectiveModel();
  const activeModelTitle = getActiveModelDisplayName();
  const hasCustom = isUsingCustomKey();
  const hasAnyKey = Boolean(effectiveKey);

  const handleRunPingTest = useCallback(async () => {
    if (!effectiveKey) {
      Alert.alert('No API Key', 'Please configure an API key in AI Settings before running diagnostics.');
      return;
    }

    setIsPinging(true);
    setPingResult({ success: null, message: '' });

    try {
      const result = await testGeminiModelConnectivity(effectiveKey, effectiveModel);
      setPingResult({
        success: result.success,
        message: result.message,
        latencyMs: result.latencyMs,
        testedAt: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      setPingResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection ping failed.',
        testedAt: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsPinging(false);
    }
  }, [effectiveKey, effectiveModel]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation Header */}
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.headerTitleCol}>
            <Text style={styles.screenTitle}>Diagnostics</Text>
            <Text style={styles.screenTag}>SYSTEM & API HEALTH CHECK</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Section: Status Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CONNECTION STATUS</Text>
          <View style={styles.cardGroup}>
            <View style={styles.statusRow}>
              <View style={styles.statusRowLeft}>
                <View
                  style={[
                    styles.statusDot,
                    hasAnyKey ? styles.statusDotLive : styles.statusDotWarning,
                  ]}
                />
                <Text style={styles.statusRowTitle}>Gemini API State</Text>
              </View>
              <Text
                style={[
                  styles.statusRowValue,
                  hasAnyKey ? { color: colors.success } : { color: colors.warning },
                ]}
              >
                {hasCustom ? 'Custom Key' : hasAnyKey ? 'Default Key' : 'Demo Mode'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.statusRow}>
              <View style={styles.statusRowLeft}>
                <Ionicons name="hardware-chip-outline" size={16} color={colors.primary} />
                <Text style={styles.statusRowTitle}>Active Model</Text>
              </View>
              <Text style={styles.statusRowValue}>{activeModelTitle}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.statusRow}>
              <View style={styles.statusRowLeft}>
                <Ionicons name="globe-outline" size={16} color={colors.textMuted} />
                <Text style={styles.statusRowTitle}>API Endpoint</Text>
              </View>
              <Text style={[styles.statusRowValue, styles.monoValue]}>
                generativelanguage.googleapis.com
              </Text>
            </View>
          </View>
        </View>

        {/* Section: Live Latency Test */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ROUNDTRIP LATENCY TEST</Text>
          <View style={styles.cardGroup}>
            <View style={styles.pingCardBody}>
              <View style={styles.pingMeta}>
                <Text style={styles.pingTitle}>Model Connectivity Ping</Text>
                <Text style={styles.pingSubtitle}>
                  {pingResult.success === true
                    ? `Connected · ${pingResult.latencyMs}ms response time`
                    : pingResult.success === false
                    ? 'Ping failed · Server error'
                    : 'Tests live HTTP roundtrip to Gemini endpoint'}
                </Text>
                {pingResult.testedAt && (
                  <Text style={styles.pingTime}>Last tested at {pingResult.testedAt}</Text>
                )}
              </View>

              <Pressable
                style={[styles.pingBtn, isPinging && styles.btnDisabled]}
                onPress={handleRunPingTest}
                disabled={isPinging}
              >
                {isPinging ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons
                      name={
                        pingResult.success === true
                          ? 'checkmark-outline'
                          : pingResult.success === false
                          ? 'refresh-outline'
                          : 'pulse-outline'
                      }
                      size={15}
                      color={
                        pingResult.success === true
                          ? colors.success
                          : pingResult.success === false
                          ? colors.danger
                          : colors.primary
                      }
                    />
                    <Text
                      style={[
                        styles.pingBtnText,
                        pingResult.success === true && { color: colors.success },
                        pingResult.success === false && { color: colors.danger },
                      ]}
                    >
                      {pingResult.success === true ? 'Retest' : 'Run Ping'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {pingResult.message ? (
              <View
                style={[
                  styles.resultBox,
                  pingResult.success === true
                    ? styles.resultBoxSuccess
                    : styles.resultBoxError,
                ]}
              >
                <Text
                  style={[
                    styles.resultText,
                    pingResult.success === true
                      ? { color: colors.success }
                      : { color: colors.danger },
                  ]}
                >
                  {pingResult.message}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Section: Platform Info */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SPECIFICATIONS</Text>
          <View style={styles.cardGroup}>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Engine Protocol</Text>
              <Text style={styles.specValue}>REST API v1beta (JSON Mime)</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Recommended Models</Text>
              <Text style={styles.specValue}>Gemini 3.6 Flash, 3.5 Flash Lite</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Request Timeout</Text>
              <Text style={styles.specValue}>45s Vision / 30s Text</Text>
            </View>
          </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  headerTitleCol: {
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  screenTag: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.secondary,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
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
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  statusRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotLive: {
    backgroundColor: colors.success,
  },
  statusDotWarning: {
    backgroundColor: colors.warning,
  },
  statusRowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  statusRowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  monoValue: {
    fontFamily: 'monospace',
    fontSize: 11,
  },
  pingCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pingMeta: {
    flex: 1,
    marginRight: 12,
  },
  pingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  pingSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pingTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  pingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.cardHover,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  pingBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  resultBox: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: colors.cardBorder,
  },
  resultBoxSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  resultBoxError: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  resultText: {
    fontSize: 12,
    fontWeight: '500',
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  specLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  specValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
