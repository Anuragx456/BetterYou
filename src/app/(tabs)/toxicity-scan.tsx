import { AI_TOXICITY_DISCLAIMER } from '../../constants/disclaimers';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { optimizeImageForAiVision } from '../../utils/imageOptimizer';
import { CAPTURE_JPEG_QUALITY, selectPreferredPictureSize } from '../../utils/cameraPictureSize';
import { createBarcodeScanGuard } from '../../utils/barcodeScanGuard';
import { useOnDemandComponent } from '../../utils/useOnDemandComponent';
import { useFitnessStore } from '../../store/useFitnessStore';
import { safeHaptics } from '../../utils/haptics';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import {
  NovaGroup,
  NutriscoreGrade,
  TargetExposure,
  ToxicityReport,
} from '../../types';

async function screenLabelImage(base64: string, fileUri: string, hint?: string) {
  const vision = await import('../../services/aiVisionService');
  const imageHash = fileUri ? await vision.hashImageFile(fileUri) : '';
  return vision.analyzeIngredientsImage(base64, {
    productNameHint: hint,
    imageHash: imageHash || undefined,
    localImagePath: fileUri,
  });
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ScreenState = 'scanning' | 'loading' | 'report';

const LabelPreview = React.memo(function LabelPreview({ uri }: { uri: string | null }) {
  const styles = useThemedStyles(createStyles);
  if (!uri) return null;
  return (
    <View style={styles.labelPreviewContainer}>
      <Image source={{ uri }} style={styles.labelPreviewImage} contentFit="cover" recyclingKey={uri} />
    </View>
  );
});

export default function ToxicityScanScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [isFocused, setIsFocused] = useState<boolean>(true);
  const addScannedProduct = useFitnessStore((state) => state.addScannedProduct);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  // Camera Permissions
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const barcodeGuardRef = useRef(createBarcodeScanGuard());
  const [scanMode, setScanMode] = useState<'label' | 'barcode'>('label');
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

  // States
  const [screenState, setScreenState] = useState<ScreenState>('scanning');
  const [enableTorch, setEnableTorch] = useState<boolean>(false);
  const [report, setReport] = useState<ToxicityReport | null>(null);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [labelPreviewUri, setLabelPreviewUri] = useState<string | null>(null);
  const rememberCapture = (fullUri: string | null, thumbUri?: string | null) => {
    setCapturedImageUri(fullUri);
    setLabelPreviewUri(thumbUri || fullUri);
  };
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [isRetryModalVisible, setIsRetryModalVisible] = useState<boolean>(false);
  const [isProcessingBarcode, setIsProcessingBarcode] = useState<boolean>(false);
  const [barcodeSearchPill, setBarcodeSearchPill] = useState<string | null>(null);
  const [isTypeProductModalVisible, setIsTypeProductModalVisible] = useState<boolean>(false);
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState<boolean>(false);
  const [EditProduct, loadEditProduct] = useOnDemandComponent(() =>
    import('../../components/EditProductModal').then((mod) => mod.EditProductModal)
  );
  const [RetryProduct, loadRetryProduct] = useOnDemandComponent(() =>
    import('../../components/RetryProductModal').then((mod) => mod.RetryProductModal)
  );
  const [ManualProduct, loadManualProduct] = useOnDemandComponent(() =>
    import('../../components/ManualProductModal').then((mod) => mod.ManualProductModal)
  );
  const [VoiceProduct, loadVoiceProduct] = useOnDemandComponent(() =>
    import('../../components/VoiceInputModal').then((mod) => mod.VoiceInputModal)
  );
  const openEditProduct = useCallback(() => {
    loadEditProduct();
    setIsEditModalVisible(true);
  }, [loadEditProduct]);
  const openRetryProduct = useCallback(() => {
    loadRetryProduct();
    setIsRetryModalVisible(true);
  }, [loadRetryProduct]);
  const openManualProduct = useCallback(() => {
    loadManualProduct();
    setIsTypeProductModalVisible(true);
  }, [loadManualProduct]);
  const openVoiceProduct = useCallback(() => {
    loadVoiceProduct();
    setIsVoiceModalVisible(true);
  }, [loadVoiceProduct]);

  // Handle Edit Save
  const handleSaveEdit = async (newName: string, newIngredients: string[]) => {
    if (!report) return;
    const { recalculateToxicityReport } = await import('../../services/barcodeService');
    const updated = recalculateToxicityReport(newName, newIngredients, report);
    setReport(updated);
    Alert.alert('Report Updated!', 'Safety score, additives, and Indian market alerts have been recalculated.');
  };

  // Reset to scan another label
  const handleResetScanner = () => {
    setReport(null);
    rememberCapture(null);
    setIsSaved(false);
    setIsProcessingBarcode(false);
    setBarcodeSearchPill(null);
    setIsRetryModalVisible(false);
    setScreenState('scanning');
  };

  // -------------------------------------------------------------
  // RETRY WITH DIFFERENT PRODUCT NAME HANDLER
  // -------------------------------------------------------------
  const handleRetryWithProductName = async (newProductName: string) => {
    const cleanName = newProductName.trim();
    if (!cleanName) return;

    setScreenState('loading');
    safeHaptics.impactMedium();

    try {
      let updatedReport: ToxicityReport;

      if (capturedImageUri) {
        // Re-analyze existing captured photo with the new product name hint
        try {
          const optimized = await optimizeImageForAiVision(capturedImageUri, 1024);
          updatedReport = await screenLabelImage(
            optimized.base64 || '',
            optimized.uri || capturedImageUri,
            cleanName
          );
        } catch {
          const { analyzeProductText } = await import('../../services/aiVisionService');
          updatedReport = await analyzeProductText(cleanName);
        }
      } else {
        const { analyzeProductText } = await import('../../services/aiVisionService');
        updatedReport = await analyzeProductText(cleanName);
      }

      setReport(updatedReport);
      setIsSaved(false);
      setScreenState('report');
      safeHaptics.success();
      Alert.alert(
        'Product Re-screened',
        `Screening updated for "${updatedReport.productName || cleanName}". Safety score, chemical additives, and regulatory standards re-calculated.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Retry Incomplete', `Could not re-analyze "${cleanName}": ${msg}`);
      setScreenState('report');
    }
  };

  // -------------------------------------------------------------
  // AUTOMATIC BARCODE SCANNER HANDLER (Deterministic Fast-Path)
  // -------------------------------------------------------------
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanMode !== 'barcode' || screenState !== 'scanning' || !data) return;
    if (!barcodeGuardRef.current.tryAcquire()) return;
    setIsProcessingBarcode(true);
    setBarcodeSearchPill(`Checking barcode: ${data}...`);

    try {
      const { fetchProductByBarcode } = await import('../../services/barcodeService');
      const toxReport = await fetchProductByBarcode(data);
      safeHaptics.success();
      setReport(toxReport);
      setBarcodeSearchPill(null);
      setScreenState('report');
    } catch {
      setBarcodeSearchPill('Barcode not found in registry. Snap photo to OCR printed label.');
      setTimeout(() => setBarcodeSearchPill(null), 3500);
    } finally {
      setTimeout(() => {
        barcodeGuardRef.current.release();
        setIsProcessingBarcode(false);
      }, 3000);
    }
  };

  // -------------------------------------------------------------
  // INGREDIENT LABEL OCR CAPTURE HANDLER
  // -------------------------------------------------------------
  const handleCaptureLabelPhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert(
        'Camera Unavailable',
        'Camera is not ready or unavailable on this device. Please select a packaging photo from your gallery or type ingredients manually.',
        [
          { text: 'Gallery', onPress: handlePickLabelFromGallery },
          { text: 'Type Manually', onPress: () => openManualProduct() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    try {
      safeHaptics.impactHeavy();
      const photo = await cameraRef.current.takePictureAsync({
        quality: CAPTURE_JPEG_QUALITY,
      });

      if (photo?.uri) {
        setScreenState('loading');
        const optimized = await optimizeImageForAiVision(photo.uri, 1024);
        const fileUri = optimized.uri || photo.uri;
        rememberCapture(fileUri, optimized.thumbnailUri);
        const toxReport = await screenLabelImage(optimized.base64 || '', fileUri);
        setReport(toxReport);
        setScreenState('report');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Camera capture / OCR analysis error:', msg);
      Alert.alert(
        'Scan Incomplete',
        `${msg}\n\nPlease align packaging clearly or check your Gemini API key in Settings.`,
        [
          { text: 'Try Again', onPress: () => setScreenState('scanning') },
          { text: 'Settings', onPress: () => router.push('/(tabs)/settings') },
        ]
      );
      setScreenState('scanning');
    }
  };

  // Gallery Picker for Ingredient Label
  const handlePickLabelFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: CAPTURE_JPEG_QUALITY,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setScreenState('loading');
        const optimized = await optimizeImageForAiVision(asset.uri, 1024);
        const fileUri = optimized.uri || asset.uri;
        rememberCapture(fileUri, optimized.thumbnailUri);
        const toxReport = await screenLabelImage(optimized.base64 || '', fileUri);
        setReport(toxReport);
        setScreenState('report');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Gallery Error', `Failed to analyze selected photo: ${msg}`);
      setScreenState('scanning');
    }
  };

  // Save report to zustand history
  const handleSaveToMyScans = () => {
    if (!report) return;

    addScannedProduct({
      productName: report.productName || 'Inspected Product',
      report,
      imageUrl: capturedImageUri ?? undefined,
    });

    setIsSaved(true);
    safeHaptics.success();
    Alert.alert('Saved!', 'Product toxicity report added to your dashboard history.');
  };

  // Helper for NOVA badge styling
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

  // Helper for Nutri-Score badge styling
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


  // Helper for Target Exposure visual meta
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
        return { icon: 'shield-outline' as const, label: 'General Exposure', color: '#9CA3AF' };
    }
  };

  // -------------------------------------------------------------
  // STAGE 2: LOADING ANALYSIS STATE
  // -------------------------------------------------------------
  if (screenState === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingTitle}>AI Ingredient Risk Screening OCR...</Text>
          <Text style={styles.loadingSub}>
            Reading printed back-of-pack ingredients, chemical additives, petroleum fillers, and safety warnings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // STAGE 3: TOXICITY & HARMFULNESS REPORT UI
  // -------------------------------------------------------------
  if (screenState === 'report' && report) {
    const score = report.overallSafetyScore;
    const scoreColor =
      score >= 71
        ? colors.safetyClean
        : score >= 40
        ? colors.safetyModerate
        : colors.safetyHighRisk;

    const novaDetails = getNovaDetails(report.novaGroup);
    const exposureMeta = getExposureMeta(report.targetExposure);

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.reportScroll} showsVerticalScrollIndicator={false}>
          {/* Header Action Row */}
          <View style={styles.reportHeaderRow}>
            <Pressable
              style={({ pressed }) => [styles.backButtonClean, pressed && styles.pressed]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={handleResetScanner}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>

            <Text style={styles.reportTitleClean}>Ingredient Risk Screening</Text>

            <Pressable
              style={({ pressed }) => [
                styles.saveReportBtnClean,
                isSaved && styles.saveReportBtnDisabled,
                pressed && !isSaved && styles.pressed,
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={handleSaveToMyScans}
              disabled={isSaved}
            >
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isSaved ? colors.primary : colors.text}
              />
            </Pressable>
          </View>

          <LabelPreview uri={labelPreviewUri} />

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
              <Ionicons name="sparkles" size={13} color={colors.primary} />
              <Text style={styles.provenanceVerifiedText}>
                AI Vision Analyzed ({report.generatedBy || 'Multimodal'})
              </Text>
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
                {report.productName || 'Inspected Product'}
              </Text>
              <Pressable
                style={styles.inlineEditBtnClean}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => openEditProduct()}
              >
                <Ionicons name="pencil" size={12} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Feature: Retry with Different Product Name */}
            <Pressable
              style={({ pressed }) => [styles.retryProductBtnClean, pressed && styles.pressed]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => {
                safeHaptics.selection();
                openRetryProduct();
              }}
              accessibilityRole="button"
              accessibilityLabel="Wrong product detected? Retry with actual product name"
            >
              <Ionicons name="swap-horizontal" size={13} color={colors.primary} />
              <Text style={styles.retryProductBtnTextClean} allowFontScaling>
                Wrong product? Retry with actual name
              </Text>
            </Pressable>
          </View>

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
          <View style={styles.ingredientsSectionClean}>
            <View style={styles.ingredientsHeaderRowClean}>
              <Text style={styles.ingredientsTitleClean}>
                Ingredients Breakdown {report.allIngredients ? `(${report.allIngredients.length})` : ''}
              </Text>
              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => openEditProduct()}
              >
                <Text style={styles.editLinkTextClean}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.ingredientsListClean}>
              {/* Flagged Harmful Additives first */}
              {report.harmfulIngredients.map((item, idx) => (
                <View key={`harmful-${idx}`} style={styles.harmfulItemCard}>
                  <View style={styles.harmfulItemHeader}>
                    <View style={styles.harmfulItemTitleRow}>
                      <View style={[styles.statusDotClean, { backgroundColor: colors.danger, marginTop: 4 }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ingredientNameHarmful}>{item.name}</Text>
                        <View style={styles.harmfulMetaRow}>
                          <Text style={styles.harmfulCategoryTag}>{item.category}</Text>
                          {item.concentrationRank ? (
                            <Text style={styles.harmfulRankTag}>{item.concentrationRank}</Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                    <View style={styles.badgeGroup}>
                      <View style={styles.severityBadgeClean}>
                        <Text style={styles.severityBadgeText}>{item.severity}</Text>
                      </View>
                      {typeof item.deduction === 'number' && item.deduction > 0 ? (
                        <View style={styles.deductionBadge}>
                          <Text style={styles.deductionBadgeText}>-{item.deduction} pts</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <Text style={styles.ingredientHarmSub}>{item.healthImpact}</Text>

                  {/* Scientific Rationale ("Why it's flagged") */}
                  {item.rationale ? (
                    <View style={styles.rationaleBox}>
                      <Text style={styles.rationaleLabel}>Why it&apos;s flagged:</Text>
                      <Text style={styles.rationaleText}>{item.rationale}</Text>
                    </View>
                  ) : null}

                  {/* Regulatory Source & Citation Link */}
                  {(item.source || item.sourceUrl) ? (
                    <View style={styles.sourceCitationRow}>
                      <View style={styles.sourcePill}>
                        <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
                        <Text style={styles.sourcePillText}>Source: {item.source || 'Regulatory Monograph'}</Text>
                      </View>
                      {item.sourceUrl ? (
                        <Pressable
                          style={({ pressed }) => [styles.sourceLinkBtn, pressed && styles.pressed]}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          onPress={() => Linking.openURL(item.sourceUrl!).catch(() => {})}
                        >
                          <Text style={styles.sourceLinkText}>View standard</Text>
                          <Ionicons name="open-outline" size={12} color={colors.primary} />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ))}

              {/* Clean / Unflagged Ingredients */}
              {report.allIngredients ? report.allIngredients.map((ing, idx) => {
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
              }) : null}
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
              {novaDetails ? (
                <View style={styles.standardChipClean}>
                  <Text style={[styles.standardChipTag, { color: novaDetails.color }]}>{novaDetails.label}</Text>
                  <Text style={styles.standardChipDesc}>{novaDetails.title}</Text>
                </View>
              ) : null}
              {report.nutriscoreGrade ? (
                <View style={styles.standardChipClean}>
                  <Text style={[styles.standardChipTag, { color: getNutriscoreColor(report.nutriscoreGrade) }]}>
                    Nutri-Score {report.nutriscoreGrade.toUpperCase()}
                  </Text>
                  <Text style={styles.standardChipDesc}>Quality</Text>
                </View>
              ) : null}
              {report.targetExposure ? (
                <View style={styles.standardChipClean}>
                  <Text style={[styles.standardChipTag, { color: exposureMeta.color }]}>{report.targetExposure}</Text>
                  <Text style={styles.standardChipDesc}>Exposure</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Bottom Scan Next Button */}
          <Pressable
            style={({ pressed }) => [styles.scanNextBtnClean, pressed && styles.pressed]}
            onPress={handleResetScanner}
          >
            <Text style={styles.scanNextBtnTextClean}>Scan Another Label</Text>
          </Pressable>

          <Text style={styles.disclaimerTextClean}>{AI_TOXICITY_DISCLAIMER}</Text>
        </ScrollView>

        {/* Edit Product & Ingredients Modal */}
        {isEditModalVisible && EditProduct ? (
          <EditProduct
            visible={isEditModalVisible}
            initialName={report.productName || ''}
            initialIngredients={report.allIngredients || []}
            onClose={() => setIsEditModalVisible(false)}
            onSave={handleSaveEdit}
          />
        ) : null}

        {/* Retry with Different Product Name Modal */}
        {isRetryModalVisible && RetryProduct ? (
          <RetryProduct
            visible={isRetryModalVisible}
            currentProductName={report.productName || ''}
            hasCapturedImage={Boolean(capturedImageUri)}
            onClose={() => setIsRetryModalVisible(false)}
            onRetry={handleRetryWithProductName}
          />
        ) : null}
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // CAMERA PERMISSION STATE
  // -------------------------------------------------------------
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.permissionCard, { justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.permissionTitle, { marginTop: 16 }]}>Initializing Scanner...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconCircle}>
            <Ionicons name="document-text-outline" size={42} color={colors.primary} />
          </View>
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionBody}>
            BetterYou needs camera access to photograph and evaluate ingredient labels and chemical warnings on packaged products.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.grantPermissionBtn, pressed && styles.pressed]}
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="Grant camera access permission"
          >
            <Text style={styles.grantPermissionText}>Grant Camera Access</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.settingsLinkBtn, pressed && styles.pressed]}
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Open device settings to manage camera permissions"
          >
            <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.settingsLinkText}>Open App Settings</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.grantPermissionBtn,
              { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, marginTop: 10 },
              pressed && styles.pressed,
            ]}
            onPress={() => openManualProduct()}
          >
            <Text style={[styles.grantPermissionText, { color: colors.text }]}>Type Product Manually</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.grantPermissionBtn,
              { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, marginTop: 10 },
              pressed && styles.pressed,
            ]}
            onPress={() => openVoiceProduct()}
            accessibilityRole="button"
            accessibilityLabel="Speak product name"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="mic-outline" size={18} color={colors.primary} />
              <Text style={[styles.grantPermissionText, { color: colors.text }]}>Speak Product Name</Text>
            </View>
          </Pressable>
        </View>
        {isTypeProductModalVisible && ManualProduct ? (
          <ManualProduct
            visible={isTypeProductModalVisible}
            onClose={() => setIsTypeProductModalVisible(false)}
            onSubmitResult={(newReport) => {
              setReport(newReport);
              rememberCapture(null);
              setIsSaved(false);
              setScreenState('report');
            }}
          />
        ) : null}
        {isVoiceModalVisible && VoiceProduct ? (
          <VoiceProduct
            visible={isVoiceModalVisible}
            mode="product"
            onClose={() => setIsVoiceModalVisible(false)}
            onSubmitProductResult={(newReport) => {
              setReport(newReport);
              rememberCapture(null);
              setIsSaved(false);
              setScreenState('report');
            }}
          />
        ) : null}
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // STAGE 1: INGREDIENT LABEL OCR VIEWFINDER
  // -------------------------------------------------------------
  return (
    <View style={styles.cameraContainer}>
      {isFocused && screenState === 'scanning' ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={enableTorch}
          pictureSize={pictureSize}
          onCameraReady={() => {
            selectPreferredPictureSize(cameraRef.current).then((size) => {
              if (size) setPictureSize(size);
            });
          }}
          {...(scanMode === 'barcode'
            ? {
                barcodeScannerSettings: {
                  barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
                },
                onBarcodeScanned: handleBarcodeScanned,
              }
            : {})}
        />
      ) : null}

      {/* Viewfinder Overlay. Bottom inset belongs to the tab bar, so this view stops above it. */}
      <SafeAreaView style={styles.overlayContainer} edges={['top', 'left', 'right']}>
        <View style={styles.topSection}>
          <View style={styles.topBar}>
            <View style={styles.scanModeRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.scanModeBtn,
                  scanMode === 'label' && styles.scanModeBtnActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  barcodeGuardRef.current.release();
                  setScanMode('label');
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: scanMode === 'label' }}
                accessibilityLabel="Scan a printed ingredient label"
              >
                <Text style={[styles.scanModeText, scanMode === 'label' && styles.scanModeTextActive]}>
                  Label
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.scanModeBtn,
                  scanMode === 'barcode' && styles.scanModeBtnActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setScanMode('barcode')}
                accessibilityRole="button"
                accessibilityState={{ selected: scanMode === 'barcode', busy: isProcessingBarcode }}
                accessibilityLabel="Scan a product barcode"
              >
                <Text style={[styles.scanModeText, scanMode === 'barcode' && styles.scanModeTextActive]}>
                  Barcode
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.topIconBtn,
                enableTorch && styles.topIconBtnActive,
                pressed && styles.pressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => setEnableTorch((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={enableTorch ? 'Turn flash off' : 'Turn flash on'}
            >
              <Ionicons
                name={enableTorch ? 'flash' : 'flash-off'}
                size={18}
                color={enableTorch ? colors.calories : colors.white}
              />
            </Pressable>
          </View>

          {barcodeSearchPill ? (
            <View style={styles.barcodeStatusPill}>
              <Ionicons name="barcode-outline" size={14} color={colors.primary} />
              <Text style={styles.barcodeStatusText} numberOfLines={2}>
                {barcodeSearchPill}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.reticleWrapper}>
          <View style={styles.ocrReticle}>
            <View style={[styles.cornerBracket, styles.bracketTL]} />
            <View style={[styles.cornerBracket, styles.bracketTR]} />
            <View style={[styles.cornerBracket, styles.bracketBL]} />
            <View style={[styles.cornerBracket, styles.bracketBR]} />
            <View style={styles.ocrCenterHelp}>
              <Ionicons
                name={scanMode === 'barcode' ? 'barcode-outline' : 'scan-outline'}
                size={32}
                color="rgba(255,255,255,0.45)"
              />
              <Text style={styles.reticleHelpLabel}>
                {scanMode === 'barcode' ? 'Center the barcode' : 'Frame the ingredient list'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomControlsBar}>
          <View style={styles.shutterRow}>
            <Pressable
              style={({ pressed }) => [styles.sideBarBtn, pressed && styles.pressed]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={handlePickLabelFromGallery}
              accessibilityRole="button"
              accessibilityLabel="Pick ingredient label photo from gallery"
            >
              <Ionicons name="images" size={24} color={colors.white} />
              <Text style={styles.sideBarBtnLabel}>Gallery</Text>
            </Pressable>

            {/* Voice Product Button */}
            <Pressable
              style={({ pressed }) => [styles.sideBarBtn, pressed && styles.pressed]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => {
                safeHaptics.impactLight();
                openVoiceProduct();
              }}
              accessibilityRole="button"
              accessibilityLabel="Add product by speaking"
            >
              <View style={styles.voiceBtnCircle}>
                <Ionicons name="mic" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.sideBarBtnLabel, { color: colors.primaryLight }]}>Speak</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.shutterRing, pressed && styles.pressed]}
              onPress={handleCaptureLabelPhoto}
              accessibilityRole="button"
              accessibilityLabel="Capture photo of ingredient label"
            >
              <View style={styles.shutterCore} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sideBarBtn, pressed && styles.pressed]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => openManualProduct()}
              accessibilityRole="button"
              accessibilityLabel="Type product name manually"
            >
              <Ionicons name="create-outline" size={24} color={colors.white} />
              <Text style={styles.sideBarBtnLabel}>Type</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
        {isTypeProductModalVisible && ManualProduct ? (
          <ManualProduct
            visible={isTypeProductModalVisible}
            onClose={() => setIsTypeProductModalVisible(false)}
            onSubmitResult={(newReport) => {
              setReport(newReport);
              rememberCapture(null);
              setIsSaved(false);
              setScreenState('report');
            }}
          />
        ) : null}
        {isVoiceModalVisible && VoiceProduct ? (
          <VoiceProduct
            visible={isVoiceModalVisible}
            mode="product"
            onClose={() => setIsVoiceModalVisible(false)}
            onSubmitProductResult={(newReport) => {
              setReport(newReport);
              rememberCapture(null);
              setIsSaved(false);
              setScreenState('report');
            }}
          />
        ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.black,
  },
  overlayContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  topSection: {
    flexShrink: 0,
    gap: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  topIconBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: colors.calories,
  },
  scanModeRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    padding: 3,
    gap: 4,
  },
  scanModeBtn: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanModeBtnActive: {
    backgroundColor: colors.primary,
  },
  scanModeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  scanModeTextActive: {
    color: '#04140C',
  },

  barcodeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 12, 16, 0.92)',
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    maxWidth: SCREEN_WIDTH * 0.9,
    marginTop: 6,
  },
  barcodeStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },

  // Reticles
  reticleWrapper: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  ocrReticle: {
    width: SCREEN_WIDTH * 0.88,
    flex: 1,
    maxHeight: 360,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  cornerBracket: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: colors.primary,
  },
  bracketTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  bracketTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  bracketBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  bracketBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  reticleHelpLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  ocrCenterHelp: {
    alignItems: 'center',
    gap: 8,
  },

  // Bottom Controls Bar
  bottomControlsBar: {
    flexShrink: 0,
    paddingBottom: 12,
  },
  shutterRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  sideBarBtn: {
    alignItems: 'center',
    gap: 4,
    minWidth: 54,
  },
  voiceBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBarBtnLabel: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  shutterRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterCore: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
    lineHeight: 18,
  },

  // Report UI
  reportScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  reportHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonClean: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  reportTitleClean: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  saveReportBtnClean: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  saveReportBtnDisabled: {
    borderColor: colors.primary,
  },
  labelPreviewContainer: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  labelPreviewImage: {
    width: '100%',
    height: '100%',
  },

  // Gauge Hero Card
  provenanceDemoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 12,
  },
  provenanceDemoText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
    letterSpacing: 0.2,
  },
  provenanceVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 12,
  },
  provenanceVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.2,
  },
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
    borderColor: colors.cardBorder,
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
  retryProductBtnClean: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    alignSelf: 'center',
  },
  retryProductBtnTextClean: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
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
  harmfulItemCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  harmfulItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  harmfulItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  harmfulMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  harmfulCategoryTag: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  harmfulRankTag: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deductionBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deductionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger,
  },
  rationaleBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
  },
  rationaleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rationaleText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  sourceCitationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  sourceLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sourceLinkText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
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

  // Scan Next Button
  scanNextBtnClean: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 52,
    marginBottom: 16,
  },
  scanNextBtnTextClean: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textInverse,
  },

  // Permissions Card
  permissionCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  permissionIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 320,
  },
  grantPermissionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  grantPermissionText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textInverse,
  },
  settingsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    width: '100%',
    marginBottom: 10,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  settingsLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  disclaimerTextClean: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: 16,
    lineHeight: 14,
    paddingHorizontal: 16,
  },
});
}

