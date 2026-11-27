import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { afterSet, describeSets, nextPending, nudgeRest, plannedSets, upcoming, restBetween, roundRest, thousands, valuesForSet, workoutTotals } from './session.ts';

describe('treino em andamento', () => {
  test('séries planejadas com ajuste do ⋯', () => {
    assert.deepEqual(plannedSets(3, 4, 0), { min: 3, max: 4 });
    assert.deepEqual(plannedSets(3, 3, 1), { min: 4, max: 4 });
    assert.deepEqual(plannedSets(1, 1, -3), { min: 1, max: 1 });
  });

  test('depois de cada série', () => {
    assert.equal(afterSet(2, 3, 4), 'continuar');
    assert.equal(afterSet(3, 3, 4), 'opcional');
    assert.equal(afterSet(4, 3, 4), 'completo');
    assert.equal(afterSet(3, 3, 3), 'completo');
  });

  test('próximo pendente na ordem, voltando ao começo', () => {
    const items = [
      { id: 'a', status: 'feito' as const },
      { id: 'b', status: 'pendente' as const },
      { id: 'c', status: 'pulado' as const },
      { id: 'd', status: 'pendente' as const },
    ];
    assert.equal(nextPending(items, 'b')?.id, 'd');
    assert.equal(nextPending(items, 'd')?.id, 'b');
    assert.equal(nextPending(items, null)?.id, 'b');
    assert.equal(nextPending([{ id: 'a', status: 'feito' as const }], 'a'), null);
  });

  test('valores da próxima série', () => {
    const prefill = { sets: [{ load: 24, reps: 10 }, { load: 24, reps: 9 }], increased: false };
    assert.deepEqual(valuesForSet(prefill, 0, null), { load: 24, reps: 10 });
    assert.deepEqual(valuesForSet(prefill, 1, { load: 26, reps: 8 }), { load: 26, reps: 9 });
    assert.deepEqual(valuesForSet(prefill, 5, { load: 26, reps: 8 }), { load: 26, reps: 9 });
  });

  test('descanso entre séries', () => {
    assert.equal(restBetween('2026-11-20T10:00:00Z', '2026-11-20T10:02:05Z'), 125);
    assert.equal(restBetween(null, '2026-11-20T10:02:05Z'), null);
  });

  test('resumo', () => {
    const t = workoutTotals('2026-11-20T10:00:00Z', '2026-11-20T11:02:00Z', [
      { status: 'feito', sets: [{ load: 24, reps: 9 }, { load: 24, reps: 8 }] },
      { status: 'pulado', sets: [] },
    ]);
    assert.deepEqual(t, { minutes: 62, sets: 2, volume: 408 });
    assert.equal(describeSets([{ load: 24, reps: 9 }, { load: 24, reps: 8 }]), '24 kg × 9, 8');
    assert.equal(describeSets([{ load: 0, reps: 8 }, { load: 0, reps: 7 }]), '× 8, 7');
    assert.equal(describeSets([{ load: 22.5, reps: 9 }, { load: 20, reps: 8 }]), '22,5×9, 20×8');
    assert.equal(thousands(8450), '8.450');
    assert.equal(roundRest(161), 165);
  });

  test('fila "a seguir": pendentes depois do atual, voltando ao começo', () => {
    const items = [
      { id: 'a', status: 'feito' as const },
      { id: 'b', status: 'pendente' as const },
      { id: 'c', status: 'pulado' as const },
      { id: 'd', status: 'pendente' as const },
      { id: 'e', status: 'pendente' as const },
    ];
    assert.deepEqual(upcoming(items, 'd').map((i) => i.id), ['e', 'b']);
    assert.deepEqual(upcoming(items, 'b', 1).map((i) => i.id), ['d']);
    assert.deepEqual(upcoming(items, null).map((i) => i.id), ['b', 'd', 'e']);
    assert.deepEqual(upcoming([{ id: 'x', status: 'pendente' as const }], 'x'), []);
  });

  test('−15s / +15s no descanso', () => {
    assert.equal(nudgeRest(60, 15), 75);
    assert.equal(nudgeRest(20, -15), 15);
    assert.equal(nudgeRest(600, 15), 600);
  });
});
