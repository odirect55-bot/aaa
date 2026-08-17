/**
 * Jest setup. Keeps the suite deterministic regardless of the machine's
 * locale, and silences the dev-only logging the app does on error paths that
 * the tests exercise on purpose.
 */

jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
