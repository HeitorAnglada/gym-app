import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { activateProgram, getProgram, listRoutines, type ProgramRow, type RoutineRow } from '../../db/queries.ts';
import { WEEKDAY_SHORT } from '../../domain/dates.ts';
import { BigButton, Card, LinkText, Muted, s } from '../../ui/components.tsx';
import { colors, fonts } from '../../ui/theme.ts';

export default function Pasta() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [start, setStart] = useState<string | null>(null);

  const load = useCallback(async () => {
    setProgram(await getProgram(db, id));
    const r = await listRoutines(db, id);
    setRoutines(r);
    setStart(r[0]?.id ?? null);
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!program) return <SafeAreaView style={s.screen} />;

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={[s.pad, { flexGrow: 1 }]}>
        <LinkText onPress={() => router.back()}>‹ pastas</LinkText>
        <Text style={st.title}>
          {program.name}
          <Text style={{ color: colors.acaiLight }}>.</Text>
        </Text>
        <Muted>sequência <Text style={st.strong}>{routines.map((r) => r.code).join(' → ')}</Text></Muted>
        {routines.map((r) => (
          <Card key={r.id} style={st.card}>
            <View style={st.letter}><Text style={st.letterText}>{r.code}</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={st.name}>{r.name}</Text>
              <Muted style={{ fontSize: 12 }}>
                {r.slots} exercícios{r.priorities ? ` · ${r.priorities} ⭐` : ''}
                {r.suggested_weekday != null ? ` · ${WEEKDAY_SHORT[r.suggested_weekday]}` : ''}
              </Muted>
            </View>
          </Card>
        ))}
        <View style={{ flex: 1 }} />
        {!program.is_active && !choosing && <BigButton title="Usar esta pasta" onPress={() => setChoosing(true)} />}
        {choosing && (
          <Card style={{ gap: 10 }}>
            <Text style={st.name}>Começar por qual ficha?</Text>
            {routines.map((r, i) => (
              <Pressable key={r.id} onPress={() => setStart(r.id)}>
                <View style={[st.option, start === r.id && st.optionOn]}>
                  <Text style={st.name}>{r.code} · {r.name}</Text>
                  {i === 0 && <Muted style={{ fontSize: 12 }}>primeira da sequência</Muted>}
                </View>
              </Pressable>
            ))}
            <Muted style={{ fontSize: 12 }}>A pasta em uso agora fica guardada com todo o histórico.</Muted>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><BigButton variant="light" title="Cancelar" onPress={() => setChoosing(false)} /></View>
              <View style={{ flex: 1 }}>
                <BigButton
                  title="Usar pasta"
                  onPress={async () => {
                    await activateProgram(db, program.id, start);
                    setChoosing(false);
                    router.navigate('/');
                  }}
                />
              </View>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  title: { fontFamily: fonts.num, fontSize: 26, letterSpacing: -0.7, color: colors.text },
  strong: { fontFamily: fonts.num, color: colors.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  letter: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.acaiBg, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontFamily: fonts.num, fontSize: 16, color: colors.lilac },
  name: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text },
  option: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, gap: 2 },
  optionOn: { borderColor: colors.acaiLight, backgroundColor: colors.acaiBg },
});
