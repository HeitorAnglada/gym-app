/**
 * Treino em andamento e histórico. Tudo é salvo a cada toque: se o app fechar,
 * o Início mostra "Continuar" e o treino volta de onde parou.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { isStalled, prefillNext, type Prefill } from '../domain/progression.ts';
import { defaultRestSeconds } from '../domain/rest.ts';
import type { ExerciseStatus } from '../domain/session.ts';
import type { ExerciseSession, SetResult, SlotTarget } from '../domain/types.ts';
import { AUTO_FINISH_HOURS } from '../domain/workoutRules.ts';
import { newId, nowIso, transaction } from './index.ts';

type Db = SQLiteDatabase;
const alive = 'deleted_at IS NULL';

export type Phase = 'pronto' | 'serie' | 'descanso' | 'fim';

export interface WorkoutRow {
  id: string;
  program_id: string | null;
  routine_id: string | null;
  routine_code: string | null;
  routine_name: string | null;
  started_at: string;
  ended_at: string | null;
  status: 'aberto' | 'finalizado';
  priority_only: number;
  note: string | null;
  current_we_id: string | null;
  phase: Phase;
  phase_started_at: string | null;
  rest_target_sec: number | null;
  last_activity_at: string | null;
}

export interface SetRow {
  id: string;
  workout_exercise_id: string;
  idx: number;
  load: number;
  reps: number;
  set_started_at: string | null;
  set_ended_at: string | null;
  rest_sec: number | null;
  rest_approx: number;
}

export interface WorkoutExerciseRow {
  id: string;
  workout_id: string;
  slot_id: string | null;
  exercise_id: string;
  name: string;
  step_kg: number;
  muscle_group: string;
  builtin_key: string | null;
  sort: number;
  status: ExerciseStatus;
  note: string | null;
  sets_min: number;
  sets_max: number;
  reps_min: number;
  reps_max: number;
  rest_sec: number;
  sets_adjust: number;
  next_load: number | null;
  next_reps: number | null;
  initial_load: number | null;
  is_priority: number;
  main_exercise_id: string | null;
  sets: SetRow[];
}

export interface WorkoutData {
  workout: WorkoutRow;
  exercises: WorkoutExerciseRow[];
}

/** Um treino passado de um exercício, para histórico, gráfico e progressão. */
export interface PastSession extends ExerciseSession {
  workoutId: string;
  code: string | null;
  rests: { seconds: number; approximate: boolean }[];
}

// ---------- leitura ----------

const workoutSelect = `
  SELECT w.id, w.program_id, w.routine_id, r.code AS routine_code, r.name AS routine_name, w.started_at, w.ended_at, w.status,
    w.priority_only, w.note, w.current_we_id, w.phase, w.phase_started_at, w.rest_target_sec, w.last_activity_at
  FROM workout w LEFT JOIN routine r ON r.id = w.routine_id`;

export function getOpenWorkout(db: Db) {
  return db.getFirstAsync<WorkoutRow>(`${workoutSelect} WHERE w.status = 'aberto' AND w.${alive} ORDER BY w.started_at DESC LIMIT 1`);
}

export async function loadWorkout(db: Db, id: string): Promise<WorkoutData | null> {
  const workout = await db.getFirstAsync<WorkoutRow>(`${workoutSelect} WHERE w.id = ? AND w.${alive}`, id);
  if (!workout) return null;
  const exercises = await db.getAllAsync<Omit<WorkoutExerciseRow, 'sets'>>(
    `SELECT we.id, we.workout_id, we.slot_id, we.exercise_id, e.name, e.step_kg, e.muscle_group, e.builtin_key, we.sort, we.status, we.note,
       COALESCE(we.sets_min, 3) AS sets_min, COALESCE(we.sets_max, 3) AS sets_max,
       COALESCE(we.reps_min, 8) AS reps_min, COALESCE(we.reps_max, 12) AS reps_max,
       COALESCE(we.rest_sec, 90) AS rest_sec, we.sets_adjust, we.next_load, we.next_reps, we.initial_load,
       COALESCE(s.is_priority, 0) AS is_priority, s.main_exercise_id
     FROM workout_exercise we JOIN exercise e ON e.id = we.exercise_id LEFT JOIN slot s ON s.id = we.slot_id
     WHERE we.workout_id = ? AND we.${alive} ORDER BY we.sort`,
    id,
  );
  const sets = await db.getAllAsync<SetRow>(
    `SELECT sl.* FROM set_log sl JOIN workout_exercise we ON we.id = sl.workout_exercise_id
     WHERE we.workout_id = ? AND sl.${alive} ORDER BY sl.idx`,
    id,
  );
  return {
    workout,
    exercises: exercises.map((e) => ({ ...e, sets: sets.filter((s) => s.workout_exercise_id === e.id) })),
  };
}

