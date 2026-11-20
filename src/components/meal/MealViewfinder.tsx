import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView } from 'expo-camera';
import React from 'react';
import { Dimensions, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RETICLE_SIZE = SCREEN_WIDTH * 0.78;

export interface MealViewfinderProps {
  isFocused: boolean;
  cameraRef: React.RefObject<CameraView | null>;
  enableTorch: boolean;
  pictureSize?: string;
  hasPermission: boolean;
  onRequestPermission: () => void;
  onCameraReady: () => void;
  onToggleTorch: () => void;
  onPickGallery: () => void;
  onOpenVoice: () => void;
  onCapturePhoto: () => void;
  onOpenManual: () => void;
}

export const MealViewfinder = React.memo(function MealViewfinder({
  isFocused,
  cameraRef,
  enableTorch,
  pictureSize,
  hasPermission,
  onRequestPermission,
  onCameraReady,
  onToggleTorch,
  onPickGallery,
  onOpenVoice,
  onCapturePhoto,
  onOpenManual,
}: MealViewfinderProps) {
  const colors = useThemeColors();

  if (!hasPermission) {
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
            <Ionicons name="camera-outline" size={42} color={colors.primary} />
          </View>
          <Text style={[styles.permissionTitle, { color: colors.text }]}>
            Camera Permission Needed
          </Text>
          <Text style={[styles.permissionBody, { color: colors.textSecondary }]}>
            BetterYou uses the camera to recognize meals, portions, and nutrition breakdowns instantly.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.grantPermissionBtn,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
            onPress={onRequestPermission}
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
              Open Device Settings
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
            testID="meal-manual-btn"
            onPress={onOpenManual}
          >
            <Text style={[styles.grantPermissionText, { color: colors.text }]}>
              Log Meal Manually
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      {isFocused ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={enableTorch}
          pictureSize={pictureSize}
          onCameraReady={onCameraReady}
        />
      ) : null}

      <SafeAreaView style={styles.overlayContainer}>
        {/* Top Control Bar */}
        <View style={styles.topControlBar}>
          <Pressable
            style={({ pressed }) => [
              styles.circleIconBtn,
              enableTorch && [styles.circleIconBtnActive, { borderColor: colors.calories }],
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={onToggleTorch}
            accessibilityRole="button"
            accessibilityLabel={enableTorch ? 'Turn flash off' : 'Turn flash on'}
          >
            <Ionicons
              name={enableTorch ? 'flash' : 'flash-off'}
              size={20}
              color={enableTorch ? colors.calories : colors.white}
            />
          </Pressable>

          <View style={[styles.modeIndicator, { borderColor: colors.primaryMuted }]}>
            <Ionicons name="sparkles" size={13} color={colors.primary} />
            <Text style={[styles.modeIndicatorText, { color: colors.white }]}>
              AI Macro Vision
            </Text>
          </View>

          <View style={{ width: 44 }} />
        </View>

        {/* Center Framing Reticle */}
        <View style={styles.centerReticleContainer}>
          <View style={styles.reticleBox}>
            <View style={[styles.cornerBracket, styles.bracketTL, { borderColor: colors.primary }]} />
            <View style={[styles.cornerBracket, styles.bracketTR, { borderColor: colors.primary }]} />
            <View style={[styles.cornerBracket, styles.bracketBL, { borderColor: colors.primary }]} />
            <View style={[styles.cornerBracket, styles.bracketBR, { borderColor: colors.primary }]} />
            <View style={styles.reticleCenterHelp}>
              <Ionicons name="scan-outline" size={36} color="rgba(255,255,255,0.4)" />
              <Text style={styles.reticleHelpText}>Frame your meal</Text>
            </View>
          </View>
        </View>

        {/* Bottom Shutter Controls */}
        <View style={styles.bottomBar}>
          {/* Gallery Picker */}
          <Pressable
            style={({ pressed }) => [styles.sideBarBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={onPickGallery}
            accessibilityRole="button"
            accessibilityLabel="Pick meal photo from device gallery"
          >
            <Ionicons name="images-outline" size={24} color={colors.white} />
            <Text style={styles.sideBarBtnLabel}>Gallery</Text>
          </Pressable>

          {/* Voice Input Button */}
          <Pressable
            style={({ pressed }) => [styles.sideBarBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => {
              safeHaptics.impactLight();
              onOpenVoice();
            }}
            accessibilityRole="button"
            accessibilityLabel="Log meal with voice recording"
          >
            <View
              style={[
                styles.voiceBtnCircle,
                { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
              ]}
            >
              <Ionicons name="mic" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.sideBarBtnLabel, { color: colors.primaryLight }]}>Speak</Text>
          </Pressable>

          {/* Shutter Button */}
          <Pressable
            style={({ pressed }) => [styles.shutterOuterRing, pressed && styles.pressed]}
            onPress={onCapturePhoto}
            accessibilityRole="button"
            accessibilityLabel="Capture photo of your meal"
          >
            <View style={[styles.shutterInnerCircle, { backgroundColor: colors.primary }]} />
          </Pressable>

          {/* Manual Entry Button */}
          <Pressable
            style={({ pressed }) => [styles.sideBarBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID="meal-manual-btn"
            onPress={onOpenManual}
            accessibilityRole="button"
            accessibilityLabel="Type meal manually without camera"
          >
            <Ionicons name="create-outline" size={24} color={colors.white} />
            <Text style={styles.sideBarBtnLabel}>Type</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
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
  },
  modeIndicatorText: {
    fontSize: 13,
    fontWeight: '700',
  },
  centerReticleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  cornerBracket: {
    position: 'absolute',
    width: 28,
    height: 28,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBarBtnLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  shutterOuterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    maxWidth: 320,
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
