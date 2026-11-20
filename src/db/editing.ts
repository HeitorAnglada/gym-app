/**
 * Montar e editar pastas, fichas e exercícios da ficha pelo app.
 * Apagar só marca deleted_at (o histórico continua apontando para as linhas).
 * Editar vale daqui pra frente: treinos já feitos guardam o exercício e as séries que tiveram.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_STEP, type Equipment, type MuscleGroup } from '../data/catalog.ts';
import { copyName, NEW_SLOT, nextRoutineCode } from '../domain/editing.ts';
import { defaultRestSeconds } from '../domain/rest.ts';
import { newId, nowIso, transaction } from './index.ts';
import { lastTopLoadSql } from './queries.ts';

type Db = SQLiteDatabase;
const alive = 'deleted_at IS NULL';

// ---------- leitura ----------

export interface RoutineDetail {
  id: string;
  program_id: string;
  program_name: string;
  code: string;
  name: string;
  suggested_weekday: number | null;
}

export interface SlotListRow {
  id: string;
  main_exercise_id: string;
  main_name: string;
  sets_min: number;
  sets_max: number;
  reps_min: number;
  reps_max: number;
  is_priority: number;
  subs: number;
}

export interface SlotDetail {
  id: string;
  routine_id: string;
  routine_code: string;
  sort: number;
  main_exercise_id: string;
  main_name: string;
  main_last_load: number | null;
  sets_min: number;
  sets_max: number;
  reps_min: number;
  reps_max: number;
  rest_sec: number;
  is_priority: number;
  initial_load: number | null;
}

export interface SubstituteRow {
  id: string;
  exercise_id: string;
  name: string;
  initial_load: number | null;
  last_load: number | null;
}

export function getRoutine(db: Db, id: string) {
  return db.getFirstAsync<RoutineDetail>(
    `SELECT r.id, r.program_id, p.name AS program_name, r.code, r.name, r.suggested_weekday
     FROM routine r JOIN program p ON p.id = r.program_id WHERE r.id = ? AND r.${alive}`,
    id,
  );
}

export async function routineCodesInProgram(db: Db, programId: string, exceptRoutineId?: string) {
  const rows = await db.getAllAsync<{ code: string }>(
    `SELECT code FROM routine WHERE program_id = ? AND ${alive} AND id != ?`,
    programId,
    exceptRoutineId ?? '',
  );
  return rows.map((r) => r.code);
}

export function listSlots(db: Db, routineId: string) {
  return db.getAllAsync<SlotListRow>(
    `SELECT s.id, s.main_exercise_id, e.name AS main_name, s.sets_min, s.sets_max, s.reps_min, s.reps_max, s.is_priority,
       (SELECT COUNT(*) FROM slot_substitute ss WHERE ss.slot_id = s.id AND ss.${alive}) AS subs
     FROM slot s JOIN exercise e ON e.id = s.main_exercise_id
     WHERE s.routine_id = ? AND s.${alive} ORDER BY s.sort`,
    routineId,
  );
}

export function getSlot(db: Db, id: string) {
  return db.getFirstAsync<SlotDetail>(
    `SELECT s.*, r.code AS routine_code, e.name AS main_name, ${lastTopLoadSql('s.main_exercise_id')} AS main_last_load
     FROM slot s JOIN routine r ON r.id = s.routine_id JOIN exercise e ON e.id = s.main_exercise_id
     WHERE s.id = ? AND s.${alive}`,
    id,
  );
}

export function listSubstitutes(db: Db, slotId: string) {
  return db.getAllAsync<SubstituteRow>(
    `SELECT ss.id, ss.exercise_id, e.name, ss.initial_load, ${lastTopLoadSql('ss.exercise_id')} AS last_load
     FROM slot_substitute ss JOIN exercise e ON e.id = ss.exercise_id
     WHERE ss.slot_id = ? AND ss.${alive} ORDER BY ss.sort`,
    slotId,
  );
}

/** Exercícios que já estão na ficha (principal ou substituto), para marcar "já na A2" na busca. */
export async function exerciseIdsInRoutine(db: Db, routineId: string) {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT main_exercise_id AS id FROM slot WHERE routine_id = ? AND ${alive}
     UNION SELECT ss.exercise_id FROM slot_substitute ss JOIN slot s ON s.id = ss.slot_id
       WHERE s.routine_id = ? AND s.${alive} AND ss.${alive}`,
    routineId,
    routineId,
  );
  return new Set(rows.map((r) => r.id));
}

// ---------- pastas ----------

async function programNames(db: Db) {
  const rows = await db.getAllAsync<{ name: string }>(`SELECT name FROM program WHERE ${alive}`);
  return rows.map((r) => r.name);
}

/** Cria uma pasta, em branco ou copiando outra. Se nenhuma estiver em uso, a nova entra em uso. */
export async function createProgram(db: Db, name: string, copyFromId: string | null): Promise<string> {
  const id = newId();
  const now = nowIso();
  await transaction(db, async (tx) => {
    const active = await tx.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM program WHERE is_active = 1 AND ${alive}`);
    const sort = await tx.getFirstAsync<{ m: number | null }>(`SELECT MAX(sort) AS m FROM program`);
    await tx.runAsync(
      `INSERT INTO program (id, created_at, updated_at, name, is_active, start_routine_id, sort) VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      id, now, now, name.trim(), active?.n ? 0 : 1, (sort?.m ?? 0) + 1,
    );
    if (copyFromId) {
      const routines = await tx.getAllAsync<{ id: string }>(`SELECT id FROM routine WHERE program_id = ? AND ${alive} ORDER BY sort`, copyFromId);
      for (const [i, r] of routines.entries()) await copyRoutine(tx, r.id, id, null, i, now);
    }
  });
  return id;
}

export async function renameProgram(db: Db, id: string, name: string) {
  await db.runAsync(`UPDATE program SET name = ?, updated_at = ? WHERE id = ?`, name.trim(), nowIso(), id);
}

export async function duplicateProgram(db: Db, id: string): Promise<string> {
  const p = await db.getFirstAsync<{ name: string }>(`SELECT name FROM program WHERE id = ?`, id);
  return createProgram(db, copyName(p?.name ?? 'Pasta', await programNames(db)), id);
}

/** Apaga a pasta e as fichas dela. A pasta em uso não pode ser apagada (a tela não oferece). */
export async function deleteProgram(db: Db, id: string) {
  const now = nowIso();
  await transaction(db, async (tx) => {
    const routines = await tx.getAllAsync<{ id: string }>(`SELECT id FROM routine WHERE program_id = ? AND ${alive}`, id);
    for (const r of routines) await softDeleteRoutine(tx, r.id, now);
    await tx.runAsync(`UPDATE program SET deleted_at = ?, updated_at = ?, is_active = 0 WHERE id = ?`, now, now, id);
  });
}

// ---------- fichas ----------

/** Nova ficha no fim da sequência, já com a próxima letra livre. */
export async function createRoutine(db: Db, programId: string): Promise<string> {
  const id = newId();
  const now = nowIso();
  const code = nextRoutineCode(await routineCodesInProgram(db, programId));
  const sort = await db.getFirstAsync<{ m: number | null }>(`SELECT MAX(sort) AS m FROM routine WHERE program_id = ? AND ${alive}`, programId);
  await db.runAsync(
    `INSERT INTO routine (id, created_at, updated_at, program_id, code, name, suggested_weekday, sort) VALUES (?, ?, ?, ?, ?, '', NULL, ?)`,
    id, now, now, programId, code, (sort?.m ?? -1) + 1,
  );
  return id;
}

export async function updateRoutine(db: Db, id: string, patch: Partial<Pick<RoutineDetail, 'code' | 'name' | 'suggested_weekday'>>) {
  const cols = Object.keys(patch) as (keyof typeof patch)[];
  if (cols.length === 0) return;
  const values = cols.map((c) => (typeof patch[c] === 'string' ? (patch[c] as string).trim() : patch[c] ?? null));
  await db.runAsync(
    `UPDATE routine SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    ...values, nowIso(), id,
  );
}

