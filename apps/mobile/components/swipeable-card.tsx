import { useRef } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

/**
 * Swipe-to-dismiss wrapper (Sprint 10.2 — touch gestures).
 *
 * A horizontal drag past the threshold flings the card off-screen and calls
 * `onDismiss`; a short drag springs back. Built on the RN `PanResponder` +
 * `Animated` (no dependency). The responder only claims clearly-horizontal drags
 * so it never steals the vertical scroll.
 */
export function SwipeableCard({
  children,
  onDismiss,
}: {
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const responder = useRef(
    PanResponder.create({
      // Only take over for a deliberate horizontal swipe (not a scroll).
      onMoveShouldSetPanResponder: (_e, g) =>
        !!onDismiss && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        translateX.setValue(g.dx);
        opacity.setValue(Math.max(0.3, 1 - Math.abs(g.dx) / 320));
      },
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) > 120) {
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: g.dx > 0 ? 500 : -500,
              duration: 180,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(() => onDismiss?.());
        } else {
          Animated.parallel([
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
            Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
          ]).start();
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[styles.wrap, { transform: [{ translateX }], opacity }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
