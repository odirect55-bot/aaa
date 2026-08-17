import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../components/AppButton';
import type { RootScreenProps } from '../navigation/types';
import { startRinging, stopRinging } from '../services/alarmAudio';
import { useAlarmStore } from '../state/AlarmStore';
import { useTheme } from '../theme/ThemeProvider';
import { formatMeridiem, formatTime } from '../utils/time';

/**
 * Full-screen alarm.
 *
 * Owns the ringing tone and vibration for as long as it is mounted, keeps the
 * screen awake, blocks the Android back gesture (an alarm must be dealt with
 * deliberately) and gives up after the configured auto-dismiss window so the
 * phone does not ring forever in an empty room.
 */
export function RingingScreen(_props: RootScreenProps<'Ringing'>) {
  const { palette, spacing } = useTheme();
  const { ringing, settings, snoozeRinging, dismissRinging, missRinging } = useAlarmStore();

  useKeepAwake();

  const [now, setNow] = useState(() => new Date());
  const pulse = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);

  const alarm = ringing?.alarm ?? null;
  const canSnooze = (alarm?.snoozeMinutes ?? 0) > 0;

  // Leaving the screen must always silence the device, whatever the reason.
  useEffect(() => {
    if (!alarm) {
      return;
    }
    void startRinging(alarm.soundId, alarm.vibrate);
    return () => {
      void stopRinging();
    };
  }, [alarm]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  // Hardware back must not dismiss an alarm by accident.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  // Stop ringing on its own after the configured window and log it as missed.
  useEffect(() => {
    if (!ringing) {
      return;
    }
    const timeout = setTimeout(
      () => {
        void missRinging();
      },
      Math.max(1, settings.autoDismissMinutes) * 60_000
    );
    return () => clearTimeout(timeout);
  }, [missRinging, ringing, settings.autoDismissMinutes]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.08] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });

  const currentTime = useMemo(
    () => formatTime(now.getHours(), now.getMinutes(), settings.use24HourClock),
    [now, settings.use24HourClock]
  );

  if (!alarm) {
    return null;
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.ringingBackgroundTop }]}>
      <StatusBar style="light" />
      <View style={[styles.gradientBottom, { backgroundColor: palette.ringingBackgroundBottom }]} />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, { padding: spacing.xl }]}>
          <View style={styles.top}>
            <Text style={styles.kicker}>
              {ringing?.kind === 'snooze' ? 'SNOOZED ALARM' : 'ALARM'}
            </Text>

            <View style={styles.clockWrapper}>
              <Animated.View
                style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
              />
              <Animated.View style={{ transform: [{ scale }] }}>
                <Text style={styles.time} allowFontScaling={false}>
                  {currentTime}
                </Text>
                {settings.use24HourClock ? null : (
                  <Text style={styles.meridiem}>{formatMeridiem(now.getHours())}</Text>
                )}
              </Animated.View>
            </View>

            <Text style={styles.label} numberOfLines={2}>
              {alarm.label.trim().length > 0 ? alarm.label.trim() : 'Wake up'}
            </Text>
          </View>

          <View style={[styles.actions, { gap: spacing.md }]}>
            {canSnooze ? (
              <AppButton
                label={`Snooze ${alarm.snoozeMinutes} min`}
                size="huge"
                fullWidth
                disabled={busy}
                onPress={() => {
                  setBusy(true);
                  void snoozeRinging().finally(() => setBusy(false));
                }}
              />
            ) : null}
            <AppButton
              label="Dismiss"
              variant={canSnooze ? 'secondary' : 'primary'}
              size="huge"
              fullWidth
              disabled={busy}
              onPress={() => {
                setBusy(true);
                void dismissRinging().finally(() => setBusy(false));
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradientBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', opacity: 0.9 },
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: 'space-between' },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  kicker: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  clockWrapper: { alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#FFFFFF',
  },
  time: {
    color: '#FFFFFF',
    fontSize: 84,
    fontWeight: '200',
    letterSpacing: -3,
    textAlign: 'center',
  },
  meridiem: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -4,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  actions: { paddingBottom: 12 },
});
