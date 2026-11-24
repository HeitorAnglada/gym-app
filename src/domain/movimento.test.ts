import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CATALOG } from '../data/catalog.ts';
import { figureAt, movementFor, MOVEMENTS, phase, VIEW } from './movimento.ts';

describe('animação dos exercícios', () => {
  test('todo exercício do catálogo tem animação', () => {
    for (const c of CATALOG) assert.ok(movementFor(c.name, c.muscle), c.key);
  });

  test('pelo nome, com acento ou não, e pelo grupo quando o nome não ajuda', () => {
    assert.equal(movementFor('Crossover na polia média/alta', 'peito'), 'crossover');
    assert.equal(movementFor('Supino inclinado com halteres', 'peito'), 'supino');
    assert.equal(movementFor('Tríceps testa (barra W ou halteres)', 'triceps'), 'tricepsTesta');
    assert.equal(movementFor('Triceps corda na polia', 'triceps'), 'tricepsPolia');
    assert.equal(movementFor('Flexão de braço', 'peito'), 'flexao');
    assert.equal(movementFor('Cadeira flexora', 'posterior'), 'flexora');
    assert.equal(movementFor('Meu exercício', 'costas'), 'remada');
    assert.equal(movementFor('Meu exercício', null), null);
  });

  test('o boneco fica dentro do quadro em todo o movimento', () => {
    for (const [name, m] of Object.entries(MOVEMENTS)) {
      for (let i = 0; i <= 10; i++) {
        const f = figureAt(m, i / 10);
        for (const [a, b] of f.bones) {
          for (const [x, y] of [a, b]) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y), name);
            assert.ok(x >= -2 && x <= VIEW.w + 2 && y >= -2 && y <= VIEW.h + 2, `${name} t=${i / 10}: (${x.toFixed(0)}, ${y.toFixed(0)})`);
          }
        }
      }
    }
  });

  test('vai e volta', () => {
    assert.equal(phase(0, 2), 0);
    assert.ok(Math.abs(phase(1, 2) - 1) < 1e-9);
    assert.ok(phase(2, 2) < 1e-9);
  });
});
