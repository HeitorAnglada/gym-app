import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { exerciseSessions, type SetRow, type WorkoutData, type WorkoutExerciseRow } from '../db/workout.ts';
import { hitTopOfRange } from '../domain/progression.ts';
import { averageRest, formatClock } from '../domain/rest.ts';
import { describeSets, thousands, workoutTotals } from '../domain/session.ts';
import { topLoad } from '../domain/stats.ts';
import { Muted } from './components.tsx';
import { colors, fonts } from './theme.ts';
import { Text } from './text.tsx';

/** O que subiu de carga hoje (⬆) e quantos exercícios ficaram prontos pra subir no próximo. */
export function useProgressMarks(data: WorkoutData | null) {
  const db = useSQLiteContext();
  const [up, setUp] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    let alive = true;
    (async () => {
      const marks = new Set<string>();
      for (const e of data.exercises) {
        if (e.sets.length === 0) continue;
        const [prev] = await exerciseSessions(db, e.exercise_id, { limit: 1, excludeWorkoutId: data.workout.id, beforeIso: data.workout.started_at });
        if (prev && topLoad(e.sets) > topLoad(prev.sets)) marks.add(e.id);
      }
      if (alive) setUp(marks);
    })();
    return () => {
      alive = false;
    };
  }, [db, data]);
  const readyToIncrease = data
    ? data.exercises.filter((e) => e.sets.length > 0 && hitTopOfRange({ date: '', sets: e.sets }, { setsMin: e.sets_min, setsMax: e.sets_max, repsMin: e.reps_min, repsMax: e.reps_max })).length
    : 0;
  return { up, readyToIncrease };
}

export function SummaryNumbers({ data, third }: { data: WorkoutData; third: 'volume' | 'rest' }) {
  const w = data.workout;
  const t = workoutTotals(w.started_at, w.ended_at ?? new Date().toISOString(), data.exercises);
  const rests = data.exercises.flatMap((e) => e.sets.filter((x) => x.rest_sec != null).map((x) => ({ seconds: x.rest_sec!, approximate: !!x.rest_approx })));
  const avg = averageRest(rests);
  return (
    <View style={st.nums}>
      <Num value={String(t.minutes)} label="min" />
      <Num value={String(t.sets)} label="séries" />
      {third === 'volume' ? <Num value={thousands(t.volume)} label="kg de volume" /> : <Num value={avg != null ? formatClock(avg) : '–'} label="descanso médio" />}
    </View>
  );
}

function Num({ value, label }: { value: string; label: string }) {
  return (
    <View style={st.num}>
      <Text style={st.numVal}>{value}</Text>
      <Muted style={{ fontSize: 11 }}>{label}</Muted>
    </View>
  );
}

/** Lista dos exercícios do treino com as séries; ⬆ onde subiu carga, extras com "+". */
export function SummaryList({ data, up, onPressExercise, onPressSet }: {
  data: WorkoutData;
  up: Set<string>;
  onPressExercise?: (e: WorkoutExerciseRow) => void;
  onPressSet?: (e: WorkoutExerciseRow, s: SetRow) => void;
}) {
  return (
    <View>
      {data.exercises.map((e) => (
        <View key={e.id} style={st.row}>
          <Pressable onPress={() => onPressExercise?.(e)} style={{ flex: 1 }}>
            <Text style={[st.name, e.status === 'pulado' && st.skipped, up.has(e.id) && { color: colors.green }]}>
              {up.has(e.id) ? '⬆ ' : ''}{!e.slot_id ? '+ ' : ''}{e.name}
            </Text>
            {e.note ? <Muted style={{ fontSize: 11 }}>obs.: {e.note}</Muted> : null}
          </Pressable>
          {e.status === 'pulado' || e.sets.length === 0 ? (
            <Muted style={{ fontSize: 12 }}>pulado</Muted>
          ) : onPressSet ? (
            <View style={st.sets}>
              {e.sets.map((x) => (
                <Pressable key={x.id} onPress={() => onPressSet(e, x)} hitSlop={4} style={st.setChip}>
                  <Text style={st.setText}>{x.load ? `${String(x.load).replace('.', ',')}×` : '×'}{x.reps}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={st.val}>{!e.slot_id ? 'extra · ' : ''}{describeSets(e.sets)}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  nums: { flexDirection: 'row', gap: 8 },
  num: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 10, gap: 2 },
  numVal: { fontFamily: fonts.num, fontSize: 22, color: colors.text, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  name: { fontFamily: fonts.textSemi, fontSize: 13, color: colors.text },
  skipped: { color: colors.grey, textDecorationLine: 'line-through' },
  val: { fontFamily: fonts.num, fontSize: 12, color: colors.text2, textAlign: 'right', flexShrink: 1 },
  sets: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', flexShrink: 1 },
  setChip: { backgroundColor: colors.card2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  setText: { fontFamily: fonts.num, fontSize: 12, color: colors.lilac },
});
