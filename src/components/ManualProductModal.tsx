import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
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
import { analyzeProductText } from '../services/aiVisionService';
import { VoiceInputModal } from './VoiceInputModal';
import { colors } from '../theme/colors';
import { ToxicityReport } from '../types';

interface ManualProductModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitResult: (report: ToxicityReport) => void;
}

const QUICK_PRODUCT_SUGGESTIONS = [
  'Bajaj Almond Drops Hair Oil',
  'Maggi 2-Minute Masala Noodles',
  'Kurkure Masala Munch',
  'Dettol Original Bath Soap',
  'Good Knight Mosquito Vaporizer',
  'Lizol Floor Cleaner',
  'Colgate Strong Teeth Toothpaste',
  "Johnson's Baby Powder",
  '100% Pure Kachi Ghani Mustard Oil',
];

export function ManualProductModal({ visible, onClose, onSubmitResult }: ManualProductModalProps) {
  const [productName, setProductName] = useState<string>('');
  const [ingredientsText, setIngredientsText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isVoiceSubModalVisible, setIsVoiceSubModalVisible] = useState<boolean>(false);

  const handleAnalyze = async () => {
    const trimmedName = productName.trim();
    if (!trimmedName) {
      Alert.alert('Product Name Required', 'Please enter a product or brand name to inspect.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const report = await analyzeProductText(trimmedName, ingredientsText);
      onSubmitResult(report);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Analysis Failed', msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
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
              onPress={onClose}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>

            <View style={styles.headerTitleCol}>
              <Text style={styles.headerTitle}>Type Product</Text>
              <Text style={styles.headerSub}>Ingredient Risk Screening Analysis</Text>
            </View>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.cardGroup}>
              {/* Product Name Input */}
              <View style={styles.fieldSection}>
                <View style={styles.inputHeaderRow}>
                  <Text style={styles.inputLabel}>PRODUCT OR BRAND NAME</Text>
                  <Pressable
                    style={({ pressed }) => [styles.speakInlineBtn, pressed && styles.pressed]}
                    onPress={() => setIsVoiceSubModalVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Speak product name"
                  >
                    <Ionicons name="mic" size={13} color={colors.primary} />
                    <Text style={styles.speakInlineText}>Speak</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={productName}
                  onChangeText={setProductName}
                  placeholder="e.g. Bajaj Almond Drops, Maggi Noodles, Lizol..."
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.primary}
                />
              </View>

              {/* Quick Preset Chips */}
              <View style={styles.suggestionsSection}>
                <Text style={styles.quickLabel}>QUICK INDIAN SUPERMARKET ITEMS</Text>
                <View style={styles.chipsWrap}>
                  {QUICK_PRODUCT_SUGGESTIONS.map((item, i) => (
                    <Pressable
                      key={i}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                      onPress={() => setProductName(item)}
                    >
                      <Text style={styles.chipText}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Ingredients Textarea (Optional) */}
              <View style={styles.fieldSection}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>INGREDIENTS LIST</Text>
                  <Text style={styles.optionalTag}>OPTIONAL</Text>
                </View>
                <TextInput
                  style={styles.textArea}
                  value={ingredientsText}
                  onChangeText={setIngredientsText}
                  placeholder="Paste or type ingredients (e.g. Light liquid paraffin, til oil, fragrance, TBHQ)... If left blank, Gemini AI will reconstruct standard supermarket formula."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  selectionColor={colors.primary}
                />
              </View>

              {/* Info banner */}
              <View style={styles.infoBanner}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
                <Text style={styles.infoBannerText}>
                  Our screening engine cross-references additives with published food & cosmetic safety monographs (EFSA, FSSAI, CDSCO, IARC).
                </Text>
              </View>

              {/* Action Button */}
              <Pressable
                style={[styles.actionBtn, isAnalyzing && styles.btnDisabled]}
                onPress={handleAnalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <View style={styles.actionBtnInner}>
                    <ActivityIndicator size="small" color={colors.textInverse} />
                    <Text style={styles.actionBtnText}>Screening Ingredients...</Text>
                  </View>
                ) : (
                  <View style={styles.actionBtnInner}>
                    <Ionicons name="shield-checkmark" size={16} color={colors.textInverse} />
                    <Text style={styles.actionBtnText}>Screen Product Ingredients</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {isVoiceSubModalVisible && (
        <VoiceInputModal
          visible={isVoiceSubModalVisible}
          mode="product"
          onClose={() => setIsVoiceSubModalVisible(false)}
          onSubmitProductResult={(report) => {
            onSubmitResult(report);
            onClose();
          }}
        />
      )}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
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
  pressed: {
    opacity: 0.7,
  },
  headerTitleCol: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  cardGroup: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    gap: 16,
  },
  fieldSection: {
    width: '100%',
  },
  inputHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  speakInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  speakInlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
    marginBottom: 6,
  },
  optionalTag: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.primary,
  },
  textInput: {
    backgroundColor: colors.cardHover,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  suggestionsSection: {
    marginTop: -4,
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.cardHover,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  textArea: {
    backgroundColor: colors.cardHover,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.text,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 90,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  actionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textInverse,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
