import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AVAILABLE_GEMINI_MODELS,
  GeminiModelOption,
  getActiveModelDisplayName,
  isUsingCustomKey,
  useSettingsStore,
  validateGeminiApiKey,
} from '../store/useSettingsStore';
import { colors } from '../theme/colors';

const GOOGLE_AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';

export default function AiSettingsScreen() {
  const router = useRouter();

  const customApiKey = useSettingsStore((state) => state.customApiKey);
  const selectedModel = useSettingsStore((state) => state.selectedModel);
  const isCustomModel = useSettingsStore((state) => state.isCustomModel);
  const customModelName = useSettingsStore((state) => state.customModelName);
  const setCustomApiKey = useSettingsStore((state) => state.setCustomApiKey);
  const clearCustomApiKey = useSettingsStore((state) => state.clearCustomApiKey);
  const setSelectedModel = useSettingsStore((state) => state.setSelectedModel);
  const setIsCustomModel = useSettingsStore((state) => state.setIsCustomModel);
  const setCustomModelName = useSettingsStore((state) => state.setCustomModelName);

  const [inputKey, setInputKey] = useState<string>(customApiKey);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const [customModelInput, setCustomModelInput] = useState<string>(customModelName);

  const activeModelTitle = getActiveModelDisplayName();
  const hasCustom = isUsingCustomKey();

  const maskedKeyPreview = useMemo(() => {
    if (!customApiKey) return 'Using Managed Proxy (No custom key configured)';
    if (customApiKey.length <= 8) return '•••••••• (Encrypted in Keystore)';
    return `${customApiKey.slice(0, 6)}••••••••${customApiKey.slice(-4)} (Encrypted in Keystore)`;
  }, [customApiKey]);

  const handleOpenAiStudio = useCallback(async () => {
    try {
      await WebBrowser.openBrowserAsync(GOOGLE_AI_STUDIO_URL, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: colors.card,
        controlsColor: colors.primary,
      });
    } catch {
      Linking.openURL(GOOGLE_AI_STUDIO_URL).catch(() => {
        Alert.alert('Unable to open link', `Please navigate to: ${GOOGLE_AI_STUDIO_URL}`);
      });
    }
  }, []);

  const handlePasteKey = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim().length > 0) {
        const cleaned = text.trim();
        setInputKey(cleaned);
        setValidationResult({ type: null, message: '' });
      } else {
        Alert.alert('Clipboard Empty', 'Your clipboard does not contain any text.');
      }
    } catch {
      Alert.alert('Error', 'Unable to read from clipboard.');
    }
  }, []);

  const handleSaveAndValidateKey = useCallback(async () => {
    Keyboard.dismiss();
    const keyToTest = inputKey.trim();

    if (!keyToTest) {
      Alert.alert('Empty Key', 'Please enter or paste your Gemini API key.');
      return;
    }

    setIsValidating(true);
    setValidationResult({ type: null, message: '' });

    try {
      const res = await validateGeminiApiKey(keyToTest);
      if (res.isValid) {
        setCustomApiKey(keyToTest);
        setValidationResult({
          type: 'success',
          message: `Verified! ${res.modelCount ?? 0} Gemini models accessible.`,
        });
      } else {
        setValidationResult({
          type: 'error',
          message: res.message || 'Verification failed. Please check the API key.',
        });
      }
    } catch (err: unknown) {
      setValidationResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to connect to Google AI Studio.',
      });
    } finally {
      setIsValidating(false);
    }
  }, [inputKey, setCustomApiKey]);

  const handleClearCustomKey = useCallback(() => {
    Alert.alert(
      'Remove Custom Key',
      'Revert to default environment key or demo mode?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            clearCustomApiKey();
            setInputKey('');
            setValidationResult({ type: null, message: '' });
          },
        },
      ]
    );
  }, [clearCustomApiKey]);

  const handleSelectModel = useCallback(
    (model: GeminiModelOption) => {
      setSelectedModel(model.id);
      setIsCustomModel(false);
    },
    [setSelectedModel, setIsCustomModel]
  );

  const handleApplyCustomModel = useCallback(() => {
    Keyboard.dismiss();
    const cleaned = customModelInput.trim();
    if (!cleaned) {
      Alert.alert('Model Required', 'Please enter a valid model identifier.');
      return;
    }
    setCustomModelName(cleaned);
    setIsCustomModel(true);
  }, [customModelInput, setCustomModelName, setIsCustomModel]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
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
            <Text style={styles.screenTitle}>AI Settings</Text>
            <Text style={styles.screenTag}>GOOGLE GEMINI & MODEL SELECTION</Text>
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
            <Text style={styles.statusPillText}>
              {hasCustom ? 'BYOK Mode' : 'Proxy Mode'}
            </Text>
          </View>
        </View>

        {/* Section: API Key */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GEMINI API KEY</Text>
          <View style={styles.cardGroup}>
            {/* Input Row */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.keyInput}
                value={inputKey}
                onChangeText={(text) => {
                  setInputKey(text);
                  setValidationResult({ type: null, message: '' });
                }}
                placeholder="AQ... or AIzaSy..."
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={colors.primary}
              />
              <Pressable
                onPress={() => setShowKey(!showKey)}
                hitSlop={8}
                style={styles.inputActionBtn}
              >
                <Ionicons
                  name={showKey ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
              <Pressable
                onPress={handlePasteKey}
                hitSlop={8}
                style={styles.pasteBadge}
              >
                <Text style={styles.pasteBadgeText}>Paste</Text>
              </Pressable>
            </View>

            {/* Validation Message */}
            {validationResult.type && (
              <View
                style={[
                  styles.messageBanner,
                  validationResult.type === 'success'
                    ? styles.messageSuccess
                    : styles.messageError,
                ]}
              >
                <Ionicons
                  name={
                    validationResult.type === 'success'
                      ? 'checkmark-circle-outline'
                      : 'alert-circle-outline'
                  }
                  size={16}
                  color={
                    validationResult.type === 'success' ? colors.success : colors.danger
                  }
                />
                <Text
                  style={[
                    styles.messageText,
                    {
                      color:
                        validationResult.type === 'success'
                          ? colors.success
                          : colors.danger,
                    },
                  ]}
                >
                  {validationResult.message}
                </Text>
              </View>
            )}

            {/* Actions Row */}
            <View style={styles.cardActionRow}>
              <Pressable
                style={[styles.saveBtn, isValidating && styles.btnDisabled]}
                onPress={handleSaveAndValidateKey}
                disabled={isValidating}
              >
                {isValidating ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.textInverse} />
                    <Text style={styles.saveBtnText}>Save & Verify Key</Text>
                  </>
                )}
              </Pressable>

              {hasCustom && (
                <Pressable
                  style={styles.clearBtn}
                  onPress={handleClearCustomKey}
                  hitSlop={8}
                >
                  <Text style={styles.clearBtnText}>Remove</Text>
                </Pressable>
              )}
            </View>

            {/* Active Key Info & AI Studio Link */}
            <View style={styles.cardFooterDivider} />
            <View style={styles.cardFooterRow}>
              <Text style={styles.footerInfoText}>
                Active: <Text style={styles.footerInfoMono}>{maskedKeyPreview}</Text>
              </Text>
              <Pressable onPress={handleOpenAiStudio} hitSlop={8} style={styles.aiStudioLink}>
                <Text style={styles.aiStudioLinkText}>Google AI Studio</Text>
                <Ionicons name="arrow-up-outline" size={12} color={colors.primary} style={{ transform: [{ rotate: '45deg' }] }} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Navigation Card to Detailed Usage & Quota */}
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.usageNavCard, pressed && styles.pressed]}
            onPress={() => router.push('/api-usage')}
            accessibilityRole="button"
            accessibilityLabel="View detailed Gemini API usage and token metrics"
          >
            <View style={styles.usageNavCardLeft}>
              <View style={styles.usageNavIconCircle}>
                <Ionicons name="speedometer-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.usageNavMeta}>
                <Text style={styles.usageNavTitle}>Detailed API Usage & Quota</Text>
                <Text style={styles.usageNavSubtitle}>
                  View scans, token consumption, and rate limits
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Section: Gemini Model */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>ACTIVE MODEL</Text>
            <Text style={styles.activeModelSubtext}>{activeModelTitle}</Text>
          </View>
          <View style={styles.cardGroup}>
            {AVAILABLE_GEMINI_MODELS.map((model, index) => {
              const isSelected = !isCustomModel && selectedModel === model.id;
              const isLast = index === AVAILABLE_GEMINI_MODELS.length - 1;

              return (
                <Pressable
                  key={model.id}
                  style={[
                    styles.modelRow,
                    isSelected && styles.modelRowActive,
                    !isLast && styles.rowDivider,
                  ]}
                  onPress={() => handleSelectModel(model)}
                >
                  <View style={styles.radioContainer}>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </View>

                  <View style={styles.modelMeta}>
                    <View style={styles.modelTitleRow}>
                      <Text style={[styles.modelName, isSelected && styles.modelNameActive]}>
                        {model.name}
                      </Text>
                      {model.badge ? (
                        <View style={styles.tagPill}>
                          <Text style={styles.tagText}>{model.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.modelId}>{model.id}</Text>
                  </View>

                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}

            {/* Custom Model Row */}
            <View style={[styles.customModelRow, styles.topDivider]}>
              <View style={styles.customModelHeader}>
                <View style={styles.radioContainer}>
                  <View style={[styles.radioCircle, isCustomModel && styles.radioCircleActive]}>
                    {isCustomModel && <View style={styles.radioDot} />}
                  </View>
                </View>
                <Text style={[styles.modelName, isCustomModel && styles.modelNameActive]}>
                  Custom Model
                </Text>
              </View>

              <View style={styles.customInputRow}>
                <TextInput
                  style={styles.customModelInput}
                  value={customModelInput}
                  onChangeText={setCustomModelInput}
                  placeholder="e.g. gemini-3.5-flash"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor={colors.primary}
                />
                <Pressable
                  style={[
                    styles.applyBtn,
                    (!customModelInput.trim() ||
                      (isCustomModel && customModelInput.trim() === customModelName.trim())) &&
                      styles.applyBtnDisabled,
                  ]}
                  onPress={handleApplyCustomModel}
                >
                  <Text style={styles.applyBtnText}>Apply</Text>
                </Pressable>
              </View>
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
    color: colors.primary,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
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
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  activeModelSubtext: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.primary,
    marginBottom: 8,
  },
  cardGroup: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  keyInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: colors.text,
    padding: 0,
  },
  inputActionBtn: {
    paddingHorizontal: 8,
  },
  pasteBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.cardHover,
    marginLeft: 4,
  },
  pasteBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: colors.cardBorder,
  },
  messageSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  messageError: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  messageText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
    gap: 12,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 11,
    borderRadius: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
  },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
  cardFooterDivider: {
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceSubtle,
  },
  footerInfoText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  footerInfoMono: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: colors.textSecondary,
  },
  aiStudioLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  aiStudioLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  modelRowActive: {
    backgroundColor: colors.cardHover,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  topDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  radioContainer: {
    marginRight: 12,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
  },
  modelMeta: {
    flex: 1,
  },
  modelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modelName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  modelNameActive: {
    color: colors.primary,
  },
  modelId: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: colors.textMuted,
    marginTop: 2,
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.cardHover,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  customModelRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  customModelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 30,
  },
  customModelInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 10,
    backgroundColor: colors.cardHover,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  applyBtn: {
    height: 36,
    paddingHorizontal: 14,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnDisabled: {
    opacity: 0.4,
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textInverse,
  },
  usageNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  usageNavCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  usageNavIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageNavMeta: {
    flex: 1,
  },
  usageNavTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  usageNavSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
