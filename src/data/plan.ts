/** Uma pasta de treino descrita em código: usada para o catálogo inicial e para gerar backups prontos. */

export interface PlanExercise {
  /** key do catálogo */
  key: string;
  /** carga atual, em kg, se conhecida */
  load?: number;
}

export interface PlanSlot {
  main: PlanExercise;
  subs: PlanExercise[];
  sets: [min: number, max: number];
  reps: [min: number, max: number];
  priority?: boolean;
  /** descanso em segundos; sem valor = padrão pela faixa de reps */
  rest?: number;
}

export interface PlanRoutine {
  code: string;
  name: string;
  /** 0 = domingo … 6 = sábado */
  weekday?: number;
  slots: PlanSlot[];
}

export interface ProgramPlan {
  name: string;
  routines: PlanRoutine[];
}
