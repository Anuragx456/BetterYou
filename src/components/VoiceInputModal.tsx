import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyzeMealText, analyzeProductText } from '../services/aiVisionService';
import {
  abortSpeechRecognition,
  isSpeechRecognitionSupported,
  startSpeechRecognition,
  stopSpeechRecognition,
} from '../services/speechService';
import { colors } from '../theme/colors';
import { MealAnalysisResult, ToxicityReport } from '../types';
import { safeHaptics } from '../utils/haptics';

interface VoiceInputModalProps {
  visible: boolean;
  mode: 'meal' | 'product';
  onClose: () => void;
  onSubmitMealResult?: (result: MealAnalysisResult) => void;
  onSubmitProductResult?: (report: ToxicityReport) => void;
}

const QUICK_MEAL_PROMPTS = [
  '2 Paneer Parathas with Curd',
  '1 Bowl Chicken Biryani & Salad',
  'Masala Dosa with Sambar & Coconut Chutney',
  '3 Boiled Eggs & Whole Wheat Toast',
  'Dal Tadka, 2 Phulkas & Jeera Rice',
  'Whey Protein Shake with Peanut Butter',
  'Oatmeal with Almonds & Banana',
];

const QUICK_PRODUCT_PROMPTS = [
  'Bajaj Almond Drops Hair Oil',
  'Maggi 2-Minute Masala Noodles',
  'Dettol Original Bath Soap',
  'Good Knight Mosquito Vaporizer',
  'Colgate Strong Teeth Toothpaste',
  'Lizol Citrus Disinfectant Floor Cleaner',
  'Patanjali Dant Kanti Toothpaste',
  'Kurkure Masala Munch',
  "Johnson's Baby Powder",
];

