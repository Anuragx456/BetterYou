import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { recalculateToxicityReport } from '../services/barcodeService';
import { useFitnessStore } from '../store/useFitnessStore';
import { getModelDisplayName } from '../store/useSettingsStore';
import type { ThemeColors } from '../theme/colors';
import { useThemeColors, useThemedStyles } from '../theme/theme';
import type { ScannedProduct } from '../types';
import { getFullImageUri } from '../utils/imageManager';
import { EditProductModal } from './EditProductModal';
import { IngredientBreakdownSection } from './scan/IngredientBreakdownSection';
import { ModalScoreGaugeHero } from './scan/ModalScoreGaugeHero';
import { StandardsDisclosureCard } from './scan/StandardsDisclosureCard';

interface ToxicityReportModalProps {
  visible: boolean;
  product: ScannedProduct | null;
  onClose: () => void;
}

export function ToxicityReportModal({
  visible,
  product,
  onClose,
}: ToxicityReportModalProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const updateScannedProduct = useFitnessStore((state) => state.updateScannedProduct);
  const removeScannedProduct = useFitnessStore((state) => state.removeScannedProduct);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  useEffect(() => {
    if (!visible || !product || product.reportComplete) return;
    useFitnessStore.getState().loadScannedProductReport(product.id).catch(() => {});
  }, [visible, product]);

  if (!product) return null;

  const report = product.report;
  const score = report.overallSafetyScore;
  const scoreColor =
    score >= 71
      ? colors.safetyClean
      : score >= 40
      ? colors.safetyModerate
      : colors.safetyHighRisk;

  // Handle Edit Save
  const handleSaveEdit = (newName: string, newIngredients: string[]) => {
    const updatedReport = recalculateToxicityReport(newName, newIngredients, report);
    updateScannedProduct(product.id, {
      productName: newName,
      report: updatedReport,
    });
    Alert.alert('Report Updated!', 'Safety score and ingredient hazards have been recalculated.');
  };

  // Handle Delete Scan
  const handleDelete = () => {
    Alert.alert(
      'Delete Scan',
      `Are you sure you want to remove "${product.productName}" from your saved scans?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeScannedProduct(product.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header Navigation */}
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={onClose}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>Ingredient Risk Screening</Text>
            <Text style={styles.headerSub}>Saved Screening</Text>
          </View>

          <View style={styles.headerActionsRight}>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => setIsEditModalVisible(true)}
            >
              <Ionicons name="pencil" size={18} color={colors.primary} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.iconBtnDanger, pressed && styles.pressed]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Captured Label Image Preview if available */}
          {product.imageUrl ? (
            <View style={styles.imagePreviewBox}>
              <Image
                source={{ uri: getFullImageUri(product.imageUrl) ?? product.imageUrl }}
                style={styles.imagePreview}
                contentFit="cover"
              />
            </View>
          ) : null}

          {/* Provenance & Verification Badge */}
          {report.generatedBy === 'offline-demo-mock' ? (
            <View style={styles.provenanceDemoBadge}>
              <Ionicons name="flask-outline" size={13} color={colors.warning} />
              <Text style={styles.provenanceDemoText}>Simulated Offline Sample (No API Key)</Text>
            </View>
          ) : report.barcode ? (
            <View style={styles.provenanceVerifiedBadge}>
              <Ionicons name="barcode-outline" size={13} color={colors.primary} />
              <Text style={styles.provenanceVerifiedText}>Verified Barcode Registry</Text>
            </View>
          ) : (
            <View style={styles.provenanceVerifiedBadge}>
              <Ionicons name="scan-outline" size={13} color={colors.primary} />
              <Text style={styles.provenanceVerifiedText}>
                AI Vision Analyzed ({getModelDisplayName(report.generatedBy) || report.generatedBy || 'Multimodal'})
              </Text>
            </View>
          )}

          {/* Circular Safety Score Gauge Hero */}
          <ModalScoreGaugeHero
            score={score}
            scoreColor={scoreColor}
            riskLevel={report.riskLevel}
            category={report.category}
            productName={product.productName}
            onOpenEdit={() => setIsEditModalVisible(true)}
          />

          {/* Plain-English Verdict Card */}
          <View style={styles.verdictCardClean}>
            <Text style={styles.verdictTextBold}>
              {report.harmfulIngredients.length === 0
                ? '0 flagged additives or elevated hazards detected.'
                : `${report.harmfulIngredients.length} flagged ${report.harmfulIngredients.length === 1 ? 'additive' : 'additives'} detected.`}
            </Text>
            {report.cleanSummary ? (
              <Text style={styles.verdictTextSub}>{report.cleanSummary}</Text>
            ) : null}
          </View>

          {/* Indian Supermarket Context Alert Box */}
          {report.indianMarketAlert ? (
            <View style={styles.indianAlertCardClean}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} />
              <Text style={styles.indianAlertTextClean}>{report.indianMarketAlert}</Text>
            </View>
          ) : null}

          {/* Clean Ingredients Breakdown */}
          <IngredientBreakdownSection
            allIngredients={report.allIngredients}
            harmfulIngredients={report.harmfulIngredients}
            onOpenEdit={() => setIsEditModalVisible(true)}
          />

          {/* Standards & Provenance Card */}
          <StandardsDisclosureCard report={report} />

          {/* Bottom Action Button */}
          <View style={styles.bottomActionsClean}>
            <Pressable
              style={({ pressed }) => [styles.closeBtnClean, pressed && styles.pressed]}
              onPress={onClose}
            >
              <Text style={styles.closeBtnTextClean}>Close Report</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Nested Edit Product Modal */}
        {isEditModalVisible ? (
          <EditProductModal
            visible={isEditModalVisible}
            initialName={product.productName}
            initialIngredients={report.allIngredients || []}
            onClose={() => setIsEditModalVisible(false)}
            onSave={handleSaveEdit}
          />
        ) : null}
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
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    iconBtnDanger: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.fatMuted,
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
      marginTop: 1,
    },
    headerActionsRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 40,
    },
    imagePreviewBox: {
      width: '100%',
      height: 180,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    imagePreview: {
      width: '100%',
      height: '100%',
    },
    provenanceDemoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      backgroundColor: colors.warning + '18',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      marginBottom: 14,
    },
    provenanceDemoText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.warning,
    },
    provenanceVerifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      backgroundColor: colors.primary + '14',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      marginBottom: 14,
    },
    provenanceVerifiedText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    verdictCardClean: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
      marginBottom: 16,
    },
    verdictTextBold: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 20,
    },
    verdictTextSub: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: 6,
    },
    indianAlertCardClean: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.warning + '12',
      borderWidth: 1,
      borderColor: colors.warning + '30',
      borderRadius: 14,
      padding: 12,
      marginBottom: 16,
    },
    indianAlertTextClean: {
      flex: 1,
      fontSize: 13,
      color: colors.warning,
      lineHeight: 18,
      fontWeight: '600',
    },
    bottomActionsClean: {
      marginTop: 12,
    },
    closeBtnClean: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnTextClean: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
