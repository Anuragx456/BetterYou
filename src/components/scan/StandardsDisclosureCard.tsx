import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/theme';
import type {
  NovaGroup,
  NutriscoreGrade,
  TargetExposure,
  ToxicityReport,
} from '../../types';

export interface StandardsDisclosureCardProps {
  report: ToxicityReport;
}

export const StandardsDisclosureCard = React.memo(function StandardsDisclosureCard({
  report,
}: StandardsDisclosureCardProps) {
  const colors = useThemeColors();

  const getNovaDetails = (nova: NovaGroup | null | undefined) => {
    switch (nova) {
      case 1:
        return { label: 'NOVA 1', title: 'Unprocessed / Natural', color: colors.nova1 };
      case 2:
        return { label: 'NOVA 2', title: 'Processed Culinary', color: colors.nova2 };
      case 3:
        return { label: 'NOVA 3', title: 'Processed Food', color: colors.nova3 };
      case 4:
        return { label: 'NOVA 4', title: 'Ultra-Processed (UPF)', color: colors.nova4 };
      default:
        return null;
    }
  };

  const getNutriscoreColor = (grade: NutriscoreGrade | null | undefined): string => {
    switch (grade) {
      case 'a':
        return '#059669';
      case 'b':
        return '#10B981';
      case 'c':
        return '#F59E0B';
      case 'd':
        return '#F97316';
      case 'e':
        return '#EF4444';
      default:
        return colors.textMuted;
    }
  };

  const getExposureMeta = (exposure?: TargetExposure) => {
    switch (exposure) {
      case 'Inhalation':
        return { icon: 'cloud-outline' as const, label: 'Inhalation Exposure', color: '#EF4444' };
      case 'Dermal Absorption':
        return { icon: 'hand-left-outline' as const, label: 'Dermal Absorption', color: '#F472B6' };
      case 'Mucous Membrane':
        return { icon: 'alert-circle-outline' as const, label: 'Mucous Membrane', color: '#F59E0B' };
      case 'Ingestion':
        return { icon: 'restaurant-outline' as const, label: 'Oral Ingestion', color: '#10B981' };
      default:
        return { icon: 'shield-outline' as const, label: 'General Exposure', color: '#9CA3AF' };
    }
  };

  const novaDetails = getNovaDetails(report.novaGroup);
  const exposureMeta = getExposureMeta(report.targetExposure);

  return (
    <View
      style={[
        styles.standardsDisclosureCard,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
    >
      <View style={styles.standardsHeaderClean}>
        <Text style={[styles.standardsTitleClean, { color: colors.textSecondary }]}>
          Regulatory Standards
        </Text>
        {report.regulatoryStandard ? (
          <Text style={[styles.standardPillClean, { color: colors.primary }]}>
            {report.regulatoryStandard}
          </Text>
        ) : null}
      </View>
      <View style={styles.standardsRowClean}>
        {novaDetails ? (
          <View
            style={[
              styles.standardChipClean,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.hairline },
            ]}
          >
            <Text style={[styles.standardChipTag, { color: novaDetails.color }]}>
              {novaDetails.label}
            </Text>
            <Text style={[styles.standardChipDesc, { color: colors.textSecondary }]}>
              {novaDetails.title}
            </Text>
          </View>
        ) : null}
        {report.nutriscoreGrade ? (
          <View
            style={[
              styles.standardChipClean,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.hairline },
            ]}
          >
            <Text style={[styles.standardChipTag, { color: getNutriscoreColor(report.nutriscoreGrade) }]}>
              Nutri-Score {report.nutriscoreGrade.toUpperCase()}
            </Text>
            <Text style={[styles.standardChipDesc, { color: colors.textSecondary }]}>
              Quality
            </Text>
          </View>
        ) : null}
        {report.targetExposure ? (
          <View
            style={[
              styles.standardChipClean,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.hairline },
            ]}
          >
            <Text style={[styles.standardChipTag, { color: exposureMeta.color }]}>
              {report.targetExposure}
            </Text>
            <Text style={[styles.standardChipDesc, { color: colors.textSecondary }]}>
              Exposure
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  standardsDisclosureCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  standardsHeaderClean: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  standardsTitleClean: {
    fontSize: 12,
    fontWeight: '600',
  },
  standardPillClean: {
    fontSize: 11,
    fontWeight: '600',
  },
  standardsRowClean: {
    flexDirection: 'row',
    gap: 8,
  },
  standardChipClean: {
    flex: 1,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
  },
  standardChipTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  standardChipDesc: {
    fontSize: 9,
    marginTop: 2,
  },
});
