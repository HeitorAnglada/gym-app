import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MUSCLE_LABEL, type MuscleGroup } from '../data/catalog.ts';
import { addSubstitute, createSlot, exerciseIdsInRoutine, getRoutine, getSlot, listSubstitutes, setSlotMain } from '../db/editing.ts';
import { listExercises, type ExerciseListRow } from '../db/queries.ts';
import { addExtra, swapExerciseById } from '../db/workout.ts';
import { dayMonth } from '../domain/dates.ts';
import { formatLoad } from '../domain/editing.ts';
import { AddButton, Chips, Label, LinkText, Muted, s } from '../ui/components.tsx';
import { CreateExerciseSheet } from '../ui/CreateExerciseSheet.tsx';
import { colors, fonts } from '../ui/theme.ts';

/**
 * Escolher exercício, usada por "+ adicionar" (ficha), "+ substituto" e "trocar" o principal.
 * modo=adicionar&ficha=<routine id> · modo=substituto&slot=<slot id> · modo=principal&slot=<slot id>
 * modo=extra&treino=<workout id> · modo=trocar&we=<workout_exercise id> (só neste treino)
 */
type Mode = 'adicionar' | 'substituto' | 'principal' | 'extra' | 'trocar';
type Filter = 'usados' | MuscleGroup;
const MUSCLES = Object.keys(MUSCLE_LABEL) as MuscleGroup[];
const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function EscolherExercicio() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ modo: Mode; ficha?: string; slot?: string; treino?: string; we?: string }>();
  const mode = params.modo;
  const [all, setAll] = useState<ExerciseListRow[]>([]);
  const [inRoutine, setInRoutine] = useState<Set<string>>(new Set());
  const [inSlot, setInSlot] = useState<Set<string>>(new Set());
  const [code, setCode] = useState('');
  const [routineId, setRoutineId] = useState<string | null>(params.ficha ?? null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const rows = await listExercises(db);
        setAll(rows);
        setFilter((f) => f ?? (rows.some((r) => r.times_done > 0) ? 'usados' : null));
        let rid = params.ficha ?? null;
        if (params.slot) {
          const sl = await getSlot(db, params.slot);
          if (sl) {
            rid = sl.routine_id;
            const subs = await listSubstitutes(db, sl.id);
            setInSlot(new Set([sl.main_exercise_id, ...subs.map((x) => x.exercise_id)]));
          }
        }
        if (rid) {
          setRoutineId(rid);
          setCode((await getRoutine(db, rid))?.code ?? '');
          setInRoutine(await exerciseIdsInRoutine(db, rid));
        }
      })();
    }, [db, params.ficha, params.slot]),
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

  const pick = async (exerciseId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'adicionar' && routineId) {
        const slotId = await createSlot(db, routineId, exerciseId);
        router.replace({ pathname: '/ficha/exercicio/[id]', params: { id: slotId } });
      } else if (mode === 'substituto' && params.slot) {
        if (!inSlot.has(exerciseId)) await addSubstitute(db, params.slot, exerciseId);
        router.back();
      } else if (mode === 'extra' && params.treino) {
        await addExtra(db, params.treino, exerciseId);
        router.back();
      } else if (mode === 'trocar' && params.we) {
        await swapExerciseById(db, params.we, exerciseId);
        router.back();
      } else if (mode === 'principal' && params.slot) {
        await setSlotMain(db, params.slot, exerciseId);
        router.back();
      }
    } finally {
      setBusy(false);
    }
  };

  const title = {
    adicionar: `adicionar à ${code}`,
    substituto: 'escolher substituto',
    principal: 'trocar principal',
    extra: 'extra · só hoje',
    trocar: 'trocar · só hoje',
  }[mode];
  const chips: Filter[] = ['usados', ...MUSCLES];

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={[s.pad, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
        <View style={st.top}>
          <LinkText onPress={() => router.back()}>‹ {mode === 'extra' || mode === 'trocar' ? 'treino' : code || 'voltar'}</LinkText>
          <Muted>{title}</Muted>
        </View>
        <View style={{ backgroundColor: colors.bg, gap: 8, paddingBottom: 4 }}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Buscar exercício" placeholderTextColor={colors.grey} style={st.search} autoFocus={mode !== 'principal'} />
          {!query && <Chips items={chips} value={filter} onChange={setFilter} label={(c) => (c === 'usados' ? 'Usados' : MUSCLE_LABEL[c])} />}
        </View>
        {!query && !filter && <Muted>Busque pelo nome ou escolha um grupo muscular.</Muted>}
        {query.trim() !== '' && shown.length === 0 && <Muted>Nada com “{query.trim()}” no catálogo.</Muted>}
        {shown.map(([group, rows]) => (
          <View key={group}>
            <Label>{MUSCLE_LABEL[group as MuscleGroup]}</Label>
            {rows.map((r) => {
              const here = inSlot.has(r.id) ? 'já neste exercício' : inRoutine.has(r.id) ? `já na ${code}` : null;
              return (
                <Pressable key={r.id} onPress={() => pick(r.id)} style={({ pressed }) => [st.row, pressed && { opacity: 0.6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.name}>{r.name}</Text>
                    <Muted style={{ fontSize: 12, color: here ? colors.lilac : colors.text2 }}>
                      {here ?? (r.times_done > 0 ? `feito ${r.times_done}× · último ${dayMonth(new Date(r.last_done!))}` : 'nunca feito')}
                    </Muted>
                  </View>
                  {r.last_top_load != null && <Text style={st.load}>{formatLoad(r.last_top_load)} kg</Text>}
                </Pressable>
              );
            })}
          </View>
        ))}
        <AddButton title={query.trim() ? `+ criar "${query.trim()}"` : '+ criar exercício'} onPress={() => setCreating(true)} />
      </ScrollView>
      <CreateExerciseSheet
        visible={creating}
        initialName={query}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          pick(id);
        }}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  search: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontFamily: fonts.text, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 8 },
  name: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text },
  load: { fontFamily: fonts.num, fontSize: 13, color: colors.text2 },
});
