import { describe, it, expect } from 'bun:test';
import { safeHaptics } from '../haptics';
import { optimizeImageForAiVision } from '../imageOptimizer';

describe('Haptics & Image Optimizer Utils (haptics.ts & imageOptimizer.ts)', () => {
  describe('safeHaptics', () => {
    it('executes impactLight safely without throwing in any environment', async () => {
      expect(safeHaptics.impactLight()).resolves.toBeUndefined();
    });

    it('executes impactMedium safely without throwing in any environment', async () => {
      expect(safeHaptics.impactMedium()).resolves.toBeUndefined();
    });

    it('executes impactHeavy safely without throwing in any environment', async () => {
      expect(safeHaptics.impactHeavy()).resolves.toBeUndefined();
    });

    it('executes selection feedback safely', async () => {
      expect(safeHaptics.selection()).resolves.toBeUndefined();
    });

    it('executes notification feedbacks (success, warning, error) safely', async () => {
      expect(safeHaptics.success()).resolves.toBeUndefined();
      expect(safeHaptics.warning()).resolves.toBeUndefined();
      expect(safeHaptics.error()).resolves.toBeUndefined();
    });

    it('executes timerFinished pulse safely', async () => {
      expect(safeHaptics.timerFinished()).resolves.toBeUndefined();
    });
  });

  describe('optimizeImageForAiVision', () => {
    it('throws descriptive error when uri is empty or undefined', async () => {
      expect(optimizeImageForAiVision('')).rejects.toThrow('No image URI provided to image optimizer.');
      expect(optimizeImageForAiVision(null as any)).rejects.toThrow('No image URI provided to image optimizer.');
    });
  });
});