/** Copia a ficha para o fim da mesma pasta, com a próxima letra livre. */
export async function duplicateRoutine(db: Db, id: string): Promise<string> {
  const r = await db.getFirstAsync<{ program_id: string }>(`SELECT program_id FROM routine WHERE id = ?`, id);
  if (!r) throw new Error('Ficha não encontrada.');
  const code = nextRoutineCode(await routineCodesInProgram(db, r.program_id));
  const sort = await db.getFirstAsync<{ m: number | null }>(`SELECT MAX(sort) AS m FROM routine WHERE program_id = ? AND ${alive}`, r.program_id);
  let newRoutineId = '';
  await transaction(db, async (tx) => {
    newRoutineId = await copyRoutine(tx, id, r.program_id, code, (sort?.m ?? -1) + 1, nowIso());
  });
  return newRoutineId;
}

/** Tira a ficha da sequência. Os treinos feitos com ela continuam no histórico. */
export async function deleteRoutine(db: Db, id: string) {
  const now = nowIso();
  await transaction(db, async (tx) => {
    await softDeleteRoutine(tx, id, now);
    await tx.runAsync(`UPDATE program SET start_routine_id = NULL, updated_at = ? WHERE start_routine_id = ?`, now, id);
  });
}

export async function reorderRoutines(db: Db, orderedIds: string[]) {
  await reorder(db, 'routine', orderedIds);
}

