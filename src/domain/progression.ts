import { topLoad, totalReps } from './stats.ts';
import type { ExerciseSession, SetResult, SlotTarget } from './types.ts';

/**
 * Progressão dupla: bateu o topo da faixa de reps em todas as séries
 * (e fez pelo menos o mínimo de séries) → sobe a carga no próximo treino.
 */
export function hitTopOfRange(session: ExerciseSession, target: SlotTarget): boolean {
  const { sets } = session;
  if (sets.length < target.setsMin) return false;
  return sets.every((s) => s.reps >= target.repsMax);
}

export interface Prefill {
  /** Carga e reps pré-preenchidas para cada série do próximo treino. */
  sets: SetResult[];
  /** true quando a carga subiu um passo (mostrar "⬆ subir carga"). */
  increased: boolean;
}

/**
 * O que vem pré-preenchido no próximo treino deste exercício.
 * Sem histórico: a carga inicial da ficha (ou 0) e o mínimo da faixa de reps.
 */
export function prefillNext(
  last: ExerciseSession | null,
  target: SlotTarget,
  step: number,
  initialLoad: number | null,
): Prefill {
  const count = target.setsMin;
  if (!last || last.sets.length === 0) {
    const load = initialLoad ?? 0;
    return { sets: Array.from({ length: count }, () => ({ load, reps: target.repsMin })), increased: false };
  }
  if (step > 0 && hitTopOfRange(last, target)) {
    const load = addLoad(topLoad(last.sets), step);
    return { sets: Array.from({ length: count }, () => ({ load, reps: target.repsMin })), increased: true };
  }
  const sets = Array.from({ length: count }, (_, i) => {
    const prev = last.sets[Math.min(i, last.sets.length - 1)];
    return { load: prev.load, reps: prev.reps };
  });
  return { sets, increased: false };
}

/** Teve progresso em relação ao treino anterior: mais carga, ou mesma carga e mais reps no total. */
export function progressed(current: ExerciseSession, previous: ExerciseSession): boolean {
  const cur = topLoad(current.sets);
  const prev = topLoad(previous.sets);
  if (cur !== prev) return cur > prev;
  return totalReps(current.sets) > totalReps(previous.sets);
}

/**
 * Estagnação: os últimos `window` treinos deste exercício (padrão 3), cada um
 * sem progresso em relação ao anterior. `sessions` vem do mais recente ao mais antigo.
 */
export function isStalled(sessions: ExerciseSession[], window = 3): boolean {
  if (sessions.length < window + 1) return false;
  for (let i = 0; i < window; i++) {
    if (progressed(sessions[i], sessions[i + 1])) return false;
  }
  return true;
}

/**
 * Soma (ou tira, com `delta` negativo) um passo à carga, a partir da carga que está ali:
 * 42,5 + 5 = 47,5 (não pula para 50). Arredonda em 2 casas para não virar 22.499999
 * e nunca fica abaixo de zero.
 */
export function addLoad(load: number, delta: number): number {
  return Math.max(0, Math.round((load + delta) * 100) / 100);
}
