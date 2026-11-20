import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MUSCLE_LABEL, type MuscleGroup } from '../../data/catalog.ts';
import { listExercises, type ExerciseListRow } from '../../db/queries.ts';
import { dayMonth } from '../../domain/dates.ts';
import { Label, Muted, ScreenTitle, s } from '../../ui/components.tsx';
import { colors, fonts } from '../../ui/theme.ts';

type Filter = 'usados' | MuscleGroup;
const MUSCLES = Object.keys(MUSCLE_LABEL) as MuscleGroup[];

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Exercicios() {
  const db = useSQLiteContext();
  const [all, setAll] = useState<ExerciseListRow[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter | null>(null);

  useFocusEffect(
    useCallback(() => {
      listExercises(db).then((rows) => {
        setAll(rows);
        // Abre em "Usados" quando já existe algum exercício feito.
        setFilter((f) => f ?? (rows.some((r) => r.times_done > 0) ? 'usados' : 'peito'));
      });
    }, [db]),
  );

  const shown = useMemo(() => {
    const q = fold(query.trim());
    let rows = all;
    if (q) rows = rows.filter((r) => fold(r.name).includes(q));
    else if (filter === 'usados') rows = rows.filter((r) => r.times_done > 0);
    else if (filter) rows = rows.filter((r) => r.muscle_group === filter);
    const groups = new Map<string, ExerciseListRow[]>();
    for (const r of rows) groups.set(r.muscle_group, [...(groups.get(r.muscle_group) ?? []), r]);
    return [...groups.entries()].sort(([a], [b]) => MUSCLES.indexOf(a as MuscleGroup) - MUSCLES.indexOf(b as MuscleGroup));
  }, [all, query, filter]);

  const chips: Filter[] = ['usados', ...MUSCLES];

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        <ScreenTitle>exercícios</ScreenTitle>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar exercício"
          placeholderTextColor={colors.grey}
          style={st.search}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {chips.map((c) => (
            <Pressable key={c} onPress={() => setFilter(c)} style={[st.chip, filter === c && !query && st.chipOn]}>
              <Text style={[st.chipText, filter === c && !query && { color: colors.lilac }]}>{c === 'usados' ? 'Usados' : MUSCLE_LABEL[c]}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {shown.length === 0 && <Muted>Nenhum exercício aqui ainda. Os que você fizer aparecem em "Usados".</Muted>}
        {shown.map(([group, rows]) => (
          <View key={group} style={{ gap: 0 }}>
            <Label>{MUSCLE_LABEL[group as MuscleGroup]}</Label>
            {rows.map((r) => (
              <View key={r.id} style={st.row}>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{r.name}</Text>
                  <Muted style={{ fontSize: 12 }}>
                    {r.times_done > 0 ? `feito ${r.times_done}× · último ${dayMonth(new Date(r.last_done!))}` : 'nunca feito'}
                  </Muted>
                </View>
                {r.last_top_load != null && <Text style={st.load}>{String(r.last_top_load).replace('.', ',')} kg</Text>}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  search: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontFamily: fonts.text, fontSize: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.card2 },
  chipOn: { backgroundColor: colors.acaiBg },
  chipText: { fontFamily: fonts.textSemi, fontSize: 12, color: colors.text2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 8 },
  name: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text },
  load: { fontFamily: fonts.num, fontSize: 13, color: colors.text2 },
});
