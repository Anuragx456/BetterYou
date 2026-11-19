import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AVAILABLE_GEMINI_MODELS, GeminiModelOption } from '../../store/useSettingsStore';
import { useThemeColors } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';

export interface AiIntelligenceSectionProps {
  activeModelTitle: string;
  selectedModel: string;
  isCustomModel: boolean;
  customModelName: string;
  hasCustom: boolean;
  totalCalls: number;
  onSelectModel: (modelId: string) => void;
  onNavigateAiSettings: () => void;
  onNavigateApiUsage: () => void;
}

export const AiIntelligenceSection = React.memo(function AiIntelligenceSection({
  activeModelTitle,
  selectedModel,
  isCustomModel,
  customModelName,
  hasCustom,
  totalCalls,
  onSelectModel,
  onNavigateAiSettings,
  onNavigateApiUsage,
}: AiIntelligenceSectionProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]} allowFontScaling>
          AI & INTELLIGENCE
        </Text>
        <View style={styles.modelHeaderBadge}>
          <Ionicons name="sparkles" size={11} color={colors.primary} />
          <Text style={[styles.modelHeaderBadgeText, { color: colors.primary }]}>
            {activeModelTitle}
          </Text>
        </View>
      </View>

      {/* Direct Model Selection in Settings */}
      <View
        style={[
          styles.modelPickerCard,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <Text style={[styles.modelPickerSubtext, { color: colors.textSecondary }]}>
          Select active Gemini model for Meal Vision & Product Screening:
        </Text>
        <View style={styles.modelChipsGrid}>
          {AVAILABLE_GEMINI_MODELS.map((model: GeminiModelOption) => {
            const isSelected = !isCustomModel && selectedModel === model.id;
            return (
              <Pressable
                key={model.id}
                style={({ pressed }) => [
                  styles.modelChip,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.cardBorder,
                  },
                  isSelected && {
                    backgroundColor: colors.primaryMuted,
                    borderColor: colors.primary,
                  },
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  safeHaptics.selection();
                  onSelectModel(model.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Select ${model.name} for meal vision and product screening`}
              >
                <View style={styles.modelChipTop}>
                  <View
                    style={[
                      styles.modelRadio,
                      { borderColor: colors.textMuted },
                      isSelected && { borderColor: colors.primary },
                    ]}
                  >
                    {isSelected && (
                      <View
                        style={[
                          styles.modelRadioDot,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.modelChipTitle,
                      { color: colors.text },
                      isSelected && { color: colors.primary, fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                  >
                    {model.name}
                  </Text>
                </View>
                <View style={styles.modelChipMeta}>
                  <View style={[styles.modelBadgeWrap, { backgroundColor: colors.card }]}>
                    <Text style={[styles.modelChipBadge, { color: colors.textSecondary }]}>
                      {model.badge}
                    </Text>
                  </View>
                  <Text style={[styles.modelChipSpeed, { color: colors.textMuted }]}>
                    {model.speed}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {isCustomModel && customModelName ? (
          <View style={styles.customModelNotice}>
            <Ionicons name="code-slash" size={13} color={colors.primary} />
            <Text style={[styles.customModelNoticeText, { color: colors.primary }]}>
              Custom Model Active: {customModelName}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.cardGroup,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
          onPress={onNavigateAiSettings}
          accessibilityRole="button"
          accessibilityLabel="Configure Gemini API settings and model"
        >
          <View style={[styles.iconBadge, { backgroundColor: colors.softGreen }]}>
            <Ionicons name="hardware-chip-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.navRowMeta}>
            <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
              API Key & Custom Model (BYOK)
            </Text>
            <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
              {hasCustom ? 'Hardware-backed custom key active' : 'Managed Proxy (Google AI Studio)'}
            </Text>
          </View>
          <View style={styles.navRight}>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
          onPress={onNavigateApiUsage}
          accessibilityRole="button"
          accessibilityLabel="View detailed Gemini API usage and quota"
        >
          <View style={[styles.iconBadge, { backgroundColor: colors.softBlue }]}>
            <Ionicons name="speedometer-outline" size={18} color={colors.protein} />
          </View>
          <View style={styles.navRowMeta}>
            <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
              API Key Usage & Quota
            </Text>
            <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
              Scans, tokens, costs & rate limits
            </Text>
          </View>
          <View style={styles.navRight}>
            <View style={styles.valueBadge}>
              <Text style={[styles.valueBadgeText, { color: colors.protein }]} allowFontScaling>
                {totalCalls > 0 ? `${totalCalls} scans` : 'Free Tier'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  modelHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modelHeaderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modelPickerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  modelPickerSubtext: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  modelChipsGrid: {
    gap: 8,
  },
  modelChip: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  modelChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  modelRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modelChipTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  modelChipMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 28,
  },
  modelBadgeWrap: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modelChipBadge: {
    fontSize: 10,
    fontWeight: '600',
  },
  modelChipSpeed: {
    fontSize: 11,
  },
  customModelNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  customModelNoticeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRowMeta: {
    flex: 1,
  },
  navRowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  navRowSubtitle: {
    fontSize: 12,
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
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  valueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
