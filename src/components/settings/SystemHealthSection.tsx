import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/theme';

export interface SystemHealthSectionProps {
  activeModelTitle: string;
  onNavigateOnboarding: () => void;
  onNavigateDiagnostics: () => void;
  onResetSettings: () => void;
}

export const SystemHealthSection = React.memo(function SystemHealthSection({
  activeModelTitle,
  onNavigateOnboarding,
  onNavigateDiagnostics,
  onResetSettings,
}: SystemHealthSectionProps) {
  const colors = useThemeColors();

  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]} allowFontScaling>
          SYSTEM HEALTH
        </Text>
        <View
          style={[
            styles.cardGroup,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
            onPress={onNavigateOnboarding}
            accessibilityRole="button"
            accessibilityLabel="View app introduction tour and onboarding walkthrough"
          >
            <View style={[styles.iconBadge, { backgroundColor: colors.softGreen }]}>
              <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.navRowMeta}>
              <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
                App Tour & Onboarding
              </Text>
              <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
                Feature walkthrough and setup guide
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: colors.cardBorder }]} />

          <Pressable
            style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
            onPress={onNavigateDiagnostics}
            accessibilityRole="button"
            accessibilityLabel="Open diagnostics and system health screen"
          >
            <View style={[styles.iconBadge, { backgroundColor: colors.softBlue }]}>
              <Ionicons name="pulse" size={18} color={colors.secondary} />
            </View>
            <View style={styles.navRowMeta}>
              <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
                Diagnostics
              </Text>
              <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
                API latency test & connection ping
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Section: Reset */}
      <View style={styles.section}>
        <Pressable
          style={({ pressed }) => [
            styles.resetBtn,
            { borderColor: colors.danger, backgroundColor: colors.card },
            pressed && styles.pressed,
          ]}
          onPress={onResetSettings}
          accessibilityRole="button"
          accessibilityLabel="Reset all settings to defaults"
        >
          <Ionicons name="refresh-outline" size={16} color={colors.danger} />
          <Text style={[styles.resetBtnText, { color: colors.danger }]} allowFontScaling>
            Reset to Default Settings
          </Text>
        </Pressable>
      </View>

      {/* Footer */}
      <View style={styles.footerContainer}>
        <Text style={[styles.footerVersion, { color: colors.textMuted }]} allowFontScaling>
          BetterYou v1.0.0 • Obsidian Theme
        </Text>
        <Text style={[styles.footerSub, { color: colors.textMuted }]} allowFontScaling>
          Powered by {activeModelTitle}
        </Text>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    gap: 12,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRowMeta: {
    flex: 1,
  },
  navRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  navRowSubtitle: {
    fontSize: 12,
  },
  rowDivider: {
    height: 1,
    marginLeft: 62,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    gap: 4,
  },
  footerVersion: {
    fontSize: 12,
    fontWeight: '500',
  },
  footerSub: {
    fontSize: 11,
  },
  pressed: {
    opacity: 0.8,
  },
});
