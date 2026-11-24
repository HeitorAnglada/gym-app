/** Regras para montar e editar pastas, fichas e exercícios da ficha. */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const norm = (code: string) => code.trim().toUpperCase();

/** Próxima letra livre na pasta (A, B, C…). Com todas usadas: F27, F28… */
export function nextRoutineCode(existing: string[]): string {
  const used = new Set(existing.map(norm));
  for (const l of LETTERS) if (!used.has(l)) return l;
  let n = LETTERS.length + 1;
  while (used.has(`F${n}`)) n += 1;
  return `F${n}`;
}

/** Erro para mostrar na tela, ou null quando a letra pode ser usada. */
export function routineCodeError(code: string, otherCodes: string[]): string | null {
  const c = norm(code);
  if (!c) return 'O treino precisa de uma letra.';
  if (c.length > 4) return 'Use até 4 caracteres.';
  if (otherCodes.map(norm).includes(c)) return `Já existe um treino ${c} nesta ficha.`;
  return null;
}

/** Nome livre para uma cópia: "X (cópia)", "X (cópia 2)"… */
export function copyName(name: string, existing: string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  let candidate = `${name} (cópia)`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) candidate = `${name} (cópia ${n++})`;
  return candidate;
}

export interface Range {
  min: number;
  max: number;
}

/**
 * Muda uma ponta da faixa sem deixar o mínimo passar do máximo:
 * subir o mínimo acima do máximo empurra o máximo junto, e vice-versa.
 */
export function setRangeEnd(range: Range, end: 'min' | 'max', value: number, floor = 1, ceil = 99): Range {
  const v = Math.min(ceil, Math.max(floor, Math.round(value)));
  if (end === 'min') return { min: v, max: Math.max(v, range.max) };
  return { min: Math.min(v, range.min), max: v };
}

/** Move um item da lista uma casa para cima (-1) ou para baixo (+1). */
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return items;
  const out = [...items];
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}

/** Faixa padrão de um exercício novo na ficha. */
export const NEW_SLOT = { setsMin: 3, setsMax: 3, repsMin: 8, repsMax: 12 } as const;

/** Lê uma carga digitada ("22,5" ou "22.5"). Vazio = sem carga inicial. */
export function parseLoad(text: string): number | null | 'invalid' {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1000) return 'invalid';
  return Math.round(n * 100) / 100;
}

export function formatLoad(kg: number): string {
  return String(kg).replace('.', ',');
}
