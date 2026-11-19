import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MealVerificationCard } from '../../components/meal/MealVerificationCard';
import { MealViewfinder } from '../../components/meal/MealViewfinder';
import { useMealScanner } from '../../hooks/useMealScanner';
import { selectPreferredPictureSize } from '../../utils/cameraPictureSize';
import { useThemeColors } from '../../theme/theme';
import { useOnDemandComponent } from '../../utils/useOnDemandComponent';

export default function MealScanScreen() {
  const colors = useThemeColors();
  const [isFocused, setIsFocused] = useState<boolean>(true);

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
    stage,
    setStage,
    enableTorch,
    setEnableTorch,
    capturedImageUri,
    pictureSize,
    setPictureSize,
    aiResult,
    setAiResult,
    portionMultiplier,
    setPortionMultiplier,
    isSaving,
    userCorrections,
    originalAiResult,
    setOriginalAiResult,
    setWasCorrected,
    dismissDeviation,
    setDismissDeviation,
    handlePickFromGallery,
    handleCapturePhoto,
    handleAdjustPortion,
    handleSaveMeal,
  } = useMealScanner();

  // Lazy loaded modals
  const [isTypeModalVisible, setIsTypeModalVisible] = useState<boolean>(false);
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState<boolean>(false);

  const [ManualMeal, loadManualMeal] = useOnDemandComponent(() =>
    import('../../components/ManualMealModal').then((mod) => mod.ManualMealModal)
  );
  const [VoiceMeal, loadVoiceMeal] = useOnDemandComponent(() =>
    import('../../components/VoiceInputModal').then((mod) => mod.VoiceInputModal)
  );

  const openManualMeal = useCallback(() => {
    loadManualMeal();
    setIsTypeModalVisible(true);
  }, [loadManualMeal]);

  const openVoiceMeal = useCallback(() => {
    loadVoiceMeal();
    setIsVoiceModalVisible(true);
  }, [loadVoiceMeal]);

  // STAGE 2: ANALYZING STATE
  if (stage === 'analyzing') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.analyzingContainer}>
          {capturedImageUri ? (
            <View style={[styles.analyzingImageWrapper, { borderColor: colors.cardBorder }]}>
              <Image
                source={{ uri: capturedImageUri }}
                style={styles.analyzingImage}
                contentFit="cover"
              />
            </View>
          ) : (
            <View style={[styles.analyzingPlaceholder, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="fast-food-outline" size={48} color={colors.primary} />
            </View>
          )}

          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 24 }} />
          <Text style={[styles.analyzingTitle, { color: colors.text }]}>Analyzing Meal</Text>
          <Text style={[styles.analyzingSub, { color: colors.textSecondary }]}>
            Estimating ingredients, weight, and macronutrients
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // STAGE 3: INTERACTIVE VERIFICATION SHEET
  if (stage === 'verifying' && aiResult) {
    return (
      <>
        <MealVerificationCard
          aiResult={aiResult}
          capturedImageUri={capturedImageUri}
          portionMultiplier={portionMultiplier}
          userCorrections={userCorrections}
          originalAiResult={originalAiResult}
          dismissDeviation={dismissDeviation}
          isSaving={isSaving}
          onRetake={() => {
            setStage('viewfinder');
            setAiResult(null);
            setWasCorrected(false);
            setDismissDeviation(false);
            setOriginalAiResult(null);
          }}
          onAdjustPortion={handleAdjustPortion}
          onSetPortion={setPortionMultiplier}
          onApplyReference={(unscaled) => {
            if (!originalAiResult) setOriginalAiResult(aiResult);
            setAiResult({
              ...aiResult,
              calories: unscaled.calories,
              protein: unscaled.protein,
              carbs: unscaled.carbs,
              fat: unscaled.fat,
              generatedBy: unscaled.provenance,
            });
            setWasCorrected(true);
            setDismissDeviation(true);
          }}
          onDismissDeviation={() => setDismissDeviation(true)}
          onOpenManualMeal={openManualMeal}
          onSaveMeal={handleSaveMeal}
        />

        {isTypeModalVisible && ManualMeal ? (
          <ManualMeal
            visible={isTypeModalVisible}
            onClose={() => setIsTypeModalVisible(false)}
            onSubmitResult={(newMeal) => {
              setAiResult(newMeal);
              setStage('verifying');
            }}
          />
        ) : null}
      </>
    );
  }

  // STAGE 1: INGREDIENT LABEL OCR VIEWFINDER
  return (
    <>
      <MealViewfinder
        isFocused={isFocused && stage === 'viewfinder'}
        cameraRef={cameraRef}
        enableTorch={enableTorch}
        pictureSize={pictureSize}
        hasPermission={Boolean(permission?.granted)}
        onRequestPermission={requestPermission}
        onCameraReady={() => {
          selectPreferredPictureSize(cameraRef.current).then((size: string | undefined) => {
            if (size) setPictureSize(size);
          });
        }}
        onToggleTorch={() => setEnableTorch((prev) => !prev)}
        onPickGallery={handlePickFromGallery}
        onOpenVoice={openVoiceMeal}
        onCapturePhoto={handleCapturePhoto}
        onOpenManual={openManualMeal}
      />

      {isTypeModalVisible && ManualMeal ? (
        <ManualMeal
          visible={isTypeModalVisible}
          onClose={() => setIsTypeModalVisible(false)}
          onSubmitResult={(newMeal) => {
            setAiResult(newMeal);
            setStage('verifying');
          }}
        />
      ) : null}

      {isVoiceModalVisible && VoiceMeal ? (
        <VoiceMeal
          visible={isVoiceModalVisible}
          mode="meal"
          onClose={() => setIsVoiceModalVisible(false)}
          onSubmitMealResult={(newMeal) => {
            setAiResult(newMeal);
            setStage('verifying');
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
  analyzingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  analyzingImageWrapper: {
    width: 220,
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  analyzingImage: {
    width: '100%',
    height: '100%',
  },
  analyzingPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
    letterSpacing: -0.3,
  },
  analyzingSub: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
});
