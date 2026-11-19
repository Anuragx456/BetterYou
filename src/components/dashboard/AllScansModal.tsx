import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { ScannedProduct } from '../../types';
import { SavedScanItem } from './RecentScans';

interface AllScansModalProps {
  visible: boolean;
  products: ScannedProduct[];
  onClose: () => void;
  onSelectProduct: (product: ScannedProduct) => void;
}

export function AllScansModal({
  visible,
  products,
  onClose,
  onSelectProduct,
}: AllScansModalProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.allScansSafeArea}>
        <View style={styles.allScansHeader}>
          <Pressable
            style={({ pressed }) => [styles.allScansCloseBtn, pressed && styles.pressed]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close all scans modal"
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.allScansTitle}>All Saved Scans</Text>
            <Text style={styles.allScansSub}>{products.length} items</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <FlashList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.allScansList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <SavedScanItem item={item} onSelect={onSelectProduct} />
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    allScansSafeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    allScansHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    allScansCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    allScansTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    allScansSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    allScansList: {
      padding: 16,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
