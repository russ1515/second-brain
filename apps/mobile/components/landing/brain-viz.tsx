import { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';

/**
 * Lightweight canvas-free knowledge constellation shared with onboarding.
 * The entry pulse runs once and then stops; reduced motion is fully static.
 */
export function BrainViz({ color, nodeColor }: { color: string; nodeColor: string }) {
  const { reducedMotion, motion } = useTokens();
  const reveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reducedMotion) {
      reveal.setValue(1);
      return;
    }
    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.duration.slow,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [motion.duration.slow, reducedMotion, reveal]);
  const nodes = [
    { x: 90, y: 20 },
    { x: 40, y: 60 },
    { x: 140, y: 55 },
    { x: 70, y: 100 },
    { x: 120, y: 105 },
    { x: 90, y: 62 },
  ];
  const scale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  return (
    <View accessible={false} style={{ width: 200, height: 140 }}>
      <View style={{ position: 'absolute', left: 39, top: 59, width: 104, height: 1, backgroundColor: nodeColor, opacity: 0.35, transform: [{ rotate: '-7deg' }] }} />
      <View style={{ position: 'absolute', left: 62, top: 69, width: 83, height: 1, backgroundColor: nodeColor, opacity: 0.35, transform: [{ rotate: '30deg' }] }} />
      {nodes.map((node, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            left: node.x - 7,
            top: node.y - 7,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: index === 5 ? color : nodeColor,
            opacity: reveal,
            transform: [{ scale }],
          }}
        />
      ))}
      <Animated.View style={{ position: 'absolute', left: 68, top: 40, width: 44, height: 44, borderRadius: 22, backgroundColor: color, opacity: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }), transform: [{ scale }] }} />
    </View>
  );
}
