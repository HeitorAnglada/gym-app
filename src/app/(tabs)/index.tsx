import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getNextRoutine, listWorkouts, type WorkoutListRow } from '../../db/queries.ts';
import { addDays, dayMonth, MONTH_LONG, sameDay, startOfWeek, WEEKDAY_LONG, WEEKDAY_SHORT } from '../../domain/dates.ts';
import { BigButton, Card, EmptyState, Label, LinkText, Muted, s } from '../../ui/components.tsx';
import { Icon } from '../../ui/icons.tsx';
import { colors, fonts } from '../../ui/theme.ts';

type Next = Awaited<ReturnType<typeof getNextRoutine>>;

export default function Inicio() {
  const db = useSQLiteContext();
  const [next, setNext] = useState<Next>(null);
  const [week, setWeek] = useState<WorkoutListRow[]>([]);
  const [monthCount, setMonthCount] = useState(0);
  const today = new Date();
  const monday = startOfWeek(today);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const n = await getNextRoutine(db);
        const w = await listWorkouts(db, monday.toISOString(), addDays(monday, 7).toISOString());
        const m = await listWorkouts(db, new Date(today.getFullYear(), today.getMonth(), 1).toISOString(), new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString());
        if (alive) {
          setNext(n);
          setWeek(w);
          setMonthCount(m.length);
        }
      })();
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]),
  );

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
            {MONTH_LONG[today.getMonth()]} <Text style={st.strong}>{monthCount} treinos</Text>
          </Muted>
        </View>

        {routine ? (
          <Card>
            <Label>próximo</Label>
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
        ) : (
          <EmptyState
            title="Nenhuma pasta de treino em uso"
            body="Crie uma pasta na aba Fichas, ou importe um backup em Ajustes para trazer suas fichas prontas."
          />
        )}

        <View style={{ flex: 1 }} />
        {routine && (
          <>
            <BigButton title={`Começar ${routine.code}`} onPress={() => router.push({ pathname: '/treino', params: { routineId: routine.id } })} />
            <View style={st.row}>
              <LinkText muted onPress={() => router.push('/fichas')}>trocar treino</LinkText>
              {routine.priorities > 0 && (
                <LinkText onPress={() => router.push({ pathname: '/treino', params: { routineId: routine.id, priorityOnly: '1' } })}>
                  só prioridades ⭐ · {routine.priorities}
                </LinkText>
              )}
            </View>
          </>
        )}
      </ScrollView>
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
});
