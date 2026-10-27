import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { colors } from '../theme/colors';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <StatusBar style="light" />
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
        </Stack>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
