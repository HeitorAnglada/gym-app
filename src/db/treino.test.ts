/**
 * Treinos inteiros rodando nas consultas de verdade (SQLite do Node, ver src/test/sqlite.ts):
 * importar a ficha, começar, séries, descansos, pular, extra, finalizar, histórico e progressão.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';

import type { SQLiteDatabase } from 'expo-sqlite';

import { HEITOR_PROGRAM } from '../data/heitor.ts';
import { openTestDatabase } from '../test/sqlite.ts';
import { backupFromPlan } from './backup.ts';
import { createProgram, createRoutine, createSlot, deleteRoutine, duplicateRoutine, getSlot, listSlots, reorderSlots, updateSlot } from './editing.ts';
import { exportBackup, importBackup, initDatabase } from './index.ts';
import { MIGRATIONS, SCHEMA_VERSION } from './schema.ts';
import { activateProgram, getNextRoutine, listExercises, listPrograms, listRoutines, listWorkouts } from './queries.ts';
import {
  addSet, changeRest, currentExercise, endSet, goToExercise, moveOn, nextValues, removeSet, setNext, startSet, toggleSkip,
} from './treino.ts';
import {
  addExtra, autoFinishStale, deleteSet, exerciseOutlook, exerciseSessions, finishWorkout, getOpenWorkout, loadWorkout, startWorkout,
  swapExercise, type WorkoutData,
} from './workout.ts';

const T0 = new Date('2026-11-23T10:00:00.000Z').getTime(); // segunda
let db: SQLiteDatabase;
let cleanup: () => void;

const tick = (sec: number) => mock.timers.tick(sec * 1000);

async function load(id: string): Promise<WorkoutData> {
  const d = await loadWorkout(db, id);
  assert.ok(d, 'treino existe');
  return d;
}

async function routineId(code: string) {
  const r = await db.getFirstAsync<{ id: string }>(`SELECT id FROM routine WHERE code = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1`, code);
  assert.ok(r, `ficha ${code}`);
  return r.id;
}

async function exerciseId(key: string) {
  const r = await db.getFirstAsync<{ id: string }>(`SELECT id FROM exercise WHERE builtin_key = ?`, key);
  assert.ok(r, key);
  return r.id;
}

/** Uma série como a tela faz: (ajusta os −/+), "Iniciar série", espera, "Iniciar descanso", descansa. */
async function doSet(wid: string, o: { load?: number; reps?: number; setSec?: number; restSec?: number } = {}) {
  let d = await load(wid);
  const cur = currentExercise(d);
  assert.ok(cur, 'tem exercício na tela');
  if (o.load != null || o.reps != null) {
    const v = nextValues(cur);
    await setNext(db, cur, o.load ?? v.load, o.reps ?? v.reps);
    d = await load(wid);
  }
  assert.equal(await startSet(db, d), true);
  tick(o.setSec ?? 40);
  const rest = await endSet(db, await load(wid));
  tick(o.restSec ?? 90);
  return rest;
}

/** Faz todas as séries mínimas do exercício da tela com a mesma carga/reps. */
async function doExercise(wid: string, sets: number, o: { load?: number; reps?: number } = {}) {
  for (let i = 0; i < sets; i++) await doSet(wid, o);
}

