import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listWorkouts, type WorkoutListRow } from '../../db/queries.ts';
import { daysInMonth, dayMonth, leadingBlanks, MONTH_LONG, sameDay, WEEKDAY_LONG } from '../../domain/dates.ts';
import { Card, EmptyState, Muted, ScreenTitle, s } from '../../ui/components.tsx';
import { colors, fonts } from '../../ui/theme.ts';

const HEAD = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

export default function Historico() {
  const db = useSQLiteContext();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [rows, setRows] = useState<WorkoutListRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      listWorkouts(db, new Date(ym.y, ym.m, 1).toISOString(), new Date(ym.y, ym.m + 1, 1).toISOString()).then(setRows);
    }, [db, ym]),
  );

  const shift = (d: number) => setYm(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));
  const blanks = leadingBlanks(ym.y, ym.m);
  const total = daysInMonth(ym.y, ym.m);
  const minutes = (w: WorkoutListRow) => (w.ended_at ? Math.round((+new Date(w.ended_at) - +new Date(w.started_at)) / 60000) : null);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.pad}>
        <ScreenTitle>histórico</ScreenTitle>
        <View style={st.head}>
          <Pressable hitSlop={12} onPress={() => shift(-1)}><Text style={st.arrow}>‹</Text></Pressable>
          <Text style={st.month}>{MONTH_LONG[ym.m]} {ym.y}</Text>
          <Pressable hitSlop={12} onPress={() => shift(1)}><Text style={st.arrow}>›</Text></Pressable>
          <View style={{ flex: 1 }} />
          <Muted>{rows.length} treinos</Muted>
        </View>
        <View style={st.grid}>
          {HEAD.map((h, i) => (
            <Text key={`h${i}`} style={st.dow}>{h}</Text>
          ))}
          {Array.from({ length: blanks }, (_, i) => (
            <View key={`b${i}`} style={st.cell} />
          ))}
          {Array.from({ length: total }, (_, i) => {
            const d = new Date(ym.y, ym.m, i + 1);
            const w = rows.find((r) => sameDay(new Date(r.started_at), d));
            const today = sameDay(d, now);
            return (
              <View key={i} style={st.cell}>
                <View style={[st.box, w && { backgroundColor: colors.acai }, today && { borderWidth: 2, borderColor: colors.lilac }]}>
                  <Text style={[st.cellText, w && { color: colors.white }]}>{w?.code ?? i + 1}</Text>
                </View>
              </View>
            );
          })}
        </View>
        {rows.length === 0 ? (
          <EmptyState title="Nenhum treino neste mês" body="Cada treino finalizado aparece aqui, com a letra da ficha no dia." />
        ) : (
          rows.map((w) => {
            const d = new Date(w.started_at);
            return (
              <Card key={w.id} style={st.item}>
                <View style={st.letter}><Text style={st.letterText}>{w.code ?? '–'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.itemTitle}>{WEEKDAY_LONG[d.getDay()]}, {dayMonth(d)}</Text>
                  <Muted>
                    {minutes(w) ?? '–'} min · {w.sets} séries{w.skipped ? ` · ${w.skipped} pulado${w.skipped > 1 ? 's' : ''}` : ''}
                  </Muted>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  arrow: { fontFamily: fonts.num, fontSize: 22, color: colors.lilac },
  month: { fontFamily: fonts.num, fontSize: 20, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dow: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.text, fontSize: 11, color: colors.grey, paddingBottom: 4 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  box: { flex: 1, borderRadius: 8, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: fonts.num, fontSize: 12, color: colors.text2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  letter: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.acaiBg, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontFamily: fonts.num, fontSize: 14, color: colors.lilac },
  itemTitle: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text, textTransform: 'capitalize' },
});
