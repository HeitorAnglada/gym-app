import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatClock } from '../domain/rest.ts';
import { Card, EmptyState, LinkText, Muted, ScreenTitle, s } from '../ui/components.tsx';
import { colors, fonts } from '../ui/theme.ts';

interface SlotView {
  id: string;
  name: string;
  sets_min: number;
  sets_max: number;
  reps_min: number;
  reps_max: number;
  rest_sec: number;
  is_priority: number;
  subs: number;
}

/**
 * Tela de treino. Nesta etapa mostra a ficha que vai ser feita; o fluxo de
 * série/descanso, timer e anotação de cargas chega na próxima etapa.
 */
export default function Treino() {
  const db = useSQLiteContext();
  const { routineId, priorityOnly } = useLocalSearchParams<{ routineId: string; priorityOnly?: string }>();
  const [code, setCode] = useState('');
  const [slots, setSlots] = useState<SlotView[]>([]);

  useEffect(() => {
    (async () => {
      const r = await db.getFirstAsync<{ code: string }>('SELECT code FROM routine WHERE id = ?', routineId);
      const rows = await db.getAllAsync<SlotView>(
        `SELECT s.id, e.name, s.sets_min, s.sets_max, s.reps_min, s.reps_max, s.rest_sec, s.is_priority,
           (SELECT COUNT(*) FROM slot_substitute ss WHERE ss.slot_id = s.id AND ss.deleted_at IS NULL) AS subs
         FROM slot s JOIN exercise e ON e.id = s.main_exercise_id
         WHERE s.routine_id = ? AND s.deleted_at IS NULL ORDER BY s.sort`,
        routineId,
      );
      setCode(r?.code ?? '');
      setSlots(priorityOnly === '1' ? rows.filter((x) => x.is_priority) : rows);
    })();
  }, [db, routineId, priorityOnly]);

  const range = (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`);

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.pad}>
        <LinkText onPress={() => router.back()}>‹ início</LinkText>
        <ScreenTitle>{code}</ScreenTitle>
        <EmptyState title="Tela de treino em construção" body="Série e descanso, timer e anotação de cargas chegam na próxima etapa. Por enquanto, esta é a ficha de hoje." />
        {slots.map((x) => (
          <Card key={x.id} style={{ gap: 4 }}>
            <Text style={{ fontFamily: fonts.textSemi, fontSize: 15, color: colors.text }}>
              {x.is_priority ? '⭐ ' : ''}
              {x.name}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Muted>
                {range(x.sets_min, x.sets_max)} × {range(x.reps_min, x.reps_max)} · descanso {formatClock(x.rest_sec)}
              </Muted>
              <Muted>+{x.subs} substitutos</Muted>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
