import type { SQLiteDatabase } from 'expo-sqlite';

import { newId, nowIso } from './index.ts';

export interface Settings {
  keepAwake: boolean;
  vibrate: boolean;
  sound: boolean;
  /** Horas parado até o treino aberto ser finalizado sozinho. 0 = nunca. */
  autoFinishHours: number;
  lastExportAt: string | null;
  /** Escala da fonte do app inteiro (0.9, 1, 1.15 ou 1.3). */
  fontScale: number;
}

export const DEFAULT_SETTINGS: Settings = { keepAwake: true, vibrate: true, sound: true, autoFinishHours: 3, lastExportAt: null, fontScale: 1 };

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(`SELECT key, value FROM setting WHERE deleted_at IS NULL`);
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    try {
      (out as unknown as Record<string, unknown>)[r.key] = JSON.parse(r.value);
    } catch {
      // valor estranho: fica o padrão
    }
  }
  return out;
}

export async function setSetting<K extends keyof Settings>(db: SQLiteDatabase, key: K, value: Settings[K]) {
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO setting (id, created_at, updated_at, key, value) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, deleted_at = NULL`,
    newId(), now, now, key, JSON.stringify(value),
  );
}
