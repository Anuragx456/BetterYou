import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AI_TOXICITY_DISCLAIMER } from '../../constants/disclaimers';
import { getModelDisplayName } from '../../store/useSettingsStore';
import { useThemeColors } from '../../theme/theme';
import type { ToxicityReport } from '../../types';
import { HarmfulIngredientItem } from './HarmfulIngredientItem';
import { SafetyScoreGaugeHero } from './SafetyScoreGaugeHero';
import { StandardsDisclosureCard } from './StandardsDisclosureCard';

export interface ScannedProductReportViewProps {
  report: ToxicityReport;
  labelPreviewUri: string | null;
  isSaved: boolean;
  activeModelName: string;
  onResetScanner: () => void;
  onSaveToMyScans: () => void;
  onOpenEditProduct: () => void;
  onOpenRetryProduct: () => void;
}

export const ScannedProductReportView = React.memo(function ScannedProductReportView({
  report,
  labelPreviewUri,
  isSaved,
  activeModelName,
  onResetScanner,
  onSaveToMyScans,
  onOpenEditProduct,
  onOpenRetryProduct,
}: ScannedProductReportViewProps) {
  const colors = useThemeColors();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.reportScroll} showsVerticalScrollIndicator={false}>
        {/* Header Action Row */}
        <View style={styles.reportHeaderRow}>
          <Pressable
            testID="scan-report-close-btn"
            style={({ pressed }) => [
              styles.backButtonClean,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={onResetScanner}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>

          <Text style={[styles.reportTitleClean, { color: colors.text }]}>
            Ingredient Risk Screening
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.saveReportBtnClean,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              isSaved && { borderColor: colors.primary },
              pressed && !isSaved && styles.pressed,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={onSaveToMyScans}
            disabled={isSaved}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isSaved ? colors.primary : colors.text}
            />
          </Pressable>
        </View>

        {labelPreviewUri ? (
          <View style={[styles.labelPreviewContainer, { borderColor: colors.cardBorder }]}>
            <Image source={{ uri: labelPreviewUri }} style={styles.labelPreviewImage} resizeMode="cover" />
          </View>
        ) : null}

        {/* Provenance & Verification Badge */}
        {report.generatedBy === 'offline-demo-mock' ? (
          <View
            style={[
              styles.provenanceDemoBadge,
              {
                backgroundColor: colors.softOrange,
                borderColor: colors.softOrangeBorder,
              },
            ]}
          >
            <Ionicons name="flask-outline" size={13} color={colors.warning} />
            <Text style={[styles.provenanceDemoText, { color: colors.softOrangeText }]}>
              Simulated Offline Sample (No API Key)
            </Text>
          </View>
        ) : report.barcode ? (
          <View
            style={[
              styles.provenanceVerifiedBadge,
              {
                backgroundColor: colors.softGreen,
                borderColor: colors.softGreenBorder,
              },
            ]}
          >
            <Ionicons name="barcode-outline" size={13} color={colors.primary} />
            <Text style={[styles.provenanceVerifiedText, { color: colors.softGreenText }]}>
              Verified Barcode Registry
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.provenanceVerifiedBadge,
              {
                backgroundColor: colors.softGreen,
                borderColor: colors.softGreenBorder,
              },
            ]}
          >
            <Ionicons name="shield-checkmark" size={13} color={colors.primary} />
            <Text style={[styles.provenanceVerifiedText, { color: colors.softGreenText }]}>
              AI Screening ({getModelDisplayName(report.generatedBy) || report.generatedBy || activeModelName})
            </Text>
          </View>
        )}

        {/* Circular Safety Score Gauge Hero */}
        <SafetyScoreGaugeHero
          report={report}
          onOpenEditProduct={onOpenEditProduct}
          onOpenRetryProduct={onOpenRetryProduct}
        />

        {/* Plain-English Verdict Card */}
        <View
          style={[
            styles.verdictCardClean,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Text style={[styles.verdictTextBold, { color: colors.text }]}>
            {report.harmfulIngredients.length === 0
              ? '0 flagged additives or elevated hazards detected.'
              : `${report.harmfulIngredients.length} flagged ${report.harmfulIngredients.length === 1 ? 'additive' : 'additives'} detected.`}
          </Text>
          {report.cleanSummary ? (
            <Text style={[styles.verdictTextSub, { color: colors.textSecondary }]}>
              {report.cleanSummary}
            </Text>
          ) : null}
        </View>

        {/* Indian Supermarket Context Alert Box */}
        {report.indianMarketAlert ? (
          <View
            style={[
              styles.indianAlertCardClean,
              {
                backgroundColor: colors.softOrange,
                borderColor: colors.softOrangeBorder,
              },
            ]}
          >
            <Ionicons name="warning-outline" size={16} color={colors.warning} />
            <Text style={[styles.indianAlertTextClean, { color: colors.softOrangeText }]}>
              {report.indianMarketAlert}
            </Text>
          </View>
        ) : null}

        {/* Clean Ingredients Breakdown */}
        <View
          style={[
            styles.ingredientsSectionClean,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.ingredientsHeaderRowClean}>
            <Text style={[styles.ingredientsTitleClean, { color: colors.text }]}>
              Ingredients Breakdown {report.allIngredients ? `(${report.allIngredients.length})` : ''}
            </Text>
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onOpenEditProduct}
            >
              <Text style={[styles.editLinkTextClean, { color: colors.primary }]}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.ingredientsListClean}>
            {/* Flagged Harmful Additives first */}
            {report.harmfulIngredients.map((item, idx) => (
              <HarmfulIngredientItem key={`harmful-${idx}`} item={item} />
            ))}

            {/* Clean / Unflagged Ingredients */}
            {report.allIngredients ? report.allIngredients.map((ing, idx) => {
              const isFlagged = report.harmfulIngredients.some(
                (h) => h.name.toLowerCase().includes(ing.toLowerCase()) || ing.toLowerCase().includes(h.name.toLowerCase())
              );
              if (isFlagged) return null;

              return (
                <View
                  key={`clean-${idx}`}
                  style={[styles.ingredientRowClean, { borderBottomColor: colors.hairline }]}
                >
                  <View style={styles.ingredientRowLeft}>
                    <View style={[styles.statusDotClean, { backgroundColor: colors.safetyClean }]} />
                    <Text style={[styles.ingredientNameClean, { color: colors.text }]}>{ing}</Text>
                  </View>
                </View>
              );
            }) : null}
          </View>
        </View>

        {/* Standards & Provenance Card */}
        <StandardsDisclosureCard report={report} />

        {/* Bottom Scan Next Button */}
        <Pressable
          testID="scan-another-label-btn"
          style={({ pressed }) => [
            styles.scanNextBtnClean,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
          onPress={onResetScanner}
        >
          <Text style={[styles.scanNextBtnTextClean, { color: colors.textInverse }]}>
            Scan Another Label
          </Text>
        </Pressable>

        <Text style={[styles.disclaimerTextClean, { color: colors.textMuted }]}>
          {AI_TOXICITY_DISCLAIMER}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  reportScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  reportHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonClean: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  reportTitleClean: {
    fontSize: 16,
    fontWeight: '700',
  },
  saveReportBtnClean: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  labelPreviewContainer: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
  },
  labelPreviewImage: {
    width: '100%',
    height: '100%',
  },
  provenanceDemoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  provenanceDemoText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  provenanceVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  provenanceVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  verdictCardClean: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  verdictTextBold: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  verdictTextSub: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  indianAlertCardClean: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  indianAlertTextClean: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  ingredientsSectionClean: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  ingredientsHeaderRowClean: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ingredientsTitleClean: {
    fontSize: 14,
    fontWeight: '700',
  },
  editLinkTextClean: {
    fontSize: 12,
    fontWeight: '600',
  },
  ingredientsListClean: {
    gap: 0,
  },
  ingredientRowClean: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  ingredientRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  statusDotClean: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  ingredientNameClean: {
    fontSize: 13,
    fontWeight: '500',
  },
  scanNextBtnClean: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    height: 52,
    marginBottom: 16,
  },
  scanNextBtnTextClean: {
    fontSize: 15,
    fontWeight: '700',
  },
  disclaimerTextClean: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  pressed: {
    opacity: 0.8,
  },
});
