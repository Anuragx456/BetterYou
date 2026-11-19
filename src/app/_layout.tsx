import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThemeProvider, useTheme } from '../theme/theme';
import { useFitnessStore } from '../store/useFitnessStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { initNetInfoQueueListener, stopNetInfoQueueListener } from '../services/scanQueueService';
import { initTelemetry } from '../services/telemetryService';
import { flushActiveWorkoutPersist } from '../utils/debouncedStorage';
import { ensureFileSystemReady } from '../utils/imageManager';
import { checkForUpdatesOnLaunch } from '../utils/checkForUpdates';

// Suppress known upstream React Native 0.88 deprecation warnings triggered by ecosystem libraries
// (e.g. react-native-drawer-layout / @react-navigation namespace evaluation)
LogBox.ignoreLogs([
  'DrawerLayoutAndroid is deprecated',
  'ImageBackground is deprecated',
  'InputAccessoryView is deprecated',
  'ProgressBarAndroid has been extracted',
  'SafeAreaView has been deprecated',
  'Clipboard has been extracted',
  'PushNotificationIOS has been extracted',
  'UTFSequence has been deprecated',
]);

// Initialize privacy-safe telemetry early in lifecycle
initTelemetry();

export default function RootLayout() {
  useEffect(() => {
    // Initialize normalized SQLite database and verify migrations
    useFitnessStore.getState().loadDataFromDb().catch(() => {});
    ensureFileSystemReady().catch(() => {});
    initNetInfoQueueListener().catch(() => {});
    checkForUpdatesOnLaunch().catch(() => {});

    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        flushActiveWorkoutPersist().catch(() => {});
      }
    });

    return () => {
      appStateSub.remove();
      stopNetInfoQueueListener();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <ThemedNavigation />
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedNavigation() {
  const { colorScheme, colors } = useTheme();
  const hasCompletedOnboarding = useSettingsStore((state) => state.hasCompletedOnboarding);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const currentSegment = (segments as string[])[0];
    const inOnboarding = currentSegment === 'onboarding';
    if (!hasCompletedOnboarding && !inOnboarding) {
      const timeout = setTimeout(() => {
        router.replace('/onboarding');
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [hasCompletedOnboarding, router, segments]);

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="nutrition-target" options={{ headerShown: false }} />
        <Stack.Screen name="ai-settings" options={{ headerShown: false }} />
        <Stack.Screen name="diagnostics" options={{ headerShown: false }} />
        <Stack.Screen name="api-usage" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
