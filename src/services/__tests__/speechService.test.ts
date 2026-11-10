import { describe, expect, it } from 'bun:test';
import {
  isSpeechRecognitionSupported,
  requestSpeechPermissions,
  startSpeechRecognition,
  stopSpeechRecognition,
  abortSpeechRecognition,
} from '../speechService';

describe('Speech Recognition Service (speechService.ts)', () => {
  it('detects support safely without throwing in headless/node environments', async () => {
    const isSupported = await isSpeechRecognitionSupported();
    expect(typeof isSupported).toBe('boolean');
  });

  it('handles permission request safely without throwing', async () => {
    const granted = await requestSpeechPermissions();
    expect(typeof granted).toBe('boolean');
  });

  it('stops and aborts speech safely without throwing even when inactive', async () => {
    await expect(stopSpeechRecognition()).resolves.toBeUndefined();
    await expect(abortSpeechRecognition()).resolves.toBeUndefined();
  });

  it('returns clean error callback when speech recognizer is unavailable in environment', async () => {
    let errorReceived = '';
    const cleanup = await startSpeechRecognition({
      onResult: () => {},
      onError: (msg) => {
        errorReceived = msg;
      },
    });

    expect(typeof cleanup).toBe('function');
    expect(errorReceived.length).toBeGreaterThan(0);
    cleanup();
  });
});