/** Treinos finalizados de um exercício, do mais recente ao mais antigo. */
export async function exerciseSessions(db: Db, exerciseId: string, opts: { limit?: number; excludeWorkoutId?: string; beforeIso?: string } = {}): Promise<PastSession[]> {
  const rows = await db.getAllAsync<{ wid: string; code: string | null; started_at: string; ended_at: string | null; load: number; reps: number; rest_sec: number | null; rest_approx: number }>(
    `SELECT w.id AS wid, r.code, w.started_at, w.ended_at, sl.load, sl.reps, sl.rest_sec, sl.rest_approx
     FROM set_log sl
       JOIN workout_exercise we ON we.id = sl.workout_exercise_id
       JOIN workout w ON w.id = we.workout_id
       LEFT JOIN routine r ON r.id = w.routine_id
     WHERE we.exercise_id = ? AND w.status = 'finalizado' AND w.${alive} AND we.${alive} AND sl.${alive} AND w.id != ? AND w.started_at < ?
     ORDER BY w.started_at DESC, we.sort, sl.idx`,
    exerciseId,
    opts.excludeWorkoutId ?? '',
    opts.beforeIso ?? '9999',
  );
  const out: PastSession[] = [];
  for (const r of rows) {
    let cur = out[out.length - 1];
    if (!cur || cur.workoutId !== r.wid) {
      if (opts.limit && out.length >= opts.limit) break;
      cur = { workoutId: r.wid, code: r.code, date: r.ended_at ?? r.started_at, sets: [], rests: [] };
      out.push(cur);
    }
    cur.sets.push({ load: r.load, reps: r.reps });
    if (r.rest_sec != null) cur.rests.push({ seconds: r.rest_sec, approximate: !!r.rest_approx });
  }
  return out;
}

export interface ExerciseOutlook {
  prefill: Prefill;
  last: PastSession | null;
  stalled: boolean;
  timesDone: number;
}

/** O que o app sabe deste exercício antes da série: último treino, pré-preenchido, estagnação. */
export async function exerciseOutlook(db: Db, exerciseId: string, target: SlotTarget, step: number, initialLoad: number | null, excludeWorkoutId?: string): Promise<ExerciseOutlook> {
  const sessions = await exerciseSessions(db, exerciseId, { excludeWorkoutId });
  const last = sessions[0] ?? null;
  return { prefill: prefillNext(last, target, step, initialLoad), last, stalled: isStalled(sessions), timesDone: sessions.length };
}

// ---------- começar ----------

/**
 * Começa o treino da ficha. No modo "só prioridades" entram só os exercícios com ⭐.
 * Se já existe um treino aberto (ex.: dois toques rápidos em "Começar"), devolve ele em vez de abrir outro.
 */
