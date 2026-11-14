import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThemeProvider, useTheme } from '../theme/theme';
import { useFitnessStore } from '../store/useFitnessStore';
import { initNetInfoQueueListener, stopNetInfoQueueListener } from '../services/scanQueueService';
import { initTelemetry } from '../services/telemetryService';
import { flushActiveWorkoutPersist } from '../utils/debouncedStorage';
import { ensureFileSystemReady } from '../utils/imageManager';

// Initialize privacy-safe telemetry early in lifecycle
initTelemetry();

export default function RootLayout() {
  useEffect(() => {
    // Initialize normalized SQLite database and verify migrations
    useFitnessStore.getState().loadDataFromDb().catch(() => {});
    ensureFileSystemReady().catch(() => {});
    initNetInfoQueueListener().catch(() => {});

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
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="nutrition-target" options={{ headerShown: false }} />
        <Stack.Screen name="ai-settings" options={{ headerShown: false }} />
        <Stack.Screen name="diagnostics" options={{ headerShown: false }} />
        <Stack.Screen name="api-usage" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
