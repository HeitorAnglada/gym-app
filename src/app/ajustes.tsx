import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { exportBackup, importBackup } from '../db/index.ts';
import { DEFAULT_SETTINGS, getSettings, setSetting, type Settings } from '../db/settings.ts';
import { dayMonth } from '../domain/dates.ts';
import { allowExactAlarm, clearOngoing, exactAlarmAllowed } from '../ui/alerts.ts';
import { BigButton, Card, Chips, Label, LinkText, Muted, ScreenTitle, Toggle, s } from '../ui/components.tsx';
import { colors, fonts } from '../ui/theme.ts';
import { FONT_SCALES, Text, setFontScale } from '../ui/text.tsx';

export default function Ajustes() {
  const db = useSQLiteContext();
  const [pending, setPending] = useState<{ name: string; data: unknown } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [exactAlarm, setExactAlarm] = useState(true);

  useEffect(() => {
    getSettings(db).then(setSettings);
    exactAlarmAllowed().then(setExactAlarm);
  }, [db]);

  const change = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((st0) => ({ ...st0, [key]: value }));
    await setSetting(db, key, value);
  };

  const HOURS = [2, 3, 4, 6, 0];

  async function onExport() {
    setMessage(null);
    try {
      const backup = await exportBackup(db);
      const day = backup.exportedAt.slice(0, 10);
      const file = new File(Paths.cache, `kargo-backup-${day}.json`);
      if (file.exists) file.delete();
      file.create();
      await file.write(JSON.stringify(backup));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Salvar backup do kargo' });
      await change('lastExportAt', backup.exportedAt);
    } catch (e) {
      setMessage(`Não consegui exportar o backup: ${(e as Error).message}`);
    }
  }

  async function onPick() {
    setMessage(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const asset = res.assets[0];
    try {
      const data = JSON.parse(await new File(asset.uri).text());
      setPending({ name: asset.name, data });
    } catch {
      setMessage('Não consegui ler esse arquivo. Escolha um backup .json exportado pelo kargo.');
    }
  }

  async function onConfirmImport() {
    if (!pending) return;
    try {
      await importBackup(db, pending.data);
      await clearOngoing();
      setMessage('Backup importado. Suas fichas e seu histórico já estão no app.');
      setSettings(await getSettings(db));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.pad}>
        <LinkText onPress={() => router.back()}>‹ início</LinkText>
        <ScreenTitle>ajustes</ScreenTitle>

        <Label>tela</Label>
        <Text style={st.title}>Tamanho da fonte</Text>
        <Chips
          items={FONT_SCALES.map((f) => f.value)}
          value={settings.fontScale}
          label={(v) => FONT_SCALES.find((f) => f.value === v)?.label ?? ''}
          onChange={(v) => {
            setFontScale(v);
            change('fontScale', v);
          }}
        />
        <Muted>Vale para o app inteiro. O tamanho de fonte do Android também conta.</Muted>

        <Label>treino</Label>
        <Toggle label="Manter tela ligada no treino" value={settings.keepAwake} onChange={(v) => change('keepAwake', v)} />
        <Toggle label="Vibrar no fim do descanso" value={settings.vibrate} onChange={(v) => change('vibrate', v)} />
        <Toggle label="Som no fim do descanso" value={settings.sound} onChange={(v) => change('sound', v)} />
        {Platform.OS === 'android' && !exactAlarm && (
          <Row title="Aviso do descanso na hora exata" detail="liberar no Android" onPress={async () => setExactAlarm(await allowExactAlarm())} />
        )}
        <Row
          title="Finalizar treino parado após"
          detail={settings.autoFinishHours ? `${settings.autoFinishHours} h` : 'nunca'}
          onPress={() => change('autoFinishHours', HOURS[(HOURS.indexOf(settings.autoFinishHours) + 1) % HOURS.length])}
        />

        <Label>dados</Label>
        <Row title="Exportar backup" detail={settings.lastExportAt ? `último: ${dayMonth(new Date(settings.lastExportAt))}` : 'salvar no Drive ou mandar pra você'} onPress={onExport} />
        <Row title="Importar backup" detail="troca os dados deste aparelho" onPress={onPick} />

        {pending && (
          <Card highlight style={{ gap: 10 }}>
            <Text style={st.title}>Importar {pending.name}?</Text>
            <Muted>Tudo o que está neste aparelho (fichas, treinos e exercícios) será trocado pelo conteúdo do backup.</Muted>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><BigButton variant="light" title="Cancelar" onPress={() => setPending(null)} /></View>
              <View style={{ flex: 1 }}><BigButton title="Importar" onPress={onConfirmImport} /></View>
            </View>
          </Card>
        )}
        {message && <Muted style={{ color: colors.text }}>{message}</Muted>}

        <Label>sobre</Label>
        <View style={st.row}>
          <Text style={st.title}>kargo 1.0</Text>
          <Muted>por kairos</Muted>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.row, pressed && { opacity: 0.7 }]}>
      <Text style={st.title}>{title}</Text>
      <Muted style={{ fontSize: 12 }}>{detail}</Muted>
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 12 },
  title: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text },
});
