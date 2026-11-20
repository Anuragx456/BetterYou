import { useCallback, useEffect, useRef, useState } from 'react';
import {
  abortSpeechRecognition,
  isSpeechRecognitionSupported,
  startSpeechRecognition,
  stopSpeechRecognition,
} from '../services/speechService';
import { safeHaptics } from '../utils/haptics';

export function useVoiceRecording() {
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Tap the microphone to speak');
  const [isSpeechAvailable, setIsSpeechAvailable] = useState<boolean>(true);

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;
    isSpeechRecognitionSupported().then((supported) => {
      if (mounted) {
        setIsSpeechAvailable(supported);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const resetRecording = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    abortSpeechRecognition().catch(() => {});
    setIsListening(false);
    setTranscript('');
    setStatusMessage('Tap the microphone to speak');
  }, []);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      stopSpeechRecognition().catch(() => {});
    };
  }, []);

  const toggleListening = useCallback(async () => {
    safeHaptics.impactMedium();

    if (isListening) {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      await stopSpeechRecognition();
      setIsListening(false);
      setStatusMessage('Listening paused. Review or submit below.');
      return;
    }

    setIsListening(true);
    setStatusMessage('Listening... Speak now');

    try {
      const stopFn = await startSpeechRecognition({
        onStart: () => {
          setIsListening(true);
          setStatusMessage('Listening... Speak clearly');
        },
        onResult: (spokenText) => {
          if (spokenText) {
            setTranscript(spokenText);
            setStatusMessage('Speech captured! Tap microphone to finish.');
          }
        },
        onError: (err) => {
          setIsListening(false);
          setStatusMessage(`Speech error: ${err}`);
        },
        onEnd: () => {
          setIsListening(false);
          setStatusMessage('Speech finished. Review or edit below.');
        },
      });

      cleanupRef.current = stopFn;
    } catch (err: unknown) {
      setIsListening(false);
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Speech unavailable: ${msg}`);
    }
  }, [isListening]);

  const stopActiveListening = useCallback(async () => {
    if (isListening) {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      await stopSpeechRecognition();
      setIsListening(false);
    }
  }, [isListening]);

  return {
    transcript,
    setTranscript,
    isListening,
    statusMessage,
    setStatusMessage,
    isSpeechAvailable,
    toggleListening,
    stopActiveListening,
    resetRecording,
  };
}
