import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { Unbounded_300Light } from '@expo-google-fonts/unbounded/300Light';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { DATABASE_NAME, initDatabase } from '../db/index.ts';
import { getSettings } from '../db/settings.ts';
import { DialogHost } from '../ui/dialog.tsx';
import { setFontScale } from '../ui/text.tsx';
import { colors } from '../ui/theme.ts';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.line, primary: colors.lilac },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Unbounded_300Light, SpaceGrotesk_500Medium, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  // Se uma fonte falhar, o app abre assim mesmo (com a fonte do sistema) em vez de travar na abertura.
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={theme}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase} useSuspense>
        <FontScaleFromSettings />
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        <DialogHost />
      </SQLiteProvider>
    </ThemeProvider>
  );
}

/** Aplica o tamanho de fonte salvo nos ajustes assim que o banco abre. */
function FontScaleFromSettings() {
  const db = useSQLiteContext();
  useEffect(() => {
    getSettings(db).then((st) => setFontScale(st.fontScale)).catch(() => {});
  }, [db]);
  return null;
}
