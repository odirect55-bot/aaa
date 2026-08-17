import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  AlarmList: undefined;
  /** Omit `alarmId` to create a new alarm. */
  AlarmEdit: { alarmId?: string } | undefined;
  Settings: undefined;
  History: undefined;
  Ringing: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
