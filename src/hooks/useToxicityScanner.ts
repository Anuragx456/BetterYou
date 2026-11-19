import { useCameraPermissions, type CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  CAPTURE_JPEG_QUALITY,
  selectPreferredPictureSize,
} from '../utils/cameraPictureSize';
import { createBarcodeScanGuard } from '../utils/barcodeScanGuard';
import { optimizeImageForAiVision } from '../utils/imageOptimizer';
import { useFitnessStore } from '../store/useFitnessStore';
import { ToxicityReport } from '../types';
import { safeHaptics } from '../utils/haptics';

async function screenLabelImage(base64: string, fileUri: string, hint?: string) {
  const vision = await import('../services/aiVisionService');
  const imageHash = fileUri ? await vision.hashImageFile(fileUri) : '';
  return vision.analyzeIngredientsImage(base64, {
    productNameHint: hint,
    imageHash: imageHash || undefined,
    localImagePath: fileUri,
  });
}

export type ScreenState = 'scanning' | 'loading' | 'report';

export function useToxicityScanner() {
  const router = useRouter();
  const addScannedProduct = useFitnessStore((state) => state.addScannedProduct);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const barcodeGuardRef = useRef(createBarcodeScanGuard());
  const [scanMode, setScanMode] = useState<'label' | 'barcode'>('label');
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

  const [screenState, setScreenState] = useState<ScreenState>('scanning');
  const [enableTorch, setEnableTorch] = useState<boolean>(false);
  const [report, setReport] = useState<ToxicityReport | null>(null);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [labelPreviewUri, setLabelPreviewUri] = useState<string | null>(null);

  const rememberCapture = useCallback((fullUri: string | null, thumbUri?: string | null) => {
    setCapturedImageUri(fullUri);
    setLabelPreviewUri(thumbUri || fullUri);
  }, []);

  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isProcessingBarcode, setIsProcessingBarcode] = useState<boolean>(false);
  const [barcodeSearchPill, setBarcodeSearchPill] = useState<string | null>(null);

  const handleResetScanner = useCallback(() => {
    setReport(null);
    rememberCapture(null);
    setIsSaved(false);
    setIsProcessingBarcode(false);
    setBarcodeSearchPill(null);
    setScreenState('scanning');
  }, [rememberCapture]);

  const handleSaveEdit = useCallback(async (newName: string, newIngredients: string[]) => {
    if (!report) return;
    const { recalculateToxicityReport } = await import('../services/barcodeService');
    const updated = recalculateToxicityReport(newName, newIngredients, report);
    setReport(updated);
    Alert.alert('Report Updated!', 'Safety score, additives, and Indian market alerts have been recalculated.');
  }, [report]);

  const handleRetryWithProductName = useCallback(async (newProductName: string) => {
    const cleanName = newProductName.trim();
    if (!cleanName) return;

    setScreenState('loading');
    safeHaptics.impactMedium();

    try {
      let updatedReport: ToxicityReport;

      if (capturedImageUri) {
        try {
          const optimized = await optimizeImageForAiVision(capturedImageUri, 1024);
          updatedReport = await screenLabelImage(
            optimized.base64 || '',
            optimized.uri || capturedImageUri,
            cleanName
          );
        } catch {
          const { analyzeProductText } = await import('../services/aiVisionService');
          updatedReport = await analyzeProductText(cleanName);
        }
      } else {
        const { analyzeProductText } = await import('../services/aiVisionService');
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
  }, [capturedImageUri]);

  const handleBarcodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scanMode !== 'barcode' || screenState !== 'scanning' || !data) return;
    if (!barcodeGuardRef.current.tryAcquire()) return;
    setIsProcessingBarcode(true);
    setBarcodeSearchPill(`Checking barcode: ${data}...`);

    try {
      const { fetchProductByBarcode } = await import('../services/barcodeService');
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
  }, [scanMode, screenState]);

  const handlePickLabelFromGallery = useCallback(async () => {
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
  }, [rememberCapture]);

  const handleCaptureLabelPhoto = useCallback(async () => {
    if (!cameraRef.current) {
      Alert.alert(
        'Camera Unavailable',
        'Camera is not ready or unavailable on this device. Please select a packaging photo from your gallery or type ingredients manually.',
        [
          { text: 'Gallery', onPress: handlePickLabelFromGallery },
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
  }, [handlePickLabelFromGallery, rememberCapture, router]);

  const handleSaveToMyScans = useCallback(() => {
    if (!report) return;

    addScannedProduct({
      productName: report.productName || 'Inspected Product',
      report,
      imageUrl: capturedImageUri ?? undefined,
    });

    setIsSaved(true);
    safeHaptics.success();
    Alert.alert('Saved!', 'Product toxicity report added to your dashboard history.');
  }, [addScannedProduct, capturedImageUri, report]);

  return {
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
  };
}
