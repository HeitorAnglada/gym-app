import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteSet, deleteWorkout, loadWorkout, setWorkoutNote, updateSet, type SetRow, type WorkoutData, type WorkoutExerciseRow } from '../../db/workout.ts';
import { dayMonth, WEEKDAY_LONG } from '../../domain/dates.ts';
import { formatLoad } from '../../domain/editing.ts';
import { addLoad } from '../../domain/progression.ts';
import { canEditWorkout, editDeadline } from '../../domain/workoutRules.ts';
import { Field, Input, LinkText, Muted, Sheet, SheetActions, Stepper, s } from '../../ui/components.tsx';
import { colors, fonts } from '../../ui/theme.ts';
import { SummaryList, SummaryNumbers, useProgressMarks } from '../../ui/WorkoutSummary.tsx';
import { Text } from '../../ui/text.tsx';
import { showDialog } from '../../ui/dialog.tsx';

/** Detalhe de um treino do histórico. Editável até 7 dias depois; depois fica travado. */
export default function Sessao() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<WorkoutData | null>(null);
  const [editing, setEditing] = useState(false);
  const [setSheet, setSetSheet] = useState<{ e: WorkoutExerciseRow; s: SetRow } | null>(null);
  const [vals, setVals] = useState({ load: 0, reps: 0 });
  const [noteSheet, setNoteSheet] = useState(false);
  const [note, setNote] = useState('');
  const { up } = useProgressMarks(data);

  const load = useCallback(async () => {
    setData(await loadWorkout(db, id));
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!data) return <SafeAreaView style={s.screen} />;
  const w = data.workout;
  const d = new Date(w.started_at);
  const editable = !!w.ended_at && canEditWorkout(w.ended_at);
  const deadline = w.ended_at ? editDeadline(w.ended_at) : null;

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.pad}>
        <View style={st.top}>
          <LinkText onPress={() => router.back()}>‹ histórico</LinkText>
          {editable && <LinkText onPress={() => setEditing((v) => !v)}>{editing ? 'pronto' : 'editar'}</LinkText>}
        </View>
        <Text style={st.title}>
          {w.routine_code ?? 'treino'}
          <Text style={{ color: colors.acaiLight }}>.</Text> {dayMonth(d)}
        </Text>
        <Muted style={{ marginTop: -8 }}>{WEEKDAY_LONG[d.getDay()].replace(/^./, (c) => c.toUpperCase())}{w.routine_name ? ` · ${w.routine_name}` : ''}</Muted>
        <SummaryNumbers data={data} third="rest" />
        {editing && <Muted style={{ fontSize: 12 }}>Toque numa série para mudar carga e reps.</Muted>}
        <SummaryList
          data={data}
          up={up}
          onPressExercise={(e) => router.push({ pathname: '/exercicio/[id]', params: { id: e.exercise_id } })}
          onPressSet={editing ? (e, x) => { setVals({ load: x.load, reps: x.reps }); setSetSheet({ e, s: x }); } : undefined}
        />
        {w.note || editing ? (
          <View style={st.note}>
            <Text style={st.noteText}>{w.note ? `"${w.note}"` : 'sem observação'}</Text>
            {editing && <LinkText onPress={() => { setNote(w.note ?? ''); setNoteSheet(true); }}>editar</LinkText>}
          </View>
        ) : null}
        <View style={st.top}>
          <Muted style={{ fontSize: 12 }}>
            {editable && deadline ? `editável até ${dayMonth(deadline)}` : 'travado: passou dos 7 dias'}
          </Muted>
          <LinkText
            muted
            onPress={() =>
              showDialog('Apagar este treino?', 'Ele sai do histórico, do calendário e dos gráficos.', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Apagar', style: 'destructive', onPress: async () => { await deleteWorkout(db, w.id); router.back(); } },
              ])
            }
          >
            apagar
          </LinkText>
        </View>
      </ScrollView>

      <Sheet visible={!!setSheet} onClose={() => setSetSheet(null)} title="Editar série" subtitle={setSheet ? `${setSheet.e.name} · série ${setSheet.s.idx + 1}` : undefined}>
        <Field label="carga (kg)">
          <Stepper
            value={formatLoad(vals.load)}
            onMinus={() => setVals((v) => ({ ...v, load: addLoad(v.load, -(setSheet?.e.step_kg ?? 2.5)) }))}
            onPlus={() => setVals((v) => ({ ...v, load: addLoad(v.load, setSheet?.e.step_kg ?? 2.5) }))}
          />
        </Field>
        <Field label="repetições">
          <Stepper value={String(vals.reps)} onMinus={() => setVals((v) => ({ ...v, reps: Math.max(0, v.reps - 1) }))} onPlus={() => setVals((v) => ({ ...v, reps: v.reps + 1 }))} />
        </Field>
        <SheetActions
          cancel="Apagar série"
          confirm="Salvar"
          onCancel={async () => { if (setSheet) await deleteSet(db, setSheet.s.id); setSetSheet(null); load(); }}
          onConfirm={async () => { if (setSheet) await updateSet(db, setSheet.s.id, vals.load, vals.reps); setSetSheet(null); load(); }}
        />
      </Sheet>

      <Sheet visible={noteSheet} onClose={() => setNoteSheet(false)} title="Observação do treino">
        <Input value={note} onChangeText={setNote} multiline autoFocus maxLength={300} placeholder="ex.: academia lotada" />
        <SheetActions confirm="Salvar" onCancel={() => setNoteSheet(false)} onConfirm={async () => { await setWorkoutNote(db, w.id, note); setNoteSheet(false); load(); }} />
      </Sheet>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.num, fontSize: 26, letterSpacing: -0.7, color: colors.text },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12 },
  noteText: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: colors.text2 },
});
