import type { SQLiteDatabase } from 'expo-sqlite';

import { nextRoutineId } from '../domain/sequence.ts';
import { nowIso } from './index.ts';

export interface ProgramRow {
  id: string;
  name: string;
  is_active: number;
  start_routine_id: string | null;
  routine_codes: string | null;
  workouts: number;
  first_workout: string | null;
  last_workout: string | null;
}

export interface RoutineRow {
  id: string;
  code: string;
  name: string;
  suggested_weekday: number | null;
  slots: number;
  priorities: number;
}

export interface WorkoutListRow {
  id: string;
  code: string | null;
  started_at: string;
  ended_at: string | null;
  sets: number;
  skipped: number;
}

export interface ExerciseListRow {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  times_done: number;
  last_done: string | null;
  last_top_load: number | null;
}

const alive = 'deleted_at IS NULL';

export function listPrograms(db: SQLiteDatabase) {
  return db.getAllAsync<ProgramRow>(`
    SELECT p.id, p.name, p.is_active, p.start_routine_id,
      (SELECT group_concat(code, ' → ') FROM (SELECT code FROM routine r WHERE r.program_id = p.id AND r.${alive} ORDER BY r.sort)) AS routine_codes,
      (SELECT COUNT(*) FROM workout w WHERE w.program_id = p.id AND w.status = 'finalizado' AND w.${alive}) AS workouts,
      (SELECT MIN(started_at) FROM workout w WHERE w.program_id = p.id AND w.status = 'finalizado' AND w.${alive}) AS first_workout,
      (SELECT MAX(started_at) FROM workout w WHERE w.program_id = p.id AND w.status = 'finalizado' AND w.${alive}) AS last_workout
    FROM program p WHERE p.${alive}
    ORDER BY p.is_active DESC, p.sort, p.created_at`);
}

export function getProgram(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<ProgramRow>(`SELECT *, NULL AS routine_codes, 0 AS workouts, NULL AS first_workout, NULL AS last_workout FROM program WHERE id = ? AND ${alive}`, id);
}

export function listRoutines(db: SQLiteDatabase, programId: string) {
  return db.getAllAsync<RoutineRow>(`
    SELECT r.id, r.code, r.name, r.suggested_weekday,
      (SELECT COUNT(*) FROM slot s WHERE s.routine_id = r.id AND s.${alive}) AS slots,
      (SELECT COUNT(*) FROM slot s WHERE s.routine_id = r.id AND s.${alive} AND s.is_priority = 1) AS priorities
    FROM routine r WHERE r.program_id = ? AND r.${alive} ORDER BY r.sort`, programId);
}

/** A ficha que vem agora, pela sequência da pasta em uso. */
export async function getNextRoutine(db: SQLiteDatabase) {
  const program = await db.getFirstAsync<{ id: string; name: string; start_routine_id: string | null }>(
    `SELECT id, name, start_routine_id FROM program WHERE is_active = 1 AND ${alive} LIMIT 1`,
  );
  if (!program) return null;
  const routines = await listRoutines(db, program.id);
  const last = await db.getFirstAsync<{ routine_id: string; ended_at: string }>(
    `SELECT routine_id, ended_at FROM workout WHERE program_id = ? AND status = 'finalizado' AND ${alive} ORDER BY started_at DESC LIMIT 1`,
    program.id,
  );
  const id = nextRoutineId(routines.map((r) => r.id), last?.routine_id ?? null, program.start_routine_id);
  const routine = routines.find((r) => r.id === id) ?? null;
  const lastOfRoutine = routine
    ? await db.getFirstAsync<{ started_at: string; ended_at: string }>(
        `SELECT started_at, ended_at FROM workout WHERE routine_id = ? AND status = 'finalizado' AND ${alive} ORDER BY started_at DESC LIMIT 1`,
        routine.id,
      )
    : null;
  return { program, routine, routineCount: routines.length, lastOfRoutine };
}

/** Pasta em uso: só uma por vez. `startRoutineId` é a ficha escolhida para começar. */
export async function activateProgram(db: SQLiteDatabase, programId: string, startRoutineId: string | null) {
  const now = nowIso();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(`UPDATE program SET is_active = 0, updated_at = ? WHERE is_active = 1`, now);
    await tx.runAsync(`UPDATE program SET is_active = 1, start_routine_id = ?, updated_at = ? WHERE id = ?`, startRoutineId, now, programId);
  });
}

export function listWorkouts(db: SQLiteDatabase, fromIso: string, toIso: string) {
  return db.getAllAsync<WorkoutListRow>(`
    SELECT w.id, r.code, w.started_at, w.ended_at,
      (SELECT COUNT(*) FROM set_log sl JOIN workout_exercise we ON we.id = sl.workout_exercise_id WHERE we.workout_id = w.id AND sl.${alive}) AS sets,
      (SELECT COUNT(*) FROM workout_exercise we WHERE we.workout_id = w.id AND we.status = 'pulado' AND we.${alive}) AS skipped
    FROM workout w LEFT JOIN routine r ON r.id = w.routine_id
    WHERE w.status = 'finalizado' AND w.${alive} AND w.started_at >= ? AND w.started_at < ?
    ORDER BY w.started_at DESC`, fromIso, toIso);
}

export function listExercises(db: SQLiteDatabase) {
  return db.getAllAsync<ExerciseListRow>(`
    SELECT e.id, e.name, e.muscle_group, e.equipment,
      COUNT(DISTINCT w.id) AS times_done,
      MAX(w.started_at) AS last_done,
      (SELECT MAX(sl.load) FROM set_log sl JOIN workout_exercise we2 ON we2.id = sl.workout_exercise_id
         JOIN workout w2 ON w2.id = we2.workout_id
         WHERE we2.exercise_id = e.id AND w2.status = 'finalizado' AND sl.${alive}
         AND w2.started_at = (SELECT MAX(w3.started_at) FROM workout w3 JOIN workout_exercise we3 ON we3.workout_id = w3.id
                              WHERE we3.exercise_id = e.id AND w3.status = 'finalizado')) AS last_top_load
    FROM exercise e
    LEFT JOIN workout_exercise we ON we.exercise_id = e.id AND we.status = 'feito' AND we.${alive}
    LEFT JOIN workout w ON w.id = we.workout_id AND w.status = 'finalizado' AND w.${alive}
    WHERE e.${alive}
    GROUP BY e.id
    ORDER BY e.name COLLATE NOCASE`);
}
