import * as Notifications from 'expo-notifications';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  cancelAlarm,
  cancelAlarmOccurrences,
  cancelAllOwned,
  cancelSnoozes,
  dismissDeliveredFor,
  getPermissionState,
  initialiseNotifications,
  parseAlarmPayload,
  requestPermission as requestNotificationPermission,
  reconcilePastOccurrences,
  scheduleSnooze,
  syncSchedule,
  type AlarmNotificationPayload,
  type PermissionState,
} from '../services/notifications';
import { storage } from '../services/storage';
import type {
  Alarm,
  AlarmDraft,
  HistoryEntry,
  ScheduledOccurrence,
  Settings,
} from '../types/models';
import { DEFAULT_SETTINGS, HISTORY_LIMIT } from '../types/models';
import { createId } from '../utils/id';
import { logger } from '../utils/logger';
import { currentTimeContext } from '../utils/time';
import { normaliseDraft, validateDraft } from '../utils/validation';

export interface RingingState {
  alarm: Alarm;
  firesAt: number;
  kind: 'alarm' | 'snooze';
}

export interface AlarmStore {
  ready: boolean;
  alarms: Alarm[];
  settings: Settings;
  history: HistoryEntry[];
  permission: PermissionState;
  ringing: RingingState | null;
  lastSyncError: string | null;
  addAlarm: (draft: AlarmDraft) => Promise<Alarm>;
  updateAlarm: (id: string, draft: AlarmDraft) => Promise<void>;
  deleteAlarm: (id: string) => Promise<void>;
  setAlarmEnabled: (id: string, enabled: boolean) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  requestPermission: () => Promise<PermissionState>;
  refreshPermission: () => Promise<void>;
  snoozeRinging: () => Promise<void>;
  dismissRinging: () => Promise<void>;
  missRinging: () => Promise<void>;
  clearHistory: () => Promise<void>;
  resetAllData: () => Promise<void>;
  resync: () => Promise<void>;
}

const AlarmStoreContext = createContext<AlarmStore | null>(null);

export function useAlarmStore(): AlarmStore {
  const store = useContext(AlarmStoreContext);
  if (!store) {
    throw new Error('useAlarmStore must be used inside <AlarmStoreProvider>');
  }
  return store;
}

