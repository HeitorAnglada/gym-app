import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CATALOG } from '../data/catalog.ts';
import { bodyMap, fitBox, sceneAt } from './corpo.ts';
import { movementFor, MOVEMENTS, poseT, tempo, tempoPhase, variantFor, WORK, type Movement } from './movimento.ts';

const entries = Object.entries(MOVEMENTS) as [keyof typeof MOVEMENTS, Movement][];

describe('corpo e músculos da animação', () => {
  test('todo movimento diz qual é o músculo alvo', () => {
    for (const [k, m] of entries) {
      assert.ok(m.muscles && m.muscles.p.length > 0, k);
      assert.deepEqual(m.muscles, WORK[k]);
    }
  });

  test('o desenho nunca tem número quebrado (NaN/Infinity) em nenhum quadro', () => {
    for (const [k, m] of entries) {
      for (let i = 0; i <= 8; i++) {
        const c = i / 8;
        for (const s of sceneAt(m, poseT(m, c), { contraction: c })) assert.ok(!/NaN|Infinity/.test(s.d), `${k} c=${c}`);
      }
      const box = fitBox(m, 1.45);
      assert.ok(box.every(Number.isFinite) && box[2] > 0 && box[3] > 0, k);
      assert.ok(Math.abs(box[2] / box[3] - 1.45) < 1e-6, k);
    }
  });

  test('o músculo alvo aparece no desenho e no mapa de frente ou de costas', () => {
    for (const [k, m] of entries) {
      const scene = sceneAt(m, poseT(m, 1), { contraction: 1 });
      assert.ok(scene.some((s) => s.fill === '#9B55CC'), `${k}: alvo não desenhado`);
      const maps = [...bodyMap(m.muscles!, false), ...bodyMap(m.muscles!, true)];
      assert.ok(maps.some((s) => s.fill === '#9B55CC'), `${k}: alvo fora do mapa`);
    }
  });

  test('ritmo: sobe, segura em cima, desce devagar e pausa embaixo', () => {
    assert.equal(tempo(0, 3.2), 0);
    assert.equal(tempo(0.4 * 3.2, 3.2), 1);
    assert.ok(tempo(0.6 * 3.2, 3.2) > 0 && tempo(0.6 * 3.2, 3.2) < 1);
    assert.equal(tempo(0.95 * 3.2, 3.2), 0);
    assert.deepEqual([0.1, 0.4, 0.6, 0.95].map((x) => tempoPhase(x * 3.2, 3.2)), ['contrai', 'segura', 'volta devagar', 'alonga']);
  });

  test('exercícios da ficha do Heitor pegam o movimento e o alvo certos', () => {
    const cases: [string, string, string][] = [
      ['Supino inclinado com halteres', 'peito', 'peitoralSup'],
      ['Remada unilateral (serrote)', 'costas', 'dorsal'],
      ['Rosca banco inclinado 45°', 'biceps', 'biceps'],
      ['Rosca martelo com halteres', 'biceps', 'antebraco'],
      ['Elevação lateral com halteres', 'ombro', 'deltLat'],
      ['Face pull na polia com corda', 'ombro', 'deltPost'],
      ['Cadeira flexora', 'posterior', 'posterior'],
      ['Barra fixa pronada', 'costas', 'dorsal'],
    ];
    for (const [name, muscle, alvo] of cases) {
      const k = movementFor(name, muscle)!;
      assert.ok(variantFor(k, name).muscles!.p.includes(alvo as never), `${name} → ${k}`);
    }
    assert.equal(movementFor('Supino inclinado com halteres', 'peito'), 'supinoInclinado');
    assert.equal(movementFor('Remada unilateral (serrote)', 'costas'), 'remadaUnilateral');
    assert.ok(variantFor('supino', 'Supino reto com halteres').props!.some((p) => p.kind === 'dumbbell'));
  });

  test('todo exercício do catálogo desenha sem erro', () => {
    for (const c of CATALOG) {
      const m = variantFor(movementFor(c.name, c.muscle)!, c.name);
      assert.ok(sceneAt(m, 0.5, { contraction: 0.5 }).length > 10, c.key);
    }
  });
});
