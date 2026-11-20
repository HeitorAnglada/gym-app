import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { daysInMonth, leadingBlanks, startOfWeek } from './dates.ts';
import { addLoad, hitTopOfRange, isStalled, prefillNext, progressed } from './progression.ts';
import { averageRest, defaultRestSeconds, formatClock } from './rest.ts';
import { nextRoutineId } from './sequence.ts';
import { records, topLoad, volume } from './stats.ts';
import type { ExerciseSession, SlotTarget } from './types.ts';
import { canEditWorkout, shouldAutoFinish } from './workoutRules.ts';

const remada: SlotTarget = { setsMin: 3, setsMax: 3, repsMin: 8, repsMax: 10 };
const s = (date: string, ...sets: [number, number][]): ExerciseSession => ({
  date,
  sets: sets.map(([load, reps]) => ({ load, reps })),
});

describe('descanso', () => {
  test('padrão pela faixa de reps', () => {
    assert.equal(defaultRestSeconds(8), 150);
    assert.equal(defaultRestSeconds(10), 120);
    assert.equal(defaultRestSeconds(12), 90);
    assert.equal(defaultRestSeconds(15), 60);
  });
  test('média ignora os aproximados', () => {
    assert.equal(averageRest([{ seconds: 120, approximate: false }, { seconds: 180, approximate: false }, { seconds: 400, approximate: true }]), 150);
    assert.equal(averageRest([{ seconds: 400, approximate: true }]), null);
  });
  test('formato m:ss', () => {
    assert.equal(formatClock(150), '2:30');
    assert.equal(formatClock(59), '0:59');
  });
});

describe('progressão dupla', () => {
  test('bateu o teto em todas as séries sobe um passo', () => {
    const last = s('2026-11-13', [22, 10], [22, 10], [22, 10]);
    assert.equal(hitTopOfRange(last, remada), true);
    const next = prefillNext(last, remada, 2, null);
    assert.equal(next.increased, true);
    assert.deepEqual(next.sets[0], { load: 24, reps: 8 });
    assert.equal(next.sets.length, 3);
  });
  test('não bateu repete o último treino série a série', () => {
    const last = s('2026-11-20', [24, 9], [24, 8], [24, 8]);
    const next = prefillNext(last, remada, 2, null);
    assert.equal(next.increased, false);
    assert.deepEqual(next.sets.map((x) => x.reps), [9, 8, 8]);
  });
  test('menos séries que o mínimo não conta como teto', () => {
    assert.equal(hitTopOfRange(s('d', [22, 10], [22, 10]), remada), false);
  });
  test('sem histórico usa a carga inicial da ficha', () => {
    const next = prefillNext(null, remada, 2, 35);
    assert.deepEqual(next.sets[0], { load: 35, reps: 8 });
  });
  test('um passo a partir da carga que está ali', () => {
    assert.equal(addLoad(37.5, 2.5), 40);
    assert.equal(addLoad(42.5, 5), 47.5); // extensora do Heitor: não pula para 50
    assert.equal(addLoad(47, -5), 42); // puxada no triângulo: não cai para 40
    assert.equal(addLoad(17.5, -5), 12.5);
    assert.equal(addLoad(0.1, 0.2), 0.3);
    assert.equal(addLoad(2, -5), 0);
  });
  test('subir carga fora da grade do passo', () => {
    const ext: SlotTarget = { setsMin: 3, setsMax: 3, repsMin: 10, repsMax: 12 };
    const next = prefillNext(s('d', [42.5, 12], [42.5, 12], [42.5, 12]), ext, 5, 42.5);
    assert.equal(next.increased, true);
    assert.deepEqual(next.sets[0], { load: 47.5, reps: 10 });
  });
});

describe('estagnação', () => {
  test('mais carga ou mais reps é progresso', () => {
    assert.equal(progressed(s('b', [24, 8]), s('a', [22, 10])), true);
    assert.equal(progressed(s('b', [22, 9], [22, 9]), s('a', [22, 9], [22, 8])), true);
    assert.equal(progressed(s('b', [22, 8]), s('a', [22, 8])), false);
  });
  test('3 treinos seguidos sem progresso avisa', () => {
    const hist = [
      s('4', [22, 8], [22, 8]),
      s('3', [22, 8], [22, 8]),
      s('2', [22, 8], [22, 8]),
      s('1', [22, 8], [22, 8]),
    ];
    assert.equal(isStalled(hist), true);
    assert.equal(isStalled(hist.slice(0, 3)), false);
    assert.equal(isStalled([s('5', [22, 9], [22, 8]), ...hist]), false);
  });
});

describe('sequência', () => {
  const ids = ['A1', 'B', 'A2'];
  test('a seguinte à última, voltando ao começo', () => {
    assert.equal(nextRoutineId(ids, 'B'), 'A2');
    assert.equal(nextRoutineId(ids, 'A2'), 'A1');
  });
  test('pasta nova começa pela escolhida ou pela primeira', () => {
    assert.equal(nextRoutineId(ids, null), 'A1');
    assert.equal(nextRoutineId(ids, null, 'A2'), 'A2');
    assert.equal(nextRoutineId(ids, 'FB1', 'B'), 'B');
    assert.equal(nextRoutineId([], null), null);
  });
  test('a escolhida ao usar a pasta vale mesmo com histórico', () => {
    assert.equal(nextRoutineId(ids, 'A1', 'A2'), 'A2');
    assert.equal(nextRoutineId(ids, 'A1', 'apagada'), 'B');
  });
});

describe('estatísticas', () => {
  test('carga máxima, volume e recordes', () => {
    const a = s('a', [20, 10], [22, 9]);
    assert.equal(topLoad(a.sets), 22);
    assert.equal(volume(a.sets), 398);
    const r = records([a, s('b', [24, 9], [22, 10])]);
    assert.deepEqual(r.heaviest, { load: 24, reps: 9 });
    assert.equal(r.mostRepsByLoad.get(22), 10);
  });
});

describe('regras do treino', () => {
  test('edição liberada por 7 dias', () => {
    const ended = '2026-11-20T21:00:00.000Z';
    assert.equal(canEditWorkout(ended, new Date('2026-11-27T20:00:00.000Z')), true);
    assert.equal(canEditWorkout(ended, new Date('2026-11-28T22:00:00.000Z')), false);
  });
  test('finaliza sozinho após 3 h parado', () => {
    assert.equal(shouldAutoFinish('2026-11-20T18:00:00.000Z', new Date('2026-11-20T21:30:00.000Z')), true);
    assert.equal(shouldAutoFinish('2026-11-20T18:00:00.000Z', new Date('2026-11-20T20:00:00.000Z')), false);
  });
});

describe('datas', () => {
  test('semana começa na segunda', () => {
    const fri = new Date(2026, 10, 20);
    assert.equal(startOfWeek(fri).getDate(), 16);
    const sun = new Date(2026, 10, 22);
    assert.equal(startOfWeek(sun).getDate(), 16);
  });
  test('grade de novembro de 2026', () => {
    assert.equal(leadingBlanks(2026, 10), 6); // 1/11/2026 é domingo
    assert.equal(daysInMonth(2026, 10), 30);
  });
});
