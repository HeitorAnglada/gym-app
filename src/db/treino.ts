/**
 * Ações da tela de treino. Cada uma grava no banco; a tela recarrega depois.
 * Ficam fora da tela para os testes rodarem um treino inteiro com SQLite de verdade.
 *
 * Toda ação recebe o treino como a tela o via. As que mudam a fase conferem antes se o
 * treino ainda está igual no banco: um segundo toque com a tela desatualizada (dedo
 * suado, toque duplo) não registra série repetida.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Prefill } from '../domain/progression.ts';
import { afterSet, nextPending, plannedSets, restBetween, valuesForSet } from '../domain/session.ts';
import type { SetResult, SlotTarget } from '../domain/types.ts';
import { nowIso } from './index.ts';
import {
  adjustSets, exerciseOutlook, logSet, setCurrent, setExerciseRest, setExerciseStatus, setNextValues, setPhase,
  type WorkoutData, type WorkoutExerciseRow, type WorkoutRow,
} from './workout.ts';

type Db = SQLiteDatabase;

/** O exercício na tela: o marcado no treino ou, sem marca, o primeiro pendente. */
export function currentExercise(data: WorkoutData): WorkoutExerciseRow | null {
  return data.exercises.find((e) => e.id === data.workout.current_we_id) ?? data.exercises.find((e) => e.status === 'pendente') ?? null;
}

export function targetOf(we: WorkoutExerciseRow): SlotTarget {
  return { setsMin: we.sets_min, setsMax: we.sets_max, repsMin: we.reps_min, repsMax: we.reps_max };
}

/** Carga e reps da próxima série (o que aparece nos −/+). */
export function nextValues(we: WorkoutExerciseRow, prefill?: Prefill | null): SetResult {
  return {
    load: we.next_load ?? prefill?.sets[0]?.load ?? 0,
    reps: we.next_reps ?? prefill?.sets[0]?.reps ?? we.reps_min,
  };
}

/** O treino no banco ainda é o que a tela mostrava? */
async function unchanged(db: Db, w: WorkoutRow): Promise<boolean> {
  const now = await db.getFirstAsync<{ status: string; phase: string; phase_started_at: string | null; current_we_id: string | null }>(
    `SELECT status, phase, phase_started_at, current_we_id FROM workout WHERE id = ? AND deleted_at IS NULL`,
    w.id,
  );
  return !!now && now.status === 'aberto' && now.phase === w.phase && now.phase_started_at === w.phase_started_at && now.current_we_id === w.current_we_id;
}

/** "Iniciar série": acaba o descanso e começa a contar a série. */
export async function startSet(db: Db, data: WorkoutData): Promise<boolean> {
  const current = currentExercise(data);
  if (!current || data.workout.phase === 'serie' || !(await unchanged(db, data.workout))) return false;
  await setPhase(db, data.workout.id, { phase: 'serie', phase_started_at: nowIso(), current_we_id: current.id });
  return true;
}

/** Descanso que começou agora: quanto tempo e quem vem depois (para o aviso). */
export interface RestStarted {
  seconds: number;
  nextName: string;
}

/**
 * "Iniciar descanso" (ou "já fiz a série sem iniciar", `approx`): registra a série com a carga e
 * as reps da tela. Completou o exercício → vai para o próximo pendente. Devolve o descanso que
 * começou, ou null quando não há descanso (treino todo feito, ou toque repetido).
 */
