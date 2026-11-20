import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AVAILABLE_GEMINI_MODELS,
  type GeminiModelOption,
} from '../../store/useSettingsStore';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';

interface ModelPickerCardProps {
  activeModelTitle: string;
  selectedModel: string;
  isCustomModel: boolean;
  customModelInput: string;
  setCustomModelInput: (text: string) => void;
  customModelName: string;
  onSelectModel: (model: GeminiModelOption) => void;
  onApplyCustomModel: () => void;
}

export function ModelPickerCard({
  activeModelTitle,
  selectedModel,
  isCustomModel,
  customModelInput,
  setCustomModelInput,
  customModelName,
  onSelectModel,
  onApplyCustomModel,
}: ModelPickerCardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
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
              onPress={() => onSelectModel(model)}
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

              {isSelected ? (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              ) : null}
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
              onPress={onApplyCustomModel}
            >
              <Text style={styles.applyBtnText}>Apply</Text>
            </Pressable>
          </View>
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
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    sectionHeader: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    activeModelSubtext: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    cardGroup: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: 'hidden',
    },
    modelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    modelRowActive: {
      backgroundColor: colors.cardHover,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    radioContainer: {
      alignItems: 'center',
      justifyContent: 'center',
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
      width: 8,
      height: 8,
      borderRadius: 4,
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
      fontWeight: '700',
      color: colors.text,
    },
    modelNameActive: {
      color: colors.primary,
    },
    tagPill: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    tagText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
    },
    modelId: {
      fontSize: 11,
      color: colors.textSecondary,
      fontFamily: 'monospace',
      marginTop: 2,
    },
    topDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    customModelRow: {
      padding: 14,
      gap: 10,
    },
    customModelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    customInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    customModelInput: {
      flex: 1,
      backgroundColor: colors.cardHover,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      fontFamily: 'monospace',
      color: colors.text,
    },
    applyBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    applyBtnDisabled: {
      opacity: 0.5,
    },
    applyBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textInverse,
    },
  });
}
