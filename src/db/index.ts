import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { catalogRows, isBackup, type Backup, type Row } from './backup.ts';
import { MIGRATIONS, SCHEMA_VERSION, SINGLE_SET_COUNT_SQL, TABLES } from './schema.ts';

export const DATABASE_NAME = 'kargo.db';

export const newId = () => Crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/** Quanto uma escrita espera outra terminar antes de desistir com "database is locked". */
const BUSY_TIMEOUT_MS = 5000;

/**
 * Transação. O expo-sqlite abre uma conexão só para ela; sem espera configurada, uma escrita
 * que cruzasse com outra (dois toques rápidos em ↑↓, por exemplo) falharia na hora.
 */
export async function transaction(db: SQLiteDatabase, task: (tx: SQLiteDatabase) => Promise<void>): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.execAsync(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    await task(tx);
  });
}

/** Roda as migrações pendentes e coloca o catálogo no primeiro uso. Passado ao SQLiteProvider como onInit. */
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`);
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < SCHEMA_VERSION) {
    const sql = MIGRATIONS[version];
    await transaction(db, async (tx) => {
      await tx.execAsync(sql);
      await tx.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version += 1;
  }
  const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exercise');
  if (!count || count.n === 0) {
    await insertRows(db, 'exercise', catalogRows(newId, nowIso()));
  }
}

async function insertRows(db: SQLiteDatabase, table: string, rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const stmt = await db.prepareAsync(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
  );
  try {
    for (const r of rows) await stmt.executeAsync(cols.map((c) => r[c] ?? null));
  } finally {
    await stmt.finalizeAsync();
  }
}

/** Todas as tabelas num objeto, para salvar como arquivo. */
export async function exportBackup(db: SQLiteDatabase): Promise<Backup> {
  const tables = {} as Backup['tables'];
  for (const t of TABLES) tables[t] = await db.getAllAsync<Row>(`SELECT * FROM ${t}`);
  return { format: 'kargo-backup', schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), tables };
}

/** Troca todos os dados do aparelho pelos do backup. A tela pede confirmação antes. */
export async function importBackup(db: SQLiteDatabase, data: unknown): Promise<void> {
  if (!isBackup(data)) throw new Error('Esse arquivo não é um backup do kargo.');
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Esse backup é de uma versão mais nova do kargo. Atualize o app e tente de novo.');
  }
  // foreign_keys só muda fora de transação no SQLite.
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await transaction(db, async (tx) => {
      for (const t of [...TABLES].reverse()) await tx.execAsync(`DELETE FROM ${t}`);
      for (const t of TABLES) await insertRows(tx, t, data.tables[t] ?? []);
      // backup de antes da série única ainda traz faixas ("3 a 4")
      await tx.execAsync(SINGLE_SET_COUNT_SQL);
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}
