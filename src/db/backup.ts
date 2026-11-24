import { CATALOG, DEFAULT_STEP } from '../data/catalog.ts';
import type { ProgramPlan } from '../data/plan.ts';
import { defaultRestSeconds } from '../domain/rest.ts';
import { SCHEMA_VERSION, TABLES, type TableName } from './schema.ts';

export type Row = Record<string, string | number | null>;

/** Arquivo de backup: todas as tabelas, com a versão do esquema que as gerou. */
export interface Backup {
  format: 'kargo-backup';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<TableName, Row[]>;
}

export function emptyBackup(now: string): Backup {
  const tables = Object.fromEntries(TABLES.map((t) => [t, [] as Row[]])) as Record<TableName, Row[]>;
  return { format: 'kargo-backup', schemaVersion: SCHEMA_VERSION, exportedAt: now, tables };
}

export function isBackup(value: unknown): value is Backup {
  const v = value as Backup;
  return !!v && v.format === 'kargo-backup' && typeof v.schemaVersion === 'number' && !!v.tables && typeof v.tables === 'object';
}

/** Linhas do catálogo que vem com o app. */
export function catalogRows(newId: () => string, now: string): Row[] {
  return CATALOG.map((c) => ({
    id: newId(),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    builtin_key: c.key,
    name: c.name,
    muscle_group: c.muscle,
    equipment: c.equipment,
    kind: c.kind ?? 'carga',
    step_kg: DEFAULT_STEP[c.equipment],
  }));
}

/**
 * Monta as linhas de uma pasta de treino a partir de um plano em código.
 * `exerciseIdByKey` liga as keys do catálogo aos ids das linhas de exercise.
 */
export function programRows(
  plan: ProgramPlan,
  exerciseIdByKey: Map<string, string>,
  newId: () => string,
  now: string,
  active: boolean,
): Pick<Record<TableName, Row[]>, 'program' | 'routine' | 'slot' | 'slot_substitute'> {
  const base = () => ({ id: newId(), created_at: now, updated_at: now, deleted_at: null });
  const exId = (key: string) => {
    const id = exerciseIdByKey.get(key);
    if (!id) throw new Error(`Exercício fora do catálogo: ${key}`);
    return id;
  };
  const program = { ...base(), name: plan.name, is_active: active ? 1 : 0, start_routine_id: null, sort: 0 };
  const routine: Row[] = [];
  const slot: Row[] = [];
  const slot_substitute: Row[] = [];
  plan.routines.forEach((r, ri) => {
    const routineRow = { ...base(), program_id: program.id, code: r.code, name: r.name, suggested_weekday: r.weekday ?? null, sort: ri };
    routine.push(routineRow);
    r.slots.forEach((s, si) => {
      const slotRow = {
        ...base(),
        routine_id: routineRow.id,
        sort: si,
        main_exercise_id: exId(s.main.key),
        // a ficha tem uma quantidade só de séries: fica a maior
        sets_min: s.sets[1],
        sets_max: s.sets[1],
        reps_min: s.reps[0],
        reps_max: s.reps[1],
        rest_sec: s.rest ?? defaultRestSeconds(s.reps[1]),
        is_priority: s.priority ? 1 : 0,
        initial_load: s.main.load ?? null,
      };
      slot.push(slotRow);
      s.subs.forEach((sub, k) => {
        slot_substitute.push({ ...base(), slot_id: slotRow.id, exercise_id: exId(sub.key), sort: k, initial_load: sub.load ?? null });
      });
    });
  });
  return { program: [program], routine, slot, slot_substitute };
}

/** Backup completo com o catálogo e uma pasta pronta, para importar no primeiro dia. */
export function backupFromPlan(plan: ProgramPlan, newId: () => string, now: string): Backup {
  const backup = emptyBackup(now);
  backup.tables.exercise = catalogRows(newId, now);
  const byKey = new Map(backup.tables.exercise.map((r) => [r.builtin_key as string, r.id as string]));
  Object.assign(backup.tables, programRows(plan, byKey, newId, now, true));
  return backup;
}
