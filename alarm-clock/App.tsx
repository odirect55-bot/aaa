import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AlarmStoreProvider, useAlarmStore } from './src/state/AlarmStore';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

/** Reads the persisted theme preference before rendering the UI. */
function ThemedApp() {
  const { settings } = useAlarmStore();
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
