import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts } from './theme.ts';
import { Text } from './text.tsx';

/**
 * Caixa de diálogo do kargo, no lugar do Alert nativo do Android (que sai cinza e
 * verde-água). Mesma forma do Alert.alert: `showDialog(título, texto, botões)`.
 *
 * - style 'cancel': botão discreto à esquerda; também é o que roda ao tocar fora ou no voltar.
 * - style 'destructive': ação que apaga algo, em laranja.
 * - sem style: ação principal, em açaí.
 *
 * O `<DialogHost />` fica uma vez só no layout raiz.
 */
export type DialogButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void | Promise<void> };
type Dialog = { title: string; message?: string; buttons: DialogButton[] };

let current: Dialog | null = null;
const listeners = new Set<() => void>();
const set = (d: Dialog | null) => {
  current = d;
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const read = () => current;

export function showDialog(title: string, message?: string, buttons?: DialogButton[]) {
  set({ title, message, buttons: buttons?.length ? buttons : [{ text: 'Ok' }] });
}

/** Fecha a caixa e só depois roda a ação, que pode abrir outra caixa (ex.: um erro). */
function press(b: DialogButton | undefined) {
  set(null);
  if (b?.onPress) Promise.resolve(b.onPress()).catch(() => {});
}

export function DialogHost() {
  const dialog = useSyncExternalStore(subscribe, read, read);
  const cancel = dialog?.buttons.find((b) => b.style === 'cancel');
  // Cancelar sempre à esquerda; a ação principal fica à direita, perto do polegar.
  const ordered = dialog ? [...dialog.buttons].sort((a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel')) : [];
  const stacked = ordered.length > 2;

  return (
    <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => press(cancel)} statusBarTranslucent navigationBarTranslucent>
      <View style={st.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => press(cancel)} accessibilityLabel="Fechar" />
        {dialog && (
          <View style={st.box} accessibilityRole="alert">
            <Text style={st.title}>{dialog.title}</Text>
            {dialog.message ? <Text style={st.message}>{dialog.message}</Text> : null}
            <View style={[st.actions, stacked && { flexDirection: 'column-reverse' }]}>
              {ordered.map((b, i) => {
                const kind = b.style === 'cancel' ? 'cancel' : b.style === 'destructive' ? 'danger' : 'main';
                return (
                  <Pressable
                    key={`${b.text}-${i}`}
                    accessibilityRole="button"
                    onPress={() => press(b)}
                    style={({ pressed }) => [st.btn, !stacked && { flex: 1 }, st[kind], pressed && { opacity: 0.8 }]}
                  >
                    <Text style={[st.btnText, kind === 'main' && { color: colors.white }, kind === 'danger' && { color: colors.orange }]}>{b.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { width: '100%', maxWidth: 380, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 24, padding: 20, gap: 10 },
  title: { fontFamily: fonts.num, fontSize: 20, letterSpacing: -0.5, color: colors.text },
  message: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.text2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { height: 50, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  cancel: { backgroundColor: colors.card2 },
  main: { backgroundColor: colors.acai },
  danger: { backgroundColor: 'rgba(255,138,61,0.12)', borderColor: 'rgba(255,138,61,0.45)' },
  btnText: { fontFamily: fonts.textSemi, fontSize: 15, color: colors.text },
});
