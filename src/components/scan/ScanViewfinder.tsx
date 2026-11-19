import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView } from 'expo-camera';
import React from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface ScanViewfinderProps {
  isFocused: boolean;
  cameraRef: React.RefObject<CameraView | null>;
  enableTorch: boolean;
  scanMode: 'label' | 'barcode';
  pictureSize?: string;
  isProcessingBarcode: boolean;
  barcodeSearchPill: string | null;
  activeModelName: string;
  onCameraReady: () => void;
  onBarcodeScanned: (event: { data: string }) => void;
  onSetScanMode: (mode: 'label' | 'barcode') => void;
  onToggleTorch: () => void;
  onPickGallery: () => void;
  onOpenVoice: () => void;
  onCapturePhoto: () => void;
  onOpenManual: () => void;
  onOpenSettings: () => void;
}

export const ScanViewfinder = React.memo(function ScanViewfinder({
  isFocused,
  cameraRef,
  enableTorch,
  scanMode,
  pictureSize,
  isProcessingBarcode,
  barcodeSearchPill,
  activeModelName,
  onCameraReady,
  onBarcodeScanned,
  onSetScanMode,
  onToggleTorch,
  onPickGallery,
  onOpenVoice,
  onCapturePhoto,
  onOpenManual,
  onOpenSettings,
}: ScanViewfinderProps) {
  const colors = useThemeColors();

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
          {...(scanMode === 'barcode'
            ? {
                barcodeScannerSettings: {
                  barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
                },
                onBarcodeScanned,
              }
            : {})}
        />
      ) : null}

      <SafeAreaView style={styles.overlayContainer} edges={['top', 'left', 'right']}>
        <View style={styles.topSection}>
          <View style={styles.topBar}>
            <View style={styles.scanModeRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.scanModeBtn,
                  scanMode === 'label' && [styles.scanModeBtnActive, { backgroundColor: colors.primary }],
                  pressed && styles.pressed,
                ]}
                onPress={() => onSetScanMode('label')}
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
                  scanMode === 'barcode' && [styles.scanModeBtnActive, { backgroundColor: colors.primary }],
                  pressed && styles.pressed,
                ]}
                onPress={() => onSetScanMode('barcode')}
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
              style={({ pressed }) => [styles.activeModelViewfinderPill, pressed && styles.pressed]}
              onPress={onOpenSettings}
              accessibilityRole="button"
              accessibilityLabel={`AI model: ${activeModelName}. Tap to change in settings.`}
            >
              <Ionicons name="sparkles" size={11} color={colors.primary} />
              <Text style={[styles.activeModelViewfinderText, { color: colors.primary }]} numberOfLines={1}>
                {activeModelName}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.topIconBtn,
                enableTorch && [styles.topIconBtnActive, { borderColor: colors.calories }],
                pressed && styles.pressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onToggleTorch}
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
              <Text style={[styles.barcodeStatusText, { color: colors.text }]} numberOfLines={2}>
                {barcodeSearchPill}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.reticleWrapper}>
          <View style={styles.ocrReticle}>
            <View style={[styles.cornerBracket, styles.bracketTL, { borderColor: colors.primary }]} />
            <View style={[styles.cornerBracket, styles.bracketTR, { borderColor: colors.primary }]} />
            <View style={[styles.cornerBracket, styles.bracketBL, { borderColor: colors.primary }]} />
            <View style={[styles.cornerBracket, styles.bracketBR, { borderColor: colors.primary }]} />
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
              onPress={onPickGallery}
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
              onPress={onOpenVoice}
              accessibilityRole="button"
              accessibilityLabel="Add product by speaking"
            >
              <View style={[styles.voiceBtnCircle, { backgroundColor: colors.primaryMuted }]}>
                <Ionicons name="mic" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.sideBarBtnLabel, { color: colors.primaryLight }]}>Speak</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.shutterRing, pressed && styles.pressed]}
              onPress={onCapturePhoto}
              accessibilityRole="button"
              accessibilityLabel="Capture photo of ingredient label"
            >
              <View style={[styles.shutterCore, { backgroundColor: colors.primary }]} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sideBarBtn, pressed && styles.pressed]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onOpenManual}
              accessibilityRole="button"
              accessibilityLabel="Type product name manually"
            >
              <Ionicons name="create-outline" size={24} color={colors.white} />
              <Text style={styles.sideBarBtnLabel}>Type</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
});

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
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
  },
  scanModeRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    padding: 3,
    gap: 4,
  },
  activeModelViewfinderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 16,
    paddingHorizontal: 10,
    minHeight: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    maxWidth: 150,
  },
  activeModelViewfinderText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scanModeBtn: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanModeBtnActive: {},
  scanModeText: {
    color: '#FFFFFF',
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
    flexShrink: 1,
  },
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
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBarBtnLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  shutterRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterCore: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  pressed: {
    opacity: 0.8,
  },
});