export async function endSet(db: Db, data: WorkoutData, approx = false): Promise<RestStarted | null> {
  const { workout, exercises } = data;
  const current = currentExercise(data);
  if (!current) return null;
  if (approx ? workout.phase !== 'descanso' : workout.phase !== 'serie') return null;
  if (!(await unchanged(db, workout))) return null;
  const logged = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM set_log WHERE workout_exercise_id = ? AND deleted_at IS NULL`, current.id);
  if ((logged?.n ?? 0) !== current.sets.length) return null;

  const outlook = await exerciseOutlook(db, current.exercise_id, targetOf(current), current.step_kg, current.initial_load, workout.id);
  const value = nextValues(current, outlook.prefill);
  const endIso = nowIso();
  const startIso = approx ? null : workout.phase_started_at;
  const rest = restBetween(current.sets.at(-1)?.set_ended_at ?? null, startIso ?? endIso);
  const done = current.sets.length;
  await logSet(db, current.id, done, value, startIso, endIso, rest, approx || !startIso);

  const planned = plannedSets(current.sets_min, current.sets_max, current.sets_adjust);
  let next: WorkoutExerciseRow | null = current;
  if (afterSet(done + 1, planned.min, planned.max) === 'completo') {
    await setExerciseStatus(db, current.id, 'feito');
    next = nextPending(exercises, current.id);
  } else {
    const v = valuesForSet(outlook.prefill, done + 1, value);
    await setNextValues(db, current.id, v.load, v.reps);
  }
  if (!next) {
    await setPhase(db, workout.id, { phase: 'fim', phase_started_at: endIso, current_we_id: null, rest_target_sec: null });
    return null;
  }
  await setPhase(db, workout.id, { phase: 'descanso', phase_started_at: endIso, current_we_id: next.id, rest_target_sec: current.rest_sec });
  return { seconds: current.rest_sec, nextName: next.name };
}

/**
 * "ir para o próximo": dá o exercício da tela por encerrado (feito se tem série, senão pulado)
 * e passa ao próximo pendente. Se estava descansando, o descanso continua.
 * Devolve false quando não sobrou nada pendente.
 */
export async function moveOn(db: Db, data: WorkoutData): Promise<boolean> {
  const { workout } = data;
  const current = currentExercise(data);
  if (!current || workout.phase === 'serie') return true;
  await setExerciseStatus(db, current.id, current.sets.length ? 'feito' : 'pulado');
  const nxt = nextPending(data.exercises, current.id);
  const resting = workout.phase === 'descanso';
  await setPhase(db, workout.id, {
    phase: nxt ? (resting ? 'descanso' : 'pronto') : 'fim',
    phase_started_at: resting && nxt ? workout.phase_started_at : nowIso(),
    current_we_id: nxt?.id ?? null,
  });
  return !!nxt;
}

/** Muda a carga e as reps da próxima série (os −/+ da tela). */
export async function setNext(db: Db, we: WorkoutExerciseRow, load: number, reps: number) {
  await setNextValues(db, we.id, Math.max(0, Math.round(load * 100) / 100), Math.max(1, Math.round(reps)));
}

/**
 * Tocar num exercício da lista: vira o da tela. Feito ou pulado volta a pendente (para fazer mais).
 * Não troca no meio de uma série: devolve false.
 */
export async function goToExercise(db: Db, data: WorkoutData, weId: string): Promise<boolean> {
  const { workout } = data;
  if (workout.phase === 'serie') return false;
  const we = data.exercises.find((e) => e.id === weId);
  if (!we) return true;
  if (we.status !== 'pendente') await setExerciseStatus(db, we.id, 'pendente');
  await setCurrent(db, workout.id, we.id);
  if (workout.phase === 'fim') await setPhase(db, workout.id, { phase: 'pronto', phase_started_at: null });
  return true;
}

/** Segurar na lista / "Pular exercício": pula ou volta a pendente. Pular o da tela passa ao próximo. */
export async function toggleSkip(db: Db, data: WorkoutData, weId: string) {
  const { workout } = data;
  const we = data.exercises.find((e) => e.id === weId);
  if (!we) return;
  if (we.status === 'pulado') {
    await setExerciseStatus(db, we.id, 'pendente');
    return;
  }
  if (we.status !== 'pendente') return;
  await setExerciseStatus(db, we.id, 'pulado');
  if (we.id === currentExercise(data)?.id) {
    const nxt = nextPending(data.exercises, we.id);
    await setPhase(db, workout.id, {
      phase: nxt ? (workout.phase === 'serie' ? 'pronto' : workout.phase) : 'fim',
      phase_started_at: workout.phase_started_at,
      current_we_id: nxt?.id ?? null,
    });
  }
}

/** ⋯ "+ adicionar série". Um exercício já feito volta a pendente para a série nova. */
export async function addSet(db: Db, we: WorkoutExerciseRow) {
  await adjustSets(db, we.id, 1);
  if (we.status === 'feito') await setExerciseStatus(db, we.id, 'pendente');
}

/** ⋯ "− remover série". Não tira série já feita: devolve false quando não dá. */
export async function removeSet(db: Db, we: WorkoutExerciseRow): Promise<boolean> {
  const planned = plannedSets(we.sets_min, we.sets_max, we.sets_adjust);
  if (planned.max <= Math.max(1, we.sets.length)) return false;
  await adjustSets(db, we.id, -1);
  return true;
}

/**
 * ⋯ "Mudar descanso", só neste treino. Se está descansando, o alvo do descanso que está
 * correndo muda junto (com ou sem aviso ligado). Devolve os segundos que faltam, para reagendar.
 */
export async function changeRest(db: Db, data: WorkoutData, we: WorkoutExerciseRow, seconds: number): Promise<number | null> {
  await setExerciseRest(db, we.id, seconds);
  const { workout } = data;
  if (workout.phase !== 'descanso') return null;
  await setPhase(db, workout.id, { phase: 'descanso', phase_started_at: workout.phase_started_at, rest_target_sec: seconds });
  const elapsed = workout.phase_started_at ? Math.floor((Date.now() - new Date(workout.phase_started_at).getTime()) / 1000) : 0;
  return seconds - elapsed;
}
