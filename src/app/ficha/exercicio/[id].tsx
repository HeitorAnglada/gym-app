import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deleteSlot, getSlot, listSlots, listSubstitutes, removeSubstitute, setSubstituteInitialLoad, updateSlot,
  type SlotDetail, type SubstituteRow,
} from '../../../db/editing.ts';
import { formatLoad, parseLoad, setRangeEnd } from '../../../domain/editing.ts';
import { defaultRestSeconds, formatClock } from '../../../domain/rest.ts';
import { AddButton, Field, Input, LinkText, Muted, Sheet, SheetActions, Stepper, Toggle, s } from '../../../ui/components.tsx';
import { colors, fonts } from '../../../ui/theme.ts';
import { Text } from '../../../ui/text.tsx';

/** Alvo da gaveta de carga inicial: o principal (slot) ou um substituto. */
type LoadTarget = { kind: 'main' } | { kind: 'sub'; sub: SubstituteRow };

export default function ExercicioDaFicha() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [slot, setSlot] = useState<SlotDetail | null>(null);
  const [subs, setSubs] = useState<SubstituteRow[]>([]);
  const [position, setPosition] = useState(0);
  const [loadTarget, setLoadTarget] = useState<LoadTarget | null>(null);
  const [loadText, setLoadText] = useState('');

  const load = useCallback(async () => {
    const sl = await getSlot(db, id);
    setSlot(sl);
    setSubs(await listSubstitutes(db, id));
    if (sl) {
      const all = await listSlots(db, sl.routine_id);
      setPosition(all.findIndex((x) => x.id === sl.id) + 1);
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!slot) return <SafeAreaView style={s.screen} />;

  const patch = async (p: Partial<SlotDetail>) => {
    setSlot({ ...slot, ...p });
    await updateSlot(db, slot.id, p);
  };

  const setSets = (end: 'min' | 'max', v: number) => {
    const r = setRangeEnd({ min: slot.sets_min, max: slot.sets_max }, end, v, 1, 10);
    patch({ sets_min: r.min, sets_max: r.max });
  };

  /** Mexer nas reps leva o descanso junto enquanto ele ainda é o sugerido pela faixa. */
  const setReps = (end: 'min' | 'max', v: number) => {
    const r = setRangeEnd({ min: slot.reps_min, max: slot.reps_max }, end, v, 1, 50);
    const followsSuggestion = slot.rest_sec === defaultRestSeconds(slot.reps_max);
    patch({ reps_min: r.min, reps_max: r.max, ...(followsSuggestion ? { rest_sec: defaultRestSeconds(r.max) } : {}) });
  };

  const suggested = defaultRestSeconds(slot.reps_max);

  const openLoad = (t: LoadTarget) => {
    const current = t.kind === 'main' ? slot.initial_load : t.sub.initial_load;
    setLoadText(current != null ? formatLoad(current) : '');
    setLoadTarget(t);
  };

  const parsed = parseLoad(loadText);

  const saveLoad = async (value: number | null) => {
    if (!loadTarget) return;
    if (loadTarget.kind === 'main') await patch({ initial_load: value });
    else {
      await setSubstituteInitialLoad(db, loadTarget.sub.id, value);
      setSubs(await listSubstitutes(db, slot.id));
    }
    setLoadTarget(null);
  };

  const remove = () =>
    Alert.alert(`Tirar ${slot.main_name} da ${slot.routine_code}?`, 'Os treinos já feitos com ele continuam no histórico.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await deleteSlot(db, slot.id); router.back(); } },
    ]);

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        <View style={st.top}>
          <LinkText onPress={() => router.back()}>‹ {slot.routine_code}</LinkText>
          <LinkText onPress={() => router.back()}>pronto</LinkText>
        </View>
        <View>
          <Text style={st.title}>
            {slot.main_name}
            <Text style={{ color: colors.acaiLight }}>.</Text>
          </Text>
          <Muted style={{ fontSize: 12 }}>{position}º exercício da {slot.routine_code}</Muted>
        </View>

        <Field label="exercício principal">
          <View style={st.box}>
            <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/escolher-exercicio', params: { modo: 'principal', slot: slot.id } })}>
              <Text style={st.boxText}>{slot.main_name}</Text>
              <Text style={st.swap}>trocar</Text>
            </Pressable>
            <LoadBadge last={slot.main_last_load} initial={slot.initial_load} onPress={() => openLoad({ kind: 'main' })} />
          </View>
        </Field>

        <Field label="substitutos">
          <View style={{ gap: 6 }}>
            {subs.map((sub) => (
              <View key={sub.id} style={st.sub}>
                <Text style={[st.boxText, { flex: 1, fontSize: 13 }]}>{sub.name}</Text>
                <LoadBadge last={sub.last_load} initial={sub.initial_load} onPress={() => openLoad({ kind: 'sub', sub })} />
                <Pressable
                  hitSlop={10}
                  accessibilityLabel={`Tirar ${sub.name}`}
                  onPress={async () => { await removeSubstitute(db, sub.id); setSubs(await listSubstitutes(db, slot.id)); }}
                >
                  <Text style={st.x}>×</Text>
                </Pressable>
              </View>
            ))}
            <AddButton title="+ substituto" onPress={() => router.push({ pathname: '/escolher-exercicio', params: { modo: 'substituto', slot: slot.id } })} />
          </View>
        </Field>

        <Field label="séries">
          <View style={st.rangeRow}>
            <View style={{ flex: 1 }}><Stepper value={String(slot.sets_min)} onMinus={() => setSets('min', slot.sets_min - 1)} onPlus={() => setSets('min', slot.sets_min + 1)} /></View>
            <Text style={st.a}>a</Text>
            <View style={{ flex: 1 }}><Stepper value={String(slot.sets_max)} onMinus={() => setSets('max', slot.sets_max - 1)} onPlus={() => setSets('max', slot.sets_max + 1)} /></View>
          </View>
        </Field>
        <Field label="repetições">
          <View style={st.rangeRow}>
            <View style={{ flex: 1 }}><Stepper value={String(slot.reps_min)} onMinus={() => setReps('min', slot.reps_min - 1)} onPlus={() => setReps('min', slot.reps_min + 1)} /></View>
            <Text style={st.a}>a</Text>
            <View style={{ flex: 1 }}><Stepper value={String(slot.reps_max)} onMinus={() => setReps('max', slot.reps_max - 1)} onPlus={() => setReps('max', slot.reps_max + 1)} /></View>
          </View>
        </Field>
        <Field label="descanso recomendado">
          <Stepper
            value={formatClock(slot.rest_sec)}
            onMinus={() => patch({ rest_sec: Math.max(15, slot.rest_sec - 15) })}
            onPlus={() => patch({ rest_sec: Math.min(600, slot.rest_sec + 15) })}
          />
          {slot.rest_sec === suggested ? (
            <Muted style={{ fontSize: 12 }}>sugerido pela faixa de reps</Muted>
          ) : (
            <LinkText onPress={() => patch({ rest_sec: suggested })}>voltar ao sugerido ({formatClock(suggested)})</LinkText>
          )}
        </Field>

        <Toggle label="⭐ Prioridade" value={!!slot.is_priority} onChange={(v) => patch({ is_priority: v ? 1 : 0 })} />
        <Muted style={{ fontSize: 12 }}>No modo “só prioridades” o treino mostra só os exercícios com ⭐.</Muted>

        <View style={{ paddingTop: 12 }}>
          <LinkText muted onPress={remove}>remover da ficha</LinkText>
        </View>
      </ScrollView>

      <Sheet
        visible={!!loadTarget}
        onClose={() => setLoadTarget(null)}
        title="Carga inicial"
        subtitle={loadTarget ? (loadTarget.kind === 'main' ? slot.main_name : loadTarget.sub.name) : undefined}
      >
        <Muted>É a carga que vem preenchida no primeiro treino deste exercício. Depois disso vale o histórico.</Muted>
        <Field label="carga em kg">
          <Input value={loadText} onChangeText={setLoadText} keyboardType="decimal-pad" placeholder="ex.: 22,5" autoFocus error={parsed === 'invalid'} />
        </Field>
        <SheetActions
          cancel={loadText ? 'Limpar' : 'Cancelar'}
          confirm="Salvar"
          disabled={parsed === 'invalid'}
          onCancel={() => (loadText ? saveLoad(null) : setLoadTarget(null))}
          onConfirm={() => parsed !== 'invalid' && saveLoad(parsed)}
        />
      </Sheet>
    </SafeAreaView>
  );
}

/** "último 24 kg" quando já tem histórico; senão a carga inicial (ou o convite para pôr uma). */
function LoadBadge({ last, initial, onPress }: { last: number | null; initial: number | null; onPress: () => void }) {
  if (last != null) return <Text style={st.last}>último {formatLoad(last)} kg</Text>;
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={st.initial}>{initial != null ? `inicial ${formatLoad(initial)} kg` : '+ carga inicial'}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.num, fontSize: 24, letterSpacing: -0.6, color: colors.text },
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  boxText: { fontFamily: fonts.text, fontSize: 14, color: colors.text },
  swap: { fontFamily: fonts.textSemi, fontSize: 12, color: colors.lilac, marginTop: 2 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  x: { color: colors.grey, fontSize: 18, paddingHorizontal: 2 },
  last: { fontFamily: fonts.num, fontSize: 12, color: colors.grey },
  initial: { fontFamily: fonts.textSemi, fontSize: 12, color: colors.lilac },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  a: { fontFamily: fonts.text, color: colors.grey, fontSize: 13 },
});
