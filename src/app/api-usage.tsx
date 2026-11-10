import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GeminiUsageSection } from '../components/GeminiUsageSection';
import { isUsingCustomKey } from '../store/useSettingsStore';
import { colors } from '../theme/colors';

export default function ApiUsageScreen() {
  const router = useRouter();
  const hasCustom = isUsingCustomKey();

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
            accessibilityRole="button"
            accessibilityLabel="Go back to settings"
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>

          <View style={styles.headerTitleCol}>
            <Text style={styles.screenTitle} allowFontScaling>
              API Key Usage
            </Text>
            <Text style={styles.screenTag} allowFontScaling>
              GEMINI TOKENS & QUOTA LIMITS
            </Text>
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
            <Text style={styles.statusPillText} allowFontScaling>
              {hasCustom ? 'BYOK Mode' : 'Proxy Mode'}
            </Text>
          </View>
        </View>

        {/* Detailed Usage Section */}
        <GeminiUsageSection />
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
    paddingTop: 12,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
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
  headerTitleCol: {
    flex: 1,
    marginLeft: 12,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  screenTag: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillLive: {
    backgroundColor: colors.primaryMuted,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusPillEnv: {
    backgroundColor: colors.caloriesMuted,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotLive: {
    backgroundColor: colors.primary,
  },
  statusDotEnv: {
    backgroundColor: colors.calories,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
