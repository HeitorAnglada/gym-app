import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadWorkout, setWorkoutNote, type WorkoutData } from '../../db/workout.ts';
import { dayMonth, WEEKDAY_LONG } from '../../domain/dates.ts';
import { BigButton, Input, Label, s } from '../../ui/components.tsx';
import { colors, fonts } from '../../ui/theme.ts';
import { SummaryList, SummaryNumbers, useProgressMarks } from '../../ui/WorkoutSummary.tsx';
import { Text } from '../../ui/text.tsx';

/** Resumo depois de finalizar. O treino já está salvo: o botão só guarda a observação e volta pro Início. */
export default function Fim() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<WorkoutData | null>(null);
  const [note, setNote] = useState('');
  const { up, readyToIncrease } = useProgressMarks(data);

  useEffect(() => {
    loadWorkout(db, id).then((d) => {
      setData(d);
      setNote(d?.workout.note ?? '');
    });
  }, [db, id]);

  if (!data) return <SafeAreaView style={s.screen} />;
  const d = new Date(data.workout.started_at);

  const save = async () => {
    await setWorkoutNote(db, data.workout.id, note);
    router.dismissTo('/');
  };

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={[s.pad, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
        <Label>treino finalizado</Label>
        <Text style={st.title}>
          {data.workout.routine_code ?? 'treino'}
          <Text style={{ color: colors.acaiLight }}>.</Text> {WEEKDAY_LONG[d.getDay()]}, {dayMonth(d)}
        </Text>
        <SummaryNumbers data={data} third="volume" />
        <SummaryList data={data} up={up} />
        {readyToIncrease > 0 && (
          <View style={st.hint}>
            <Text style={st.hintText}>
              Próximo {data.workout.routine_code ?? 'treino'}: {readyToIncrease} {readyToIncrease === 1 ? 'exercício pronto' : 'exercícios prontos'} pra subir carga
            </Text>
          </View>
        )}
        <Input value={note} onChangeText={setNote} placeholder="Observação do treino (opcional)" multiline maxLength={300} />
        <View style={{ flex: 1 }} />
        <BigButton title="Salvar treino" onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  title: { fontFamily: fonts.num, fontSize: 26, letterSpacing: -0.7, color: colors.text },
  hint: { backgroundColor: colors.greenBg, borderRadius: 10, padding: 10 },
  hintText: { fontFamily: fonts.textSemi, fontSize: 13, color: colors.green },
});
