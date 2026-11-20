import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/**
 * Gaveta que sobe de baixo, com o fundo escurecido. Tocar fora fecha.
 * No Android (borda a borda) o modal passa por baixo da barra de navegação: o pé da gaveta
 * ganha a altura dela, para os botões não ficarem embaixo dos botões do sistema.
 */
export function Sheet({ visible, onClose, title, subtitle, children }: { visible: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable style={s.veil} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={[s.sheet, { paddingBottom: 24 + insets.bottom }]}>
          <View style={s.handle} />
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            {subtitle ? <Muted style={{ fontSize: 12, flexShrink: 1, textAlign: 'right' }}>{subtitle}</Muted> : null}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }} style={{ maxHeight: 520 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Opção de uma gaveta: título em negrito e uma linha de explicação. */
export function Option({ title, detail, selected, danger, onPress }: { title: string; detail?: string; selected?: boolean; danger?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View style={[s.option, selected && s.optionOn]}>
        <Text style={[s.optionTitle, danger && { color: colors.orange }]}>{title}</Text>
        {detail ? <Muted style={{ fontSize: 12 }}>{detail}</Muted> : null}
      </View>
    </Pressable>
  );
}

/** Dois botões lado a lado no pé de uma gaveta. */
export function SheetActions({ cancel = 'Cancelar', confirm, onCancel, onConfirm, disabled }: { cancel?: string; confirm: string; onCancel: () => void; onConfirm: () => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable style={[s.action, { backgroundColor: colors.card2 }]} onPress={onCancel}>
        <Text style={s.actionText}>{cancel}</Text>
      </Pressable>
      <Pressable style={[s.action, { backgroundColor: colors.acai, opacity: disabled ? 0.4 : 1 }]} onPress={onConfirm} disabled={disabled}>
        <Text style={[s.actionText, { color: colors.white }]}>{confirm}</Text>
      </Pressable>
    </View>
  );
}

export function Field({ label, children, style }: { label: string; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ gap: 4 }, style]}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps & { error?: boolean }) {
  const { error, style, ...rest } = props;
  return <TextInput placeholderTextColor={colors.grey} {...rest} style={[s.input, error && { borderColor: colors.orange }, style]} />;
}

/** Fileira de chips (dias, grupos musculares, equipamentos). */
export function Chips<T extends string | number>({ items, value, onChange, label }: { items: readonly T[]; value: T | null; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <View style={s.chips}>
      {items.map((it) => {
        const on = it === value;
        return (
          <Pressable key={String(it)} onPress={() => onChange(it)} style={[s.chip, on && s.chipOn]} hitSlop={4}>
            <Text style={[s.chipText, on && { color: colors.lilac }]}>{label(it)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Valor com − e + grandes dos lados. */
export function Stepper({ value, onMinus, onPlus }: { value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={s.stepper}>
      <Pressable onPress={onMinus} style={s.stepBtn} hitSlop={6} accessibilityLabel="Diminuir">
        <Text style={s.stepSign}>−</Text>
      </Pressable>
      <Text style={s.stepValue}>{value}</Text>
      <Pressable onPress={onPlus} style={s.stepBtn} hitSlop={6} accessibilityLabel="Aumentar">
        <Text style={s.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.toggle}>
      <Text style={s.optionTitle}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.line, true: colors.acai }} thumbColor={value ? colors.white : colors.grey} />
    </View>
  );
}

/** Botão tracejado "+ adicionar". */
export function AddButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.add} accessibilityRole="button">
      <Text style={s.link}>{title}</Text>
    </Pressable>
  );
}

/** Botão flutuante ("+ pasta", "+ ficha"). */
export function Fab({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.fab, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <Text style={s.fabText}>{title}</Text>
    </Pressable>
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
  veil: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, gap: 10 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  sheetTitle: { fontFamily: fonts.num, fontSize: 19, letterSpacing: -0.4, color: colors.text },
  option: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, gap: 2 },
  optionOn: { borderColor: colors.acaiLight, backgroundColor: colors.acaiBg },
  optionTitle: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text },
  action: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: fonts.textSemi, fontSize: 15, color: colors.text },
  fieldLabel: { fontFamily: fonts.text, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.grey },
  input: { backgroundColor: colors.bg, borderColor: colors.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontFamily: fonts.text, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.card2 },
  chipOn: { backgroundColor: colors.acaiBg },
  chipText: { fontFamily: fonts.textSemi, fontSize: 12, color: colors.text2 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 12 },
  stepBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontFamily: fonts.textSemi, fontSize: 20, color: colors.lilac },
  stepValue: { flex: 1, textAlign: 'center', fontFamily: fonts.num, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  toggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  add: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16, height: 48, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.acai, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabText: { fontFamily: fonts.textBold, fontSize: 15, color: colors.white },
});
