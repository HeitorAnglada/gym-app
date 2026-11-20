/**
 * Só para testes: um SQLiteDatabase do expo-sqlite feito sobre o node:sqlite,
 * para rodar as consultas e as migrações de verdade no Node.
 *
 * Imita o que importa do expo-sqlite no Android:
 * - parâmetros soltos ou num array, booleanos viram 0/1, undefined vira null;
 * - withExclusiveTransactionAsync abre OUTRA conexão (como o expo-sqlite faz), então
 *   escrever pela conexão principal no meio da transação dá "database is locked".
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

type Params = unknown[];

function bind(params: Params): SQLInputValue[] {
  const list = params.length === 1 && Array.isArray(params[0]) ? (params[0] as unknown[]) : params;
  return list.map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v === undefined ? null : (v as SQLInputValue)));
}

function wrap(raw: DatabaseSync, path: string): SQLiteDatabase {
  const api = {
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, ...params: Params) {
      const r = raw.prepare(sql).run(...bind(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getFirstAsync(sql: string, ...params: Params) {
      return (raw.prepare(sql).get(...bind(params)) as object | undefined) ?? null;
    },
    async getAllAsync(sql: string, ...params: Params) {
      return raw.prepare(sql).all(...bind(params));
    },
    async prepareAsync(sql: string) {
      const stmt = raw.prepare(sql);
      return {
        async executeAsync(...params: Params) {
          stmt.run(...bind(params));
        },
        async finalizeAsync() {},
      };
    },
    async withExclusiveTransactionAsync(task: (tx: SQLiteDatabase) => Promise<void>) {
      // Conexão nova, com as chaves estrangeiras no padrão do SQLite (desligadas), como no app.
      const conn = new DatabaseSync(path, { enableForeignKeyConstraints: false });
      try {
        conn.exec('BEGIN');
        try {
          await task(wrap(conn, path));
          conn.exec('COMMIT');
        } catch (e) {
          conn.exec('ROLLBACK');
          throw e;
        }
      } finally {
        conn.close();
      }
    },
    async closeAsync() {
      raw.close();
    },
  };
  return api as unknown as SQLiteDatabase;
}

/** Banco novo num arquivo temporário. `cleanup` fecha e apaga. */
export function openTestDatabase(): { db: SQLiteDatabase; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'kargo-test-'));
  const path = join(dir, 'kargo.db');
  const raw = new DatabaseSync(path, { enableForeignKeyConstraints: false });
  return {
    db: wrap(raw, path),
    cleanup: () => {
      raw.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
