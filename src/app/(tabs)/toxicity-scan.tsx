import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScannedProductReportView } from '../../components/scan/ScannedProductReportView';
import { ScanViewfinder } from '../../components/scan/ScanViewfinder';
import { useToxicityScanner } from '../../hooks/useToxicityScanner';
import {
  getActiveModelDisplayName,
  useSettingsStore,
} from '../../store/useSettingsStore';
import { useThemeColors } from '../../theme/theme';
import { selectPreferredPictureSize } from '../../utils/cameraPictureSize';
import { useOnDemandComponent } from '../../utils/useOnDemandComponent';

export default function ToxicityScanScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [isFocused, setIsFocused] = useState<boolean>(true);

  // Re-render when active model settings change
  useSettingsStore((state) => state.selectedModel);
  useSettingsStore((state) => state.customModelName);
  const activeModelName = getActiveModelDisplayName();

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  const {
    permission,
    requestPermission,
    cameraRef,
    barcodeGuardRef,
    scanMode,
    setScanMode,
    pictureSize,
    setPictureSize,
    screenState,
    setScreenState,
    enableTorch,
    setEnableTorch,
    report,
    setReport,
    capturedImageUri,
    labelPreviewUri,
    rememberCapture,
    isSaved,
    setIsSaved,
    isProcessingBarcode,
    barcodeSearchPill,
    handleResetScanner,
    handleSaveEdit,
    handleRetryWithProductName,
    handleBarcodeScanned,
    handlePickLabelFromGallery,
    handleCaptureLabelPhoto,
    handleSaveToMyScans,
  } = useToxicityScanner();

  // Lazy loaded modals
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [isRetryModalVisible, setIsRetryModalVisible] = useState<boolean>(false);
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

  // Loading State
  if (screenState === 'loading') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingTitle, { color: colors.text }]}>
            AI Ingredient Risk Screening OCR...
          </Text>
          <Text style={[styles.loadingSub, { color: colors.textSecondary }]}>
            Reading printed back-of-pack ingredients, chemical additives, petroleum fillers, and safety warnings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Report State
  if (screenState === 'report' && report) {
    return (
      <>
        <ScannedProductReportView
          report={report}
          labelPreviewUri={labelPreviewUri}
          isSaved={isSaved}
          activeModelName={activeModelName}
          onResetScanner={handleResetScanner}
          onSaveToMyScans={handleSaveToMyScans}
          onOpenEditProduct={openEditProduct}
          onOpenRetryProduct={openRetryProduct}
        />

        {isEditModalVisible && EditProduct ? (
          <EditProduct
            visible={isEditModalVisible}
            initialName={report.productName || ''}
            initialIngredients={report.allIngredients || []}
            onClose={() => setIsEditModalVisible(false)}
            onSave={handleSaveEdit}
          />
        ) : null}

        {isRetryModalVisible && RetryProduct ? (
          <RetryProduct
            visible={isRetryModalVisible}
            currentProductName={report.productName || ''}
            hasCapturedImage={Boolean(capturedImageUri)}
            onClose={() => setIsRetryModalVisible(false)}
            onRetry={handleRetryWithProductName}
          />
        ) : null}
      </>
    );
  }

  // Permission Check
  if (!permission) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.permissionCard, { justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.permissionTitle, { color: colors.text, marginTop: 16 }]}>
            Initializing Scanner...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.permissionCard}>
          <View
            style={[
              styles.permissionIconCircle,
              {
                backgroundColor: colors.primaryMuted,
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons name="document-text-outline" size={42} color={colors.primary} />
          </View>
          <Text style={[styles.permissionTitle, { color: colors.text }]}>
            Camera Permission Required
          </Text>
          <Text style={[styles.permissionBody, { color: colors.textSecondary }]}>
            BetterYou needs camera access to photograph and evaluate ingredient labels and chemical warnings on packaged products.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.grantPermissionBtn,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="Grant camera access permission"
          >
            <Text style={[styles.grantPermissionText, { color: colors.textInverse }]}>
              Grant Camera Access
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.settingsLinkBtn, pressed && styles.pressed]}
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Open device settings to manage camera permissions"
          >
            <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.settingsLinkText, { color: colors.textSecondary }]}>
              Open App Settings
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.grantPermissionBtn,
              {
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                marginTop: 10,
              },
              pressed && styles.pressed,
            ]}
            onPress={openManualProduct}
          >
            <Text style={[styles.grantPermissionText, { color: colors.text }]}>
              Type Product Manually
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.grantPermissionBtn,
              {
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                marginTop: 10,
              },
              pressed && styles.pressed,
            ]}
            onPress={openVoiceProduct}
            accessibilityRole="button"
            accessibilityLabel="Speak product name"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="mic-outline" size={18} color={colors.primary} />
              <Text style={[styles.grantPermissionText, { color: colors.text }]}>
                Speak Product Name
              </Text>
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

  // Viewfinder State
  return (
    <>
      <ScanViewfinder
        isFocused={isFocused && screenState === 'scanning'}
        cameraRef={cameraRef}
        enableTorch={enableTorch}
        scanMode={scanMode}
        pictureSize={pictureSize}
        isProcessingBarcode={isProcessingBarcode}
        barcodeSearchPill={barcodeSearchPill}
        activeModelName={activeModelName}
        onCameraReady={() => {
          selectPreferredPictureSize(cameraRef.current).then((size: string | undefined) => {
            if (size) setPictureSize(size);
          });
        }}
        onBarcodeScanned={handleBarcodeScanned}
        onSetScanMode={(mode) => {
          barcodeGuardRef.current.release();
          setScanMode(mode);
        }}
        onToggleTorch={() => setEnableTorch((prev) => !prev)}
        onPickGallery={handlePickLabelFromGallery}
        onOpenVoice={openVoiceProduct}
        onCapturePhoto={handleCaptureLabelPhoto}
        onOpenManual={openManualProduct}
        onOpenSettings={() => router.push('/(tabs)/settings')}
      />

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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
    lineHeight: 18,
  },
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  grantPermissionBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  grantPermissionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 6,
  },
  settingsLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});
