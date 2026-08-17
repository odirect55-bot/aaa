import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { darkPalette } from '../theme/tokens';
import { describeError, logger } from '../utils/logger';

interface State {
  error: Error | null;
}

/**
 * Last line of defence. A render crash in an alarm app must not leave the user
 * looking at a blank screen with no idea whether their alarms still exist, so
 * the boundary explains what happened and confirms that alarms already handed
 * to the system keep ringing regardless.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    logger.error('ui', error);
  }

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error. Alarms that were already scheduled with Android are
            unaffected and will still ring. Reopen the app to continue.
          </Text>
          <Text style={styles.detail}>{describeError(error)}</Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: darkPalette.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { color: darkPalette.textPrimary, fontSize: 24, fontWeight: '700' },
  body: { color: darkPalette.textSecondary, fontSize: 15, lineHeight: 22 },
  detail: { color: darkPalette.textMuted, fontSize: 12, fontFamily: 'monospace', marginTop: 8 },
});
