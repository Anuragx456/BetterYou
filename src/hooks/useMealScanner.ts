import { useCameraPermissions, type CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { dbGetAllCorrections, dbInsertCorrection } from '../db/client';
import { useFitnessStore } from '../store/useFitnessStore';
import type { MealAnalysisResult } from '../types';
import { CAPTURE_JPEG_QUALITY } from '../utils/cameraPictureSize';
import { safeHaptics } from '../utils/haptics';
import { optimizeImageForAiVision } from '../utils/imageOptimizer';
import type { UserMealCorrection } from '../utils/indianFoodMatcher';

export type ScanStage = 'viewfinder' | 'analyzing' | 'verifying';

export function useMealScanner() {
  const router = useRouter();
  const addMeal = useFitnessStore((state) => state.addMeal);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [stage, setStage] = useState<ScanStage>('viewfinder');
  const [enableTorch, setEnableTorch] = useState<boolean>(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [capturedThumbUri, setCapturedThumbUri] = useState<string | null>(null);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const [aiResult, setAiResult] = useState<MealAnalysisResult | null>(null);
  const [portionMultiplier, setPortionMultiplier] = useState<number>(1.0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [userCorrections, setUserCorrections] = useState<UserMealCorrection[]>([]);
  const [originalAiResult, setOriginalAiResult] = useState<MealAnalysisResult | null>(null);
  const [wasCorrected, setWasCorrected] = useState<boolean>(false);
  const [dismissDeviation, setDismissDeviation] = useState<boolean>(false);

  const processImageForAnalysis = useCallback(
    async (
      uri: string,
      base64: string | undefined,
      thumbnailUri?: string
    ) => {
      setCapturedImageUri(uri);
      setCapturedThumbUri(thumbnailUri ?? null);
      setStage('analyzing');
      setPortionMultiplier(1.0);

      try {
        let finalBase64 = base64;
        let finalThumb = thumbnailUri;
        let hashUri = uri;
        if (!finalBase64 && uri) {
          const opt = await optimizeImageForAiVision(uri, 1024);
          finalBase64 = opt.base64;
          finalThumb = opt.thumbnailUri ?? finalThumb;
          hashUri = opt.uri || uri;
          setCapturedThumbUri(finalThumb ?? null);
          if (opt.uri) setCapturedImageUri(opt.uri);
        }
        const vision = await import('../services/aiVisionService');
        const imageHash = hashUri ? await vision.hashImageFile(hashUri) : '';
        const result = await vision.analyzeMealImage(finalBase64 || '', {
          imageHash: imageHash || undefined,
          localImagePath: hashUri,
        });
        setAiResult(result);
        setOriginalAiResult(result);
        setWasCorrected(false);
        setDismissDeviation(false);
        dbGetAllCorrections('meal').then((rows) => {
          const parsed: UserMealCorrection[] = [];
          for (const r of rows) {
            try {
              const c = JSON.parse(r.correctedJson);
              if (c && c.dishName) {
                parsed.push({
                  dishName: c.dishName,
                  portionGrams: c.portionGrams || 250,
                  calories: c.calories || 0,
                  protein: c.protein || 0,
                  carbs: c.carbs || 0,
                  fat: c.fat || 0,
                  timestamp: r.timestamp,
                });
              }
            } catch {}
          }
          setUserCorrections(parsed);
        }).catch(() => {});
        setStage('verifying');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert(
          'Analysis Failed',
          `Unable to analyze meal image: ${msg}. Try capturing again.`,
          [{ text: 'OK', onPress: () => setStage('viewfinder') }]
        );
        setStage('viewfinder');
      }
    },
    []
  );

  const handlePickFromGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: CAPTURE_JPEG_QUALITY,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setCapturedImageUri(asset.uri);
        setStage('analyzing');
        const optimized = await optimizeImageForAiVision(asset.uri, 1024);
        await processImageForAnalysis(optimized.uri || asset.uri, optimized.base64, optimized.thumbnailUri);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Gallery Error', `Failed to open image picker: ${msg}`);
    }
  }, [processImageForAnalysis]);

  const handleSimulateSampleMeal = useCallback(async () => {
    setCapturedImageUri(null);
    setStage('analyzing');
    setPortionMultiplier(1.0);

    const { analyzeMealImage } = await import('../services/aiVisionService');
    const result = await analyzeMealImage('demo_sample', { isExplicitDemo: true });
    setAiResult(result);
    setStage('verifying');
  }, []);

  const handleCapturePhoto = useCallback(async () => {
    if (!cameraRef.current) {
      Alert.alert(
        'Camera Unavailable',
        'Camera is not ready or unavailable on this device. Please select a photo from your gallery or log meal manually.',
        [
          { text: 'Gallery', onPress: handlePickFromGallery },
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
        const optimized = await optimizeImageForAiVision(photo.uri, 1024);
        await processImageForAnalysis(optimized.uri || photo.uri, optimized.base64, optimized.thumbnailUri);
      }
    } catch (err: unknown) {
      console.warn('Camera capture error, offering demo sample:', err);
      handleSimulateSampleMeal();
    }
  }, [handlePickFromGallery, handleSimulateSampleMeal, processImageForAnalysis]);

  const handleAdjustPortion = useCallback((delta: number) => {
    safeHaptics.selection();
    setPortionMultiplier((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      return Math.max(0.2, Math.min(3.0, next));
    });
  }, []);

  const handleSaveMeal = useCallback(() => {
    if (!aiResult) return;

    setIsSaving(true);
    const scaledCalories = Math.round(aiResult.calories * portionMultiplier);
    const scaledProtein = Math.round(aiResult.protein * portionMultiplier);
    const scaledCarbs = Math.round(aiResult.carbs * portionMultiplier);
    const scaledFat = Math.round(aiResult.fat * portionMultiplier);
    const scaledGrams = Math.round(aiResult.estimatedWeightGrams * portionMultiplier);

    addMeal({
      dishName: aiResult.dishName,
      calories: scaledCalories,
      protein: scaledProtein,
      carbs: scaledCarbs,
      fat: scaledFat,
      estimatedWeightGrams: scaledGrams,
      portionMultiplier,
      imageUri: capturedImageUri ?? undefined,
      thumbnailUri: capturedThumbUri ?? undefined,
      ingredientsDetected: aiResult.ingredientsDetected,
    });

    if (wasCorrected && originalAiResult) {
      dbInsertCorrection({
        type: 'meal',
        originalJson: JSON.stringify({
          dishName: originalAiResult.dishName,
          portionGrams: originalAiResult.estimatedWeightGrams,
          calories: originalAiResult.calories,
          protein: originalAiResult.protein,
          carbs: originalAiResult.carbs,
          fat: originalAiResult.fat,
        }),
        correctedJson: JSON.stringify({
          dishName: aiResult.dishName,
          portionGrams: scaledGrams,
          calories: scaledCalories,
          protein: scaledProtein,
          carbs: scaledCarbs,
          fat: scaledFat,
        }),
      }).catch(() => {});
    }

    setIsSaving(false);
    safeHaptics.success();

    Alert.alert(
      'Meal Logged',
      `Saved ${scaledCalories} kcal (${aiResult.dishName}) to today's log.`,
      [
        {
          text: 'View Dashboard',
          onPress: () => {
            setStage('viewfinder');
            setAiResult(null);
            router.push('/');
          },
        },
        {
          text: 'Log Another',
          onPress: () => {
            setStage('viewfinder');
            setAiResult(null);
          },
        },
      ]
    );
  }, [
    addMeal,
    aiResult,
    capturedImageUri,
    capturedThumbUri,
    originalAiResult,
    portionMultiplier,
    router,
    wasCorrected,
  ]);

  return {
    permission,
    requestPermission,
    cameraRef,
    stage,
    setStage,
    enableTorch,
    setEnableTorch,
    capturedImageUri,
    setCapturedImageUri,
    capturedThumbUri,
    setCapturedThumbUri,
    pictureSize,
    setPictureSize,
    aiResult,
    setAiResult,
    portionMultiplier,
    setPortionMultiplier,
    isSaving,
    userCorrections,
    setUserCorrections,
    originalAiResult,
    setOriginalAiResult,
    wasCorrected,
    setWasCorrected,
    dismissDeviation,
    setDismissDeviation,
    processImageForAnalysis,
    handlePickFromGallery,
    handleCapturePhoto,
    handleSimulateSampleMeal,
    handleAdjustPortion,
    handleSaveMeal,
  };
}
