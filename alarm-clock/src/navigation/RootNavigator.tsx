import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AlarmEditScreen } from '../screens/AlarmEditScreen';
import { AlarmListScreen } from '../screens/AlarmListScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { RingingScreen } from '../screens/RingingScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useAlarmStore } from '../state/AlarmStore';
import { useTheme } from '../theme/ThemeProvider';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { palette, isDark } = useTheme();
  const { ready, ringing } = useAlarmStore();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.primary,
        background: palette.background,
        card: palette.background,
        text: palette.textPrimary,
        border: palette.border,
      },
    };
  }, [isDark, palette]);

  // The container is not navigable on the first render, and an alarm tapped
  // from a cold start sets the ringing state before then — so the effect below
  // has to re-run once navigation is ready.
  const [navigationReady, setNavigationReady] = useState(false);

  /**
   * A ringing alarm always wins: whatever the user was doing, the full-screen
   * alarm takes over, and it is dismissed as soon as the store clears it. This
   * is the only place that navigates to or away from the ringing screen, so
   * the two directions can never race each other.
   */
  useEffect(() => {
    if (!navigationReady || !navigationRef.isReady()) {
      return;
    }
    const currentRoute = navigationRef.getCurrentRoute()?.name;
    if (ringing && currentRoute !== 'Ringing') {
      navigationRef.navigate('Ringing');
    } else if (!ringing && currentRoute === 'Ringing' && navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
  }, [navigationReady, navigationRef, ringing]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.background,
        }}
      >
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => setNavigationReady(true)}
    >
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: palette.textPrimary,
          headerStyle: { backgroundColor: palette.background },
          contentStyle: { backgroundColor: palette.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="AlarmList" component={AlarmListScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="AlarmEdit"
          component={AlarmEditScreen}
          options={{ title: 'New alarm', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
        <Stack.Screen
          name="Ringing"
          component={RingingScreen}
          options={{
            headerShown: false,
            gestureEnabled: false,
            animation: 'fade',
            presentation: 'fullScreenModal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
