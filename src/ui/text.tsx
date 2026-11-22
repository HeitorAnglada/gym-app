import { useSyncExternalStore } from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet, type StyleProp, type TextInputProps, type TextProps, type TextStyle } from 'react-native';

/**
 * Tamanho da fonte do app (Ajustes › tela). Todo texto do app passa por estes `Text` e
 * `TextInput`, que multiplicam o fontSize (e o lineHeight) do estilo pela escala escolhida.
 * Texto aninhado sem fontSize próprio herda o tamanho já escalado do pai.
 * Soma-se ao tamanho de fonte do Android (configurações do sistema), que continua valendo.
 */
export const FONT_SCALES = [
  { value: 0.9, label: 'pequena' },
  { value: 1, label: 'normal' },
  { value: 1.15, label: 'grande' },
  { value: 1.3, label: 'enorme' },
] as const;

let current = 1;
const listeners = new Set<() => void>();

export function setFontScale(scale: number) {
  const next = FONT_SCALES.some((f) => f.value === scale) ? scale : 1;
  if (next === current) return;
  current = next;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const read = () => current;

export function useFontScale() {
  return useSyncExternalStore(subscribe, read, read);
}

function scaled(style: StyleProp<TextStyle>, scale: number): StyleProp<TextStyle> {
  if (scale === 1 || !style) return style;
  const { fontSize, lineHeight } = StyleSheet.flatten(style) ?? {};
  if (fontSize == null && lineHeight == null) return style;
  const up = (n: number | undefined) => (n == null ? undefined : Math.round(n * scale * 2) / 2);
  return [style, { ...(fontSize != null && { fontSize: up(fontSize) }), ...(lineHeight != null && { lineHeight: up(lineHeight) }) }];
}

export function Text({ style, ...rest }: TextProps) {
  const scale = useFontScale();
  return <RNText {...rest} style={scaled(style, scale)} />;
}

export function TextInput({ style, ...rest }: TextInputProps) {
  const scale = useFontScale();
  return <RNTextInput {...rest} style={scaled(style, scale)} />;
}
