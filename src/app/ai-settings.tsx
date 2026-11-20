import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiKeyManagementCard } from '../components/settings/ApiKeyManagementCard';
import { ApiUsageNavCard } from '../components/settings/ApiUsageNavCard';
import { ModelPickerCard } from '../components/settings/ModelPickerCard';
import {
  GeminiModelOption,
  getActiveModelDisplayName,
  isUsingCustomKey,
  useSettingsStore,
  validateGeminiApiKey,
} from '../store/useSettingsStore';
import type { ThemeColors } from '../theme/colors';
import { useThemeColors, useThemedStyles } from '../theme/theme';
import { safeHaptics } from '../utils/haptics';

const GOOGLE_AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';

export default function AiSettingsScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
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
  }, [colors.card, colors.primary]);

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
      safeHaptics.selection();
      setSelectedModel(model.id);
      setIsCustomModel(false);
    },
    [setSelectedModel, setIsCustomModel]
  );

  const handleApplyCustomModel = useCallback(() => {
    Keyboard.dismiss();
    const cleaned = customModelInput.trim();
    if (!cleaned) {
      safeHaptics.warning();
      Alert.alert('Model Required', 'Please enter a valid model identifier.');
      return;
    }
    safeHaptics.success();
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
        <ApiKeyManagementCard
          inputKey={inputKey}
          setInputKey={setInputKey}
          showKey={showKey}
          setShowKey={setShowKey}
          isValidating={isValidating}
          validationResult={validationResult}
          setValidationResult={setValidationResult}
          hasCustom={hasCustom}
          maskedKeyPreview={maskedKeyPreview}
          onSaveAndValidate={handleSaveAndValidateKey}
          onClearCustomKey={handleClearCustomKey}
          onPasteKey={handlePasteKey}
          onOpenAiStudio={handleOpenAiStudio}
        />

        {/* Navigation Card to Detailed Usage & Quota */}
        <ApiUsageNavCard />

        {/* Section: Gemini Model */}
        <ModelPickerCard
          activeModelTitle={activeModelTitle}
          selectedModel={selectedModel}
          isCustomModel={isCustomModel}
          customModelInput={customModelInput}
          setCustomModelInput={setCustomModelInput}
          customModelName={customModelName}
          onSelectModel={handleSelectModel}
          onApplyCustomModel={handleApplyCustomModel}
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
      color: colors.text,
    },
  });
}