export async function startWorkout(db: Db, routineId: string, priorityOnly: boolean): Promise<string> {
  const open = await getOpenWorkout(db);
  if (open) return open.id;
  const routine = await db.getFirstAsync<{ program_id: string }>(`SELECT program_id FROM routine WHERE id = ?`, routineId);
  const slots = await db.getAllAsync<{ id: string; main_exercise_id: string; sets_min: number; sets_max: number; reps_min: number; reps_max: number; rest_sec: number; is_priority: number; initial_load: number | null; step_kg: number }>(
    `SELECT s.id, s.main_exercise_id, s.sets_min, s.sets_max, s.reps_min, s.reps_max, s.rest_sec, s.is_priority, s.initial_load, e.step_kg
     FROM slot s JOIN exercise e ON e.id = s.main_exercise_id
     WHERE s.routine_id = ? AND s.${alive} ORDER BY s.sort`,
    routineId,
  );
  const chosen = priorityOnly ? slots.filter((s) => s.is_priority) : slots;
  const wid = newId();
  const now = nowIso();
  const rows: { id: string; s: (typeof chosen)[number]; sort: number; first: SetResult | undefined }[] = [];
  for (const [i, s] of chosen.entries()) {
    const target = { setsMin: s.sets_min, setsMax: s.sets_max, repsMin: s.reps_min, repsMax: s.reps_max };
    const o = await exerciseOutlook(db, s.main_exercise_id, target, s.step_kg, s.initial_load);
    rows.push({ id: newId(), s, sort: i, first: o.prefill.sets[0] });
  }
  await transaction(db, async (tx) => {
    await tx.runAsync(
      `INSERT INTO workout (id, created_at, updated_at, program_id, routine_id, started_at, status, priority_only, current_we_id, phase, last_activity_at)
       VALUES (?, ?, ?, ?, ?, ?, 'aberto', ?, ?, 'pronto', ?)`,
      wid, now, now, routine?.program_id ?? null, routineId, now, priorityOnly ? 1 : 0, rows[0]?.id ?? null, now,
    );
    for (const r of rows) {
      await tx.runAsync(
        `INSERT INTO workout_exercise (id, created_at, updated_at, workout_id, slot_id, exercise_id, sort, status,
           sets_min, sets_max, reps_min, reps_max, rest_sec, initial_load, next_load, next_reps)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, ?)`,
        r.id, now, now, wid, r.s.id, r.s.main_exercise_id, r.sort,
        r.s.sets_min, r.s.sets_max, r.s.reps_min, r.s.reps_max, r.s.rest_sec, r.s.initial_load, r.first?.load ?? null, r.first?.reps ?? null,
      );
    }
  });
  return wid;
}

// ---------- durante o treino ----------

export async function setPhase(db: Db, workoutId: string, patch: { phase: Phase; phase_started_at: string | null; current_we_id?: string | null; rest_target_sec?: number | null }) {
  const cols: string[] = ['phase = ?', 'phase_started_at = ?'];
  const vals: (string | number | null)[] = [patch.phase, patch.phase_started_at];
  if ('current_we_id' in patch) { cols.push('current_we_id = ?'); vals.push(patch.current_we_id ?? null); }
  if ('rest_target_sec' in patch) { cols.push('rest_target_sec = ?'); vals.push(patch.rest_target_sec ?? null); }
  const now = nowIso();
  await db.runAsync(`UPDATE workout SET ${cols.join(', ')}, last_activity_at = ?, updated_at = ? WHERE id = ?`, ...vals, now, now, workoutId);
}

export async function setCurrent(db: Db, workoutId: string, weId: string) {
  const now = nowIso();
  await db.runAsync(`UPDATE workout SET current_we_id = ?, last_activity_at = ?, updated_at = ? WHERE id = ?`, weId, now, now, workoutId);
}

export async function logSet(db: Db, weId: string, idx: number, set: SetResult, startedAt: string | null, endedAt: string, restSec: number | null, restApprox: boolean) {
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO set_log (id, created_at, updated_at, workout_exercise_id, idx, load, reps, set_started_at, set_ended_at, rest_sec, rest_approx)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(), now, now, weId, idx, set.load, set.reps, startedAt, endedAt, restSec, restApprox ? 1 : 0,
  );
}

export async function updateSet(db: Db, setId: string, load: number, reps: number) {
  await db.runAsync(`UPDATE set_log SET load = ?, reps = ?, updated_at = ? WHERE id = ?`, load, reps, nowIso(), setId);
}

/**
 * Apaga uma série. As seguintes do mesmo exercício sobem uma posição (série 3 vira 2).
 * Treino aberto: se o exercício estava feito e ficou abaixo do mínimo, volta a pendente.
 * Treino do histórico: exercício sem nenhuma série vira pulado.
 */
