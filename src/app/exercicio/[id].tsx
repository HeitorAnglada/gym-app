import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { MUSCLE_LABEL, type MuscleGroup } from '../../data/catalog.ts';
import { exerciseUsage, getExercise, setRestForSlots, updateExercise, type ExerciseDetail } from '../../db/editing.ts';
import { exerciseSessions, type PastSession } from '../../db/workout.ts';
import { dayMonth } from '../../domain/dates.ts';
import { formatLoad, parseLoad } from '../../domain/editing.ts';
import { averageRest, formatClock } from '../../domain/rest.ts';
import { roundRest, thousands } from '../../domain/session.ts';
import { records, topLoad, volume } from '../../domain/stats.ts';
import { Chips, Field, Input, LinkText, Muted, Sheet, SheetActions, s } from '../../ui/components.tsx';
import { EQUIPMENT_LABEL } from '../../ui/CreateExerciseSheet.tsx';
import { colors, fonts } from '../../ui/theme.ts';

const MUSCLES = Object.keys(MUSCLE_LABEL) as MuscleGroup[];

export default function Exercicio() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ex, setEx] = useState<ExerciseDetail | null>(null);
  const [sessions, setSessions] = useState<PastSession[]>([]);
  const [usage, setUsage] = useState<{ slot_id: string; code: string; rest_sec: number; as_main: number }[]>([]);
  const [mode, setMode] = useState<'carga' | 'volume'>('carga');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', muscle: 'peito' as MuscleGroup, step: '' });

  const load = useCallback(async () => {
    setEx(await getExercise(db, id));
    setSessions(await exerciseSessions(db, id));
    setUsage(await exerciseUsage(db, id));
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!ex) return <SafeAreaView style={s.screen} />;

  const rec = records(sessions);
  const avg = averageRest(sessions.flatMap((x) => x.rests));
  const mains = usage.filter((u) => u.as_main);
  const recommended = mains[0]?.rest_sec ?? null;
  const commonLoad = mostCommonLoad(sessions);
  const points = [...sessions].reverse().map((x) => ({ date: x.date, value: mode === 'carga' ? topLoad(x.sets) : volume(x.sets) }));
  const step = parseLoad(form.step);

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.pad}>
        <View style={st.top}>
          <LinkText onPress={() => router.back()}>‹ voltar</LinkText>
          <LinkText onPress={() => { setForm({ name: ex.name, muscle: ex.muscle_group, step: formatLoad(ex.step_kg) }); setEditing(true); }}>editar</LinkText>
        </View>
        <Text style={st.title}>
          {ex.name}
          <Text style={{ color: colors.acaiLight }}>.</Text>
        </Text>
        <Muted style={{ marginTop: -8 }}>
          {MUSCLE_LABEL[ex.muscle_group].toLowerCase()} · {EQUIPMENT_LABEL[ex.equipment].toLowerCase()} · passo {formatLoad(ex.step_kg)} kg · feito {sessions.length}×
        </Muted>

        {sessions.length === 0 ? (
          <View style={st.empty}><Muted>Ainda sem treinos com este exercício. O gráfico e os recordes aparecem depois do primeiro.</Muted></View>
        ) : (
          <>
            <View style={st.seg}>
              {(['carga', 'volume'] as const).map((m) => (
                <Pressable key={m} onPress={() => setMode(m)} style={[st.segItem, mode === m && st.segOn]}>
                  <Text style={[st.segText, mode === m && { color: colors.lilac }]}>{m === 'carga' ? 'Melhor carga' : 'Volume'}</Text>
                </Pressable>
              ))}
            </View>
            <Chart points={points} unit={mode === 'carga' ? 'kg' : ''} />
            <View style={st.kv}>
              {rec.heaviest && <KV label="maior carga" value={`${formatLoad(rec.heaviest.load)} kg × ${rec.heaviest.reps}`} />}
              {commonLoad != null && <KV label={`mais reps com ${formatLoad(commonLoad)} kg`} value={`${rec.mostRepsByLoad.get(commonLoad)} reps`} />}
              <KV
                label="descanso médio"
                value={avg != null ? formatClock(avg) : '–'}
                extra={
                  avg != null && recommended != null && Math.abs(roundRest(avg) - recommended) >= 15 ? (
                    <LinkText onPress={async () => { await setRestForSlots(db, mains.map((u) => u.slot_id), roundRest(avg)); load(); }}>
                      recomendado {formatClock(recommended)} · ajustar para {formatClock(roundRest(avg))}
                    </LinkText>
                  ) : recommended != null ? (
                    <Muted style={{ fontSize: 11 }}>recomendado {formatClock(recommended)}</Muted>
                  ) : undefined
                }
              />
              <KV label="usado em" value={usage.length ? [...new Set(usage.map((u) => u.code))].join(', ') : 'nenhuma ficha em uso'} />
            </View>
          </>
        )}

        {sessions.map((x) => (
          <Pressable key={x.workoutId} onPress={() => router.push({ pathname: '/sessao/[id]', params: { id: x.workoutId } })} style={st.row}>
            <View style={{ flex: 1 }}>
              <Text style={st.rowTitle}>{dayMonth(new Date(x.date))}{x.code ? ` · ${x.code}` : ''}</Text>
              <Muted style={{ fontSize: 12 }}>{x.sets.map((y) => y.reps).join(', ')}</Muted>
            </View>
            <Text style={st.rowVal}>{formatLoad(topLoad(x.sets))} kg</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Sheet visible={editing} onClose={() => setEditing(false)} title="Editar exercício">
        <Field label="nome">
          <Input value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} maxLength={60} />
        </Field>
        <Field label="grupo muscular">
          <Chips items={MUSCLES} value={form.muscle} onChange={(m) => setForm((f) => ({ ...f, muscle: m }))} label={(m) => MUSCLE_LABEL[m]} />
        </Field>
        <Field label="passo do −/+ (kg)">
          <Input value={form.step} onChangeText={(t) => setForm((f) => ({ ...f, step: t }))} keyboardType="decimal-pad" error={step === 'invalid' || step === 0} />
        </Field>
        {ex.builtin_key && <Muted style={{ fontSize: 12 }}>Exercício do catálogo: mudar o nome não afeta o histórico.</Muted>}
        <SheetActions
          confirm="Salvar"
          disabled={!form.name.trim() || step === 'invalid' || !step}
          onCancel={() => setEditing(false)}
          onConfirm={async () => {
            if (typeof step !== 'number' || !step) return;
            await updateExercise(db, ex.id, { name: form.name, muscle_group: form.muscle, step_kg: step });
            setEditing(false);
            load();
          }}
        />
      </Sheet>
    </SafeAreaView>
  );
}