export function AlarmStoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [permission, setPermission] = useState<PermissionState>({
    granted: false,
    canAskAgain: true,
    status: 'unknown',
  });
  const [ringing, setRinging] = useState<RingingState | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  /**
   * Scheduling work outlives the render cycle: a sync started by the last
   * interaction can still be in flight when the provider unmounts. These
   * wrappers drop the resulting state updates instead of warning about
   * updating an unmounted component.
   */
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const safely =
    <T,>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (value: React.SetStateAction<T>) => {
      if (mounted.current) {
        setter(value);
      }
    };

  const setAlarmsSafely = safely(setAlarms);
  const setHistorySafely = safely(setHistory);
  const setSettingsSafely = safely(setSettings);
  const setPermissionSafely = safely(setPermission);
  const setRingingSafely = safely(setRinging);
  const setLastSyncErrorSafely = safely(setLastSyncError);
  const setReadySafely = safely(setReady);

  // Listeners and the sync queue run outside React's render cycle, so the
  // latest values are mirrored into refs to avoid stale closures.
  const alarmsRef = useRef<Alarm[]>([]);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const historyRef = useRef<HistoryEntry[]>([]);
  const scheduleRef = useRef<ScheduledOccurrence[]>([]);
  const syncQueue = useRef<Promise<unknown>>(Promise.resolve());

  alarmsRef.current = alarms;
  settingsRef.current = settings;
  historyRef.current = history;

  /** Serialises every scheduling pass; concurrent syncs would race the OS. */
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const result = syncQueue.current.then(task, task);
    syncQueue.current = result.catch(() => undefined);
    return result;
  }, []);

  const persistHistory = useCallback(async (entries: HistoryEntry[]) => {
    const trimmed = entries.slice(0, HISTORY_LIMIT);
    historyRef.current = trimmed;
    setHistorySafely(trimmed);
    await storage.saveHistory(trimmed);
  }, []);

  const recordHistory = useCallback(
    async (entry: HistoryEntry) => {
      const deduped = historyRef.current.filter(
        (existing) =>
          !(existing.alarmId === entry.alarmId && existing.scheduledFor === entry.scheduledFor)
      );
      await persistHistory([entry, ...deduped]);
    },
    [persistHistory]
  );

  const persistAlarms = useCallback(async (next: Alarm[]) => {
    alarmsRef.current = next;
    setAlarmsSafely(next);
    await storage.saveAlarms(next);
  }, []);

  /**
   * Rebuilds the OS schedule from the current alarms. Runs after every
   * mutation, when the app returns to the foreground, and whenever the device
   * time context changes.
   */
  const runSync = useCallback(async () => {
    try {
      const snoozes = scheduleRef.current.filter((item) => item.kind === 'snooze');
      const result = await syncSchedule(alarmsRef.current, settingsRef.current, snoozes);
      scheduleRef.current = result.occurrences;
      await storage.saveSchedule(result.occurrences);
      setLastSyncErrorSafely(
        result.failed > 0
          ? `${result.failed} alarm${result.failed === 1 ? '' : 's'} could not be scheduled. Check notification permissions.`
          : null
      );
    } catch (error) {
      logger.error('store', error);
      setLastSyncErrorSafely('Could not update scheduled alarms.');
    }
  }, []);

  /**
   * Applies whatever happened while the app was closed: alarms that rang
   * unattended become history, one-shot alarms that already fired switch off.
   */
  const reconcile = useCallback(async () => {
    const { alarmIdsToDisable, missedEntries, remaining } = reconcilePastOccurrences(
      alarmsRef.current,
      scheduleRef.current,
      historyRef.current
    );

    scheduleRef.current = remaining;

    if (missedEntries.length > 0) {
      await persistHistory([...missedEntries, ...historyRef.current]);
    }

    if (alarmIdsToDisable.length > 0) {
      const toDisable = new Set(alarmIdsToDisable);
      const next = alarmsRef.current.map((alarm) =>
        toDisable.has(alarm.id) ? { ...alarm, enabled: false, updatedAt: Date.now() } : alarm
      );
      await persistAlarms(next);
    }
  }, [persistAlarms, persistHistory]);

  const beginRinging = useCallback((payload: AlarmNotificationPayload) => {
    const alarm = alarmsRef.current.find((candidate) => candidate.id === payload.alarmId);
    if (!alarm) {
      logger.warn('store', `Notification for unknown alarm ${payload.alarmId}`);
      return;
    }
    // Tapping a stale notification left in the shade must not restart an alarm
    // the user already dealt with.
    const alreadyHandled = historyRef.current.some(
      (entry) => entry.alarmId === payload.alarmId && entry.scheduledFor === payload.firesAt
    );
    if (alreadyHandled) {
      logger.info('store', `Ignoring notification for handled occurrence ${payload.firesAt}`);
      void dismissDeliveredFor(payload.alarmId);
      return;
    }
    setRingingSafely({ alarm, firesAt: payload.firesAt, kind: payload.kind });
  }, []);

  const finishRinging = useCallback(
    async (
      payload: AlarmNotificationPayload,
      action: 'dismissed' | 'snoozed' | 'missed'
    ): Promise<void> => {
      const alarm = alarmsRef.current.find((candidate) => candidate.id === payload.alarmId);
      await recordHistory({
        id: createId('history'),
        alarmId: payload.alarmId,
        label: alarm?.label ?? '',
        scheduledFor: payload.firesAt,
        recordedAt: Date.now(),
        action,
      });
      await dismissDeliveredFor(payload.alarmId);
      setRingingSafely((current) => (current?.alarm.id === payload.alarmId ? null : current));
    },
    [recordHistory]
  );

  // `snoozeAlarm` falls back to dismissing when snooze is switched off, and
  // `dismissAlarm` is declared below it; a ref breaks the cycle without
  // reordering the two callbacks.
  const dismissAlarmRef = useRef<(payload: AlarmNotificationPayload) => Promise<void>>(
    async () => undefined
  );

  /** Snooze from either the ringing screen or the notification action. */
  const snoozeAlarm = useCallback(
    async (payload: AlarmNotificationPayload) => {
      const alarm = alarmsRef.current.find((candidate) => candidate.id === payload.alarmId);
      if (!alarm) {
        return;
      }
      // `snoozeMinutes === 0` means the user turned snooze off for this alarm,
      // so a snooze request degrades to a dismissal rather than quietly
      // borrowing the global default.
      const minutes = alarm.snoozeMinutes;
      if (minutes <= 0) {
        await dismissAlarmRef.current(payload);
        return;
      }

      const snoozed = await enqueue(async () => {
        // Only one snooze may be pending per alarm.
        await cancelSnoozes(alarm.id);
        const occurrence = await scheduleSnooze(alarm, settingsRef.current, minutes);
        if (!occurrence) {
          setLastSyncErrorSafely('Could not schedule the snooze.');
          return false;
        }
        scheduleRef.current = [...scheduleRef.current, occurrence];
        await storage.saveSchedule(scheduleRef.current);
        return true;
      });

      // If the snooze could not be scheduled, nothing is going to ring again —
      // record what actually happened rather than a snooze that does not exist.
      await finishRinging(payload, snoozed ? 'snoozed' : 'dismissed');
    },
    [enqueue, finishRinging]
  );

  const dismissAlarm = useCallback(
    async (payload: AlarmNotificationPayload) => {
      await enqueue(async () => {
        await cancelSnoozes(payload.alarmId);
        scheduleRef.current = scheduleRef.current.filter(
          (item) => !(item.alarmId === payload.alarmId && item.kind === 'snooze')
        );

        // A one-shot alarm is done once it has been dealt with.
        const alarm = alarmsRef.current.find((candidate) => candidate.id === payload.alarmId);
        if (alarm && alarm.repeatDays.length === 0 && alarm.enabled) {
          await persistAlarms(
            alarmsRef.current.map((candidate) =>
              candidate.id === alarm.id
                ? { ...candidate, enabled: false, updatedAt: Date.now() }
                : candidate
            )
          );
        }
        await runSync();
      });
      await finishRinging(payload, 'dismissed');
    },
    [enqueue, finishRinging, persistAlarms, runSync]
  );

  dismissAlarmRef.current = dismissAlarm;

  const handleResponse = useCallback(
    async (response: Notifications.NotificationResponse) => {
      const payload = parseAlarmPayload(response.notification.request.content.data);
      if (!payload) {
        return;
      }
      switch (response.actionIdentifier) {
        case 'snooze':
          await snoozeAlarm(payload);
          break;
        case 'dismiss':
          await dismissAlarm(payload);
          break;
        default:
          // Tapping the notification body opens the full ringing screen.
          beginRinging(payload);
          break;
      }
    },
    [beginRinging, dismissAlarm, snoozeAlarm]
  );

  // ---------------------------------------------------------------- bootstrap
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await initialiseNotifications();

        const [storedAlarms, storedSettings, storedHistory, storedSchedule] = await Promise.all([
          storage.loadAlarms(),
          storage.loadSettings(),
          storage.loadHistory(),
          storage.loadSchedule(),
        ]);

        if (cancelled) {
          return;
        }

        alarmsRef.current = storedAlarms;
        settingsRef.current = storedSettings;
        historyRef.current = storedHistory;
        scheduleRef.current = storedSchedule;

        setAlarmsSafely(storedAlarms);
        setSettingsSafely(storedSettings);
        setHistorySafely(storedHistory);

        const state = await getPermissionState();
        if (!cancelled) {
          setPermissionSafely(state);
        }

        await reconcile();
        await enqueue(runSync);
        await storage.saveTimeContext(currentTimeContext());

        // A notification tapped while the app was closed is delivered here.
        const lastResponse = Notifications.getLastNotificationResponse();
        if (lastResponse) {
          Notifications.clearLastNotificationResponse();
          await handleResponse(lastResponse);
        }
      } catch (error) {
        logger.error('store', error);
      } finally {
        if (!cancelled) {
          setReadySafely(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Bootstrap must run exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------- runtime listeners
  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const payload = parseAlarmPayload(notification.request.content.data);
      if (payload) {
        beginRinging(payload);
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void handleResponse(response);
      }
    );

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [beginRinging, handleResponse]);

  // Returning to the foreground is the moment to repair the schedule: the
  // clock, the time zone or the OS may have moved underneath the app.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active' || !ready) {
        return;
      }
      void enqueue(async () => {
        const previousContext = await storage.loadTimeContext();
        const context = currentTimeContext();
        if (previousContext !== context) {
          logger.info('store', `Time context changed: ${previousContext} -> ${context}`);
          await storage.saveTimeContext(context);
        }
        await reconcile();
        await runSync();
      });
      void getPermissionState().then(setPermissionSafely);
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [enqueue, ready, reconcile, runSync]);

  // A long-running foreground session still has to notice midnight, a DST
  // change or a user changing the system clock.
  useEffect(() => {
    if (!ready) {
      return;
    }
    const interval = setInterval(() => {
      void enqueue(async () => {
        const previousContext = await storage.loadTimeContext();
        const context = currentTimeContext();
        if (previousContext !== context) {
          await storage.saveTimeContext(context);
          await runSync();
        }
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, [enqueue, ready, runSync]);

  // ------------------------------------------------------------------ actions
  const addAlarm = useCallback(
    async (draft: AlarmDraft): Promise<Alarm> => {
      const normalised = normaliseDraft(draft);
      const validation = validateDraft(normalised);
      if (!validation.valid) {
        throw new Error(validation.errors.join(' '));
      }

      // Ask for notification permission at the moment it starts to matter,
      // rather than with a cold dialog on first launch.
      const current = await getPermissionState();
      if (!current.granted && current.canAskAgain) {
        setPermissionSafely(await requestNotificationPermission());
      } else {
        setPermissionSafely(current);
      }

      const now = Date.now();
      const alarm: Alarm = { ...normalised, id: createId(), createdAt: now, updatedAt: now };
      await persistAlarms([...alarmsRef.current, alarm]);
      await enqueue(runSync);
      return alarm;
    },
    [enqueue, persistAlarms, runSync]
  );

  const updateAlarm = useCallback(
    async (id: string, draft: AlarmDraft): Promise<void> => {
      const normalised = normaliseDraft(draft);
      const validation = validateDraft(normalised);
      if (!validation.valid) {
        throw new Error(validation.errors.join(' '));
      }

      const next = alarmsRef.current.map((alarm) =>
        alarm.id === id ? { ...alarm, ...normalised, updatedAt: Date.now() } : alarm
      );
      await persistAlarms(next);
      await enqueue(async () => {
        // Editing invalidates every pending notification for this alarm,
        // including a snooze that belongs to the previous configuration.
        await cancelAlarm(id);
        scheduleRef.current = scheduleRef.current.filter((item) => item.alarmId !== id);
        await runSync();
      });
    },
    [enqueue, persistAlarms, runSync]
  );

  const deleteAlarm = useCallback(
    async (id: string): Promise<void> => {
      await persistAlarms(alarmsRef.current.filter((alarm) => alarm.id !== id));
      setRingingSafely((current) => (current?.alarm.id === id ? null : current));
      await enqueue(async () => {
        await cancelAlarm(id);
        scheduleRef.current = scheduleRef.current.filter((item) => item.alarmId !== id);
        await runSync();
      });
    },
    [enqueue, persistAlarms, runSync]
  );

  const setAlarmEnabled = useCallback(
    async (id: string, enabled: boolean): Promise<void> => {
      const next = alarmsRef.current.map((alarm) =>
        alarm.id === id ? { ...alarm, enabled, updatedAt: Date.now() } : alarm
      );
      await persistAlarms(next);
      await enqueue(async () => {
        if (!enabled) {
          await cancelAlarm(id);
          scheduleRef.current = scheduleRef.current.filter((item) => item.alarmId !== id);
        }
        await runSync();
      });
    },
    [enqueue, persistAlarms, runSync]
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>): Promise<void> => {
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      setSettingsSafely(next);
      await storage.saveSettings(next);

      // The clock format is baked into the notification text, so pending
      // notifications have to be rebuilt for it to take effect.
      if (patch.use24HourClock !== undefined) {
        await enqueue(async () => {
          for (const alarm of alarmsRef.current) {
            await cancelAlarmOccurrences(alarm.id);
          }
          scheduleRef.current = scheduleRef.current.filter((item) => item.kind === 'snooze');
          await runSync();
        });
      }
    },
    [enqueue, runSync]
  );

  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    const state = await requestNotificationPermission();
    setPermissionSafely(state);
    if (state.granted) {
      await enqueue(runSync);
    }
    return state;
  }, [enqueue, runSync]);

  const refreshPermission = useCallback(async () => {
    setPermissionSafely(await getPermissionState());
  }, []);

  const snoozeRinging = useCallback(async () => {
    if (!ringing) {
      return;
    }
    await snoozeAlarm({ alarmId: ringing.alarm.id, firesAt: ringing.firesAt, kind: ringing.kind });
  }, [ringing, snoozeAlarm]);

  const dismissRinging = useCallback(async () => {
    if (!ringing) {
      return;
    }
    await dismissAlarm({ alarmId: ringing.alarm.id, firesAt: ringing.firesAt, kind: ringing.kind });
  }, [dismissAlarm, ringing]);

  const missRinging = useCallback(async () => {
    if (!ringing) {
      return;
    }
    await finishRinging(
      { alarmId: ringing.alarm.id, firesAt: ringing.firesAt, kind: ringing.kind },
      'missed'
    );
  }, [finishRinging, ringing]);

  const clearHistory = useCallback(async () => {
    await persistHistory([]);
  }, [persistHistory]);

  /** Wipes stored alarms, settings and history, and unschedules everything. */
  const resetAllData = useCallback(async () => {
    await enqueue(async () => {
      await cancelAllOwned();
      await storage.clearAll();

      alarmsRef.current = [];
      historyRef.current = [];
      settingsRef.current = { ...DEFAULT_SETTINGS };
      scheduleRef.current = [];

      setAlarmsSafely([]);
      setHistorySafely([]);
      setSettingsSafely({ ...DEFAULT_SETTINGS });
      setRingingSafely(null);
      setLastSyncErrorSafely(null);
    });
  }, [enqueue]);

  const resync = useCallback(async () => {
    await enqueue(async () => {
      await reconcile();
      await runSync();
    });
  }, [enqueue, reconcile, runSync]);

  const value = useMemo<AlarmStore>(
    () => ({
      ready,
      alarms,
      settings,
      history,
      permission,
      ringing,
      lastSyncError,
      addAlarm,
      updateAlarm,
      deleteAlarm,
      setAlarmEnabled,
      updateSettings,
      requestPermission,
      refreshPermission,
      snoozeRinging,
      dismissRinging,
      missRinging,
      clearHistory,
      resetAllData,
      resync,
    }),
    [
      ready,
      alarms,
      settings,
      history,
      permission,
      ringing,
      lastSyncError,
      addAlarm,
      updateAlarm,
      deleteAlarm,
      setAlarmEnabled,
      updateSettings,
      requestPermission,
      refreshPermission,
      snoozeRinging,
      dismissRinging,
      missRinging,
      clearHistory,
      resetAllData,
      resync,
    ]
  );

  return <AlarmStoreContext.Provider value={value}>{children}</AlarmStoreContext.Provider>;
}
