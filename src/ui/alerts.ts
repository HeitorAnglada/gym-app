/**
 * Avisos do treino: notificação no fim do descanso (com som e/ou vibração) e
 * a notificação fixa "treino em andamento". No Android o som e a vibração
 * ficam no canal, então há um canal para cada combinação.
 */
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

import { formatClock } from '../domain/rest.ts';

const ONGOING_ID = 'kargo-treino';
let configured = false;

const channelFor = (sound: boolean, vibrate: boolean) => `descanso-${sound ? 's' : 'x'}${vibrate ? 'v' : 'x'}`;

export async function setupAlerts() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS !== 'android') return;
  for (const sound of [true, false]) {
    for (const vibrate of [true, false]) {
      await Notifications.setNotificationChannelAsync(channelFor(sound, vibrate), {
        name: `Fim do descanso${sound ? ' com som' : ''}${vibrate ? ' e vibração' : ''}`,
        importance: Notifications.AndroidImportance.HIGH,
        sound: sound ? 'default' : null,
        enableVibrate: vibrate,
        vibrationPattern: vibrate ? [0, 400, 200, 400] : null,
      });
    }
  }
  await Notifications.setNotificationChannelAsync('treino', {
    name: 'Treino em andamento',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
  });
}

export async function askPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Agenda o aviso de fim do descanso. Cancela o anterior. */
export async function scheduleRestEnd(afterSeconds: number, targetSec: number, nextName: string, opts: { sound: boolean; vibrate: boolean }) {
  await cancelRestEnd();
  if (afterSeconds <= 0) return;
  await Notifications.scheduleNotificationAsync({
    identifier: 'kargo-descanso',
    content: {
      title: `Descanso de ${formatClock(targetSec)} completo`,
      body: `Próxima série: ${nextName}`,
      sound: opts.sound ? 'default' : false,
      vibrate: opts.vibrate ? [0, 400, 200, 400] : undefined,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(afterSeconds)), channelId: channelFor(opts.sound, opts.vibrate) },
  });
}

export async function cancelRestEnd() {
  await Notifications.cancelScheduledNotificationAsync('kargo-descanso').catch(() => {});
  await Notifications.dismissNotificationAsync('kargo-descanso').catch(() => {});
}

/** Notificação fixa enquanto o treino está aberto (tocar volta pro app). */
export async function showOngoing(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    identifier: ONGOING_ID,
    content: { title, body, sticky: true, autoDismiss: false, sound: false },
    trigger: Platform.OS === 'android' ? { channelId: 'treino' } : null,
  }).catch(() => {});
}

export async function clearOngoing() {
  await Notifications.dismissNotificationAsync(ONGOING_ID).catch(() => {});
  await cancelRestEnd();
}

/** Vibração com o app aberto (a notificação cobre o app fechado). */
export function buzz() {
  Vibration.vibrate([0, 400, 200, 400]);
}
