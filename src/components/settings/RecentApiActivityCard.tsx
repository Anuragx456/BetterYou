import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GeminiApiRecord } from '../../store/useGeminiUsageStore';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { formatTimestamp, formatTokens } from './usageFormatters';

interface RecentApiActivityCardProps {
  records: GeminiApiRecord[];
  showAllLogs: boolean;
  setShowAllLogs: (val: boolean) => void;
}

export function RecentApiActivityCard({
  records,
  showAllLogs,
  setShowAllLogs,
}: RecentApiActivityCardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  if (records.length === 0) return null;

  const displayedRecords = showAllLogs ? records : records.slice(0, 5);

  return (
    <View style={styles.activityCard}>
      <View style={styles.activityHeaderRow}>
        <Text style={styles.cardSectionTitle}>RECENT API ACTIVITY</Text>
        <Text style={styles.activityCountTag}>{records.length} logged</Text>
      </View>

      <View style={styles.logsList}>
        {displayedRecords.map((item: GeminiApiRecord) => (
          <View key={item.id} style={styles.logItem}>
            <View style={styles.logLeftCol}>
              <View style={styles.logTitleRow}>
                <View
                  style={[
                    styles.logStatusDot,
                    item.status === 'success' ? styles.logDotOk : styles.logDotErr,
                  ]}
                />
                <Text style={styles.logFeatureName}>{item.featureLabel}</Text>
              </View>
              <Text style={styles.logTimestamp}>{formatTimestamp(item.timestamp)}</Text>
            </View>

            <View style={styles.logRightCol}>
              <Text style={styles.logTokens}>
                {item.totalTokens > 0 ? `~${formatTokens(item.totalTokens)} tok` : '0 tok'}
              </Text>
              <Text style={styles.logDuration}>{item.durationMs}ms</Text>
            </View>
          </View>
        ))}
      </View>

      {records.length > 5 && (
        <Pressable
          style={({ pressed }) => [styles.toggleLogsBtn, pressed && styles.pressed]}
          onPress={() => setShowAllLogs(!showAllLogs)}
        >
          <Text style={styles.toggleLogsBtnText}>
            {showAllLogs ? 'Show Less' : `Show All (${records.length})`}
          </Text>
          <Ionicons
            name={showAllLogs ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.primary}
          />
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    activityCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 16,
    },
    activityHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    cardSectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.8,
    },
    activityCountTag: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    logsList: {
      gap: 10,
    },
    logItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    logLeftCol: {
      flex: 1,
    },
    logTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    logStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    logDotOk: {
      backgroundColor: colors.success,
    },
    logDotErr: {
      backgroundColor: colors.danger,
    },
    logFeatureName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    logTimestamp: {
      fontSize: 11,
      color: colors.textMuted,
    },
    logRightCol: {
      alignItems: 'flex-end',
    },
    logTokens: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    logDuration: {
      fontSize: 11,
      color: colors.textMuted,
    },
    toggleLogsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingTop: 12,
      marginTop: 4,
    },
    toggleLogsBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