/** Carga mais usada nas séries (para o recorde "mais reps com X kg"). */
function mostCommonLoad(sessions: PastSession[]): number | null {
  const count = new Map<number, number>();
  for (const x of sessions) for (const y of x.sets) count.set(y.load, (count.get(y.load) ?? 0) + 1);
  let best: number | null = null;
  for (const [load, n] of count) if (best == null || n > count.get(best)! || (n === count.get(best) && load > best)) best = load;
  return best;
}

function KV({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <View style={st.kvItem}>
      <Muted style={{ fontSize: 11 }}>{label}</Muted>
      <Text style={st.kvVal}>{value}</Text>
      {extra}
    </View>
  );
}

function Chart({ points, unit }: { points: { date: string; value: number }[]; unit: string }) {
  const [w, setW] = useState(0);
  const h = 140;
  const pad = { l: 8, r: 8, t: 16, b: 20 };
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => pad.l + (points.length === 1 ? (w - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (w - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b);
  const fmt = (v: number) => (unit ? `${formatLoad(v)} ${unit}` : thousands(v));
  return (
    <View style={st.chart} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={h}>
          <Line x1={pad.l} x2={w - pad.r} y1={y(min)} y2={y(min)} stroke={colors.line} strokeWidth={1} />
          <Line x1={pad.l} x2={w - pad.r} y1={y(max)} y2={y(max)} stroke={colors.line} strokeWidth={1} strokeDasharray="3 4" />
          {points.length > 1 && (
            <Polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke={colors.acaiLight} strokeWidth={2.5} strokeLinejoin="round" />
          )}
          {points.map((p, i) => (
            <Circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4.5 : 3} fill={i === points.length - 1 ? colors.lilac : colors.acaiLight} />
          ))}
          <SvgText x={w - pad.r} y={y(max) - 5} fill={colors.text2} fontSize={11} textAnchor="end">{fmt(max)}</SvgText>
          {min !== max && <SvgText x={w - pad.r} y={y(min) + 14} fill={colors.grey} fontSize={11} textAnchor="end">{fmt(min)}</SvgText>}
          <SvgText x={pad.l} y={h - 4} fill={colors.grey} fontSize={10}>{dayMonth(new Date(points[0].date))}</SvgText>
          {points.length > 1 && <SvgText x={w - pad.r} y={h - 4} fill={colors.grey} fontSize={10} textAnchor="end">{dayMonth(new Date(points[points.length - 1].date))}</SvgText>}
        </Svg>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.num, fontSize: 24, letterSpacing: -0.6, color: colors.text },
  empty: { backgroundColor: colors.card, borderRadius: 12, padding: 14 },
  seg: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 10, padding: 3 },
  segItem: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segOn: { backgroundColor: colors.acaiBg },
  segText: { fontFamily: fonts.textSemi, fontSize: 12, color: colors.text2 },
  chart: { backgroundColor: colors.card, borderRadius: 12, height: 140, overflow: 'hidden' },
  kv: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kvItem: { width: '48%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 12, padding: 10, gap: 2 },
  kvVal: { fontFamily: fonts.num, fontSize: 16, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowTitle: { fontFamily: fonts.textSemi, fontSize: 13, color: colors.text },
  rowVal: { fontFamily: fonts.num, fontSize: 13, color: colors.text2 },
});
