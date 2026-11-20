import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVoiceRecording } from '../hooks/useVoiceRecording';
import { analyzeMealText, analyzeProductText } from '../services/aiVisionService';
import type { ThemeColors } from '../theme/colors';
import { useThemeColors, useThemedStyles } from '../theme/theme';
import { MealAnalysisResult, ToxicityReport } from '../types';
import { safeHaptics } from '../utils/haptics';
import { VoicePromptSuggestions } from './voice/VoicePromptSuggestions';
import { VoiceWaveformVisualizer } from './voice/VoiceWaveformVisualizer';

interface VoiceInputModalProps {
  visible: boolean;
  mode: 'meal' | 'product';
  onClose: () => void;
  onSubmitMealResult?: (result: MealAnalysisResult) => void;
  onSubmitProductResult?: (report: ToxicityReport) => void;
}

export function VoiceInputModal({
  visible,
  mode,
  onClose,
  onSubmitMealResult,
  onSubmitProductResult,
}: VoiceInputModalProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const {
    transcript,
    setTranscript,
    isListening,
    statusMessage,
    setStatusMessage,
    isSpeechAvailable,
    toggleListening,
    stopActiveListening,
    resetRecording,
  } = useVoiceRecording();

  const handleModalClose = useCallback(() => {
    resetRecording();
    onClose();
  }, [resetRecording, onClose]);

  // Submit to Gemini AI Analysis
  const handleSubmit = async () => {
    const textToAnalyze = transcript.trim();
    if (!textToAnalyze) {
      Alert.alert('Speech Required', 'Please speak or select a suggestion first.');
      return;
    }

    await stopActiveListening();
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
            <VoiceWaveformVisualizer
              isListening={isListening}
              statusMessage={statusMessage}
              onToggleListening={toggleListening}
            />

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
            <VoicePromptSuggestions
              isMeal={isMeal}
              onSelectPrompt={(prompt) => {
                setTranscript(prompt);
                setStatusMessage(`Selected "${prompt}"`);
              }}
            />

            {!isSpeechAvailable ? (
              <View style={styles.noticeBanner}>
                <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                <Text style={styles.noticeText}>
                  Speech recognition requires a connected microphone or device speech service. You can also type or use quick suggestions above.
                </Text>
              </View>
            ) : null}

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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitleCol: {
      alignItems: 'center',
    },
    headerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 2,
    },
    headerBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 40,
    },
    transcriptCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
      marginTop: 8,
    },
    transcriptHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
      color: colors.primary,
    },
    transcriptInput: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      minHeight: 76,
      lineHeight: 24,
      padding: 0,
    },
    transcriptHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 8,
    },
    noticeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.softOrange,
      borderWidth: 1,
      borderColor: colors.softOrangeBorder,
      borderRadius: 12,
      padding: 12,
      marginTop: 16,
    },
    noticeText: {
      fontSize: 12,
      color: colors.softOrangeText,
      flex: 1,
      lineHeight: 16,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
    },
    submitBtnDisabled: {
      opacity: 0.5,
    },
    submitBtnInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    submitBtnText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
