import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { SupportedLanguage } from '../../i18n';
import { useThemeColors } from '../../theme/theme';

export interface AppearanceSectionProps {
  colorScheme: 'light' | 'dark';
  onToggleColorScheme: (scheme: 'light' | 'dark') => void;
  currentLang: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
}

export const AppearanceSection = React.memo(function AppearanceSection({
  colorScheme,
  onToggleColorScheme,
  currentLang,
  onSelectLanguage,
}: AppearanceSectionProps) {
  const colors = useThemeColors();

  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]} allowFontScaling>
          APPEARANCE
        </Text>
        <View
          style={[
            styles.cardGroup,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.navRow}>
            <View style={[styles.iconBadge, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons
                name={colorScheme === 'dark' ? 'moon' : 'sunny-outline'}
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={styles.navRowMeta}>
              <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
                Dark mode
              </Text>
              <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
                Dim the dashboard, scans, and workouts
              </Text>
            </View>
            <Switch
              value={colorScheme === 'dark'}
              onValueChange={(enabled) => onToggleColorScheme(enabled ? 'dark' : 'light')}
              trackColor={{ false: colors.hairline, true: colors.primary }}
              thumbColor={colors.white}
              accessibilityLabel="Dark mode"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]} allowFontScaling>
          LANGUAGE / भाषा
        </Text>
        <View style={styles.langRow}>
          <Pressable
            style={({ pressed }) => [
              styles.langBtn,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              currentLang === 'en' && { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
              pressed && styles.pressed,
            ]}
            onPress={() => onSelectLanguage('en')}
            accessibilityRole="button"
            accessibilityLabel="Select English language"
          >
            <Text
              style={[
                styles.langBtnText,
                { color: currentLang === 'en' ? colors.primary : colors.textSecondary },
              ]}
              allowFontScaling
            >
              English
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.langBtn,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              currentLang === 'hi' && { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
              pressed && styles.pressed,
            ]}
            onPress={() => onSelectLanguage('hi')}
            accessibilityRole="button"
            accessibilityLabel="हिंदी भाषा चुनें"
          >
            <Text
              style={[
                styles.langBtnText,
                { color: currentLang === 'hi' ? colors.primary : colors.textSecondary },
              ]}
              allowFontScaling
            >
              हिंदी (Hindi)
            </Text>
          </Pressable>
        </View>
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
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 48,
  },
  langBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});
