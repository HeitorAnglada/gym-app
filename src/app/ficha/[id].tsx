import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getRoutine, listSlots, reorderSlots, routineCodesInProgram, updateRoutine, type RoutineDetail, type SlotListRow } from '../../db/editing.ts';
import { WEEKDAY_SHORT } from '../../domain/dates.ts';
import { moveItem, routineCodeError } from '../../domain/editing.ts';
import { AddButton, Chips, Field, Input, LinkText, Muted, s } from '../../ui/components.tsx';
import { colors, fonts } from '../../ui/theme.ts';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const range = (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`);

export default function Ficha() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [routine, setRoutine] = useState<RoutineDetail | null>(null);
  const [slots, setSlots] = useState<SlotListRow[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [otherCodes, setOtherCodes] = useState<string[]>([]);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    const r = await getRoutine(db, id);
    setRoutine(r);
    if (r) {
      setCode(r.code);
      setName(r.name);
      setOtherCodes(await routineCodesInProgram(db, r.program_id, r.id));
    }
    setSlots(await listSlots(db, id));
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!routine) return <SafeAreaView style={s.screen} />;

  const codeError = routineCodeError(code, otherCodes);

  const saveCode = async () => {
    if (!codeError) await updateRoutine(db, routine.id, { code: code.trim().toUpperCase() });
  };

  const done = async () => {
    if (codeError) return;
    await saveCode();
    await updateRoutine(db, routine.id, { name });
    router.back();
  };

  const move = async (index: number, delta: -1 | 1) => {
    const next = moveItem(slots, index, delta);
    setSlots(next);
    await reorderSlots(db, next.map((sl) => sl.id));
  };

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        <View style={st.top}>
          <LinkText onPress={done}>‹ {routine.program_name}</LinkText>
          <LinkText onPress={done}>pronto</LinkText>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field label="letra" style={{ width: 80 }}>
            <Input value={code} onChangeText={setCode} onEndEditing={saveCode} autoCapitalize="characters" maxLength={4} error={!!codeError} />
          </Field>
          <Field label="nome" style={{ flex: 1 }}>
            <Input
              value={name}
              onChangeText={setName}
              onEndEditing={() => updateRoutine(db, routine.id, { name })}
              placeholder="ex.: peito e tríceps"
              maxLength={50}
            />
          </Field>
        </View>
        {codeError && <Text style={st.error}>{codeError}</Text>}
        <Field label="dia sugerido">
          <Chips
            items={DAYS}
            value={routine.suggested_weekday}
            label={(d) => WEEKDAY_SHORT[d]}
            onChange={async (d) => {
              const v = routine.suggested_weekday === d ? null : d;
              setRoutine({ ...routine, suggested_weekday: v });
              await updateRoutine(db, routine.id, { suggested_weekday: v });
            }}
          />
        </Field>
        <Muted style={{ fontSize: 12 }}>O dia é só um lembrete. O próximo treino segue a sequência da pasta.</Muted>

        <View style={st.top}>
          <Text style={s.label}>exercícios · {slots.length}</Text>
          {slots.length > 1 && <LinkText onPress={() => setReordering((v) => !v)}>{reordering ? 'pronto' : 'reordenar'}</LinkText>}
        </View>
        {slots.length === 0 && (
          <View style={st.empty}>
            <Muted>Nenhum exercício ainda.</Muted>
          </View>
        )}
        <View>
          {slots.map((sl, i) => (
            <Pressable
              key={sl.id}
              disabled={reordering}
              onPress={() => router.push({ pathname: '/ficha/exercicio/[id]', params: { id: sl.id } })}
              style={[st.row, i === slots.length - 1 && { borderBottomWidth: 0 }]}
            >
              <Text style={st.num}>{i + 1}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.name}>{sl.is_priority ? '⭐ ' : ''}{sl.main_name}</Text>
                <Muted style={{ fontSize: 12 }}>{sl.subs ? `+${sl.subs} ${sl.subs === 1 ? 'substituto' : 'substitutos'}` : 'sem substitutos'}</Muted>
              </View>
              {reordering ? (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <Arrow label="↑" disabled={i === 0} onPress={() => move(i, -1)} />
                  <Arrow label="↓" disabled={i === slots.length - 1} onPress={() => move(i, 1)} />
                </View>
              ) : (
                <Text style={st.range}>{range(sl.sets_min, sl.sets_max)} × {range(sl.reps_min, sl.reps_max)}</Text>
              )}
            </Pressable>
          ))}
        </View>
        {!reordering && (
          <AddButton title="+ adicionar" onPress={() => router.push({ pathname: '/escolher-exercicio', params: { modo: 'adicionar', ficha: routine.id } })} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Arrow({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={[st.arrow, disabled && { opacity: 0.3 }]}>
      <Text style={st.arrowText}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { fontFamily: fonts.text, fontSize: 12, color: colors.orange },
  empty: { backgroundColor: colors.card, borderRadius: 12, paddingVertical: 20, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  num: { width: 18, fontFamily: fonts.num, fontSize: 13, color: colors.grey },
  name: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text },
  range: { fontFamily: fonts.num, fontSize: 13, color: colors.text2 },
  arrow: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: colors.lilac, fontSize: 16, fontFamily: fonts.textSemi },
});
