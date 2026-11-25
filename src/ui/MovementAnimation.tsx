import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { CATALOG } from '../data/catalog.ts';
import { bodyMap, fitBox, sceneAt, type Shape } from '../domain/corpo.ts';
import { movementFor, MUSCLE_NAME, poseT, tempo, tempoPhase, VIEW, variantFor, type Movement } from '../domain/movimento.ts';
import { colors, fonts } from './theme.ts';
import { Text } from './text.tsx';

/** Nome original do catálogo, para um exercício renomeado continuar com a animação certa. */
const CATALOG_NAME = new Map(CATALOG.map((c) => [c.key, c.name]));

/** Largura/altura do quadro da animação. */
const RATIO = 1.45;
/** Quadro dos bonequinhos de frente e costas. */
const MAP_BOX = '58 24 84 152';

/**
 * Animação do exercício: corpo com volume fazendo o movimento, músculo alvo em açaí claro
 * (acende quando contrai) e os que ajudam em açaí escuro. Desenhada no app (SVG), então funciona
 * offline e vale também para exercícios criados pelo usuário. Sem movimento conhecido, não aparece.
 * `compact` (tela do treino): sem os bonequinhos de frente e costas, só as etiquetas.
 */
export function MovementAnimation({ name, muscle, builtinKey, compact }: { name: string; muscle: string | null; builtinKey: string | null; compact?: boolean }) {
  const original = (builtinKey && CATALOG_NAME.get(builtinKey)) || name;
  const key = movementFor(original, muscle);
  const movement = useMemo(() => (key ? variantFor(key, original) : null), [key, original]);
  if (!movement) return null;
  return <MovementLoop movement={movement} compact={!!compact} />;
}

function Shapes({ shapes }: { shapes: Shape[] }) {
  return (
    <>
      {shapes.map((s, i) => (
        <Path
          key={i}
          d={s.d}
          fill={s.fill ?? 'none'}
          stroke={s.stroke}
          strokeWidth={s.sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={s.op}
        />
      ))}
    </>
  );
}

function MovementLoop({ movement, compact }: { movement: Movement; compact: boolean }) {
  const [sec, setSec] = useState(0);
  const [focused, setFocused] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const period = movement.period ?? 3.2;

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
    const start = Date.now();
    let frame = 0;
    let last = 0;
    const tick = () => {
      const now = Date.now();
      // ~25 quadros por segundo bastam e poupam bateria
      if (now - last >= 40) {
        last = now;
        setSec((now - start) / 1000);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [movement, focused, reduceMotion]);

  const box = useMemo(() => fitBox(movement, RATIO).map((v) => v.toFixed(1)).join(' '), [movement]);
  const muscles = useMemo(() => movement.muscles ?? { p: [], s: [] }, [movement]);
  const maps = useMemo(() => (compact ? null : [bodyMap(muscles, false), bodyMap(muscles, true)]), [muscles, compact]);

  // com "reduzir movimento" ligado no Android, mostra o músculo contraído, parado
  const c = reduceMotion ? 1 : tempo(sec, period);
  const shapes = sceneAt(movement, poseT(movement, c), { contraction: c });
  const label = `Animação do movimento. Alvo: ${muscles.p.map((m) => MUSCLE_NAME[m]).join(', ')}`;

  return (
    <View style={st.card}>
      <View style={st.anim} accessible accessibilityLabel={label}>
        <Svg width="100%" height="100%" viewBox={box}>
          <Line x1={-200} y1={VIEW.ground} x2={400} y2={VIEW.ground} stroke={colors.line} strokeWidth={2} />
          <Shapes shapes={shapes} />
        </Svg>
        {!reduceMotion && <Text style={st.phase}>{tempoPhase(sec, period)}</Text>}
        <Text style={st.caption}>movimento ilustrativo</Text>
      </View>
      {muscles.p.length > 0 && (
        <View style={st.info}>
          {maps && (
            <View style={st.maps}>
              {(['frente', 'costas'] as const).map((lbl, i) => (
                <View key={lbl} style={st.map}>
                  <Svg width={48} height={86} viewBox={MAP_BOX}>
                    <Shapes shapes={maps[i]} />
                  </Svg>
                  <Text style={st.mapLabel}>{lbl}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={st.tags}>
            <View style={st.row}>
              <Text style={st.lbl}>alvo</Text>
              {muscles.p.map((m) => <Text key={m} style={[st.tag, st.primary]}>{MUSCLE_NAME[m]}</Text>)}
            </View>
            {muscles.s.length > 0 && (
              <View style={st.row}>
                <Text style={st.lbl}>ajudam</Text>
                {muscles.s.map((m) => <Text key={m} style={[st.tag, st.secondary]}>{MUSCLE_NAME[m]}</Text>)}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  anim: { aspectRatio: RATIO, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 18 },
  phase: { position: 'absolute', bottom: 6, left: 14, fontSize: 11, color: colors.lilac, fontFamily: fonts.num },
  caption: { position: 'absolute', bottom: 6, right: 12, fontSize: 10, color: colors.grey },
  info: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopColor: colors.line, borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  maps: { flexDirection: 'row', gap: 2 },
  map: { alignItems: 'center' },
  mapLabel: { fontSize: 10, color: colors.grey, marginTop: -2 },
  tags: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  lbl: { fontSize: 11, color: colors.grey, marginRight: 2 },
  tag: { fontSize: 12, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden' },
  primary: { backgroundColor: colors.acaiLight, color: colors.white },
  secondary: { backgroundColor: colors.acaiBg, color: colors.lilac, borderWidth: 1, borderColor: colors.acai },
});