// ---------- exercícios da ficha ----------

/** Põe um exercício no fim da ficha com 3 × 8–12 e o descanso sugerido pela faixa. */
export async function createSlot(db: Db, routineId: string, exerciseId: string): Promise<string> {
  const id = newId();
  const now = nowIso();
  const sort = await db.getFirstAsync<{ m: number | null }>(`SELECT MAX(sort) AS m FROM slot WHERE routine_id = ? AND ${alive}`, routineId);
  await db.runAsync(
    `INSERT INTO slot (id, created_at, updated_at, routine_id, sort, main_exercise_id, sets_min, sets_max, reps_min, reps_max, rest_sec, is_priority, initial_load)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    id, now, now, routineId, (sort?.m ?? -1) + 1, exerciseId,
    NEW_SLOT.setsMin, NEW_SLOT.setsMax, NEW_SLOT.repsMin, NEW_SLOT.repsMax, defaultRestSeconds(NEW_SLOT.repsMax),
  );
  return id;
}

type SlotPatch = Partial<Pick<SlotDetail, 'sets_min' | 'sets_max' | 'reps_min' | 'reps_max' | 'rest_sec' | 'is_priority' | 'initial_load' | 'main_exercise_id'>>;

export async function updateSlot(db: Db, id: string, patch: SlotPatch) {
  const cols = Object.keys(patch) as (keyof SlotPatch)[];
  if (cols.length === 0) return;
  await db.runAsync(
    `UPDATE slot SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    ...cols.map((c) => patch[c] ?? null), nowIso(), id,
  );
}

/** Troca o exercício principal. A carga inicial era do anterior, então zera. */
export async function setSlotMain(db: Db, slotId: string, exerciseId: string) {
  await updateSlot(db, slotId, { main_exercise_id: exerciseId, initial_load: null });
}

export async function deleteSlot(db: Db, id: string) {
  const now = nowIso();
  await transaction(db, async (tx) => {
    await tx.runAsync(`UPDATE slot_substitute SET deleted_at = ?, updated_at = ? WHERE slot_id = ? AND ${alive}`, now, now, id);
    await tx.runAsync(`UPDATE slot SET deleted_at = ?, updated_at = ? WHERE id = ?`, now, now, id);
  });
}

export async function reorderSlots(db: Db, orderedIds: string[]) {
  await reorder(db, 'slot', orderedIds);
}

export async function addSubstitute(db: Db, slotId: string, exerciseId: string) {
  const now = nowIso();
  const sort = await db.getFirstAsync<{ m: number | null }>(`SELECT MAX(sort) AS m FROM slot_substitute WHERE slot_id = ? AND ${alive}`, slotId);
  await db.runAsync(
    `INSERT INTO slot_substitute (id, created_at, updated_at, slot_id, exercise_id, sort, initial_load) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    newId(), now, now, slotId, exerciseId, (sort?.m ?? -1) + 1,
  );
}

export async function setSubstituteInitialLoad(db: Db, id: string, load: number | null) {
  await db.runAsync(`UPDATE slot_substitute SET initial_load = ?, updated_at = ? WHERE id = ?`, load, nowIso(), id);
}

export async function removeSubstitute(db: Db, id: string) {
  const now = nowIso();
  await db.runAsync(`UPDATE slot_substitute SET deleted_at = ?, updated_at = ? WHERE id = ?`, now, now, id);
}

// ---------- catálogo ----------

export async function createExercise(db: Db, name: string, muscle: MuscleGroup, equipment: Equipment): Promise<string> {
  const id = newId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO exercise (id, created_at, updated_at, builtin_key, name, muscle_group, equipment, kind, step_kg) VALUES (?, ?, ?, NULL, ?, ?, ?, 'carga', ?)`,
    id, now, now, name.trim(), muscle, equipment, DEFAULT_STEP[equipment],
  );
  return id;
}

// ---------- internos ----------

async function reorder(db: Db, table: 'routine' | 'slot', orderedIds: string[]) {
  const now = nowIso();
  await transaction(db, async (tx) => {
    for (const [i, id] of orderedIds.entries()) await tx.runAsync(`UPDATE ${table} SET sort = ?, updated_at = ? WHERE id = ?`, i, now, id);
  });
}

