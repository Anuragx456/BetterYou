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
import { colors } from '../theme/colors';
import { safeHaptics } from '../utils/haptics';

interface RetryProductModalProps {
  visible: boolean;
  currentProductName: string;
  hasCapturedImage: boolean;
  onClose: () => void;
  onRetry: (newProductName: string) => Promise<void>;
}

const COMMON_SUGGESTIONS = [
  'Bajaj Almond Drops Hair Oil',
  'Parle-G Gluco Biscuits',
  'Maggi 2-Minute Masala Noodles',
  'Kurkure Masala Munch',
  'Dabur Red Toothpaste',
  'Good Knight Mosquito Vaporizer',
  'Dettol Original Bath Soap',
  "Johnson's Baby Powder",
  'Lizol Surface Disinfectant',
  '100% Pure Mustard Oil',
];

export function RetryProductModal({
  visible,
  currentProductName,
  hasCapturedImage,
  onClose,
  onRetry,
}: RetryProductModalProps) {
  const [productName, setProductName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async () => {
    const trimmed = productName.trim();
    if (!trimmed) {
      safeHaptics.warning();
      Alert.alert('Product Name Required', 'Please type the actual product name to re-screen.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onRetry(trimmed);
      setProductName('');
      onClose();
    } catch {
      // Error handled by parent onRetry
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectSuggestion = (name: string) => {
    safeHaptics.selection();
    setProductName(name);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={onClose}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Cancel retrying with different product name"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>

            <View style={styles.headerTitleCol}>
              <Text style={styles.headerTitle} allowFontScaling>
                Different Product?
              </Text>
              <Text style={styles.headerSub} allowFontScaling>
                Retry with Correct Product Name
              </Text>
            </View>

            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Context Card */}
            <View style={styles.contextCard}>
              <View style={styles.contextHeader}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                <Text style={styles.contextLabel} allowFontScaling>
                  SCANNED IDENTIFICATION
                </Text>
              </View>
              <Text style={styles.currentNameText} numberOfLines={2} allowFontScaling>
                {currentProductName || 'Unknown Product'}
              </Text>
              <Text style={styles.contextExplainer} allowFontScaling>
                If the barcode or packaging scanner misidentified the item, specify the real product name below. BetterYou will re-evaluate its ingredients, toxic chemicals, and regulatory safety score.
              </Text>
            </View>

            {/* Input Section */}
            <View style={styles.fieldSection}>
              <Text style={styles.inputLabel} allowFontScaling>
                ACTUAL PRODUCT OR BRAND NAME
              </Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  value={productName}
                  onChangeText={setProductName}
                  placeholder="e.g. Parle-G Biscuits, Dabur Amla..."
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  editable={!isSubmitting}
                  accessibilityLabel="Actual product or brand name input"
                />
                {productName.length > 0 && !isSubmitting && (
                  <Pressable
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => setProductName('')}
                    accessibilityRole="button"
                    accessibilityLabel="Clear product name text"
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>

              {/* Method Indicator */}
              <View style={styles.methodPill}>
                <Ionicons
                  name={hasCapturedImage ? 'camera-outline' : 'search-outline'}
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.methodPillText} allowFontScaling>
                  {hasCapturedImage
                    ? 'Re-analyzing your packaging photo with this name hint'
                    : 'Querying chemical database for this formulation'}
                </Text>
              </View>
            </View>

            {/* Quick Suggestions */}
            <View style={styles.suggestionsSection}>
              <Text style={styles.suggestionsLabel} allowFontScaling>
                POPULAR SUPERMARKET ITEMS
              </Text>
              <View style={styles.chipsContainer}>
                {COMMON_SUGGESTIONS.map((item, idx) => (
                  <Pressable
                    key={idx}
                    style={({ pressed }) => [
                      styles.chip,
                      productName === item && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleSelectSuggestion(item)}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item}`}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        productName === item && styles.chipTextActive,
                      ]}
                      allowFontScaling
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Action Bar */}
          <View style={styles.actionBar}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              onPress={onClose}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Cancel retry"
            >
              <Text style={styles.cancelBtnText} allowFontScaling>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                (!productName.trim() || isSubmitting) && styles.submitBtnDisabled,
                pressed && !isSubmitting && styles.pressed,
              ]}
              onPress={handleSubmit}
              disabled={!productName.trim() || isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Re-screen with actual product name"
            >
              {isSubmitting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.textInverse} />
                  <Text style={styles.submitBtnText} allowFontScaling>
                    Re-screening...
                  </Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <Ionicons name="refresh" size={16} color={colors.textInverse} />
                  <Text style={styles.submitBtnText} allowFontScaling>
                    Re-screen Product
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
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
  container: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
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
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.surfaceSubtle,
  },
  headerTitleCol: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  headerSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  contextCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    marginBottom: 16,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  contextLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
    letterSpacing: 0.5,
  },
  currentNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  contextExplainer: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  fieldSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  methodPillText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  suggestionsSection: {
    marginBottom: 16,
  },
  suggestionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textInverse,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
