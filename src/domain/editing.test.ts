import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { copyName, moveItem, nextRoutineCode, parseLoad, routineCodeError, setRangeEnd } from './editing.ts';

describe('montar fichas', () => {
  test('próxima letra livre', () => {
    assert.equal(nextRoutineCode([]), 'A');
    assert.equal(nextRoutineCode(['A1', 'B', 'A2']), 'A');
    assert.equal(nextRoutineCode(['a', 'B']), 'C');
    assert.equal(nextRoutineCode([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']), 'F27');
  });

  test('letra não repete na pasta', () => {
    assert.equal(routineCodeError('b', ['A1', 'B']), 'Já existe um treino B nesta ficha.');
    assert.equal(routineCodeError('  ', []), 'O treino precisa de uma letra.');
    assert.equal(routineCodeError('C', ['A', 'B']), null);
    assert.equal(routineCodeError('ABCDE', []), 'Use até 4 caracteres.');
  });

  test('nome da cópia', () => {
    assert.equal(copyName('ABC', ['ABC']), 'ABC (cópia)');
    assert.equal(copyName('ABC', ['ABC', 'abc (cópia)']), 'ABC (cópia 2)');
  });

  test('mínimo nunca passa do máximo', () => {
    assert.deepEqual(setRangeEnd({ min: 8, max: 10 }, 'min', 11), { min: 11, max: 11 });
    assert.deepEqual(setRangeEnd({ min: 8, max: 10 }, 'max', 6), { min: 6, max: 6 });
    assert.deepEqual(setRangeEnd({ min: 3, max: 4 }, 'min', 0), { min: 1, max: 4 });
    assert.deepEqual(setRangeEnd({ min: 3, max: 4 }, 'max', 5), { min: 3, max: 5 });
  });

  test('mover na lista', () => {
    assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
    assert.deepEqual(moveItem(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
    assert.deepEqual(moveItem(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
  });

  test('carga digitada', () => {
    assert.equal(parseLoad('22,5'), 22.5);
    assert.equal(parseLoad(''), null);
    assert.equal(parseLoad('abc'), 'invalid');
    assert.equal(parseLoad('-2'), 'invalid');
  });
});
