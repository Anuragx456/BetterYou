import { useFitnessStore } from '../store/useFitnessStore';

export interface UpdateGatingConditions {
  isDev: boolean;
  isEnabled: boolean;
  isMidWorkout: boolean;
}

function promptUserRestart(onRestart: () => void) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AlertModule = typeof require !== 'undefined' ? require('react-native').Alert : null;
    if (AlertModule?.alert) {
      AlertModule.alert(
        'Update Ready',
        'A new update for BetterYou is ready. Would you like to restart now to apply it?',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Restart Now',
            onPress: onRestart,
          },
        ]
      );
    }
  } catch {
    // No-op in headless test environments
  }
}

/**
 * Pure gating decision:
 * Only checks for updates in production builds when expo-updates is enabled.
 * Never runs in development / Expo Go.
 * Never interrupts a user mid-workout.
 */
export function shouldCheckForUpdates({
  isDev,
  isEnabled,
  isMidWorkout,
}: UpdateGatingConditions): boolean {
  if (isDev) return false;
  if (!isEnabled) return false;
  if (isMidWorkout) return false;
  return true;
}

/**
 * Checks for OTA updates on launch, downloads the bundle, and prompts the user to restart.
 * Never force-restarts.
 */
export async function checkForUpdatesOnLaunch(
  injectedUpdates?: typeof import('expo-updates')
): Promise<{ status: 'checked' | 'skipped' | 'downloaded' | 'error'; reason?: string }> {
  const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : false;
  let updatesModule: typeof import('expo-updates');

  try {
    updatesModule = injectedUpdates ?? (await import('expo-updates'));
  } catch {
    return { status: 'skipped', reason: 'expo-updates native module not available' };
  }

  const isEnabled = Boolean(updatesModule?.isEnabled);
  const isMidWorkout = Boolean(useFitnessStore.getState().activeWorkout);

  if (!shouldCheckForUpdates({ isDev, isEnabled, isMidWorkout })) {
    return {
      status: 'skipped',
      reason: isDev
        ? 'Disabled in development'
        : !isEnabled
        ? 'Updates disabled or running in Expo Go'
        : 'User is mid-workout',
    };
  }

  try {
    const check = await updatesModule.checkForUpdateAsync();
    if (!check.isAvailable) {
      return { status: 'checked', reason: 'App is already up to date' };
    }

    const fetchResult = await updatesModule.fetchUpdateAsync();
    if (fetchResult.isNew) {
      // Prompt user to restart — never force-restart mid-workout or mid-scan
      promptUserRestart(() => {
        updatesModule.reloadAsync().catch(() => {});
      });
      return { status: 'downloaded' };
    }
    return { status: 'checked' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('[checkForUpdates] Update check failed:', errorMsg);
    return { status: 'error', reason: errorMsg };
  }
}
