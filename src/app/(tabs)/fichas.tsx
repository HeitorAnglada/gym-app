import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listPrograms, type ProgramRow } from '../../db/queries.ts';
import { dayMonth } from '../../domain/dates.ts';
import { Card, EmptyState, Fab, Label, Muted, ScreenTitle, s } from '../../ui/components.tsx';
import { NewProgramSheet } from '../../ui/NewProgramSheet.tsx';
import { colors, fonts } from '../../ui/theme.ts';

export default function Fichas() {
  const db = useSQLiteContext();
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listPrograms(db).then(setPrograms);
    }, [db]),
  );

  const active = programs.filter((p) => p.is_active);
  const others = programs.filter((p) => !p.is_active);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={[s.pad, { paddingBottom: 90 }]}>
        <ScreenTitle>fichas</ScreenTitle>
        {programs.length === 0 && (
          <EmptyState title="Nenhuma pasta de treino" body="Uma pasta guarda as fichas de um programa (ex.: A1 → B → A2). Toque em + pasta para montar a sua, ou importe um backup em Ajustes." />
        )}
        {active.length > 0 && <Label>em uso</Label>}
        {active.map((p) => <ProgramCard key={p.id} p={p} />)}
        {others.length > 0 && <Label>outras pastas</Label>}
        {others.map((p) => <ProgramCard key={p.id} p={p} />)}
      </ScrollView>
      <Fab title="+ pasta" onPress={() => setCreating(true)} />
      <NewProgramSheet visible={creating} onClose={() => setCreating(false)} />
    </SafeAreaView>
  );
}

function ProgramCard({ p }: { p: ProgramRow }) {
  const since = p.first_workout ? ` · desde ${dayMonth(new Date(p.first_workout))}` : '';
  return (
    <Pressable onPress={() => router.push({ pathname: '/pasta/[id]', params: { id: p.id } })}>
      <Card highlight={!!p.is_active} style={st.card}>
        <View style={[st.icon, !p.is_active && { backgroundColor: colors.card2 }]}>
          <Text style={[st.iconText, !p.is_active && { color: colors.text2 }]}>▣</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.name}>{p.name}</Text>
          <Muted style={{ fontSize: 12 }}>
            {p.routine_codes ?? 'sem fichas'}{since} · {p.workouts} {p.workouts === 1 ? 'treino' : 'treinos'}
          </Muted>
        </View>
        <Text style={st.chev}>›</Text>
      </Card>
    </Pressable>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.acaiBg, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.lilac, fontSize: 18 },
  name: { fontFamily: fonts.textSemi, fontSize: 15, color: colors.text },
  chev: { color: colors.grey, fontSize: 18 },
});
