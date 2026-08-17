/**
 * Jest setup. Keeps the suite deterministic regardless of the machine's
 * locale, wires up the AsyncStorage mock so the persistence layer runs for
 * real against memory, and silences the dev-only logging that the tests
 * exercise on purpose.
 */

// React only allows `act()` when this flag is set; the store's bootstrap does
// its state updates asynchronously, so every test needs it.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Without native insets the real SafeAreaProvider renders no children at all.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
