/**
 * Esquema do banco local (SQLite). Cada item de MIGRATIONS roda uma vez, em ordem,
 * e o número da versão fica em PRAGMA user_version.
 *
 * Toda tabela tem id (UUID), created_at, updated_at e deleted_at: apagar só marca
 * deleted_at, para a sincronização com a nuvem (depois do login) não exigir migração.
 */

const common = `
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT`;

export const TABLES = [
  'exercise',
  'program',
  'routine',
  'slot',
  'slot_substitute',
  'workout',
  'workout_exercise',
  'set_log',
  'setting',
] as const;

export type TableName = (typeof TABLES)[number];

export const MIGRATIONS: string[] = [
  // 1: esquema inicial da v1
  `
  CREATE TABLE exercise (${common},
    builtin_key TEXT UNIQUE,
    name TEXT NOT NULL,
    muscle_group TEXT NOT NULL,
    equipment TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'carga',
    step_kg REAL NOT NULL
  );
  CREATE TABLE program (${common},
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    start_routine_id TEXT,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE routine (${common},
    program_id TEXT NOT NULL REFERENCES program(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    suggested_weekday INTEGER,
    sort INTEGER NOT NULL
  );
  CREATE TABLE slot (${common},
    routine_id TEXT NOT NULL REFERENCES routine(id),
    sort INTEGER NOT NULL,
    main_exercise_id TEXT NOT NULL REFERENCES exercise(id),
    sets_min INTEGER NOT NULL,
    sets_max INTEGER NOT NULL,
    reps_min INTEGER NOT NULL,
    reps_max INTEGER NOT NULL,
    rest_sec INTEGER NOT NULL,
    is_priority INTEGER NOT NULL DEFAULT 0,
    initial_load REAL
  );
  CREATE TABLE slot_substitute (${common},
    slot_id TEXT NOT NULL REFERENCES slot(id),
    exercise_id TEXT NOT NULL REFERENCES exercise(id),
    sort INTEGER NOT NULL,
    initial_load REAL
  );
  CREATE TABLE workout (${common},
    program_id TEXT REFERENCES program(id),
    routine_id TEXT REFERENCES routine(id),
    started_at TEXT NOT NULL,
    ended_at TEXT,
    status TEXT NOT NULL DEFAULT 'aberto',
    priority_only INTEGER NOT NULL DEFAULT 0,
    note TEXT
  );
  CREATE TABLE workout_exercise (${common},
    workout_id TEXT NOT NULL REFERENCES workout(id),
    slot_id TEXT REFERENCES slot(id),
    exercise_id TEXT NOT NULL REFERENCES exercise(id),
    sort INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    note TEXT
  );
  CREATE TABLE set_log (${common},
    workout_exercise_id TEXT NOT NULL REFERENCES workout_exercise(id),
    idx INTEGER NOT NULL,
    load REAL NOT NULL,
    reps INTEGER NOT NULL,
    set_started_at TEXT,
    set_ended_at TEXT,
    rest_sec INTEGER,
    rest_approx INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE setting (${common},
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
  );
  CREATE INDEX idx_routine_program ON routine(program_id, sort);
  CREATE INDEX idx_slot_routine ON slot(routine_id, sort);
  CREATE INDEX idx_sub_slot ON slot_substitute(slot_id, sort);
  CREATE INDEX idx_workout_started ON workout(started_at);
  CREATE INDEX idx_wex_workout ON workout_exercise(workout_id, sort);
  CREATE INDEX idx_wex_exercise ON workout_exercise(exercise_id);
  CREATE INDEX idx_set_wex ON set_log(workout_exercise_id, idx);
  `,
  // 2: o treino guarda as faixas com que começou, para editar a ficha não mudar um treino aberto
  `
  ALTER TABLE workout_exercise ADD COLUMN sets_min INTEGER;
  ALTER TABLE workout_exercise ADD COLUMN sets_max INTEGER;
  ALTER TABLE workout_exercise ADD COLUMN reps_min INTEGER;
  ALTER TABLE workout_exercise ADD COLUMN reps_max INTEGER;
  ALTER TABLE workout_exercise ADD COLUMN rest_sec INTEGER;
  `,
  // 3: estado do treino em andamento (para retomar depois de fechar o app)
  `
  ALTER TABLE workout ADD COLUMN current_we_id TEXT;
  ALTER TABLE workout ADD COLUMN phase TEXT NOT NULL DEFAULT 'pronto';
  ALTER TABLE workout ADD COLUMN phase_started_at TEXT;
  ALTER TABLE workout ADD COLUMN rest_target_sec INTEGER;
  ALTER TABLE workout ADD COLUMN last_activity_at TEXT;
  ALTER TABLE workout_exercise ADD COLUMN sets_adjust INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE workout_exercise ADD COLUMN next_load REAL;
  ALTER TABLE workout_exercise ADD COLUMN next_reps INTEGER;
  ALTER TABLE workout_exercise ADD COLUMN initial_load REAL;
  CREATE INDEX idx_workout_status ON workout(status);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;
