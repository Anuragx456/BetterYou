import { AI_NUTRITION_DISCLAIMER, AI_PRIVACY_NOTICE } from '../../constants/disclaimers';
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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ManualMealModal } from '../../components/ManualMealModal';
import { VoiceInputModal } from '../../components/VoiceInputModal';
import { analyzeMealImage } from '../../services/aiVisionService';
import { optimizeImageForAiVision } from '../../utils/imageOptimizer';
import { useFitnessStore } from '../../store/useFitnessStore';
import { safeHaptics } from '../../utils/haptics';
import { colors } from '../../theme/colors';
import { MealAnalysisResult } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RETICLE_SIZE = SCREEN_WIDTH * 0.78;

type ScanStage = 'viewfinder' | 'analyzing' | 'verifying';

const PORTION_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export default function MealScanScreen() {
  const router = useRouter();
  const [isFocused, setIsFocused] = useState<boolean>(true);
  const addMeal = useFitnessStore((state) => state.addMeal);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // State
  const [stage, setStage] = useState<ScanStage>('viewfinder');
  const [facing] = useState<'back' | 'front'>('back');
  const [enableTorch, setEnableTorch] = useState<boolean>(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<MealAnalysisResult | null>(null);
  const [portionMultiplier, setPortionMultiplier] = useState<number>(1.0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTypeModalVisible, setIsTypeModalVisible] = useState<boolean>(false);
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState<boolean>(false);

  // Trigger AI analysis on a chosen image
  const processImageForAnalysis = async (uri: string, base64: string | undefined) => {
    // Store only the lightweight local file URI to prevent SQLite CursorWindow bloat in AsyncStorage
    setCapturedImageUri(uri);
    setStage('analyzing');
    setPortionMultiplier(1.0);

    try {
      let finalBase64 = base64;
      if (!finalBase64 && uri) {
        const opt = await optimizeImageForAiVision(uri, 1024);
        finalBase64 = opt.base64;
      }
      // Analyze with Gemini Vision using optimized ephemeral base64 or mock fallback
      const result = await analyzeMealImage(finalBase64 || '');
      setAiResult(result);
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
  };

  // Capture from CameraView
  const handleCapturePhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert(
        'Camera Unavailable',
        'Camera is not ready or unavailable on this device. Please select a photo from your gallery or log meal manually.',
        [
          { text: 'Gallery', onPress: handlePickFromGallery },
          { text: 'Manual Entry', onPress: () => setIsTypeModalVisible(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    try {
      safeHaptics.impactHeavy();
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (photo?.uri) {
        setCapturedImageUri(photo.uri);
        setStage('analyzing');
        const optimized = await optimizeImageForAiVision(photo.uri, 1024);
        await processImageForAnalysis(optimized.uri || photo.uri, optimized.base64);
      }
    } catch (err: unknown) {
      console.warn('Camera capture error, offering demo sample:', err);
      handleSimulateSampleMeal();
    }
  };

  // Pick from Photo Gallery
  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setCapturedImageUri(asset.uri);
        setStage('analyzing');
        const optimized = await optimizeImageForAiVision(asset.uri, 1024);
        await processImageForAnalysis(optimized.uri || asset.uri, optimized.base64);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Gallery Error', `Failed to open image picker: ${msg}`);
    }
  };

  // Demo Fallback for Simulator / Desktop environments
  const handleSimulateSampleMeal = async () => {
    setCapturedImageUri(null);
    setStage('analyzing');
    setPortionMultiplier(1.0);

    // Call AI vision service with explicit demo flag
    const result = await analyzeMealImage('demo_sample', { isExplicitDemo: true });
    setAiResult(result);
    setStage('verifying');
  };

  // Portion multiplier adjustment
  const handleAdjustPortion = (delta: number) => {
    safeHaptics.selection();
    setPortionMultiplier((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      return Math.max(0.2, Math.min(3.0, next));
    });
  };

  // Save to Today's Log
  const handleSaveMeal = () => {
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
      ingredientsDetected: aiResult.ingredientsDetected,
    });

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
  };

  // -------------------------------------------------------------
  // STAGE 2: ANALYZING STATE
  // -------------------------------------------------------------
  if (stage === 'analyzing') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.analyzingContainer}>
          {capturedImageUri ? (
            <View style={styles.analyzingImageWrapper}>
              <Image
                source={{ uri: capturedImageUri }}
                style={styles.analyzingImage}
                contentFit="cover"
              />
            </View>
          ) : (
            <View style={styles.analyzingPlaceholder}>
              <Ionicons name="fast-food-outline" size={48} color={colors.primary} />
            </View>
          )}

          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 24 }} />
          <Text style={styles.analyzingTitle}>Analyzing Meal</Text>
          <Text style={styles.analyzingSub}>
            Estimating ingredients, weight, and macronutrients
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // STAGE 3: INTERACTIVE VERIFICATION SHEET
  // -------------------------------------------------------------
  if (stage === 'verifying' && aiResult) {
    const scaledCalories = Math.round(aiResult.calories * portionMultiplier);
    const scaledProtein = Math.round(aiResult.protein * portionMultiplier);
    const scaledCarbs = Math.round(aiResult.carbs * portionMultiplier);
    const scaledFat = Math.round(aiResult.fat * portionMultiplier);
    const scaledGrams = Math.round(aiResult.estimatedWeightGrams * portionMultiplier);

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.verifyScroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.verifyHeaderRow}>
            <Pressable
              style={({ pressed }) => [styles.retakeButton, pressed && styles.pressed]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => {
                setStage('viewfinder');
                setAiResult(null);
              }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>

            {aiResult.generatedBy === 'offline-demo-mock' ? (
              <View style={[styles.confidenceBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: colors.calories }]}>
                <Ionicons name="flask-outline" size={14} color={colors.calories} />
                <Text style={[styles.confidenceText, { color: colors.calories }]}>Offline Demo Simulation</Text>
              </View>
            ) : aiResult.isPlausible ? (
              <View style={styles.confidenceBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                <Text style={styles.confidenceText}>Macro Balanced (4P+4C+9F)</Text>
              </View>
            ) : (
              <View style={[styles.confidenceBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' }]}>
                <Ionicons name="warning-outline" size={14} color="#ef4444" />
                <Text style={[styles.confidenceText, { color: '#ef4444' }]}>Macro Discrepancy</Text>
              </View>
            )}
          </View>

          {/* Captured Image Preview */}
          {capturedImageUri && (
            <View style={styles.previewImageContainer}>
              <Image
                source={{ uri: capturedImageUri }}
                style={styles.previewImage}
                contentFit="cover"
              />
            </View>
          )}

          {/* Dish Header & Weight */}
          <View style={styles.dishCardClean}>
            <Text style={styles.dishNameTextClean}>{aiResult.dishName}</Text>
            <Text style={styles.dishWeightSubClean}>~{scaledGrams}g</Text>
          </View>

          {/* Plausibility Warning Banner */}
          {!aiResult.isPlausible && aiResult.plausibilityWarning && (
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <Text style={{ color: '#fca5a5', fontSize: 12, lineHeight: 16 }}>
                ⚠️ {aiResult.plausibilityWarning}
              </Text>
            </View>
          )}

          {/* Fallback to Manual Entry Prompt */}
          {aiResult.fallbackToManual && (
            <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 12, borderRadius: 8, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              <Text style={{ color: colors.calories, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
                Uncertain Vision Estimate
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginBottom: 8 }}>
                Visual recognition could not confirm high-confidence macros. You can adjust the numbers below or switch to manual entry.
              </Text>
              <Pressable
                style={{ alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.card, borderRadius: 6, borderWidth: 1, borderColor: colors.cardBorder }}
                onPress={() => setIsTypeModalVisible(true)}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>Enter Details Manually</Text>
              </Pressable>
            </View>
          )}

          {/* Calorie Hero Metric */}
          <View style={styles.calorieHeroContainer}>
            <Text style={styles.calorieHeroNumber}>
              {scaledCalories}{' '}
              <Text style={styles.calorieHeroUnit}>kcal</Text>
            </Text>
          </View>

          {/* Minimal 3 Macro Pills */}
          <View style={styles.macroPillsRow}>
            <View style={styles.macroPillClean}>
              <Ionicons name="barbell-outline" size={14} color={colors.protein} />
              <View style={styles.macroPillTextCol}>
                <Text style={styles.macroPillValue}>{scaledProtein}g</Text>
                <Text style={styles.macroPillLabel}>Protein</Text>
              </View>
            </View>

            <View style={styles.macroPillClean}>
              <Ionicons name="nutrition-outline" size={14} color={colors.carbs} />
              <View style={styles.macroPillTextCol}>
                <Text style={styles.macroPillValue}>{scaledCarbs}g</Text>
                <Text style={styles.macroPillLabel}>Carbs</Text>
              </View>
            </View>

            <View style={styles.macroPillClean}>
              <Ionicons name="water-outline" size={14} color={colors.fat} />
              <View style={styles.macroPillTextCol}>
                <Text style={styles.macroPillValue}>{scaledFat}g</Text>
                <Text style={styles.macroPillLabel}>Fat</Text>
              </View>
            </View>
          </View>

          {/* Portion Stepper */}
          <View style={styles.portionCleanCard}>
            <View style={styles.portionStepperRow}>
              <Pressable
                style={({ pressed }) => [styles.portionStepBtn, pressed && styles.pressed]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => handleAdjustPortion(-0.1)}
              >
                <Ionicons name="remove" size={18} color={colors.text} />
              </Pressable>

              <View style={styles.portionDisplayCol}>
                <Text style={styles.portionValueClean}>{portionMultiplier.toFixed(1)}x</Text>
                <Text style={styles.portionLabelClean}>Portion</Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.portionStepBtn, pressed && styles.pressed]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => handleAdjustPortion(0.1)}
              >
                <Ionicons name="add" size={18} color={colors.text} />
              </Pressable>
            </View>

            {/* Quick Preset Row */}
            <View style={styles.presetCleanRow}>
              {PORTION_PRESETS.map((preset) => {
                const isSelected = portionMultiplier === preset;
                return (
                  <Pressable
                    key={preset}
                    style={({ pressed }) => [
                      styles.presetCleanBtn,
                      isSelected && styles.presetCleanBtnSelected,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      safeHaptics.selection();
                      setPortionMultiplier(preset);
                    }}
                  >
                    <Text
                      style={[
                        styles.presetCleanBtnText,
                        isSelected && styles.presetCleanBtnTextSelected,
                      ]}
                    >
                      {preset}x
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Detected Ingredients Section (Collapsible / Clean) */}
          {aiResult.ingredientsDetected && aiResult.ingredientsDetected.length > 0 && (
            <View style={styles.ingredientsCleanCard}>
              <Text style={styles.ingredientsCleanHeader}>Detected Ingredients</Text>
              <View style={styles.ingredientsCleanWrap}>
                {aiResult.ingredientsDetected.map((ing, i) => (
                  <View key={i} style={styles.ingredientCleanChip}>
                    <Text style={styles.ingredientCleanChipText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Save Action Button */}
          <Pressable
            style={({ pressed }) => [
              styles.saveButtonClean,
              isSaving && styles.saveButtonDisabled,
              pressed && styles.pressed,
            ]}
            onPress={handleSaveMeal}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.saveButtonTextClean}>Log to Today</Text>
            )}
          </Pressable>

          <Text style={styles.disclaimerTextClean}>{AI_NUTRITION_DISCLAIMER}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // PERMISSION CHECK STATE
  // -------------------------------------------------------------
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.permissionCard, { justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.permissionTitle, { marginTop: 16 }]}>Initializing Camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconCircle}>
            <Ionicons name="camera" size={42} color={colors.primary} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionBody}>
            BetterYou uses camera vision to identify meals, estimate portion weights, and automatically calculate your daily macronutrients.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.grantPermissionBtn, pressed && styles.pressed]}
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="Grant camera permission"
          >
            <Text style={styles.grantPermissionText}>Grant Camera Permission</Text>
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
            style={({ pressed }) => [styles.galleryFallbackBtn, pressed && styles.pressed]}
            onPress={handlePickFromGallery}
          >
            <Ionicons name="images-outline" size={18} color={colors.primary} />
            <Text style={styles.galleryFallbackText}>Choose from Photo Gallery</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.galleryFallbackBtn, { marginTop: 10 }, pressed && styles.pressed]}
            onPress={() => setIsTypeModalVisible(true)}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={styles.galleryFallbackText}>Type Meal Manually</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.galleryFallbackBtn, { marginTop: 10 }, pressed && styles.pressed]}
            onPress={() => setIsVoiceModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Speak meal description"
          >
            <Ionicons name="mic-outline" size={18} color={colors.primary} />
            <Text style={styles.galleryFallbackText}>Speak Meal Description</Text>
          </Pressable>

          <Pressable
            style={styles.demoFallbackBtn}
            onPress={handleSimulateSampleMeal}
          >
            <Text style={styles.demoFallbackText}>Simulate Demo Food Scan</Text>
          </Pressable>
        </View>
        {isTypeModalVisible && (
          <ManualMealModal
            visible={isTypeModalVisible}
            onClose={() => setIsTypeModalVisible(false)}
            onSubmitResult={(result) => {
              setAiResult(result);
              setCapturedImageUri(null);
              setPortionMultiplier(1.0);
              setStage('verifying');
            }}
          />
        )}
        {isVoiceModalVisible && (
          <VoiceInputModal
            visible={isVoiceModalVisible}
            mode="meal"
            onClose={() => setIsVoiceModalVisible(false)}
            onSubmitMealResult={(result) => {
              setAiResult(result);
              setCapturedImageUri(null);
              setPortionMultiplier(1.0);
              setStage('verifying');
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // STAGE 1: CAMERA VIEWFINDER & RETICLE OVERLAY
  // -------------------------------------------------------------
  return (
    <View style={styles.cameraContainer}>
      {isFocused && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          enableTorch={enableTorch}
        />
      )}

      {/* Reticle Overlay */}
      <SafeAreaView style={styles.overlayContainer}>
        {/* Top Controls Bar */}
        <View style={styles.topControlBar}>
          <Pressable
            style={({ pressed }) => [styles.circleIconBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={22} color={colors.white} />
          </Pressable>

          <View style={styles.modeIndicator}>
            <Ionicons name="sparkles" size={14} color={colors.primary} />
            <Text style={styles.modeIndicatorText}>AI Plate Vision</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.circleIconBtn,
              enableTorch && styles.circleIconBtnActive,
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => setEnableTorch((prev) => !prev)}
          >
            <Ionicons
              name={enableTorch ? 'flash' : 'flash-off'}
              size={20}
              color={enableTorch ? colors.calories : colors.white}
            />
          </Pressable>
        </View>

        {/* Framing Reticle */}
        <View style={styles.centerReticleContainer}>
          <View style={styles.reticleBox}>
            {/* 4 Corner Brackets */}
            <View style={[styles.cornerBracket, styles.bracketTL]} />
            <View style={[styles.cornerBracket, styles.bracketTR]} />
            <View style={[styles.cornerBracket, styles.bracketBL]} />
            <View style={[styles.cornerBracket, styles.bracketBR]} />

            <View style={styles.reticleCenterHelp}>
              <Ionicons name="scan-outline" size={32} color="rgba(255,255,255,0.4)" />
              <Text style={styles.reticleHelpText}>Align meal plate or bowl</Text>
            </View>
          </View>
        </View>

        <Text style={styles.privacyCaptionClean}>{AI_PRIVACY_NOTICE}</Text>

        {/* Bottom Shutter, Gallery, Speak & Type Bar */}
        <View style={styles.bottomBar}>
          <Pressable
            style={({ pressed }) => [styles.sideBarBtn, pressed && styles.pressed]}
            onPress={handlePickFromGallery}
            accessibilityRole="button"
            accessibilityLabel="Pick meal photo from gallery"
          >
            <Ionicons name="images" size={24} color={colors.white} />
            <Text style={styles.sideBarBtnLabel}>Gallery</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.sideBarBtn, pressed && styles.pressed]}
            onPress={() => {
              safeHaptics.impactLight();
              setIsVoiceModalVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Add meal by speaking"
          >
            <View style={styles.voiceBtnCircle}>
              <Ionicons name="mic" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.sideBarBtnLabel, { color: colors.primaryLight }]}>Speak</Text>
          </Pressable>

          {/* Shutter Button */}
          <Pressable
            style={({ pressed }) => [styles.shutterOuterRing, pressed && styles.pressed]}
            onPress={handleCapturePhoto}
            accessibilityRole="button"
            accessibilityLabel="Capture photo of meal"
          >
            <View style={styles.shutterInnerCircle} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.sideBarBtn, pressed && styles.pressed]}
            onPress={() => setIsTypeModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Type meal details manually"
          >
            <Ionicons name="create-outline" size={24} color={colors.white} />
            <Text style={styles.sideBarBtnLabel}>Type Meal</Text>
          </Pressable>
        </View>
      </SafeAreaView>
        {isTypeModalVisible && (
          <ManualMealModal
            visible={isTypeModalVisible}
            onClose={() => setIsTypeModalVisible(false)}
            onSubmitResult={(result) => {
              setAiResult(result);
              setCapturedImageUri(null);
              setPortionMultiplier(1.0);
              setStage('verifying');
            }}
          />
        )}
        {isVoiceModalVisible && (
          <VoiceInputModal
            visible={isVoiceModalVisible}
            mode="meal"
            onClose={() => setIsVoiceModalVisible(false)}
            onSubmitMealResult={(result) => {
              setAiResult(result);
              setCapturedImageUri(null);
              setPortionMultiplier(1.0);
              setStage('verifying');
            }}
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  circleIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  circleIconBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: colors.calories,
  },
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  modeIndicatorText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },

  // Framing Reticle
  centerReticleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  cornerBracket: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.primary,
  },
  bracketTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  bracketTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bracketBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bracketBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  reticleCenterHelp: {
    alignItems: 'center',
    gap: 8,
  },
  reticleHelpText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Bottom Controls
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 16 : 24,
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
  shutterOuterRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterInnerCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
  },

  // Analyzing Stage
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
    borderColor: colors.cardBorder,
  },
  analyzingImage: {
    width: '100%',
    height: '100%',
  },
  analyzingPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  analyzingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 18,
  },
  analyzingSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },

  // Verification Stage - Minimal & Modern
  verifyScroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  verifyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  retakeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  previewImageContainer: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  dishCardClean: {
    alignItems: 'center',
    marginBottom: 12,
  },
  dishNameTextClean: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  dishWeightSubClean: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  calorieHeroContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  calorieHeroNumber: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  calorieHeroUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  macroPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  macroPillClean: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  macroPillTextCol: {
    alignItems: 'flex-start',
  },
  macroPillValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  macroPillLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  portionCleanCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  portionStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 14,
  },
  portionStepBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portionDisplayCol: {
    alignItems: 'center',
    minWidth: 70,
  },
  portionValueClean: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  portionLabelClean: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  presetCleanRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetCleanBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  presetCleanBtnSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetCleanBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  presetCleanBtnTextSelected: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  ingredientsCleanCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  ingredientsCleanHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  ingredientsCleanWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ingredientCleanChip: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  ingredientCleanChipText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  saveButtonClean: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 52,
    marginTop: 4,
    marginBottom: 16,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  disclaimerTextClean: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 14,
    paddingHorizontal: 8,
  },
  privacyCaptionClean: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  saveButtonTextClean: {
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
  galleryFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    marginBottom: 10,
  },
  galleryFallbackText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  demoFallbackBtn: {
    paddingVertical: 8,
  },
  demoFallbackText: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },

  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
