import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';

interface ApiKeyManagementCardProps {
  inputKey: string;
  setInputKey: (text: string) => void;
  showKey: boolean;
  setShowKey: (show: boolean) => void;
  isValidating: boolean;
  validationResult: { type: 'success' | 'error' | null; message: string };
  setValidationResult: (res: { type: 'success' | 'error' | null; message: string }) => void;
  hasCustom: boolean;
  maskedKeyPreview: string;
  onSaveAndValidate: () => void;
  onClearCustomKey: () => void;
  onPasteKey: () => void;
  onOpenAiStudio: () => void;
}

export function ApiKeyManagementCard({
  inputKey,
  setInputKey,
  showKey,
  setShowKey,
  isValidating,
  validationResult,
  setValidationResult,
  hasCustom,
  maskedKeyPreview,
  onSaveAndValidate,
  onClearCustomKey,
  onPasteKey,
  onOpenAiStudio,
}: ApiKeyManagementCardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
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
            onPress={onPasteKey}
            hitSlop={8}
            style={styles.pasteBadge}
          >
            <Text style={styles.pasteBadgeText}>Paste</Text>
          </Pressable>
        </View>

        {/* Validation Message */}
        {validationResult.type ? (
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
        ) : null}

        {/* Actions Row */}
        <View style={styles.cardActionRow}>
          <Pressable
            style={[styles.saveBtn, isValidating && styles.btnDisabled]}
            onPress={onSaveAndValidate}
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

          {hasCustom ? (
            <Pressable
              style={styles.clearBtn}
              onPress={onClearCustomKey}
              hitSlop={8}
            >
              <Text style={styles.clearBtnText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Active Key Info & AI Studio Link */}
        <View style={styles.cardFooterDivider} />
        <View style={styles.cardFooterRow}>
          <Text style={styles.footerInfoText}>
            Active: <Text style={styles.footerInfoMono}>{maskedKeyPreview}</Text>
          </Text>
          <Pressable onPress={onOpenAiStudio} hitSlop={8} style={styles.aiStudioLink}>
            <Text style={styles.aiStudioLinkText}>Google AI Studio</Text>
            <Ionicons
              name="arrow-up-outline"
              size={12}
              color={colors.primary}
              style={{ transform: [{ rotate: '45deg' }] }}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      padding: 16,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardHover,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    keyInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontFamily: 'monospace',
      padding: 0,
    },
    inputActionBtn: {
      padding: 4,
    },
    pasteBadge: {
      backgroundColor: colors.card,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    pasteBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    messageBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 10,
      padding: 10,
      marginTop: 12,
    },
    messageSuccess: {
      backgroundColor: colors.softGreen,
      borderWidth: 1,
      borderColor: colors.softGreenBorder,
    },
    messageError: {
      backgroundColor: colors.fatMuted,
      borderWidth: 1,
      borderColor: colors.danger + '30',
    },
    messageText: {
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    cardActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 14,
    },
    saveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
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
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.cardHover,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    clearBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.danger,
    },
    cardFooterDivider: {
      height: 1,
      backgroundColor: colors.cardBorder,
      marginVertical: 14,
    },
    cardFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footerInfoText: {
      fontSize: 11,
      color: colors.textSecondary,
      flex: 1,
      marginRight: 8,
    },
    footerInfoMono: {
      fontFamily: 'monospace',
      fontWeight: '600',
      color: colors.text,
    },
    aiStudioLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    aiStudioLinkText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
  });
}
