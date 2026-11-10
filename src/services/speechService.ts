/**
 * Unified Speech Recognition Service
 * Supports Expo Speech Recognition on iOS/Android native builds
 * and Web Speech API on web/browsers, with graceful degradation.
 */

let ExpoSpeechRecognitionModule: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule ?? null;
} catch {
  ExpoSpeechRecognitionModule = null;
}

export interface SpeechRecognitionCallbacks {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (errorMessage: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface SpeechRecognitionOptions {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
}

function getWebSpeechRecognition(): any {
  if (typeof window !== 'undefined') {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  }
  return null;
}

let activeWebRecognizer: any = null;
let activeNativeSubscriptions: { remove: () => void }[] = [];

/**
 * Checks whether speech recognition is available on the current device / platform.
 */
export async function isSpeechRecognitionSupported(): Promise<boolean> {
  try {
    if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function') {
      const isAvailable = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (isAvailable) return true;
    }
  } catch {
    // Native module unavailable or not loaded
  }

  const WebSpeech = getWebSpeechRecognition();
  return WebSpeech !== null;
}

/**
 * Requests speech recognition and microphone permissions.
 */
export async function requestSpeechPermissions(): Promise<boolean> {
  try {
    if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.requestPermissionsAsync === 'function') {
      const response = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return !!response?.granted;
    }
  } catch {
    // Fall back to web permissions if applicable
  }

  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop tracks immediately after granting permission
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  // If in web environment without mediaDevices or standard web speech, let browser prompt on start
  return getWebSpeechRecognition() !== null;
}

/**
 * Starts speech recognition with live streaming result callbacks.
 * Returns a cleanup function that stops listening.
 */
export async function startSpeechRecognition(
  callbacks: SpeechRecognitionCallbacks,
  options?: SpeechRecognitionOptions
): Promise<() => void> {
  const lang = options?.lang || 'en-IN';
  const interimResults = options?.interimResults !== false;

  // Clean up any existing active session first
  await stopSpeechRecognition();

  // 1. Try Native ExpoSpeechRecognitionModule
  if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.start === 'function') {
    try {
      const permGranted = await requestSpeechPermissions();
      if (!permGranted) {
        callbacks.onError?.('Microphone or speech recognition permission was denied.');
        return () => {};
      }

      activeNativeSubscriptions.forEach((sub) => sub.remove());
      activeNativeSubscriptions = [];

      const resultSub = ExpoSpeechRecognitionModule.addListener(
        'result',
        (event: { isFinal?: boolean; results?: { transcript?: string }[] }) => {
          const text = event.results?.[0]?.transcript || '';
          if (text) {
            callbacks.onResult(text, !!event.isFinal);
          }
        }
      );

      const startSub = ExpoSpeechRecognitionModule.addListener('start', () => {
        callbacks.onStart?.();
      });

      const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
        callbacks.onEnd?.();
      });

      const errorSub = ExpoSpeechRecognitionModule.addListener(
        'error',
        (event: { error?: string; message?: string }) => {
          callbacks.onError?.(event.message || event.error || 'Speech recognition encountered an error.');
        }
      );

      activeNativeSubscriptions = [resultSub, startSub, endSub, errorSub];

      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults,
        continuous: options?.continuous ?? false,
      });

      return () => {
        stopSpeechRecognition().catch(() => {});
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[speechService] Native speech start failed, falling back:', msg);
    }
  }

  // 2. Try Web Speech API fallback
  const WebSpeech = getWebSpeechRecognition();
  if (WebSpeech) {
    try {
      const recognizer = new WebSpeech();
      recognizer.lang = lang;
      recognizer.interimResults = interimResults;
      recognizer.continuous = options?.continuous ?? false;

      recognizer.onstart = () => {
        callbacks.onStart?.();
      };

      recognizer.onresult = (event: any) => {
        let transcript = '';
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }
        callbacks.onResult(transcript, isFinal);
      };

      recognizer.onerror = (event: any) => {
        callbacks.onError?.(event.error || 'Web Speech recognition error');
      };

      recognizer.onend = () => {
        callbacks.onEnd?.();
      };

      recognizer.start();
      activeWebRecognizer = recognizer;

      return () => {
        try {
          recognizer.stop();
        } catch {
          // Ignore
        }
        activeWebRecognizer = null;
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      callbacks.onError?.(`Speech recognition failed to start: ${msg}`);
      return () => {};
    }
  }

  callbacks.onError?.('Speech recognition is not supported on this device/runtime.');
  return () => {};
}

/**
 * Stops any active speech recognition session.
 */
export async function stopSpeechRecognition(): Promise<void> {
  if (activeWebRecognizer) {
    try {
      activeWebRecognizer.stop();
    } catch {
      // Ignore
    }
    activeWebRecognizer = null;
  }

  if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.stop === 'function') {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // Ignore
    }
  }

  activeNativeSubscriptions.forEach((sub) => {
    try {
      sub.remove();
    } catch {
      // Ignore
    }
  });
  activeNativeSubscriptions = [];
}

/**
 * Aborts speech recognition immediately without final result.
 */
export async function abortSpeechRecognition(): Promise<void> {
  if (activeWebRecognizer) {
    try {
      activeWebRecognizer.abort();
    } catch {
      // Ignore
    }
    activeWebRecognizer = null;
  }

  if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.abort === 'function') {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Ignore
    }
  }

  activeNativeSubscriptions.forEach((sub) => {
    try {
      sub.remove();
    } catch {
      // Ignore
    }
  });
  activeNativeSubscriptions = [];
}