beforeEach(async () => {
  mock.timers.enable({ apis: ['Date'], now: T0 });
  ({ db, cleanup } = openTestDatabase());
  await initDatabase(db);
  await importBackup(db, backupFromPlan(HEITOR_PROGRAM, randomUUID, '2026-11-20T00:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  mock.timers.reset();
});

describe('banco novo e backup', () => {
  test('migrações e catálogo no primeiro uso, sem duplicar ao abrir de novo', async () => {
    const { db: fresh, cleanup: done } = openTestDatabase();
    try {
      await initDatabase(fresh);
      await initDatabase(fresh);
      assert.equal((await fresh.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, SCHEMA_VERSION);
      assert.equal((await fresh.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exercise'))?.n, 108);
    } finally {
      done();
    }
  });

  test('a ficha do Heitor entra em uso e o próximo é o A1', async () => {
    const programs = await listPrograms(db);
    assert.equal(programs.length, 1);
    assert.equal(programs[0].routine_codes, 'A1 → B → A2');
    const next = await getNextRoutine(db);
    assert.equal(next?.routine?.code, 'A1');
    assert.equal(next?.routine?.slots, 8);
  });

  test('backup exportado volta igual, com o histórico', async () => {
    const wid = await startWorkout(db, await routineId('A1'), false);
    await doExercise(wid, 3, { reps: 8 });
    await finishWorkout(db, wid);
    const backup = await exportBackup(db);

    const other = openTestDatabase();
    try {
      await initDatabase(other.db);
      await importBackup(other.db, JSON.parse(JSON.stringify(backup)));
      const again = await exportBackup(other.db);
      for (const t of Object.keys(backup.tables) as (keyof typeof backup.tables)[]) {
        assert.deepEqual(again.tables[t], backup.tables[t], `tabela ${t}`);
      }
      assert.equal((await getNextRoutine(other.db))?.routine?.code, 'B');
    } finally {
      other.cleanup();
    }
  });

  test('backup de versão antiga (esquema 2) importa e o histórico abre', async () => {
    const wid = await startWorkout(db, await routineId('A1'), false);
    await doExercise(wid, 3);
    await finishWorkout(db, wid);
    const backup = await exportBackup(db);
    backup.schemaVersion = 2;
    const v3workout = ['current_we_id', 'phase', 'phase_started_at', 'rest_target_sec', 'last_activity_at'];
    const v3we = ['sets_adjust', 'next_load', 'next_reps', 'initial_load'];
    backup.tables.workout = backup.tables.workout.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !v3workout.includes(k))));
    backup.tables.workout_exercise = backup.tables.workout_exercise.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !v3we.includes(k))));
    await importBackup(db, backup);
    const d = await load(wid);
    assert.equal(d.workout.status, 'finalizado');
    assert.equal(d.exercises[0].sets.length, 3);
    assert.equal(d.exercises[0].sets_adjust, 0);
  });

  test('séries viram um número só: backup antigo com faixa "3 a 4" entra como 4', async () => {
    const backup = await exportBackup(db);
    backup.schemaVersion = 3;
    backup.tables.slot = backup.tables.slot.map((r) => (r.sets_max === 4 ? { ...r, sets_min: 3 } : r));
    assert.ok(backup.tables.slot.some((r) => r.sets_min !== r.sets_max));
    await importBackup(db, backup);
    const ranges = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM slot WHERE sets_min <> sets_max');
    assert.equal(ranges?.n, 0);
    const supino = await db.getFirstAsync<{ sets_min: number; sets_max: number }>(
      `SELECT s.sets_min, s.sets_max FROM slot s JOIN exercise e ON e.id = s.main_exercise_id WHERE e.builtin_key = 'supino-reto-barra'`,
    );
    assert.deepEqual([supino?.sets_min, supino?.sets_max], [4, 4]);
  });

  test('migração 4 junta a faixa de séries de quem já tinha o app', async () => {
    const { db: old, cleanup: done } = openTestDatabase();
    try {
      for (const sql of MIGRATIONS.slice(0, 3)) await old.execAsync(sql);
      await old.execAsync('PRAGMA user_version = 3');
      const now = '2026-11-20T00:00:00.000Z';
      await old.runAsync(`INSERT INTO exercise (id, created_at, updated_at, name, muscle_group, equipment, step_kg) VALUES ('e', ?, ?, 'X', 'peito', 'barra', 2.5)`, now, now);
      await old.runAsync(`INSERT INTO program (id, created_at, updated_at, name, is_active, sort) VALUES ('p', ?, ?, 'P', 1, 0)`, now, now);
      await old.runAsync(`INSERT INTO routine (id, created_at, updated_at, program_id, code, name, sort) VALUES ('r', ?, ?, 'p', 'A', '', 0)`, now, now);
      await old.runAsync(
        `INSERT INTO slot (id, created_at, updated_at, routine_id, sort, main_exercise_id, sets_min, sets_max, reps_min, reps_max, rest_sec, is_priority)
         VALUES ('s', ?, ?, 'r', 0, 'e', 3, 4, 8, 12, 90, 0)`, now, now,
      );
      await initDatabase(old);
      const s = await old.getFirstAsync<{ sets_min: number; sets_max: number; updated_at: string }>(`SELECT sets_min, sets_max, updated_at FROM slot WHERE id = 's'`);
      assert.deepEqual([s?.sets_min, s?.sets_max], [4, 4]);
      assert.notEqual(s?.updated_at, now);
    } finally {
      done();
    }
  });

  test('recusa arquivo que não é backup e backup de versão mais nova', async () => {
    await assert.rejects(importBackup(db, { hello: 1 }), /não é um backup/);
    await assert.rejects(importBackup(db, { format: 'kargo-backup', schemaVersion: 1, tables: null }), /não é um backup/);
    await assert.rejects(importBackup(db, { format: 'kargo-backup', schemaVersion: 99, tables: {} }), /versão mais nova/);
    assert.equal((await listPrograms(db)).length, 1, 'nada mudou');
  });
});

