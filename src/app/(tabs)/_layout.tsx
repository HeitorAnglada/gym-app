import { Tabs } from 'expo-router/js-tabs';

import { Icon } from '../../ui/icons.tsx';
import { useFontScale } from '../../ui/text.tsx';
import { colors, fonts } from '../../ui/theme.ts';

export default function TabsLayout() {
  const scale = useFontScale();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lilac,
        tabBarInactiveTintColor: colors.grey,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: fonts.textSemi, fontSize: Math.round(11 * scale) },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Treinar', tabBarIcon: ({ color }) => <Icon name="treinar" color={color} /> }} />
      <Tabs.Screen name="historico" options={{ title: 'Histórico', tabBarIcon: ({ color }) => <Icon name="historico" color={color} /> }} />
      <Tabs.Screen name="fichas" options={{ title: 'Fichas', tabBarIcon: ({ color }) => <Icon name="fichas" color={color} /> }} />
      <Tabs.Screen name="exercicios" options={{ title: 'Exercícios', tabBarIcon: ({ color }) => <Icon name="exercicios" color={color} /> }} />
    </Tabs>
  );
}
