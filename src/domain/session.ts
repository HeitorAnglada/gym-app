/** Regras do treino em andamento: séries, ordem livre, próximo exercício e resumo. */
import type { Prefill } from './progression.ts';
import { volume } from './stats.ts';
import type { SetResult } from './types.ts';

export type ExerciseStatus = 'pendente' | 'feito' | 'pulado';

/** Séries planejadas de um exercício hoje: a faixa da ficha mais o que foi somado/tirado no ⋯. */
export function plannedSets(setsMin: number, setsMax: number, adjust: number): { min: number; max: number } {
  const min = Math.max(1, setsMin + adjust);
  const max = Math.max(min, setsMax + adjust);
  return { min, max };
}

/**
 * Depois de registrar uma série:
 * - 'continuar': ainda falta série obrigatória;
 * - 'opcional': já fez o mínimo, mas a faixa permite mais uma (bolinha tracejada);
 * - 'completo': chegou no máximo.
 */
export function afterSet(done: number, min: number, max: number): 'continuar' | 'opcional' | 'completo' {
  if (done >= max) return 'completo';
  if (done >= min) return 'opcional';
  return 'continuar';
}

/** Próximo exercício pendente depois do atual, na ordem da ficha, voltando ao começo. */
export function nextPending<T extends { id: string; status: ExerciseStatus }>(items: T[], currentId: string | null): T | null {
  const start = currentId ? items.findIndex((i) => i.id === currentId) : -1;
  for (let k = 1; k <= items.length; k++) {
    const it = items[(start + k + items.length) % items.length];
    if (it.status === 'pendente' && it.id !== currentId) return it;
  }
  return null;
}

/**
 * Carga e reps que aparecem para a série `index` (0 = primeira).
 * A carga segue a última série feita hoje (se você mudou, continua com a nova);
 * as reps vêm do último treino deste exercício.
 */
export function valuesForSet(prefill: Prefill, index: number, lastToday: SetResult | null): SetResult {
  const fromPlan = prefill.sets[Math.min(index, prefill.sets.length - 1)] ?? { load: 0, reps: 10 };
  if (!lastToday) return fromPlan;
  return { load: lastToday.load, reps: fromPlan.reps };
}

/** Descanso entre duas séries do mesmo exercício, em segundos. */
export function restBetween(prevEndIso: string | null, startIso: string): number | null {
  if (!prevEndIso) return null;
  const s = Math.round((new Date(startIso).getTime() - new Date(prevEndIso).getTime()) / 1000);
  return s >= 0 ? s : null;
}

export interface SummaryExercise {
  status: ExerciseStatus;
  sets: SetResult[];
}

/** Totais do resumo: minutos, séries e volume (kg × reps). */
export function workoutTotals(startedAt: string, endedAt: string, exercises: SummaryExercise[]) {
  const minutes = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000));
  const sets = exercises.reduce((n, e) => n + e.sets.length, 0);
  const vol = Math.round(exercises.reduce((n, e) => n + volume(e.sets), 0));
  return { minutes, sets, volume: vol };
}

/** "24 kg × 9, 8, 8" (mesma carga) ou "24×9, 22×8" (cargas diferentes). Peso do corpo sem carga: "× 8, 8". */
export function describeSets(sets: SetResult[]): string {
  if (sets.length === 0) return '';
  const loads = new Set(sets.map((s) => s.load));
  const fmt = (n: number) => String(n).replace('.', ',');
  if (loads.size === 1) {
    const load = sets[0].load;
    return `${load ? `${fmt(load)} kg ` : ''}× ${sets.map((s) => s.reps).join(', ')}`;
  }
  return sets.map((s) => `${fmt(s.load)}×${s.reps}`).join(', ');
}

/** Formata 8450 como "8.450". */
export function thousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Arredonda segundos para o múltiplo de 15 mais próximo (ajustar descanso pela média real). */
export function roundRest(seconds: number): number {
  return Math.max(15, Math.round(seconds / 15) * 15);
}
