import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getNextRoutine, listRoutines, listWorkouts, type RoutineRow, type WorkoutListRow } from '../../db/queries.ts';
import { getSettings } from '../../db/settings.ts';
import { autoFinishStale, deleteWorkout, finishWorkout, getOpenWorkout, loadWorkout, startWorkout, type WorkoutData } from '../../db/workout.ts';
import { clearOngoing } from '../../ui/alerts.ts';
import { addDays, dayMonth, MONTH_LONG, sameDay, startOfWeek, WEEKDAY_LONG, WEEKDAY_SHORT } from '../../domain/dates.ts';
import { BigButton, Card, Label, LinkText, Muted, Option, Sheet, s } from '../../ui/components.tsx';
import { Icon } from '../../ui/icons.tsx';
import { NewProgramSheet } from '../../ui/NewProgramSheet.tsx';
import { colors, fonts } from '../../ui/theme.ts';
import { Text } from '../../ui/text.tsx';
import { showDialog } from '../../ui/dialog.tsx';

type Next = Awaited<ReturnType<typeof getNextRoutine>>;

export default function Inicio() {
  const db = useSQLiteContext();
  const [next, setNext] = useState<Next>(null);
  const [week, setWeek] = useState<WorkoutListRow[]>([]);
  const [monthCount, setMonthCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<WorkoutData | null>(null);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const starting = useRef(false);
  const [tick, setTick] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const today = new Date(nowMs);
  const monday = startOfWeek(today);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const settings = await getSettings(db);
        if (await autoFinishStale(db, settings.autoFinishHours)) await clearOngoing();
        const ow = await getOpenWorkout(db);
        const od = ow ? await loadWorkout(db, ow.id) : null;
        const n = await getNextRoutine(db);
        const rs = n?.program ? await listRoutines(db, n.program.id) : [];
        const w = await listWorkouts(db, monday.toISOString(), addDays(monday, 7).toISOString());
        const m = await listWorkouts(db, new Date(today.getFullYear(), today.getMonth(), 1).toISOString(), new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString());
        if (alive) {
          setNowMs(Date.now());
          setNext(n);
          setOpen(od);
          setRoutines(rs);
          setWeek(w);
          setMonthCount(m.length);
        }
      })();
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, tick]),
  );

  const start = async (routineId: string, priorityOnly: boolean) => {
    // ref, não estado: dois toques no mesmo instante veem o mesmo estado e abririam dois treinos
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    try {
      const id = await startWorkout(db, routineId, priorityOnly);
      setPicking(false);
      router.push({ pathname: '/treino', params: { id } });
    } finally {
      starting.current = false;
      setBusy(false);
    }
  };

  const ow = open?.workout;
  const openDone = open ? open.exercises.filter((e) => e.status !== 'pendente').length : 0;
  const openTotal = open?.exercises.length ?? 0;
  const openCurrent = open?.exercises.find((e) => e.id === ow?.current_we_id);
  const lastActivity = ow ? Math.round((nowMs - new Date(ow.last_activity_at ?? ow.started_at).getTime()) / 60000) : 0;
  const startedMin = ow ? Math.round((nowMs - new Date(ow.started_at).getTime()) / 60000) : 0;
  const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const routine = next?.routine;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={[s.pad, { flexGrow: 1 }]}>
        <View style={st.top}>
          <Text style={st.brand}>
            k<Text style={{ color: colors.grey }}>arg</Text>o
          </Text>
          <Pressable accessibilityLabel="Ajustes" hitSlop={12} onPress={() => router.push('/ajustes')}>
            <Icon name="ajustes" color={colors.text2} />
          </Pressable>
        </View>

        <View style={st.week}>
          {days.map((d) => {
            const done = week.find((w) => sameDay(new Date(w.started_at), d));
            const isToday = sameDay(d, today);
            return (
              <View key={d.toISOString()} style={st.day}>
                <View style={[st.dayBox, done && { backgroundColor: colors.acai }, isToday && st.today]}>
                  <Text style={[st.dayText, done && { color: colors.white }]}>{done?.code ?? '·'}</Text>
                </View>
                <Text style={st.dayLabel}>{WEEKDAY_SHORT[d.getDay()]}</Text>
              </View>
            );
          })}
        </View>
        <View style={st.weekFoot}>
          <Muted>
            esta semana <Text style={st.strong}>{week.length} de {next?.routineCount ?? 0}</Text>
          </Muted>
          <Muted>
            {MONTH_LONG[today.getMonth()]} <Text style={st.strong}>{monthCount} {monthCount === 1 ? 'treino' : 'treinos'}</Text>
          </Muted>
        </View>

        {ow ? (
          <Card highlight style={{ gap: 10 }}>
            <Label><Text style={{ color: colors.lilac }}>em andamento</Text></Label>
            <Text style={st.code}>
              {ow.routine_code ?? 'treino'}
              <Text style={st.codeSmall}>  {Math.min(openDone + 1, openTotal)} de {openTotal}</Text>
            </Text>
            <View style={st.bar}><View style={[st.barFill, { width: `${openTotal ? (openDone / openTotal) * 100 : 0}%` }]} /></View>
            <View style={st.row}><Muted>Começou</Muted><Text style={st.strong}>{hhmm(ow.started_at)} · há {startedMin} min</Text></View>
            <View style={st.row}><Muted>Parado há</Muted><Text style={st.strong}>{lastActivity} min</Text></View>
            {openCurrent && <View style={st.row}><Muted>Agora</Muted><Text style={st.strong}>{openCurrent.name}</Text></View>}
          </Card>
        ) : routine ? (
          <Card>
            <View style={st.row}>
              <Label>próximo</Label>
              <Pressable
                hitSlop={12}
                accessibilityLabel={`Editar o treino ${routine.code}`}
                onPress={() => router.push({ pathname: '/ficha/[id]', params: { id: routine.id } })}
                style={st.edit}
              >
                <Icon name="editar" color={colors.lilac} size={18} />
              </Pressable>
            </View>
            <Text style={st.code}>
              {routine.code}
              <Text style={{ color: colors.acaiLight }}>.</Text>
            </Text>
            <Muted>
              {routine.name} · {routine.slots} exercícios
            </Muted>
            <View style={st.row}>
              <Muted>Último {routine.code}</Muted>
              <Text style={st.strong}>{next?.lastOfRoutine ? dayMonth(new Date(next.lastOfRoutine.started_at)) : 'nunca'}</Text>
            </View>
            {routine.suggested_weekday != null && (
              <View style={st.row}>
                <Muted>Dia sugerido</Muted>
                <Text style={st.strong}>{WEEKDAY_LONG[routine.suggested_weekday]}</Text>
              </View>
            )}
          </Card>
        ) : next?.program ? (
          <Card style={{ gap: 10 }}>
            <Text style={st.welcome}>{next.program.name} ainda não tem treinos.</Text>
            <Muted>Monte o primeiro treino da ficha para ele aparecer aqui.</Muted>
            <BigButton title="Montar treino" onPress={() => router.push({ pathname: '/pasta/[id]', params: { id: next.program.id } })} />
          </Card>
        ) : (
          <Card style={{ gap: 10 }}>
            <Text style={st.welcome}>Bem-vindo ao kargo.</Text>
            <Muted>
              Comece montando a sua ficha: os treinos (A, B, C…), os exercícios e os substitutos. Se você já usa o kargo em outro celular, importe o backup.
            </Muted>
            <BigButton title="Montar minha ficha" onPress={() => setCreating(true)} />
            <BigButton variant="light" title="Importar backup" onPress={() => router.push('/ajustes')} />
          </Card>
        )}

        <View style={{ flex: 1 }} />
        {ow ? (
          <>
            <BigButton title={`Continuar ${ow.routine_code ?? 'treino'}`} onPress={() => router.push({ pathname: '/treino', params: { id: ow.id } })} />
            <View style={st.row}>
              <LinkText
                muted
                onPress={() =>
                  showDialog(`Finalizar o ${ow.routine_code ?? 'treino'} como está?`, 'O que você já fez fica no histórico; o resto vai como pulado.', [
                    { text: 'Voltar', style: 'cancel' },
                    {
                      text: 'Finalizar',
                      onPress: async () => {
                        await finishWorkout(db, ow.id);
                        await clearOngoing();
                        router.push({ pathname: '/fim/[id]', params: { id: ow.id } });
                      },
                    },
                  ])
                }
              >
                finalizar como está
              </LinkText>
              <LinkText
                muted
                onPress={() =>
                  showDialog('Descartar o treino aberto?', 'Nada dele fica no histórico.', [
                    { text: 'Voltar', style: 'cancel' },
                    { text: 'Descartar', style: 'destructive', onPress: async () => { await deleteWorkout(db, ow.id); await clearOngoing(); setTick((n) => n + 1); } },
                  ])
                }
              >
                descartar
              </LinkText>
            </View>
          </>
        ) : routine ? (
          <>
            <BigButton title={`Começar ${routine.code}`} disabled={busy || routine.slots === 0} onPress={() => start(routine.id, false)} />
            <View style={st.row}>
              <LinkText muted onPress={() => setPicking(true)}>trocar treino</LinkText>
              {routine.priorities > 0 && (
                <LinkText onPress={() => start(routine.id, true)}>
                  só prioridades ⭐ · {routine.priorities}
                </LinkText>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
      <NewProgramSheet visible={creating} onClose={() => setCreating(false)} />
      <Sheet visible={picking} onClose={() => setPicking(false)} title="Trocar treino" subtitle="a sequência continua depois deste">
        {routines.map((r) => (
          <Option
            key={r.id}
            title={`${r.code} · ${r.name || 'sem nome'}`}
            detail={`${r.slots} exercícios${r.id === routine?.id ? ' · próximo' : ''}`}
            selected={r.id === routine?.id}
            onPress={() => r.slots > 0 && start(r.id, false)}
          />
        ))}
        <LinkText muted onPress={() => { setPicking(false); router.push('/fichas'); }}>ver fichas e treinos</LinkText>
      </Sheet>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: fonts.brand, fontSize: 20, color: colors.text, letterSpacing: -0.5 },
  week: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', gap: 5 },
  dayBox: { width: '100%', maxWidth: 40, aspectRatio: 1, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 2, borderColor: colors.lilac },
  dayText: { fontFamily: fonts.num, fontSize: 13, color: colors.text2 },
  dayLabel: { fontFamily: fonts.text, fontSize: 11, color: colors.grey },
  weekFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  strong: { fontFamily: fonts.textSemi, color: colors.text, fontSize: 13 },
  code: { fontFamily: fonts.num, fontSize: 44, letterSpacing: -1.3, color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeSmall: { fontFamily: fonts.text, fontSize: 14, color: colors.text2, letterSpacing: 0 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.card2, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.acaiLight },
  edit: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' },
  welcome: { fontFamily: fonts.num, fontSize: 20, letterSpacing: -0.4, color: colors.text },
});
