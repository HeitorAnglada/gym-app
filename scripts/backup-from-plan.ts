/**
 * Gera um arquivo de backup do kargo com o catálogo e a ficha do Heitor,
 * pronto para "Ajustes › Importar backup" no primeiro dia.
 *
 *   npm run backup:heitor -- caminho/do/arquivo.json
 */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import { HEITOR_PROGRAM } from '../src/data/heitor.ts';
import { backupFromPlan } from '../src/db/backup.ts';

const out = process.argv[2] ?? 'kargo-backup-heitor.json';
const backup = backupFromPlan(HEITOR_PROGRAM, randomUUID, new Date().toISOString());
writeFileSync(out, JSON.stringify(backup, null, 2));
console.log(`Backup salvo em ${out}: ${backup.tables.exercise.length} exercícios, ${backup.tables.routine.length} fichas.`);
