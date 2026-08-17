import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';

export interface SheetOption<T> {
  value: T;
  label: string;
  description?: string;
}

/**
 * Bottom sheet single-choice picker (alarm sound, snooze length, …).
 * Slides up on open so the transition reads as a sheet rather than a jump cut.
 */
export function OptionSheet<T extends string | number>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  onHighlight,
}: {
  visible: boolean;
  title: string;
  options: SheetOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  /** Fired when an option is chosen, before closing — used to preview sounds. */
  onHighlight?: (value: T) => void;
}) {
  const { palette, radius, spacing } = useTheme();
  const translateY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(40);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 3 }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [opacity, translateY, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close"
        style={[styles.backdrop, { backgroundColor: palette.overlay }]}
        onPress={onClose}
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: spacing.xl,
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: palette.border }]} />
        <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text>
        <ScrollView bounces={false} style={styles.list}>
          {options.map((option) => {
            const isSelected = option.value === selected;
            return (
              <Pressable
                key={String(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={option.label}
                onPress={() => {
                  onHighlight?.(option.value);
                  onSelect(option.value);
                }}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: isSelected
                      ? palette.primarySoft
                      : pressed
                        ? palette.surfaceSubtle
                        : 'transparent',
                    borderRadius: radius.md,
                  },
                ]}
              >
                <View style={styles.optionTexts}>
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: isSelected ? palette.primary : palette.textPrimary },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.description ? (
                    <Text style={[styles.optionDescription, { color: palette.textSecondary }]}>
                      {option.description}
                    </Text>
                  ) : null}
                </View>
                {isSelected ? (
                  <Text style={[styles.check, { color: palette.primary }]}>✓</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '75%',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8, paddingHorizontal: 4 },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET + 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  optionTexts: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 16, fontWeight: '600' },
  optionDescription: { fontSize: 13 },
  check: { fontSize: 18, fontWeight: '700' },
});
