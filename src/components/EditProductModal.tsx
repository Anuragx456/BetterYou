import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
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

interface EditProductModalProps {
  visible: boolean;
  initialName: string;
  initialIngredients: string[];
  onClose: () => void;
  onSave: (newName: string, newIngredients: string[]) => void;
}

export function EditProductModal({
  visible,
  initialName,
  initialIngredients,
  onClose,
  onSave,
}: EditProductModalProps) {
  const [productName, setProductName] = useState(initialName);
  const [ingredientsText, setIngredientsText] = useState(() => initialIngredients.join(', '));

  // Compute live ingredient count
  const detectedIngredients = ingredientsText
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const handleSave = () => {
    const trimmedName = productName.trim() || 'Custom Product';
    onSave(trimmedName, detectedIngredients);
    onClose();
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
          style={styles.keyboardContainer}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={onClose}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>

            <View style={styles.headerTitleCol}>
              <Text style={styles.headerTitle}>Edit Product & Ingredients</Text>
              <Text style={styles.headerSub}>Recalculates Safety Score on Save</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.saveHeaderBtn, pressed && styles.pressed]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={handleSave}
            >
              <Text style={styles.saveHeaderText}>Save</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Context Card */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <Text style={styles.infoBannerText}>
                Correct OCR typos, add missing additives, or delete ingredients. BetterYou will instantly re-evaluate harmful additives, Indian market alerts, and safety scores.
              </Text>
            </View>

            {/* Product Name Input */}
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>Product Name</Text>
              <TextInput
                style={styles.inputSingle}
                value={productName}
                onChangeText={setProductName}
                placeholder="e.g. Kurkure, Bajaj Almond Drops..."
                placeholderTextColor={colors.textSecondary}
                selectionColor={colors.primary}
              />
            </View>

            {/* Ingredients Input */}
            <View style={styles.fieldSection}>
              <View style={styles.ingredientsHeaderRow}>
                <Text style={styles.fieldLabel}>Ingredients (Separated by commas)</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {detectedIngredients.length}{' '}
                    {detectedIngredients.length === 1 ? 'ingredient' : 'ingredients'}
                  </Text>
                </View>
              </View>

              <TextInput
                style={styles.inputMulti}
                value={ingredientsText}
                onChangeText={setIngredientsText}
                placeholder="Enter ingredients separated by commas, e.g.: Refined Palmolein, Monosodium Glutamate, TBHQ, Salt..."
                placeholderTextColor={colors.textSecondary}
                multiline
                textAlignVertical="top"
                selectionColor={colors.primary}
              />
              <Text style={styles.fieldHelper}>
                Tip: You can paste comma-separated ingredients directly from back labels or online store listings.
              </Text>
            </View>

            {/* Live Ingredients Preview */}
            {detectedIngredients.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewTitle}>Detected Ingredients Preview</Text>
                <View style={styles.previewPillsWrap}>
                  {detectedIngredients.map((item, index) => (
                    <View key={index} style={styles.previewPill}>
                      <Text style={styles.previewPillIndex}>{index + 1}.</Text>
                      <Text style={styles.previewPillText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Bottom Save Action Button */}
            <View style={styles.bottomActions}>
              <Pressable
                style={({ pressed }) => [styles.saveMainBtn, pressed && styles.pressed]}
                onPress={handleSave}
              >
                <Ionicons name="sparkles" size={18} color={colors.textInverse} />
                <Text style={styles.saveMainBtnText}>Save & Recalculate Report</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
                onPress={onClose}
              >
                <Text style={styles.cancelBtnText}>Discard Changes</Text>
              </Pressable>
            </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  iconBtn: {
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  headerSub: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  saveHeaderBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textInverse,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
  fieldSection: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  inputSingle: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  ingredientsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  countBadge: {
    backgroundColor: colors.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  inputMulti: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: colors.text,
    minHeight: 130,
    lineHeight: 20,
  },
  fieldHelper: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  previewSection: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  previewTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  previewPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  previewPillIndex: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  previewPillText: {
    fontSize: 11,
    color: colors.text,
  },
  bottomActions: {
    gap: 12,
    marginTop: 8,
  },
  saveMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    minHeight: 52,
    gap: 8,
  },
  saveMainBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textInverse,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
