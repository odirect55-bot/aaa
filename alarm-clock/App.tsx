import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AlarmStoreProvider, useAlarmStore } from './src/state/AlarmStore';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

/**
 * Keep the native splash up until alarms and settings have been read back, so
 * a cold start goes straight from the splash to the alarm list rather than
 * flashing a loading spinner in the wrong theme.
 */
SplashScreen.preventAutoHideAsync().catch(() => {
  // Not fatal: the splash simply hides on its own.
});

/** Reads the persisted theme preference before rendering the UI. */
function ThemedApp() {
  const { settings, ready } = useAlarmStore();

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {
        // Already hidden, or no splash on this platform.
      });
    }
  }, [ready]);

  return (
    <ThemeProvider mode={settings.themeMode}>
      <StatusBarForTheme />
      <RootNavigator />
    </ThemeProvider>
  );
}

function StatusBarForTheme() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* Seeding the metrics avoids a blank first frame on cold start. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AlarmStoreProvider>
          <ThemedApp />
        </AlarmStoreProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
