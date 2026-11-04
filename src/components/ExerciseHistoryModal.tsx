import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors } from '../theme/colors';
import { WorkoutSession } from '../types';

interface ExerciseHistoryModalProps {
  visible: boolean;
  exerciseName: string;
  workouts: WorkoutSession[];
  onClose: () => void;
}

interface HistoricalDataPoint {
  date: string;
  maxWeightKg: number;
  totalVolumeKg: number;
  sets: { setNumber: number; weightKg: number; reps: number }[];
}

export function ExerciseHistoryModal({
  visible,
  exerciseName,
  workouts,
  onClose,
}: ExerciseHistoryModalProps) {
  // Extract historical sessions for this specific exercise
  const historyData = useMemo<HistoricalDataPoint[]>(() => {
    if (!exerciseName) return [];
    const points: HistoricalDataPoint[] = [];

    const sorted = [...workouts].sort((a, b) => {
      const da = new Date(a.completedAt || a.startedAt || 0).getTime();
      const db = new Date(b.completedAt || b.startedAt || 0).getTime();
      return da - db;
    });

    for (const session of sorted) {
      const ex = session.exercises?.find(
        (e) => e.name.toLowerCase().trim() === exerciseName.toLowerCase().trim()
      );
      if (ex && ex.sets.some((s) => s.completed && s.weightKg > 0)) {
        const completedSets = ex.sets.filter((s) => s.completed && s.weightKg > 0);
        const maxWeight = Math.max(...completedSets.map((s) => s.weightKg));
        const totalVolume = completedSets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
        const dateStr = (session.completedAt || session.startedAt || '').split('T')[0] || '';

        points.push({
          date: dateStr,
          maxWeightKg: maxWeight,
          totalVolumeKg: totalVolume,
          sets: completedSets.map((s) => ({
            setNumber: s.setNumber,
            weightKg: s.weightKg,
            reps: s.reps,
          })),
        });
      }
    }

    return points;
  }, [exerciseName, workouts]);

  // Compute PRs (Personal Records)
  const prMetrics = useMemo(() => {
    let maxWeightPr = 0;
    let maxVolumePr = 0;
    let bestSet = '';

    for (const p of historyData) {
      if (p.maxWeightKg > maxWeightPr) {
        maxWeightPr = p.maxWeightKg;
      }
      for (const s of p.sets) {
        const v = s.weightKg * s.reps;
        if (v > maxVolumePr) {
          maxVolumePr = v;
          bestSet = `${s.weightKg} kg × ${s.reps} reps`;
        }
      }
    }

    return { maxWeightPr, maxVolumePr, bestSet };
  }, [historyData]);

  // Mini Chart Coordinates
  const chartPoints = useMemo(() => {
    if (historyData.length < 2) return null;
    const width = 300;
    const height = 100;
    const padding = 16;

    const weights = historyData.map((d) => d.maxWeightKg);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const rangeW = maxW - minW || 1;

    const stepX = (width - padding * 2) / (historyData.length - 1);

    const coords = historyData.map((d, i) => {
      const x = padding + i * stepX;
      const y = height - padding - ((d.maxWeightKg - minW) / rangeW) * (height - padding * 2);
      return { x, y, weight: d.maxWeightKg, date: d.date };
    });

    const polylineStr = coords.map((c) => `${c.x},${c.y}`).join(' ');

    return { width, height, coords, polylineStr, minW, maxW };
  }, [historyData]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close exercise history"
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {exerciseName}
            </Text>
            <Text style={styles.headerSub}>Progression & PR History</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* PR Highlights Card */}
          <View style={styles.prCard}>
            <View style={styles.prItem}>
              <View style={styles.prBadge}>
                <Ionicons name="trophy" size={14} color="#F59E0B" />
                <Text style={styles.prBadgeText}>WEIGHT PR</Text>
              </View>
              <Text style={styles.prValue}>
                {prMetrics.maxWeightPr > 0 ? `${prMetrics.maxWeightPr} kg` : '—'}
              </Text>
              <Text style={styles.prSub}>Heaviest Load</Text>
            </View>

            <View style={styles.prDivider} />

            <View style={styles.prItem}>
              <View style={styles.prBadge}>
                <Ionicons name="flame" size={14} color="#EF4444" />
                <Text style={styles.prBadgeText}>BEST SET</Text>
              </View>
              <Text style={styles.prValue}>
                {prMetrics.bestSet ? prMetrics.bestSet : '—'}
              </Text>
              <Text style={styles.prSub}>Peak Set Volume</Text>
            </View>
          </View>

          {/* SVG Progression Trend Chart */}
          {chartPoints && (
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Max Weight Trend (kg)</Text>
                <Text style={styles.chartSub}>
                  {chartPoints.minW}kg → {chartPoints.maxW}kg
                </Text>
              </View>

              <Svg width={chartPoints.width} height={chartPoints.height} style={{ alignSelf: 'center' }}>
                {/* Horizontal baseline */}
                <Line
                  x1={16}
                  y1={chartPoints.height - 16}
                  x2={chartPoints.width - 16}
                  y2={chartPoints.height - 16}
                  stroke={colors.hairline}
                  strokeWidth={1}
                />
                {/* Polyline connecting points */}
                <Polyline
                  points={chartPoints.polylineStr}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={2.5}
                />
                {/* Data point circles */}
                {chartPoints.coords.map((c, i) => (
                  <Circle
                    key={i}
                    cx={c.x}
                    cy={c.y}
                    r={4}
                    fill={colors.card}
                    stroke={colors.primary}
                    strokeWidth={2}
                  />
                ))}
              </Svg>
            </View>
          )}

          {/* Past Sessions List */}
          <View style={styles.sessionsSection}>
            <Text style={styles.sectionTitle}>
              Logged Sessions ({historyData.length})
            </Text>

            {historyData.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="barbell-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No past records for this lift</Text>
                <Text style={styles.emptySub}>
                  Completed sets from your workouts will automatically appear here.
                </Text>
              </View>
            ) : (
              [...historyData].reverse().map((entry, idx) => (
                <View key={idx} style={styles.sessionCard}>
                  <View style={styles.sessionHeaderRow}>
                    <Text style={styles.sessionDate}>{entry.date}</Text>
                    <View style={styles.volumeBadge}>
                      <Text style={styles.volumeBadgeText}>
                        {entry.totalVolumeKg.toLocaleString()} kg vol
                      </Text>
                    </View>
                  </View>

                  <View style={styles.setsWrap}>
                    {entry.sets.map((s, si) => (
                      <View key={si} style={styles.setChip}>
                        <Text style={styles.setChipText}>
                          Set {s.setNumber}: <Text style={{ color: colors.text }}>{s.weightKg}kg × {s.reps}</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerTitleCol: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  headerSub: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  prCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  prItem: {
    alignItems: 'center',
    flex: 1,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  prBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  prValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  prSub: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  prDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.hairline,
    alignSelf: 'center',
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  chartSub: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  sessionsSection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sessionDate: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  volumeBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  volumeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  setsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  setChip: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  setChipText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});
