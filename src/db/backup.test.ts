import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { CATALOG } from '../data/catalog.ts';
import { HEITOR_PROGRAM } from '../data/heitor.ts';
import { backupFromPlan, isBackup } from './backup.ts';

test('catálogo sem keys repetidas', () => {
  const keys = CATALOG.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(CATALOG.length >= 100);
});

test('ficha do Heitor vira um backup completo', () => {
  const b = backupFromPlan(HEITOR_PROGRAM, randomUUID, '2026-11-20T00:00:00.000Z');
  assert.ok(isBackup(b));
  assert.equal(b.tables.program.length, 1);
  assert.deepEqual(b.tables.routine.map((r) => r.code), ['A1', 'B', 'A2']);
  assert.equal(b.tables.slot.length, 8 + 6 + 8);
  const supino = b.tables.slot[0];
  assert.equal(supino.initial_load, 10);
  assert.equal(supino.rest_sec, 150);
  assert.equal(supino.sets_max, 4);
  assert.ok(b.tables.slot_substitute.some((s) => s.initial_load === 18));
});