async function softDeleteRoutine(tx: Db, routineId: string, now: string) {
  await tx.runAsync(
    `UPDATE slot_substitute SET deleted_at = ?, updated_at = ? WHERE ${alive} AND slot_id IN (SELECT id FROM slot WHERE routine_id = ?)`,
    now, now, routineId,
  );
  await tx.runAsync(`UPDATE slot SET deleted_at = ?, updated_at = ? WHERE routine_id = ? AND ${alive}`, now, now, routineId);
  await tx.runAsync(`UPDATE routine SET deleted_at = ?, updated_at = ? WHERE id = ?`, now, now, routineId);
}

/** Copia uma ficha (com exercícios e substitutos) para `programId`. `code` null mantém a letra. */
async function copyRoutine(tx: Db, routineId: string, programId: string, code: string | null, sort: number, now: string): Promise<string> {
  const r = await tx.getFirstAsync<{ code: string; name: string; suggested_weekday: number | null }>(
    `SELECT code, name, suggested_weekday FROM routine WHERE id = ?`, routineId,
  );
  if (!r) throw new Error('Ficha não encontrada.');
  const rid = newId();
  await tx.runAsync(
    `INSERT INTO routine (id, created_at, updated_at, program_id, code, name, suggested_weekday, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    rid, now, now, programId, code ?? r.code, r.name, r.suggested_weekday, sort,
  );
  const slots = await tx.getAllAsync<Record<string, string | number | null>>(`SELECT * FROM slot WHERE routine_id = ? AND ${alive} ORDER BY sort`, routineId);
  for (const s of slots) {
    const sid = newId();
    await tx.runAsync(
      `INSERT INTO slot (id, created_at, updated_at, routine_id, sort, main_exercise_id, sets_min, sets_max, reps_min, reps_max, rest_sec, is_priority, initial_load)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sid, now, now, rid, s.sort, s.main_exercise_id, s.sets_min, s.sets_max, s.reps_min, s.reps_max, s.rest_sec, s.is_priority, s.initial_load,
    );
    const subs = await tx.getAllAsync<{ exercise_id: string; sort: number; initial_load: number | null }>(
      `SELECT exercise_id, sort, initial_load FROM slot_substitute WHERE slot_id = ? AND ${alive}`, s.id as string,
    );
    for (const sub of subs) {
      await tx.runAsync(
        `INSERT INTO slot_substitute (id, created_at, updated_at, slot_id, exercise_id, sort, initial_load) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        newId(), now, now, sid, sub.exercise_id, sub.sort, sub.initial_load,
      );
    }
  }
  return rid;
}

// ---------- página do exercício ----------

export interface ExerciseDetail {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  step_kg: number;
  builtin_key: string | null;
}

export function getExercise(db: Db, id: string) {
  return db.getFirstAsync<ExerciseDetail>(`SELECT id, name, muscle_group, equipment, step_kg, builtin_key FROM exercise WHERE id = ?`, id);
}

export async function updateExercise(db: Db, id: string, patch: { name: string; muscle_group: MuscleGroup; step_kg: number }) {
  await db.runAsync(
    `UPDATE exercise SET name = ?, muscle_group = ?, step_kg = ?, updated_at = ? WHERE id = ?`,
    patch.name.trim(), patch.muscle_group, patch.step_kg, nowIso(), id,
  );
}

/** Onde o exercício aparece na pasta em uso: como principal (com o descanso recomendado) ou substituto. */
export function exerciseUsage(db: Db, exerciseId: string) {
  return db.getAllAsync<{ slot_id: string; code: string; rest_sec: number; as_main: number }>(
    `SELECT s.id AS slot_id, r.code, s.rest_sec, CASE WHEN s.main_exercise_id = ? THEN 1 ELSE 0 END AS as_main
     FROM slot s JOIN routine r ON r.id = s.routine_id JOIN program p ON p.id = r.program_id
     WHERE p.is_active = 1 AND p.${alive} AND r.${alive} AND s.${alive}
       AND (s.main_exercise_id = ? OR EXISTS (SELECT 1 FROM slot_substitute ss WHERE ss.slot_id = s.id AND ss.exercise_id = ? AND ss.${alive}))
     ORDER BY r.sort, s.sort`,
    exerciseId, exerciseId, exerciseId,
  );
}

/** "ajustar": muda o descanso recomendado das posições da ficha que usam o exercício. */
export async function setRestForSlots(db: Db, slotIds: string[], seconds: number) {
  const now = nowIso();
  for (const id of slotIds) await db.runAsync(`UPDATE slot SET rest_sec = ?, updated_at = ? WHERE id = ?`, seconds, now, id);
}
