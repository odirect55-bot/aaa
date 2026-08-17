import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'medium' | 'large' | 'huge';

const HEIGHTS: Record<Size, number> = {
  medium: MIN_TOUCH_TARGET,
  large: 56,
  huge: 72,
};

const FONT_SIZES: Record<Size, number> = {
  medium: 15,
  large: 17,
  huge: 20,
};

/**
 * The app's only button. Presses animate a small scale-down, which reads as
 * responsive without the delay of an opacity fade.
 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const { palette, radius } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const background =
    variant === 'primary'
      ? palette.primary
      : variant === 'danger'
        ? palette.dangerSoft
        : variant === 'secondary'
          ? palette.surfaceSubtle
          : 'transparent';

  const textColor =
    variant === 'primary'
      ? palette.onPrimary
      : variant === 'danger'
        ? palette.danger
        : variant === 'ghost'
          ? palette.primary
          : palette.textPrimary;

  return (
    <Animated.View
      style={[
        fullWidth && styles.fullWidth,
        { transform: [{ scale }], opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        disabled={disabled || loading}
        onPressIn={() => animateTo(0.96)}
        onPressOut={() => animateTo(1)}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: background,
            borderRadius: radius.pill,
            minHeight: HEIGHTS[size],
            borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
            borderColor: palette.border,
            opacity: pressed && variant === 'ghost' ? 0.6 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <View style={styles.content}>
            <Text
              numberOfLines={1}
              style={[styles.label, { color: textColor, fontSize: FONT_SIZES[size] }]}
            >
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontWeight: '600', textAlign: 'center' },
});