// Reanimated Waveform Bar Component
function WaveformBar({ isListening, delay, minHeight, maxHeight }: {
  isListening: boolean;
  delay: number;
  minHeight: number;
  maxHeight: number;
}) {
  const heightAnim = useSharedValue(minHeight);

  useEffect(() => {
    if (isListening) {
      heightAnim.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(maxHeight, { duration: 320, easing: Easing.inOut(Easing.ease) }),
            withTiming(minHeight, { duration: 320, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
    } else {
      heightAnim.value = withTiming(minHeight, { duration: 250 });
    }
  }, [isListening, delay, minHeight, maxHeight, heightAnim]);

  const barStyle = useAnimatedStyle(() => ({
    height: heightAnim.value,
  }));

  return <Animated.View style={[styles.waveBar, barStyle]} />;
}

export function VoiceInputModal({
  visible,
  mode,
  onClose,
  onSubmitMealResult,
  onSubmitProductResult,
}: VoiceInputModalProps) {
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Tap the microphone to speak');
  const [isSpeechAvailable, setIsSpeechAvailable] = useState<boolean>(true);

  const cleanupRef = useRef<(() => void) | null>(null);

  // Animated pulse rings for the microphone
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    if (isListening) {
      pulseScale.value = withRepeat(
        withTiming(1.35, { duration: 1100, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 400 }),
          withTiming(0, { duration: 700 })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isListening, pulseScale, pulseOpacity]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Check speech availability on mount
  useEffect(() => {
    let mounted = true;
    isSpeechRecognitionSupported().then((supported) => {
      if (mounted) {
        setIsSpeechAvailable(supported);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Cleanup on unmount or modal close
  const handleModalClose = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    abortSpeechRecognition().catch(() => {});
    setIsListening(false);
    setTranscript('');
    setStatusMessage('Tap the microphone to speak');
    onClose();
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      stopSpeechRecognition().catch(() => {});
    };
  }, []);

  // Toggle Microphone
  const handleToggleListening = async () => {
    safeHaptics.impactMedium();

    if (isListening) {
      // Stop listening
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      await stopSpeechRecognition();
      setIsListening(false);
      setStatusMessage('Listening paused. Review or submit below.');
      return;
    }

    // Start listening
    setIsListening(true);
    setStatusMessage('Listening... Speak now');

    try {
      const stopFn = await startSpeechRecognition({
        onStart: () => {
          setIsListening(true);
          setStatusMessage('Listening... Speak clearly');
        },
        onResult: (spokenText) => {
          if (spokenText) {
            setTranscript(spokenText);
            setStatusMessage('Speech captured! Tap microphone to finish.');
          }
        },
        onError: (err) => {
          setIsListening(false);
          setStatusMessage(`Speech error: ${err}`);
        },
        onEnd: () => {
          setIsListening(false);
          setStatusMessage('Speech finished. Review or edit below.');
        },
      });

      cleanupRef.current = stopFn;
    } catch (err: unknown) {
      setIsListening(false);
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Speech unavailable: ${msg}`);
    }
  };

  // Submit to Gemini AI Analysis
  const handleSubmit = async () => {
    const textToAnalyze = transcript.trim();
    if (!textToAnalyze) {
      Alert.alert('Speech Required', 'Please speak or select a suggestion first.');
      return;
    }

    if (isListening) {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      await stopSpeechRecognition();
      setIsListening(false);
    }

    setIsAnalyzing(true);
    safeHaptics.impactLight();

    try {
      if (mode === 'meal') {
        const result = await analyzeMealText(textToAnalyze);
        safeHaptics.success();
        if (onSubmitMealResult) {
          onSubmitMealResult(result);
        }
        handleModalClose();
      } else {
        const report = await analyzeProductText(textToAnalyze);
        safeHaptics.success();
        if (onSubmitProductResult) {
          onSubmitProductResult(report);
        }
        handleModalClose();
      }
    } catch (err: unknown) {
      safeHaptics.error();
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(
        mode === 'meal' ? 'Meal Analysis Failed' : 'Product Screening Failed',
        msg
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isMeal = mode === 'meal';
  const prompts = isMeal ? QUICK_MEAL_PROMPTS : QUICK_PRODUCT_PROMPTS;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleModalClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={handleModalClose}
              accessibilityRole="button"
              accessibilityLabel="Close voice modal"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>

            <View style={styles.headerTitleCol}>
              <View style={styles.headerBadge}>
                <Ionicons
                  name={isMeal ? 'restaurant' : 'shield-checkmark'}
                  size={12}
                  color={colors.primary}
                />
                <Text style={styles.headerBadgeText}>
                  {isMeal ? 'Meals AI Voice' : 'Screening Voice'}
                </Text>
              </View>
              <Text style={styles.headerTitle}>
                {isMeal ? 'Speak Your Meal' : 'Speak Product'}
              </Text>
            </View>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Visualizer & Mic Section */}
            <View style={styles.visualizerContainer}>
              {/* Concentric Pulse Ring */}
              <Animated.View style={[styles.pulseRing, pulseRingStyle]} />

              {/* Main Glowing Mic Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.micButton,
                  isListening && styles.micButtonListening,
                  pressed && styles.pressed,
                ]}
                onPress={handleToggleListening}
                accessibilityRole="button"
                accessibilityLabel={isListening ? 'Stop listening' : 'Start listening'}
              >
                <Ionicons
                  name={isListening ? 'mic' : 'mic-outline'}
                  size={36}
                  color={isListening ? colors.textInverse : colors.primary}
                />
              </Pressable>

              {/* Waveform Bars */}
              <View style={styles.waveformContainer}>
                <WaveformBar isListening={isListening} delay={0} minHeight={6} maxHeight={28} />
                <WaveformBar isListening={isListening} delay={70} minHeight={8} maxHeight={36} />
                <WaveformBar isListening={isListening} delay={140} minHeight={10} maxHeight={44} />
                <WaveformBar isListening={isListening} delay={210} minHeight={8} maxHeight={34} />
                <WaveformBar isListening={isListening} delay={280} minHeight={6} maxHeight={26} />
              </View>

              {/* Status Pill */}
              <View
                style={[
                  styles.statusPill,
                  isListening && styles.statusPillActive,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    isListening && styles.statusDotActive,
                  ]}
                />
                <Text style={styles.statusText}>{statusMessage}</Text>
              </View>
            </View>

            {/* Spoken Transcript Input Card */}
            <View style={styles.transcriptCard}>
              <View style={styles.transcriptHeaderRow}>
                <Text style={styles.transcriptLabel}>Spoken Transcript</Text>
                {transcript.length > 0 && (
                  <Pressable
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => {
                      safeHaptics.selection();
                      setTranscript('');
                      setStatusMessage('Transcript cleared. Tap mic to speak again.');
                    }}
                  >
                    <Text style={styles.clearLinkText}>Clear</Text>
                  </Pressable>
                )}
              </View>

              <TextInput
                style={styles.transcriptInput}
                placeholder={
                  isMeal
                    ? 'e.g., 2 paneer parathas with a cup of curd and cucumber salad'
                    : 'e.g., Dabur Red Toothpaste, Bajaj Almond Drops Hair Oil'
                }
                placeholderTextColor={colors.textSecondary}
                value={transcript}
                onChangeText={setTranscript}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!isAnalyzing}
              />
              <Text style={styles.transcriptHint}>
                {transcript.length > 0
                  ? 'Tap text to edit if speech recognition made a typo'
                  : 'Speak into your microphone or tap any quick suggestion below'}
              </Text>
            </View>

            {/* Quick Suggestions Carousel */}
            <View style={styles.suggestionsContainer}>
              <View style={styles.suggestionsHeaderRow}>
                <Text style={styles.suggestionsTitle}>
                  {isMeal ? 'Quick Meal Examples' : 'Popular Indian Products'}
                </Text>
                <Text style={styles.suggestionsSubtitle}>Tap to insert</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScrollRow}
              >
                {prompts.map((prompt, idx) => (
                  <Pressable
                    key={idx}
                    style={({ pressed }) => [styles.chipBtn, pressed && styles.pressed]}
                    onPress={() => {
                      safeHaptics.selection();
                      setTranscript(prompt);
                      setStatusMessage(`Selected "${prompt}"`);
                    }}
                  >
                    <Ionicons
                      name={isMeal ? 'fast-food-outline' : 'barcode-outline'}
                      size={13}
                      color={colors.primary}
                    />
                    <Text style={styles.chipText} numberOfLines={1}>
                      {prompt}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {!isSpeechAvailable && (
              <View style={styles.noticeBanner}>
                <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                <Text style={styles.noticeText}>
                  Speech recognition requires a connected microphone or device speech service. You can also type or use quick suggestions above.
                </Text>
              </View>
            )}

            {/* Submit Action Button */}
            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                (!transcript.trim() || isAnalyzing) && styles.submitBtnDisabled,
                pressed && styles.pressed,
              ]}
              disabled={!transcript.trim() || isAnalyzing}
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel={isMeal ? 'Analyze spoken meal' : 'Screen spoken product'}
            >
              {isAnalyzing ? (
                <View style={styles.submitBtnInner}>
                  <ActivityIndicator size="small" color={colors.textInverse} />
                  <Text style={styles.submitBtnText}>Analyzing with Gemini AI...</Text>
                </View>
              ) : (
                <View style={styles.submitBtnInner}>
                  <Ionicons name="sparkles" size={18} color={colors.textInverse} />
                  <Text style={styles.submitBtnText}>
                    {isMeal ? 'Analyze Spoken Meal' : 'Screen Spoken Product'}
                  </Text>
                </View>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerTitleCol: {
    alignItems: 'center',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  visualizerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    position: 'relative',
    height: 180,
  },
  pulseRing: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.primary,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.cardElevated,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  micButtonListening: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    marginTop: 16,
  },
  waveBar: {
    width: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: 8,
  },
  statusPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
  },
  statusDotActive: {
    backgroundColor: colors.primary,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  transcriptCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: 12,
  },
  transcriptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger ?? '#EF4444',
  },
  transcriptInput: {
    color: colors.text,
    fontSize: 15,
    minHeight: 70,
    lineHeight: 22,
    padding: 0,
  },
  transcriptHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    paddingTop: 8,
  },
  suggestionsContainer: {
    marginTop: 20,
  },
  suggestionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  suggestionsSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  chipsScrollRow: {
    gap: 8,
    paddingRight: 8,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  noticeText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textInverse,
  },
  pressed: {
    opacity: 0.75,
  },
});
