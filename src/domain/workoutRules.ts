const DAY = 24 * 60 * 60 * 1000;

/** Um treino pode ser editado até 7 dias depois de terminar. */
export const EDIT_WINDOW_DAYS = 7;

export function canEditWorkout(endedAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(endedAt).getTime() <= EDIT_WINDOW_DAYS * DAY;
}

/** Último dia em que o treino pode ser editado. */
export function editDeadline(endedAt: string): Date {
  return new Date(new Date(endedAt).getTime() + EDIT_WINDOW_DAYS * DAY);
}

/** Treino aberto e parado há mais de 3 h é finalizado sozinho, com a hora da última série. */
export const AUTO_FINISH_HOURS = 3;

export function shouldAutoFinish(lastActivityAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(lastActivityAt).getTime() > AUTO_FINISH_HOURS * 60 * 60 * 1000;
}
