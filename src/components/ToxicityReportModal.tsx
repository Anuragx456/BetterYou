import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
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
import { colors } from '../theme/colors';
import {
  NovaGroup,
  NutriscoreGrade,
  ScannedProduct,
  TargetExposure,
} from '../types';
import { EditProductModal } from './EditProductModal';

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
  const updateScannedProduct = useFitnessStore((state) => state.updateScannedProduct);
  const removeScannedProduct = useFitnessStore((state) => state.removeScannedProduct);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  if (!product) return null;

  const report = product.report;
  const score = report.overallSafetyScore;
  const scoreColor =
    score >= 71
      ? colors.safetyClean
      : score >= 40
      ? colors.safetyModerate
      : colors.safetyHighRisk;

  // Visual meta helpers
  const getExposureMeta = (exposure?: TargetExposure) => {
    switch (exposure) {
      case 'Inhalation':
        return { icon: 'cloud-outline' as const, label: 'Inhalation Exposure', color: '#EF4444' };
      case 'Dermal Absorption':
        return { icon: 'hand-left-outline' as const, label: 'Dermal Absorption', color: '#F472B6' };
      case 'Mucous Membrane':
        return { icon: 'alert-circle-outline' as const, label: 'Mucous Membrane', color: '#F59E0B' };
      case 'Ingestion':
        return { icon: 'restaurant-outline' as const, label: 'Oral Ingestion', color: '#10B981' };
      default:
        return { icon: 'shield-outline' as const, label: 'General Household', color: '#9CA3AF' };
    }
  };

  const getNovaDetails = (nova: NovaGroup | null | undefined) => {
    switch (nova) {
      case 1:
        return { label: 'NOVA 1', title: 'Unprocessed / Natural', color: colors.nova1 };
      case 2:
        return { label: 'NOVA 2', title: 'Processed Culinary', color: colors.nova2 };
      case 3:
        return { label: 'NOVA 3', title: 'Processed Food', color: colors.nova3 };
      case 4:
        return { label: 'NOVA 4', title: 'Ultra-Processed (UPF)', color: colors.nova4 };
      default:
        return null;
    }
  };

  const getNutriscoreColor = (grade: NutriscoreGrade | null | undefined): string => {
    switch (grade) {
      case 'a':
        return '#059669';
      case 'b':
        return '#10B981';
      case 'c':
        return '#F59E0B';
      case 'd':
        return '#F97316';
      case 'e':
        return '#EF4444';
      default:
        return colors.textMuted;
    }
  };

  const exposureMeta = getExposureMeta(report.targetExposure);
  const novaDetails = getNovaDetails(report.novaGroup);

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
            <Text style={styles.headerTitle}>Full Toxicity Report</Text>
            <Text style={styles.headerSub}>Saved Scan</Text>
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
          {product.imageUrl && (
            <View style={styles.imagePreviewBox}>
              <Image source={{ uri: product.imageUrl }} style={styles.imagePreview} contentFit="cover" />
            </View>
          )}

          {/* Circular Safety Score Gauge Hero */}
          <View style={styles.gaugeHeroCard}>
            <View style={styles.gaugeOuter}>
              <View
                style={[
                  styles.gaugeArc,
                  {
                    borderColor: scoreColor,
                    opacity: 0.9,
                  },
                ]}
              />
              <View style={styles.gaugeInner}>
                <Text style={[styles.gaugeScoreHuge, { color: scoreColor }]}>{score}</Text>
                <Text style={styles.gaugeRiskLabel}>
                  {report.riskLevel === 'Safe' ? 'Safe & Clean' : report.riskLevel}
                </Text>
                {report.category ? (
                  <View style={styles.gaugeCategoryBadge}>
                    <Text style={styles.gaugeCategoryText}>{report.category}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.productNameRowClean}>
              <Text style={styles.productNameClean} numberOfLines={2}>
                {product.productName}
              </Text>
              <Pressable
                style={styles.inlineEditBtnClean}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setIsEditModalVisible(true)}
              >
                <Ionicons name="pencil" size={13} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Plain-English Verdict Card */}
          <View style={styles.verdictCardClean}>
            <Text style={styles.verdictTextBold}>
              {report.harmfulIngredients.length === 0
                ? '0 harmful endocrine disruptors or toxic additives detected.'
                : `${report.harmfulIngredients.length} harmful ${report.harmfulIngredients.length === 1 ? 'additive' : 'additives'} flagged.`}
            </Text>
            {report.cleanSummary ? (
              <Text style={styles.verdictTextSub}>{report.cleanSummary}</Text>
            ) : null}
          </View>

          {/* Indian Supermarket Context Alert Box */}
          {report.indianMarketAlert && (
            <View style={styles.indianAlertCardClean}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} />
              <Text style={styles.indianAlertTextClean}>{report.indianMarketAlert}</Text>
            </View>
          )}

          {/* Clean Ingredients Breakdown */}
          <View style={styles.ingredientsSectionClean}>
            <View style={styles.ingredientsHeaderRowClean}>
              <Text style={styles.ingredientsTitleClean}>
                Ingredients Breakdown {report.allIngredients ? `(${report.allIngredients.length})` : ''}
              </Text>
              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setIsEditModalVisible(true)}
              >
                <Text style={styles.editLinkTextClean}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.ingredientsListClean}>
              {/* Flagged Harmful Additives first */}
              {report.harmfulIngredients.map((item, idx) => (
                <View key={`harmful-${idx}`} style={styles.ingredientRowClean}>
                  <View style={styles.ingredientRowLeft}>
                    <View style={[styles.statusDotClean, { backgroundColor: colors.danger }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ingredientNameHarmful}>{item.name}</Text>
                      <Text style={styles.ingredientHarmSub}>{item.healthImpact}</Text>
                    </View>
                  </View>
                  <View style={styles.severityBadgeClean}>
                    <Text style={styles.severityBadgeText}>{item.severity}</Text>
                  </View>
                </View>
              ))}

              {/* Clean / Unflagged Ingredients */}
              {report.allIngredients && report.allIngredients.map((ing, idx) => {
                const isFlagged = report.harmfulIngredients.some(
                  (h) => h.name.toLowerCase().includes(ing.toLowerCase()) || ing.toLowerCase().includes(h.name.toLowerCase())
                );
                if (isFlagged) return null;

                return (
                  <View key={`clean-${idx}`} style={styles.ingredientRowClean}>
                    <View style={styles.ingredientRowLeft}>
                      <View style={[styles.statusDotClean, { backgroundColor: colors.safetyClean }]} />
                      <Text style={styles.ingredientNameClean}>{ing}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Standards & Provenance Card */}
          <View style={styles.standardsDisclosureCard}>
            <View style={styles.standardsHeaderClean}>
              <Text style={styles.standardsTitleClean}>Regulatory Standards</Text>
              {report.regulatoryStandard ? (
                <Text style={styles.standardPillClean}>{report.regulatoryStandard}</Text>
              ) : null}
            </View>
            <View style={styles.standardsRowClean}>
              {novaDetails && (
                <View style={styles.standardChipClean}>
                  <Text style={[styles.standardChipTag, { color: novaDetails.color }]}>{novaDetails.label}</Text>
                  <Text style={styles.standardChipDesc}>{novaDetails.title}</Text>
                </View>
              )}
              {report.nutriscoreGrade && (
                <View style={styles.standardChipClean}>
                  <Text style={[styles.standardChipTag, { color: getNutriscoreColor(report.nutriscoreGrade) }]}>
                    Nutri-Score {report.nutriscoreGrade.toUpperCase()}
                  </Text>
                  <Text style={styles.standardChipDesc}>Quality</Text>
                </View>
              )}
              {report.targetExposure && (
                <View style={styles.standardChipClean}>
                  <Text style={[styles.standardChipTag, { color: exposureMeta.color }]}>{report.targetExposure}</Text>
                  <Text style={styles.standardChipDesc}>Exposure</Text>
                </View>
              )}
            </View>
          </View>

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
        {isEditModalVisible && (
          <EditProductModal
            visible={isEditModalVisible}
            initialName={product.productName}
            initialIngredients={report.allIngredients || []}
            onClose={() => setIsEditModalVisible(false)}
            onSave={handleSaveEdit}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
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
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  // Gauge Hero Card
  gaugeHeroCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  gaugeOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 6,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 8,
  },
  gaugeArc: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 6,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  gaugeInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScoreHuge: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  gaugeRiskLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  gaugeCategoryBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  gaugeCategoryText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  productNameRowClean: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  productNameClean: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  inlineEditBtnClean: {
    padding: 4,
  },

  // Verdict Card
  verdictCardClean: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  verdictTextBold: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  verdictTextSub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 6,
  },

  // Indian Alert Card
  indianAlertCardClean: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  indianAlertTextClean: {
    flex: 1,
    fontSize: 12,
    color: colors.warning,
    lineHeight: 17,
    fontWeight: '500',
  },

  // Clean Ingredients Breakdown
  ingredientsSectionClean: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  ingredientsHeaderRowClean: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ingredientsTitleClean: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  editLinkTextClean: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  ingredientsListClean: {
    gap: 0,
  },
  ingredientRowClean: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  ingredientRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  statusDotClean: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  ingredientNameClean: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  ingredientNameHarmful: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  ingredientHarmSub: {
    fontSize: 11,
    color: colors.danger,
    marginTop: 2,
    lineHeight: 15,
  },
  severityBadgeClean: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  severityBadgeText: {
    fontSize: 10,
    color: colors.danger,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // Standards Disclosure
  standardsDisclosureCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  standardsHeaderClean: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  standardsTitleClean: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  standardPillClean: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  standardsRowClean: {
    flexDirection: 'row',
    gap: 8,
  },
  standardChipClean: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  standardChipTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  standardChipDesc: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Bottom Actions
  bottomActionsClean: {
    gap: 10,
    marginTop: 4,
  },
  closeBtnClean: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  closeBtnTextClean: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
