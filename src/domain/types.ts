/** Uma série concluída de um exercício. Carga em kg (ou número da placa). */
export interface SetResult {
  load: number;
  reps: number;
}

/** Um treino de um exercício: as séries feitas naquele dia, em ordem. */
export interface ExerciseSession {
  /** ISO date-time de quando o treino terminou. */
  date: string;
  sets: SetResult[];
}

/** Faixas e regras de uma posição da ficha. */
export interface SlotTarget {
  setsMin: number;
  setsMax: number;
  repsMin: number;
  repsMax: number;
}