describe('treino do começo ao fim', () => {
  test('A1: séries, descansos, opcional, pular, extra e finalizar', async () => {
    const a1 = await routineId('A1');
    const wid = await startWorkout(db, a1, false);
    let d = await load(wid);
    assert.equal(d.exercises.length, 8);
    assert.equal(d.workout.phase, 'pronto');
    const supino = currentExercise(d)!;
    assert.equal(supino.name, 'Supino reto com barra');
    assert.deepEqual(nextValues(supino), { load: 10, reps: 6 }, 'carga inicial da ficha e o mínimo de reps');

    // 1ª série: descanso começa no próprio supino (faixa 3–4 séries)
    const rest1 = await doSet(wid, { reps: 8, restSec: 0 });
    assert.deepEqual(rest1, { seconds: 150, nextName: 'Supino reto com barra' });
    d = await load(wid);
    assert.equal(d.workout.phase, 'descanso');
    assert.equal(d.workout.rest_target_sec, 150);
    assert.equal(currentExercise(d)?.id, supino.id);
    tick(130);

    // 2ª e 3ª: o descanso entre séries fica gravado
    await doSet(wid, { restSec: 120 });
    await doSet(wid, { restSec: 5 });
    d = await load(wid);
    const sets = d.exercises[0].sets;
    assert.deepEqual(sets.map((x) => x.idx), [0, 1, 2]);
    // a carga segue a de hoje; as reps vêm do último treino (sem histórico: o mínimo da faixa)
    assert.deepEqual(sets.map((x) => [x.load, x.reps]), [[10, 8], [10, 6], [10, 6]]);
    assert.equal(sets[0].rest_sec, null);
    assert.equal(sets[1].rest_sec, 130);
    assert.equal(sets[2].rest_sec, 120);
    assert.ok(sets.every((x) => x.rest_approx === 0));
    // 3 de 3–4: opcional, continua no supino até pedir o próximo
    assert.equal(d.exercises[0].status, 'pendente');
    assert.equal(currentExercise(d)?.id, supino.id);
    assert.equal(await moveOn(db, d), true);
    d = await load(wid);
    assert.equal(d.exercises[0].status, 'feito');
    assert.equal(d.workout.phase, 'descanso', 'o descanso continua contando');
    assert.equal(currentExercise(d)?.name, 'Remada curvada com barra');

    // remada: 4 séries (máximo) fecham sozinhas e vão para o desenvolvimento
    await doExercise(wid, 4, { reps: 10 });
    d = await load(wid);
    assert.equal(d.exercises[1].status, 'feito');
    assert.equal(d.exercises[1].sets.length, 4);
    assert.equal(currentExercise(d)?.name, 'Desenvolvimento com halteres');

    // "já fiz a série sem iniciar": descanso aproximado, sem início da série
    d = await load(wid);
    assert.equal(d.workout.phase, 'descanso');
    await setNext(db, currentExercise(d)!, 14, 10);
    tick(60);
    await endSet(db, await load(wid), true);
    d = await load(wid);
    const dev = d.exercises[2];
    assert.equal(dev.sets.length, 1);
    assert.equal(dev.sets[0].set_started_at, null);
    assert.equal(dev.sets[0].rest_approx, 1);
    assert.deepEqual([dev.sets[0].load, dev.sets[0].reps], [14, 10]);

    // pular o da tela passa ao próximo; tocar nele de novo traz de volta
    await moveOn(db, d); // desenvolvimento com 1 série: fica "feito" (tem série)
    d = await load(wid);
    const paralelas = currentExercise(d)!;
    assert.equal(paralelas.name, 'Paralelas / Dips');
    await toggleSkip(db, d, paralelas.id);
    d = await load(wid);
    assert.equal(d.exercises[3].status, 'pulado');
    assert.equal(currentExercise(d)?.name, 'Puxada alta aberta na polia');
    assert.equal(await goToExercise(db, d, paralelas.id), true);
    d = await load(wid);
    assert.equal(d.exercises[3].status, 'pendente');
    assert.equal(currentExercise(d)?.id, paralelas.id);
    await toggleSkip(db, d, paralelas.id);

    // extra no meio da série: a série continua no exercício dela
    d = await load(wid);
    await startSet(db, d);
    const extraId = await addExtra(db, wid, await exerciseId('face-pull'));
    d = await load(wid);
    assert.equal(currentExercise(d)?.name, 'Puxada alta aberta na polia');
    assert.equal(d.exercises.at(-1)?.id, extraId);
    await endSet(db, d);
    d = await load(wid);
    assert.equal(d.exercises[4].sets.length, 1);
    // fora da série, o extra vira o da tela
    const extra2 = await addExtra(db, wid, await exerciseId('encolhimento-halteres'));
    d = await load(wid);
    assert.equal(currentExercise(d)?.id, extra2);

    // finalizar: com série → feito; sem série → pulado
    tick(600);
    await finishWorkout(db, wid);
    d = await load(wid);
    assert.equal(d.workout.status, 'finalizado');
    const status = Object.fromEntries(d.exercises.map((e) => [e.name, e.status]));
    assert.equal(status['Supino reto com barra'], 'feito');
    assert.equal(status['Desenvolvimento com halteres'], 'feito');
    assert.equal(status['Paralelas / Dips'], 'pulado');
    assert.equal(status['Rosca martelo com halteres'], 'pulado');
    assert.equal(status['Encolhimento com halteres'], 'pulado');
    assert.equal(await getOpenWorkout(db), null);

    // histórico e sequência
    const hist = await listWorkouts(db, new Date(T0 - 86400000).toISOString(), new Date(T0 + 86400000).toISOString());
    assert.equal(hist.length, 1);
    assert.equal(hist[0].code, 'A1');
    assert.equal(hist[0].sets, 3 + 4 + 1 + 1);
    assert.equal((await getNextRoutine(db))?.routine?.code, 'B');
  });

  test('toque duplo em "Iniciar descanso" grava uma série só', async () => {
    const wid = await startWorkout(db, await routineId('B'), false);
    await startSet(db, await load(wid));
    tick(30);
    const stale = await load(wid);
    const first = await endSet(db, stale);
    const second = await endSet(db, stale);
    assert.ok(first);
    assert.equal(second, null);
    assert.equal((await load(wid)).exercises[0].sets.length, 1);
    // e o "registrar sem iniciar" repetido também não duplica
    const resting = await load(wid);
    await endSet(db, resting, true);
    await endSet(db, resting, true);
    assert.equal((await load(wid)).exercises[0].sets.length, 2);
  });

  test('"Começar" com um treino já aberto devolve o aberto', async () => {
    const x = await startWorkout(db, await routineId('A1'), false);
    const y = await startWorkout(db, await routineId('B'), false);
    assert.equal(x, y);
    assert.equal((await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM workout WHERE status = 'aberto'`))?.n, 1);
  });

  test('séries a mais/a menos e "ir para o próximo" com o exercício completo', async () => {
    const wid = await startWorkout(db, await routineId('A1'), false);
    let d = await load(wid);
    const supino = currentExercise(d)!;
    await doExercise(wid, 2);
    // 3–4 com 2 feitas: tira até ficar 1–2; daí não tira série já feita
    assert.equal(await removeSet(db, (await load(wid)).exercises[0]), true);
    assert.equal(await removeSet(db, (await load(wid)).exercises[0]), true);
    assert.equal(await removeSet(db, (await load(wid)).exercises[0]), false, 'não tira série já feita');
    d = await load(wid);
    assert.equal(d.exercises[0].sets_adjust, -2);
    // 2 de 1–2: completo, mas ainda na tela até "ir para o próximo"
    assert.equal(d.exercises[0].status, 'pendente');
    assert.equal(currentExercise(d)?.id, supino.id);
    await moveOn(db, d);
    d = await load(wid);
    assert.equal(d.exercises[0].status, 'feito');
    assert.equal(currentExercise(d)?.name, 'Remada curvada com barra');
    // voltar ao supino e pôr mais uma série
    await goToExercise(db, d, supino.id);
    d = await load(wid);
    assert.equal(d.exercises[0].status, 'pendente');
    await addSet(db, d.exercises[0]);
    await doSet(wid);
    d = await load(wid);
    assert.equal(d.exercises[0].status, 'feito', '3 de 2–3: completo');
    assert.equal(d.exercises[0].sets.length, 3);
  });

  test('mudar o descanso no meio do descanso muda o alvo que está correndo', async () => {
    const wid = await startWorkout(db, await routineId('A1'), false);
    await doSet(wid, { restSec: 30 });
    const d = await load(wid);
    const left = await changeRest(db, d, currentExercise(d)!, 180);
    assert.equal(left, 150);
    const after = await load(wid);
    assert.equal(after.workout.rest_target_sec, 180);
    assert.equal(after.exercises[0].rest_sec, 180);
  });

  test('trocar pelo substituto usa a carga e o histórico dele', async () => {
    const wid = await startWorkout(db, await routineId('A1'), false);
    const d = await load(wid);
    await swapExercise(db, currentExercise(d)!, await exerciseId('supino-reto-halteres'), 18);
    const after = await load(wid);
    const cur = currentExercise(after)!;
    assert.equal(cur.name, 'Supino reto com halteres');
    assert.deepEqual(nextValues(cur), { load: 18, reps: 6 });
    assert.equal(cur.step_kg, 2);
  });

  test('apagar série renumera as seguintes e reabre o exercício', async () => {
    const wid = await startWorkout(db, await routineId('A2'), false);
    await doExercise(wid, 3, { reps: 7 }); // barra fixa 3–4: 3 é opcional
    let d = await load(wid);
    await moveOn(db, d);
    d = await load(wid);
    assert.equal(d.exercises[0].status, 'feito');
    await deleteSet(db, d.exercises[0].sets[1].id);
    d = await load(wid);
    assert.deepEqual(d.exercises[0].sets.map((x) => x.idx), [0, 1]);
    assert.equal(d.exercises[0].status, 'pendente', 'ficou abaixo do mínimo');
    // a próxima série entra como a 3ª, sem índice repetido
    await goToExercise(db, d, d.exercises[0].id);
    await doSet(wid);
    d = await load(wid);
    assert.deepEqual(d.exercises[0].sets.map((x) => x.idx), [0, 1, 2]);

    // no histórico, apagar todas as séries deixa o exercício como pulado
    await finishWorkout(db, wid);
    d = await load(wid);
    for (const x of d.exercises[0].sets) await deleteSet(db, x.id);
    d = await load(wid);
    assert.equal(d.exercises[0].status, 'pulado');
  });

  test('treino parado há mais de 3 h finaliza na hora da última série; sem série, some', async () => {
    const wid = await startWorkout(db, await routineId('A1'), false);
    await doSet(wid, { restSec: 0 });
    const lastSetEnd = (await load(wid)).exercises[0].sets[0].set_ended_at;
    tick(2 * 3600);
    assert.equal(await autoFinishStale(db), false);
    tick(1.5 * 3600);
    assert.equal(await autoFinishStale(db), true);
    const d = await load(wid);
    assert.equal(d.workout.status, 'finalizado');
    assert.equal(d.workout.ended_at, lastSetEnd);

    const empty = await startWorkout(db, await routineId('B'), false);
    tick(4 * 3600);
    assert.equal(await autoFinishStale(db, 3), true);
    assert.equal(await loadWorkout(db, empty), null);
    assert.equal(await autoFinishStale(db, 0), false, '"nunca" desliga');
  });

  test('só prioridades leva só os exercícios com ⭐', async () => {
    const b = await routineId('B');
    const slots = await listSlots(db, b);
    await updateSlot(db, slots[0].id, { is_priority: 1 });
    await updateSlot(db, slots[4].id, { is_priority: 1 });
    const wid = await startWorkout(db, b, true);
    const d = await load(wid);
    assert.deepEqual(d.exercises.map((e) => e.name), ['Agachamento livre com barra', 'Panturrilha no leg press']);
    assert.ok(d.exercises.every((e) => e.is_priority === 1));
  });
});

describe('progressão entre treinos', () => {
  async function session(code: string, reps: number[], o: { load?: number; exercise?: number } = {}) {
    const wid = await startWorkout(db, await routineId(code), false);
    let d = await load(wid);
    if (o.exercise) await goToExercise(db, d, d.exercises[o.exercise].id);
    for (const r of reps) await doSet(wid, { reps: r, load: o.load });
    d = await load(wid);
    await finishWorkout(db, wid);
    tick(2 * 86400);
    return wid;
  }

  test('bateu o topo em tudo: sobe um passo a partir da carga dele (42,5 → 47,5)', async () => {
    // cadeira extensora (B, 3 × 10–12, máquina, passo 5) com 42,5 kg da ficha
    await session('B', [12, 12, 12], { exercise: 2 });
    const wid = await startWorkout(db, await routineId('B'), false);
    const ext = (await load(wid)).exercises[2];
    assert.equal(ext.name, 'Cadeira extensora');
    assert.deepEqual(nextValues(ext), { load: 47.5, reps: 10 });
    const o = await exerciseOutlook(db, ext.exercise_id, { setsMin: 3, setsMax: 3, repsMin: 10, repsMax: 12 }, ext.step_kg, ext.initial_load, wid);
    assert.equal(o.prefill.increased, true);
    assert.equal(o.timesDone, 1);
  });

  test('não bateu: repete série a série; 3 treinos sem progresso avisam', async () => {
    for (let i = 0; i < 4; i++) await session('A1', [8, 7, 6]);
    const wid = await startWorkout(db, await routineId('A1'), false);
    const supino = (await load(wid)).exercises[0];
    const o = await exerciseOutlook(db, supino.exercise_id, { setsMin: 3, setsMax: 4, repsMin: 6, repsMax: 8 }, supino.step_kg, supino.initial_load, wid);
    assert.deepEqual(o.prefill.sets.map((x) => x.reps), [8, 7, 6]);
    assert.equal(o.prefill.increased, false);
    assert.equal(o.stalled, true);
    assert.equal(o.last?.sets.length, 3);
  });

  test('"último" da carga ignora o treino em que o exercício foi pulado', async () => {
    await session('A1', [8, 8, 8], { load: 12.5 });
    // próximo A1: supino pulado
    const wid = await startWorkout(db, await routineId('A1'), false);
    const d = await load(wid);
    await toggleSkip(db, d, d.exercises[0].id);
    await doSet(wid);
    await finishWorkout(db, wid);
    const supinoId = await exerciseId('supino-reto-barra');
    const row = (await listExercises(db)).find((e) => e.id === supinoId);
    assert.equal(row?.last_top_load, 12.5);
    assert.equal(row?.times_done, 1);
    const slot = await getSlot(db, (await listSlots(db, await routineId('A1')))[0].id);
    assert.equal(slot?.main_last_load, 12.5);
    assert.equal((await exerciseSessions(db, supinoId)).length, 1);
  });
});

describe('pastas e sequência', () => {
  test('a ficha escolhida ao usar a pasta vem primeiro, mesmo com histórico', async () => {
    const heitor = (await listPrograms(db))[0];
    const a1 = await routineId('A1');
    let wid = await startWorkout(db, a1, false);
    await doSet(wid);
    await finishWorkout(db, wid);
    assert.equal((await getNextRoutine(db))?.routine?.code, 'B');

    // outra pasta em uso, depois volta para a do Heitor começando pela A2
    const other = await createProgram(db, 'Outra', null);
    await activateProgram(db, other, null);
    assert.equal((await getNextRoutine(db))?.program.name, 'Outra');
    const a2 = await routineId('A2');
    await activateProgram(db, heitor.id, a2);
    assert.equal((await getNextRoutine(db))?.routine?.code, 'A2');

    // depois de fazer a A2, a sequência segue dali (A1), e a escolha some
    wid = await startWorkout(db, a2, false);
    await doSet(wid);
    await finishWorkout(db, wid);
    assert.equal((await getNextRoutine(db))?.routine?.code, 'A1');
    assert.equal((await listPrograms(db)).find((p) => p.id === heitor.id)?.start_routine_id, null);
  });

  test('montar uma pasta pelo app', async () => {
    const pid = await createProgram(db, '  Full body  ', null);
    const programs = await listPrograms(db);
    const p = programs.find((x) => x.id === pid);
    assert.equal(p?.name, 'Full body');
    assert.equal(p?.is_active, 0, 'já existe uma pasta em uso');
    const r1 = await createRoutine(db, pid);
    const s1 = await createSlot(db, r1, await exerciseId('leg-press-45'));
    const s2 = await createSlot(db, r1, await exerciseId('supino-maquina'));
    const slot = await getSlot(db, s1);
    assert.deepEqual([slot?.sets_min, slot?.sets_max, slot?.reps_min, slot?.reps_max, slot?.rest_sec], [3, 3, 8, 12, 90]);
    await reorderSlots(db, [s2, s1]);
    assert.deepEqual((await listSlots(db, r1)).map((x) => x.id), [s2, s1]);
    const r2 = await duplicateRoutine(db, r1);
    const routines = await listRoutines(db, pid);
    assert.deepEqual(routines.map((r) => r.code), ['A', 'B']);
    assert.equal(routines[1].id, r2);
    assert.equal(routines[1].slots, 2);
    await activateProgram(db, pid, r2);
    assert.equal((await getNextRoutine(db))?.routine?.code, 'B');
    await deleteRoutine(db, r2);
    assert.equal((await getNextRoutine(db))?.routine?.code, 'A', 'apagar a escolhida volta para a primeira');
  });
});
