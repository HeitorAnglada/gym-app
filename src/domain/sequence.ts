/**
 * Próxima ficha da pasta em uso:
 * - a escolhida ao usar a pasta (`startWith`), até terminar um treino nela;
 * - senão, a seguinte à última feita, voltando ao começo no fim;
 * - sem treino na pasta: a primeira.
 */
export function nextRoutineId(
  orderedRoutineIds: string[],
  lastDoneRoutineId: string | null,
  startWith: string | null = null,
): string | null {
  if (orderedRoutineIds.length === 0) return null;
  if (startWith && orderedRoutineIds.includes(startWith)) return startWith;
  if (lastDoneRoutineId) {
    const i = orderedRoutineIds.indexOf(lastDoneRoutineId);
    if (i >= 0) return orderedRoutineIds[(i + 1) % orderedRoutineIds.length];
  }
  return orderedRoutineIds[0];
}
