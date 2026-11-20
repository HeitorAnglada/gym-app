import type { ExerciseSession, SetResult } from './types.ts';

/** Maior carga usada no treino. */
export function topLoad(sets: SetResult[]): number {
  return sets.reduce((max, s) => Math.max(max, s.load), 0);
}

/** Soma de carga × reps. */
export function volume(sets: SetResult[]): number {
  return sets.reduce((sum, s) => sum + s.load * s.reps, 0);
}

export function totalReps(sets: SetResult[]): number {
  return sets.reduce((sum, s) => sum + s.reps, 0);
}

/** Recordes de um exercício: maior carga (com as reps dela) e mais reps em cada carga. */
export function records(sessions: ExerciseSession[]): {
  heaviest: SetResult | null;
  mostRepsByLoad: Map<number, number>;
} {
  let heaviest: SetResult | null = null;
  const mostRepsByLoad = new Map<number, number>();
  for (const session of sessions) {
    for (const set of session.sets) {
      if (!heaviest || set.load > heaviest.load || (set.load === heaviest.load && set.reps > heaviest.reps)) {
        heaviest = set;
      }
      mostRepsByLoad.set(set.load, Math.max(mostRepsByLoad.get(set.load) ?? 0, set.reps));
    }
  }
  return { heaviest, mostRepsByLoad };
}
