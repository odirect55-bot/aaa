import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

const ITEM_HEIGHT = 56;
const VISIBLE_ITEMS = 3;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface WheelProps {
  values: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  accessibilityLabel: string;
  width?: number;
}

/**
 * A snapping scroll wheel. Items scale and fade with their distance from the
 * centre, driven natively so the animation never stutters while scrolling.
 * Items are also tappable, which keeps the control usable with a screen reader
 * and for anyone who finds precise scrolling difficult.
 */
function Wheel({ values, selectedIndex, onSelect, accessibilityLabel, width = 92 }: WheelProps) {
  const { palette } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(selectedIndex * ITEM_HEIGHT)).current;
  const lastReported = useRef(selectedIndex);

  // Follow external changes (e.g. switching between 12- and 24-hour mode).
  useEffect(() => {
    if (lastReported.current === selectedIndex) {
      return;
    }
    lastReported.current = selectedIndex;
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: true });
  }, [selectedIndex]);

  // `contentOffset` positions the wheel on first paint, but on Android the
  // offset can be applied before the content has been measured; re-applying it
  // once the size is known makes the initial position reliable.
  const alignedOnce = useRef(false);
  const handleContentSizeChange = useCallback(() => {
    if (alignedOnce.current) {
      return;
    }
    alignedOnce.current = true;
    scrollRef.current?.scrollTo({ y: lastReported.current * ITEM_HEIGHT, animated: false });
  }, []);

  const handleSettle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(values.length - 1, index));
      if (clamped !== lastReported.current) {
        lastReported.current = clamped;
        onSelect(clamped);
      }
    },
    [onSelect, values.length]
  );

  return (
    <View style={{ height: WHEEL_HEIGHT, width }}>
      <ScrollView
        ref={scrollRef}
        accessibilityLabel={accessibilityLabel}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
        contentContainerStyle={{ paddingVertical: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleSettle}
        onScrollEndDrag={handleSettle}
        onContentSizeChange={handleContentSizeChange}
      >
        {values.map((label, index) => {
          const distance = Animated.subtract(scrollY, index * ITEM_HEIGHT);
          const inputRange = [-2 * ITEM_HEIGHT, -ITEM_HEIGHT, 0, ITEM_HEIGHT, 2 * ITEM_HEIGHT];
          const opacity = distance.interpolate({
            inputRange,
            outputRange: [0.25, 0.55, 1, 0.55, 0.25],
            extrapolate: 'clamp',
          });
          const scale = distance.interpolate({
            inputRange,
            outputRange: [0.75, 0.86, 1, 0.86, 0.75],
            extrapolate: 'clamp',
          });

          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: index === selectedIndex }}
              onPress={() => {
                scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
                lastReported.current = index;
                onSelect(index);
              }}
            >
              <Animated.View style={[styles.item, { opacity, transform: [{ scale }] }]}>
                <Text style={[styles.itemText, { color: palette.textPrimary }]}>{label}</Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const HOURS_24 = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const HOURS_12 = Array.from({ length: 12 }, (_, index) => String(index === 0 ? 12 : index));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const MERIDIEMS = ['AM', 'PM'];

/**
 * Time selector for the alarm editor. Works in both clock formats and reports
 * the value back as a plain 24-hour hour/minute pair.
 */
export function TimePicker({
  hour,
  minute,
  use24HourClock,
  onChange,
}: {
  hour: number;
  minute: number;
  use24HourClock: boolean;
  onChange: (next: { hour: number; minute: number }) => void;
}) {
  const { palette, radius, spacing } = useTheme();

  const hourValues = use24HourClock ? HOURS_24 : HOURS_12;
  const hourIndex = use24HourClock ? hour : hour % 12;
  const meridiemIndex = hour < 12 ? 0 : 1;

  const handleHour = useCallback(
    (index: number) => {
      if (use24HourClock) {
        onChange({ hour: index, minute });
        return;
      }
      onChange({ hour: index + (meridiemIndex === 1 ? 12 : 0), minute });
    },
    [meridiemIndex, minute, onChange, use24HourClock]
  );

  const handleMeridiem = useCallback(
    (index: number) => {
      const baseHour = hour % 12;
      onChange({ hour: baseHour + (index === 1 ? 12 : 0), minute });
    },
    [hour, minute, onChange]
  );

  const selectionStyle = useMemo(
    () => ({
      top: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2,
      height: ITEM_HEIGHT,
      borderRadius: radius.md,
      backgroundColor: palette.surfaceSubtle,
    }),
    [palette.surfaceSubtle, radius.md]
  );

  return (
    <View style={[styles.container, { gap: spacing.xs }]}>
      <View style={[styles.selection, selectionStyle]} pointerEvents="none" />
      <Wheel
        values={hourValues}
        selectedIndex={hourIndex}
        onSelect={handleHour}
        accessibilityLabel="Hour"
      />
      <Text style={[styles.separator, { color: palette.textMuted }]}>:</Text>
      <Wheel
        values={MINUTES}
        selectedIndex={minute}
        onSelect={(index) => onChange({ hour, minute: index })}
        accessibilityLabel="Minute"
      />
      {use24HourClock ? null : (
        <Wheel
          values={MERIDIEMS}
          selectedIndex={meridiemIndex}
          onSelect={handleMeridiem}
          accessibilityLabel="AM or PM"
          width={78}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: WHEEL_HEIGHT,
  },
  selection: { position: 'absolute', left: 8, right: 8 },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 38, fontWeight: '300', letterSpacing: -1 },
  separator: { fontSize: 32, fontWeight: '300', marginBottom: 4 },
});
