/**
 * Próxima ficha pela sequência da pasta em uso: a seguinte à última feita,
 * voltando ao começo no fim. Sem treino na pasta (ou pasta nova): a primeira,
 * ou a que a pessoa escolheu ao usar a pasta (`startWith`).
 */
export function nextRoutineId(
  orderedRoutineIds: string[],
  lastDoneRoutineId: string | null,
  startWith: string | null = null,
): string | null {
  if (orderedRoutineIds.length === 0) return null;
  if (lastDoneRoutineId) {
    const i = orderedRoutineIds.indexOf(lastDoneRoutineId);
    if (i >= 0) return orderedRoutineIds[(i + 1) % orderedRoutineIds.length];
  }
  if (startWith && orderedRoutineIds.includes(startWith)) return startWith;
  return orderedRoutineIds[0];
}
