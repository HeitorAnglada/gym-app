/**
 * Avisos do treino: notificação no fim do descanso (com som e/ou vibração) e
 * a notificação fixa "treino em andamento". No Android o som e a vibração
 * ficam no canal, então há um canal para cada combinação.
 */
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

import { formatClock } from '../domain/rest.ts';

const ONGOING_ID = 'kargo-treino';
const REST_ID = 'kargo-descanso';
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

type AlertOpts = { sound: boolean; vibrate: boolean };

function restContent(targetSec: number, nextName: string, opts: AlertOpts): Notifications.NotificationContentInput {
  return {
    title: `Descanso de ${formatClock(targetSec)} completo`,
    body: `Próxima série: ${nextName}`,
    sound: opts.sound ? 'default' : false,
    vibrate: opts.vibrate ? [0, 400, 200, 400] : undefined,
  };
}

/** Agenda o aviso de fim do descanso (cobre o app fechado ou a tela apagada). Cancela o anterior. */
export async function scheduleRestEnd(afterSeconds: number, targetSec: number, nextName: string, opts: AlertOpts) {
  await cancelRestEnd();
  if (afterSeconds <= 0) return;
  await Notifications.scheduleNotificationAsync({
    identifier: REST_ID,
    content: restContent(targetSec, nextName, opts),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(afterSeconds)), channelId: channelFor(opts.sound, opts.vibrate) },
  }).catch(() => {});
}

/**
 * Fim do descanso visto com a tela aberta: avisa na hora. No Android, sem a permissão de
 * alarme exato, o aviso agendado pode chegar bem depois do alvo. Se ele já apareceu, não repete.
 */
export async function restEndNow(targetSec: number, nextName: string, opts: AlertOpts) {
  const shown = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  if (shown.some((n) => n.request.identifier === REST_ID)) return;
  await Notifications.cancelScheduledNotificationAsync(REST_ID).catch(() => {});
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: REST_ID,
      content: restContent(targetSec, nextName, opts),
      trigger: Platform.OS === 'android' ? { channelId: channelFor(opts.sound, opts.vibrate) } : null,
    });
  } catch {
    if (opts.vibrate) buzz();
  }
}

export async function cancelRestEnd() {
  await Notifications.cancelScheduledNotificationAsync(REST_ID).catch(() => {});
  await Notifications.dismissNotificationAsync(REST_ID).catch(() => {});
}

/** Android 12+: sem alarme exato liberado, o aviso agendado do descanso pode atrasar. */
export async function exactAlarmAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return true;
  }
}

/** Abre a tela do Android para liberar o alarme exato. Devolve se ficou liberado. */
export async function allowExactAlarm(): Promise<boolean> {
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
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
