/**
 * Descanso recomendado padrão, pela faixa de repetições da posição.
 * 6–8 → 2:30 · 8–10 → 2:00 · 10–12 → 1:30 · 12–15 (ou mais) → 1:00.
 */
export function defaultRestSeconds(repsMax: number): number {
  if (repsMax <= 8) return 150;
  if (repsMax <= 10) return 120;
  if (repsMax <= 12) return 90;
  return 60;
}

export interface RestSample {
  seconds: number;
  /** true quando a pessoa não tocou em "Iniciar série" e o tempo inclui a série. */
  approximate: boolean;
}

/** Descanso médio, ignorando os aproximados. `null` sem amostras válidas. */
export function averageRest(samples: RestSample[]): number | null {
  const valid = samples.filter((s) => !s.approximate && s.seconds > 0);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, s) => sum + s.seconds, 0) / valid.length);
}

/** Formata segundos como m:ss (ex.: 150 → "2:30"). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
