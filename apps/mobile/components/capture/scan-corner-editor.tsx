import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from 'react-native';
import {
  SCAN_CORNERS,
  containedImageRect,
  moveScanCorner,
  type ImageContainRect,
  type NormalizedPoint,
  type ScanCorner,
  type ScanQuadrilateral,
} from '../../lib/capture/scan-geometry';

const HANDLE_SIZE = 34;
const EDGE_SIZE = 2;
const NUDGE_STEP = 0.02;
const FINE_NUDGE_STEP = 0.01;

interface Props {
  corners: ScanQuadrilateral;
  imageWidth: number;
  imageHeight: number;
  color: string;
  label: string;
  disabled?: boolean;
  onChange: (corners: ScanQuadrilateral) => void;
}

interface HandleProps {
  corner: ScanCorner;
  index: number;
  point: NormalizedPoint;
  rect: ImageContainRect;
  quad: ScanQuadrilateral;
  color: string;
  label: string;
  disabled: boolean;
  onChange: (corners: ScanQuadrilateral) => void;
}

interface WebKeyboardEvent {
  key: string;
  shiftKey?: boolean;
  preventDefault: () => void;
}

function CornerHandle({ corner, index, point, rect, quad, color, label, disabled, onChange }: HandleProps) {
  const pointRef = useRef(point);
  const quadRef = useRef(quad);
  const rectRef = useRef(rect);
  const onChangeRef = useRef(onChange);
  const start = useRef(point);
  const [focused, setFocused] = useState(false);

  useEffect(() => { pointRef.current = point; }, [point]);
  useEffect(() => { quadRef.current = quad; }, [quad]);
  useEffect(() => { rectRef.current = rect; }, [rect]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const move = (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
    const active = rectRef.current;
    if (disabled || active.width <= 0 || active.height <= 0) return;
    const next = moveScanCorner(quadRef.current, corner, {
      x: start.current.x + gesture.dx / active.width,
      y: start.current.y + gesture.dy / active.height,
    });
    quadRef.current = next;
    pointRef.current = next[corner];
    onChangeRef.current(next);
  };

  const nudge = (deltaX: number, deltaY: number) => {
    if (disabled) return;
    const current = quadRef.current;
    const currentPoint = current[corner];
    const next = moveScanCorner(current, corner, {
      x: currentPoint.x + deltaX,
      y: currentPoint.y + deltaY,
    });
    if (next === current) return;
    quadRef.current = next;
    pointRef.current = next[corner];
    onChangeRef.current(next);
  };

  const onKeyDown = (event: WebKeyboardEvent) => {
    const step = event.shiftKey ? FINE_NUDGE_STEP : NUDGE_STEP;
    const delta = event.key === 'ArrowLeft' ? [-step, 0]
      : event.key === 'ArrowRight' ? [step, 0]
        : event.key === 'ArrowUp' ? [0, -step]
          : event.key === 'ArrowDown' ? [0, step]
            : null;
    if (!delta) return;
    event.preventDefault();
    nudge(delta[0], delta[1]);
  };

  const horizontalInward = corner === 'topLeft' || corner === 'bottomLeft' ? NUDGE_STEP : -NUDGE_STEP;
  const verticalInward = corner === 'topLeft' || corner === 'topRight' ? NUDGE_STEP : -NUDGE_STEP;
  const accessibilityActions = [
    { name: 'increment' },
    { name: 'decrement' },
    { name: 'moveLeft', label: `${label} ←` },
    { name: 'moveRight', label: `${label} →` },
    { name: 'moveUp', label: `${label} ↑` },
    { name: 'moveDown', label: `${label} ↓` },
  ];
  const webKeyboardProps = Platform.OS === 'web'
    ? { tabIndex: (disabled ? -1 : 0) as -1 | 0, onKeyDown }
    : {};

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: () => { start.current = pointRef.current; },
    onPanResponderMove: move,
  // The responder reads current props through refs so an active drag survives
  // the state updates it generates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [corner, disabled]);

  return (
    <Pressable
      {...responder.panHandlers}
      {...webKeyboardProps}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${label} ${index + 1}`}
      accessibilityValue={{ text: `${Math.round(point.x * 100)}%, ${Math.round(point.y * 100)}%` }}
      accessibilityState={{ disabled }}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={(event) => {
        const action = event.nativeEvent.actionName;
        if (action === 'increment') nudge(horizontalInward, verticalInward);
        if (action === 'decrement') nudge(-horizontalInward, -verticalInward);
        if (action === 'moveLeft') nudge(-NUDGE_STEP, 0);
        if (action === 'moveRight') nudge(NUDGE_STEP, 0);
        if (action === 'moveUp') nudge(0, -NUDGE_STEP);
        if (action === 'moveDown') nudge(0, NUDGE_STEP);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      testID={`scan-corner-${corner}`}
      style={{
        position: 'absolute',
        left: rect.x + point.x * rect.width - HANDLE_SIZE / 2,
        top: rect.y + point.y * rect.height - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        borderRadius: HANDLE_SIZE / 2,
        borderWidth: focused ? 4 : 3,
        borderColor: focused ? '#111827' : '#fff',
        backgroundColor: color,
        opacity: disabled ? 0.55 : 1,
        shadowColor: '#fff',
        shadowOpacity: focused ? 1 : 0,
        shadowRadius: focused ? 4 : 0,
        elevation: focused ? 6 : 0,
      }}
    />
  );
}

function Edge({ from, to, rect, color }: { from: NormalizedPoint; to: NormalizedPoint; rect: ImageContainRect; color: string }) {
  const x1 = rect.x + from.x * rect.width;
  const y1 = rect.y + from.y * rect.height;
  const x2 = rect.x + to.x * rect.width;
  const y2 = rect.y + to.y * rect.height;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (x1 + x2) / 2 - length / 2,
        top: (y1 + y2) / 2 - EDGE_SIZE / 2,
        width: length,
        height: EDGE_SIZE,
        backgroundColor: color,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

export function ScanCornerEditor({ corners, imageWidth, imageHeight, color, label, disabled = false, onChange }: Props) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const rect = containedImageRect(layout.width, layout.height, imageWidth, imageHeight);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  return (
    <View testID="scan-corner-editor" onLayout={onLayout} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {SCAN_CORNERS.map((corner, index) => (
        <Edge
          key={`edge-${corner}`}
          from={corners[corner]}
          to={corners[SCAN_CORNERS[(index + 1) % SCAN_CORNERS.length]]}
          rect={rect}
          color={color}
        />
      ))}
      {SCAN_CORNERS.map((corner, index) => (
        <CornerHandle
          key={corner}
          corner={corner}
          index={index}
          point={corners[corner]}
          rect={rect}
          quad={corners}
          color={color}
          label={label}
          disabled={disabled}
          onChange={onChange}
        />
      ))}
    </View>
  );
}
