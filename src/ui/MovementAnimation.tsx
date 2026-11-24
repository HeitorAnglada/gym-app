import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { CATALOG } from '../data/catalog.ts';
import { figureAt, movementFor, MOVEMENTS, phase, VIEW, type Movement } from '../domain/movimento.ts';
import { colors } from './theme.ts';
import { Text } from './text.tsx';

/** Nome original do catálogo, para um exercício renomeado continuar com a animação certa. */
const CATALOG_NAME = new Map(CATALOG.map((c) => [c.key, c.name]));

/**
 * Boneco animado mostrando o movimento do exercício. Desenhado no app (SVG), então funciona
 * offline e vale também para exercícios criados pelo usuário. Sem movimento conhecido, não aparece.
 */
export function MovementAnimation({ name, muscle, builtinKey }: { name: string; muscle: string | null; builtinKey: string | null }) {
  const key = movementFor((builtinKey && CATALOG_NAME.get(builtinKey)) || name, muscle);
  if (!key) return null;
  return <MovementLoop movement={MOVEMENTS[key]} />;
}

function MovementLoop({ movement }: { movement: Movement }) {
  const [t, setT] = useState(0);
  const [focused, setFocused] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!focused || reduceMotion) return;
    const period = movement.period ?? 2.4;
    const start = Date.now();
    let frame = 0;
    let last = 0;
    const tick = () => {
      const now = Date.now();
      // ~30 quadros por segundo bastam para o boneco e poupam bateria
      if (now - last >= 33) {
        last = now;
        setT(phase((now - start) / 1000, period));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [movement, focused, reduceMotion]);

  // com "reduzir movimento" ligado no Android, mostra só a pose final, parada
  const f = figureAt(movement, reduceMotion ? 1 : t);

  return (
    <View style={st.box} accessible accessibilityLabel="Animação do movimento do exercício">
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}>
        <Line x1={0} y1={VIEW.ground} x2={VIEW.w} y2={VIEW.ground} stroke={colors.line} strokeWidth={2} />
        {f.props.rects.map((r, i) => <Rect key={`r${i}`} x={r.x} y={r.y} width={r.w} height={r.h} rx={3} fill={colors.card2} />)}
        {f.props.lines.map(([a, b], i) => <Line key={`l${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={colors.grey} strokeWidth={4} strokeLinecap="round" opacity={0.7} />)}
        {f.props.cables.map(([a, b], i) => <Line key={`c${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={colors.grey} strokeWidth={1.4} opacity={0.6} />)}
        {f.bones.map(([a, b], i) => <Line key={`b${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={colors.lilac} strokeWidth={6} strokeLinecap="round" />)}
        <Circle cx={f.head[0]} cy={f.head[1]} r={9} fill={colors.lilac} />
        {f.props.dots.map((d, i) => <Circle key={`d${i}`} cx={d.c[0]} cy={d.c[1]} r={d.r} fill={colors.grey} />)}
      </Svg>
      <Text style={st.caption}>movimento ilustrativo</Text>
    </View>
  );
}

const st = StyleSheet.create({
  box: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 14, aspectRatio: VIEW.w / VIEW.h * 1.25, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 22 },
  caption: { position: 'absolute', bottom: 6, right: 12, fontSize: 10, color: colors.grey },
});