export async function deleteSet(db: Db, setId: string) {
  const row = await db.getFirstAsync<{ we_id: string; idx: number; w_status: string; we_status: string; min_sets: number }>(
    `SELECT sl.workout_exercise_id AS we_id, sl.idx, w.status AS w_status, we.status AS we_status,
       COALESCE(we.sets_min, 3) + we.sets_adjust AS min_sets
     FROM set_log sl JOIN workout_exercise we ON we.id = sl.workout_exercise_id JOIN workout w ON w.id = we.workout_id
     WHERE sl.id = ? AND sl.${alive}`,
    setId,
  );
  if (!row) return;
  const now = nowIso();
  await transaction(db, async (tx) => {
    await tx.runAsync(`UPDATE set_log SET deleted_at = ?, updated_at = ? WHERE id = ?`, now, now, setId);
    await tx.runAsync(
      `UPDATE set_log SET idx = idx - 1, updated_at = ? WHERE workout_exercise_id = ? AND idx > ? AND ${alive}`,
      now, row.we_id, row.idx,
    );
    const left = (await tx.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM set_log WHERE workout_exercise_id = ? AND ${alive}`, row.we_id))?.n ?? 0;
    let status: ExerciseStatus | null = null;
    if (row.w_status === 'finalizado' && left === 0) status = 'pulado';
    else if (row.w_status === 'aberto' && row.we_status === 'feito' && left < Math.max(1, row.min_sets)) status = 'pendente';
    if (status) await tx.runAsync(`UPDATE workout_exercise SET status = ?, updated_at = ? WHERE id = ?`, status, now, row.we_id);
  });
}

export async function setNextValues(db: Db, weId: string, load: number, reps: number) {
  await db.runAsync(`UPDATE workout_exercise SET next_load = ?, next_reps = ?, updated_at = ? WHERE id = ?`, load, reps, nowIso(), weId);
}

export async function setExerciseStatus(db: Db, weId: string, status: ExerciseStatus) {
  await db.runAsync(`UPDATE workout_exercise SET status = ?, updated_at = ? WHERE id = ?`, status, nowIso(), weId);
}

export async function adjustSets(db: Db, weId: string, delta: number) {
  await db.runAsync(`UPDATE workout_exercise SET sets_adjust = sets_adjust + ?, updated_at = ? WHERE id = ?`, delta, nowIso(), weId);
}

export async function setExerciseRest(db: Db, weId: string, seconds: number) {
  await db.runAsync(`UPDATE workout_exercise SET rest_sec = ?, updated_at = ? WHERE id = ?`, seconds, nowIso(), weId);
}

export async function setExerciseNote(db: Db, weId: string, note: string) {
  await db.runAsync(`UPDATE workout_exercise SET note = ?, updated_at = ? WHERE id = ?`, note.trim() || null, nowIso(), weId);
}

/** Troca o exercício só neste treino (a ficha não muda). */
export async function swapExercise(db: Db, we: WorkoutExerciseRow, exerciseId: string, initialLoad: number | null) {
  const ex = await db.getFirstAsync<{ step_kg: number }>(`SELECT step_kg FROM exercise WHERE id = ?`, exerciseId);
  const target = { setsMin: we.sets_min, setsMax: we.sets_max, repsMin: we.reps_min, repsMax: we.reps_max };
  const o = await exerciseOutlook(db, exerciseId, target, ex?.step_kg ?? 2.5, initialLoad, we.workout_id);
  const first = o.prefill.sets[0];
  await db.runAsync(
    `UPDATE workout_exercise SET exercise_id = ?, initial_load = ?, next_load = ?, next_reps = ?, updated_at = ? WHERE id = ?`,
    exerciseId, initialLoad, first?.load ?? null, first?.reps ?? null, nowIso(), we.id,
  );
}

/**
 * Exercício extra, só hoje: entra no fim da lista com 3 × 8–12 e vira o exercício da tela,
 * a não ser que uma série esteja correndo (ela termina no exercício dela).
 */
export async function addExtra(db: Db, workoutId: string, exerciseId: string): Promise<string> {
  const id = newId();
  const now = nowIso();
  const sort = await db.getFirstAsync<{ m: number | null }>(`SELECT MAX(sort) AS m FROM workout_exercise WHERE workout_id = ?`, workoutId);
  const ex = await db.getFirstAsync<{ step_kg: number }>(`SELECT step_kg FROM exercise WHERE id = ?`, exerciseId);
  const target = { setsMin: 3, setsMax: 3, repsMin: 8, repsMax: 12 };
  const o = await exerciseOutlook(db, exerciseId, target, ex?.step_kg ?? 2.5, null, workoutId);
  await db.runAsync(
    `INSERT INTO workout_exercise (id, created_at, updated_at, workout_id, slot_id, exercise_id, sort, status,
       sets_min, sets_max, reps_min, reps_max, rest_sec, next_load, next_reps)
     VALUES (?, ?, ?, ?, NULL, ?, ?, 'pendente', 3, 3, 8, 12, ?, ?, ?)`,
    id, now, now, workoutId, exerciseId, (sort?.m ?? -1) + 1, defaultRestSeconds(12), o.prefill.sets[0]?.load ?? null, o.prefill.sets[0]?.reps ?? null,
  );
  await db.runAsync(
    `UPDATE workout SET current_we_id = ?, phase = CASE WHEN phase = 'fim' THEN 'pronto' ELSE phase END, last_activity_at = ?, updated_at = ?
     WHERE id = ? AND phase != 'serie'`,
    id, now, now, workoutId,
  );
  return id;
}

// ---------- terminar ----------

/** Finaliza: quem tem série vira "feito", quem não tem vira "pulado". */
export async function finishWorkout(db: Db, workoutId: string, endedAt?: string) {
  const now = nowIso();
  await transaction(db, async (tx) => {
    await tx.runAsync(
      `UPDATE workout_exercise SET status = CASE
         WHEN EXISTS (SELECT 1 FROM set_log sl WHERE sl.workout_exercise_id = workout_exercise.id AND sl.deleted_at IS NULL) THEN 'feito'
         ELSE 'pulado' END, updated_at = ?
       WHERE workout_id = ? AND ${alive}`,
      now, workoutId,
    );
    await tx.runAsync(
      `UPDATE workout SET status = 'finalizado', ended_at = ?, phase = 'fim', phase_started_at = NULL, updated_at = ? WHERE id = ?`,
      endedAt ?? now, now, workoutId,
    );
    // A ficha escolhida ao usar a pasta já cumpriu o papel: daqui em diante vale a sequência.
    await tx.runAsync(
      `UPDATE program SET start_routine_id = NULL, updated_at = ? WHERE start_routine_id IS NOT NULL AND id = (SELECT program_id FROM workout WHERE id = ?)`,
      now, workoutId,
    );
  });
}

export async function setWorkoutNote(db: Db, workoutId: string, note: string) {
  await db.runAsync(`UPDATE workout SET note = ?, updated_at = ? WHERE id = ?`, note.trim() || null, nowIso(), workoutId);
}

/** Descarta (treino aberto) ou apaga (histórico). Some do histórico e das contas. */
export async function deleteWorkout(db: Db, workoutId: string) {
  const now = nowIso();
  await transaction(db, async (tx) => {
    await tx.runAsync(
      `UPDATE set_log SET deleted_at = ?, updated_at = ? WHERE ${alive} AND workout_exercise_id IN (SELECT id FROM workout_exercise WHERE workout_id = ?)`,
      now, now, workoutId,
    );
    await tx.runAsync(`UPDATE workout_exercise SET deleted_at = ?, updated_at = ? WHERE workout_id = ? AND ${alive}`, now, now, workoutId);
    await tx.runAsync(`UPDATE workout SET deleted_at = ?, updated_at = ? WHERE id = ?`, now, now, workoutId);
  });
}

/**
 * Treino aberto e parado há mais de `hours` é finalizado sozinho, com a hora da última série.
 * Sem nenhuma série, é descartado. Devolve true se mexeu em algo.
 */
export async function autoFinishStale(db: Db, hours = AUTO_FINISH_HOURS, now = new Date()): Promise<boolean> {
  if (hours <= 0) return false;
  const w = await getOpenWorkout(db);
  if (!w) return false;
  const last = w.last_activity_at ?? w.started_at;
  if (now.getTime() - new Date(last).getTime() <= hours * 3600_000) return false;
  const lastSet = await db.getFirstAsync<{ t: string | null }>(
    `SELECT MAX(sl.set_ended_at) AS t FROM set_log sl JOIN workout_exercise we ON we.id = sl.workout_exercise_id WHERE we.workout_id = ? AND sl.${alive}`,
    w.id,
  );
  if (!lastSet?.t) await deleteWorkout(db, w.id);
  else await finishWorkout(db, w.id, lastSet.t);
  return true;
}

export async function swapExerciseById(db: Db, weId: string, exerciseId: string) {
  const row = await db.getFirstAsync<{ workout_id: string }>(`SELECT workout_id FROM workout_exercise WHERE id = ?`, weId);
  if (!row) return;
  const data = await loadWorkout(db, row.workout_id);
  const we = data?.exercises.find((e) => e.id === weId);
  if (we) await swapExercise(db, we, exerciseId, null);
}
