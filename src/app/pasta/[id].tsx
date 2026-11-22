import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createRoutine, deleteProgram, deleteRoutine, duplicateProgram, duplicateRoutine, renameProgram, reorderRoutines } from '../../db/editing.ts';
import { activateProgram, getNextRoutine, getProgram, listRoutines, sequenceNextRoutineId, type ProgramRow, type RoutineRow } from '../../db/queries.ts';
import { WEEKDAY_SHORT } from '../../domain/dates.ts';
import { moveItem } from '../../domain/editing.ts';
import { BigButton, Card, EmptyState, Fab, Field, Input, LinkText, Muted, Option, Sheet, SheetActions, s } from '../../ui/components.tsx';
import { colors, fonts } from '../../ui/theme.ts';
import { Text } from '../../ui/text.tsx';

type SheetName = null | 'usar' | 'menu' | 'renomear' | { routine: RoutineRow };

export default function Pasta() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [nextId, setNextId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [start, setStart] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    const p = await getProgram(db, id);
    setProgram(p);
    const r = await listRoutines(db, id);
    setRoutines(r);
    // sugere continuar a sequência de onde parou (ou a primeira, numa pasta nova)
    setStart((await sequenceNextRoutineId(db, id)) ?? r[0]?.id ?? null);
    setNextId(p?.is_active ? ((await getNextRoutine(db))?.routine?.id ?? null) : null);
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!program) return <SafeAreaView style={s.screen} />;

  const openRoutine = (r: RoutineRow) => router.push({ pathname: '/ficha/[id]', params: { id: r.id } });

  const move = async (index: number, delta: -1 | 1) => {
    const next = moveItem(routines, index, delta);
    setRoutines(next);
    await reorderRoutines(db, next.map((r) => r.id));
  };

  const addRoutine = async () => {
    const rid = await createRoutine(db, program.id);
    router.push({ pathname: '/ficha/[id]', params: { id: rid, nova: '1' } });
  };

  const confirmDeleteRoutine = (r: RoutineRow) => {
    setSheet(null);
    Alert.alert(`Apagar a ficha ${r.code}?`, 'Ela sai da sequência. Os treinos feitos com ela continuam no histórico.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => { await deleteRoutine(db, r.id); load(); } },
    ]);
  };

  const confirmDeleteProgram = () => {
    setSheet(null);
    Alert.alert(`Apagar a pasta ${program.name}?`, 'As fichas dela somem da lista. Os treinos feitos continuam no histórico.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => { await deleteProgram(db, program.id); router.back(); } },
    ]);
  };

  const routineSheet = typeof sheet === 'object' && sheet ? sheet.routine : null;

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={[s.pad, { flexGrow: 1, paddingBottom: 90 }]}>
        <View style={st.top}>
          <LinkText onPress={() => router.back()}>‹ pastas</LinkText>
          <Pressable hitSlop={12} onPress={() => setSheet('menu')} accessibilityLabel="Opções da pasta">
            <Text style={st.dots}>⋯</Text>
          </Pressable>
        </View>
        <Text style={st.title}>
          {program.name}
          <Text style={{ color: colors.acaiLight }}>.</Text>
        </Text>
        {routines.length > 0 && (
          <View style={st.top}>
            <Muted>sequência <Text style={st.strong}>{routines.map((r) => r.code).join(' → ')}</Text></Muted>
            {routines.length > 1 && <LinkText onPress={() => setReordering((v) => !v)}>{reordering ? 'pronto' : 'reordenar'}</LinkText>}
          </View>
        )}
        {routines.length === 0 && (
          <EmptyState title="Nenhuma ficha ainda" body="Toque em + ficha para montar a primeira. A ordem das fichas aqui é a sequência do treino." />
        )}
        {routines.map((r, i) => (
          <Pressable key={r.id} onPress={() => !reordering && openRoutine(r)} onLongPress={() => !reordering && setSheet({ routine: r })} delayLongPress={350}>
            <Card style={st.card} highlight={r.id === nextId}>
              <View style={st.letter}><Text style={st.letterText}>{r.code}</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.name}>{r.name || 'sem nome'}</Text>
                <Muted style={{ fontSize: 12 }}>
                  {r.slots} {r.slots === 1 ? 'exercício' : 'exercícios'}{r.priorities ? ` · ${r.priorities} ⭐` : ''}
                  {r.suggested_weekday != null ? ` · ${WEEKDAY_SHORT[r.suggested_weekday]}` : ''}
                  {r.id === nextId ? ' · próxima' : ''}
                </Muted>
              </View>
              {reordering ? (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <Arrow label="↑" disabled={i === 0} onPress={() => move(i, -1)} />
                  <Arrow label="↓" disabled={i === routines.length - 1} onPress={() => move(i, 1)} />
                </View>
              ) : (
                <Text style={st.chev}>›</Text>
              )}
            </Card>
          </Pressable>
        ))}
        {routines.length > 0 && !reordering && <Muted style={{ fontSize: 12 }}>Segure uma ficha para duplicar ou apagar.</Muted>}
        <View style={{ flex: 1 }} />
        {!program.is_active && routines.length > 0 && <BigButton title="Usar esta pasta" onPress={() => setSheet('usar')} />}
      </ScrollView>
      {!reordering && <Fab title="+ ficha" onPress={addRoutine} />}

      <Sheet visible={sheet === 'usar'} onClose={() => setSheet(null)} title="Usar esta pasta" subtitle="começar por qual ficha?">
        {routines.map((r, i) => (
          <Option key={r.id} title={`${r.code} · ${r.name || 'sem nome'}`} detail={i === 0 ? 'primeira da sequência' : undefined} selected={start === r.id} onPress={() => setStart(r.id)} />
        ))}
        <Muted style={{ fontSize: 12 }}>A pasta em uso agora sai de uso e fica guardada com todo o histórico.</Muted>
        <SheetActions
          confirm="Usar pasta"
          onCancel={() => setSheet(null)}
          onConfirm={async () => {
            await activateProgram(db, program.id, start);
            setSheet(null);
            router.navigate('/');
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={program.name}>
        <Option title="Renomear" onPress={() => { setNewName(program.name); setSheet('renomear'); }} />
        <Option
          title="Duplicar pasta"
          detail="copia as fichas, os exercícios e os substitutos"
          onPress={async () => {
            setSheet(null);
            const nid = await duplicateProgram(db, program.id);
            router.replace({ pathname: '/pasta/[id]', params: { id: nid } });
          }}
        />
        {program.is_active ? (
          <Option title="Apagar pasta" detail="a pasta em uso não pode ser apagada; use outra antes" />
        ) : (
          <Option title="Apagar pasta" danger detail="os treinos feitos continuam no histórico" onPress={confirmDeleteProgram} />
        )}
      </Sheet>

      <Sheet visible={sheet === 'renomear'} onClose={() => setSheet(null)} title="Renomear pasta">
        <Field label="nome">
          <Input value={newName} onChangeText={setNewName} autoFocus maxLength={40} />
        </Field>
        <SheetActions
          confirm="Salvar"
          disabled={!newName.trim()}
          onCancel={() => setSheet(null)}
          onConfirm={async () => {
            await renameProgram(db, program.id, newName);
            setSheet(null);
            load();
          }}
        />
      </Sheet>

      <Sheet
        visible={!!routineSheet}
        onClose={() => setSheet(null)}
        title={routineSheet?.code ?? ''}
        subtitle={routineSheet ? `${routineSheet.name || 'sem nome'} · ${routineSheet.slots} exercícios` : undefined}
      >
        {routineSheet && (
          <>
            <Option title="Editar" onPress={() => { setSheet(null); openRoutine(routineSheet); }} />
            <Option
              title="Duplicar"
              detail="cria uma cópia no fim da sequência"
              onPress={async () => {
                setSheet(null);
                await duplicateRoutine(db, routineSheet.id);
                load();
              }}
            />
            <Option title="Apagar" danger detail="sai da sequência; os treinos feitos com ela continuam no histórico" onPress={() => confirmDeleteRoutine(routineSheet)} />
          </>
        )}
      </Sheet>
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
  dots: { color: colors.lilac, fontSize: 22, lineHeight: 22 },
  title: { fontFamily: fonts.num, fontSize: 26, letterSpacing: -0.7, color: colors.text },
  strong: { fontFamily: fonts.num, color: colors.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  letter: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.acaiBg, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontFamily: fonts.num, fontSize: 16, color: colors.lilac },
  name: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text },
  chev: { color: colors.grey, fontSize: 18 },
  arrow: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: colors.lilac, fontSize: 16, fontFamily: fonts.textSemi },
});
