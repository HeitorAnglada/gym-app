import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from './theme.ts';

/** Título de tela em minúsculas com o ponto em açaí ("fichas."). */
export function ScreenTitle({ children }: { children: string }) {
  return (
    <Text style={s.title}>
      {children}
      <Text style={{ color: colors.acaiLight }}>.</Text>
    </Text>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Card({ children, style, highlight }: { children: ReactNode; style?: ViewStyle; highlight?: boolean }) {
  return <View style={[s.card, highlight && { borderColor: colors.acai }, style]}>{children}</View>;
}

/** Botão principal: grande, embaixo, onde o polegar alcança. */
export function BigButton({ title, onPress, variant = 'acai', disabled }: { title: string; onPress?: () => void; variant?: 'acai' | 'light'; disabled?: boolean }) {
  const light = variant === 'light';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.big, { backgroundColor: light ? colors.text : colors.acai, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 }]}
    >
      <Text style={[s.bigText, { color: light ? colors.bg : colors.white }]}>{title}</Text>
    </Pressable>
  );
}

export function LinkText({ children, onPress, muted }: { children: ReactNode; onPress?: () => void; muted?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Text style={[s.link, muted && { color: colors.text2, fontFamily: fonts.text }]}>{children}</Text>
    </Pressable>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card style={{ gap: 6 }}>
      <Text style={s.emptyTitle}>{title}</Text>
      <Muted>{body}</Muted>
    </Card>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 12 },
  title: { fontFamily: fonts.num, fontSize: 30, letterSpacing: -0.9, color: colors.text },
  label: { fontFamily: fonts.textSemi, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color: colors.grey },
  card: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 8 },
  big: { height: 64, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  bigText: { fontFamily: fonts.textBold, fontSize: 20, letterSpacing: -0.2 },
  link: { fontFamily: fonts.textSemi, fontSize: 13, color: colors.lilac },
  muted: { fontFamily: fonts.text, fontSize: 13, color: colors.text2 },
  emptyTitle: { fontFamily: fonts.textSemi, fontSize: 15, color: colors.text },
  num: { fontFamily: fonts.num, color: colors.text, fontVariant: ['tabular-nums'] },
});
