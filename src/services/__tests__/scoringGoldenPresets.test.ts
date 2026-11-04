import { describe, it, expect } from 'bun:test';
import {
  INDIAN_SUPERMARKET_PRESETS,
  fetchProductByBarcode,
} from '../barcodeService';
import { RiskLevel } from '../../types';

describe('Golden Preset Tests for Indian Supermarket Catalog', () => {
  const PRESET_BARCODES: {
    barcode: string;
    name: string;
    expectedScore: number;
    expectedRisk: RiskLevel;
  }[] = [
    { barcode: '8901030383749', name: 'Kurkure Masala Munch', expectedScore: 9, expectedRisk: 'High Risk' },
    { barcode: '8901030005702', name: 'Maggi 2-Minute Masala Instant Noodles', expectedScore: 28, expectedRisk: 'High Risk' },
    { barcode: '8901725181222', name: "Haldiram's Nagpur Aloo Bhujia", expectedScore: 23, expectedRisk: 'High Risk' },
    { barcode: '8901030825317', name: 'Glow & Lovely Advanced Multi-Vitamin Cream', expectedScore: 53, expectedRisk: 'Moderate' },
    { barcode: '8901030584504', name: 'Dettol Original Germ Protection Bathing Soap', expectedScore: 78, expectedRisk: 'Safe' },
    { barcode: '8901314010520', name: 'Colgate Strong Teeth Amino Shakti Toothpaste', expectedScore: 62, expectedRisk: 'Moderate' },
    { barcode: '8901023010101', name: 'Good Knight Active+ Mosquito Liquid Vaporizer', expectedScore: 47, expectedRisk: 'Moderate' },
    { barcode: '8901096312456', name: 'Lizol Disinfectant Surface & Floor Cleaner', expectedScore: 58, expectedRisk: 'Moderate' },
    { barcode: '8901030112233', name: "Johnson's Pure Cornstarch/Talc Baby Powder", expectedScore: 73, expectedRisk: 'Safe' },
    { barcode: '8901500000000', name: '100% Cold Pressed Pure Mustard Oil (Kachi Ghani)', expectedScore: 95, expectedRisk: 'Safe' },
  ];

  it('contains exactly 10 authentic curated presets in catalog', () => {
    expect(Object.keys(INDIAN_SUPERMARKET_PRESETS).length).toBe(10);
  });

  for (const preset of PRESET_BARCODES) {
    it(`verifies golden snapshot for ${preset.name} (${preset.barcode})`, async () => {
      const report = await fetchProductByBarcode(preset.barcode);

      expect(report.productName).toContain(preset.name.split(' ')[0]);
      expect(report.overallSafetyScore).toBe(preset.expectedScore);
      expect(report.riskLevel).toBe(preset.expectedRisk);
      expect(report.regulatoryStandard).toBeDefined();
      expect(report.targetExposure).toBeDefined();
      expect(report.cleanSummary).toBeDefined();
      expect(report.cleanSummary.length).toBeGreaterThan(10);

      // Verify no sensationalist language is present
      const fullText = JSON.stringify(report).toLowerCase();
      expect(fullText).not.toContain('toxic poison');
      expect(fullText).not.toContain('deadly trap');
      expect(fullText).not.toContain('certified');

      // Verify every flagged additive includes source citations and rationale
      for (const additive of report.harmfulIngredients) {
        expect(additive.name).toBeDefined();
        expect(additive.severity).toBeDefined();
        expect(additive.rationale).toBeDefined();
        expect(additive.rationale?.length).toBeGreaterThan(15);
        expect(additive.source).toBeDefined();
        expect(additive.sourceUrl).toContain('http');
        expect(additive.concentrationRank).toBeDefined();
        expect(additive.deduction).toBeGreaterThan(0);
      }
    });
  }
});
