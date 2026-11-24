/**
 * Desenho do corpo da animação: troncos, braços e pernas com volume e os músculos por cima,
 * o alvo em açaí forte (pulsando com a contração) e os auxiliares em açaí escuro.
 * Tudo vira uma lista de caminhos SVG (`Shape`), então o mesmo código desenha no app e em
 * qualquer página: sem imagem, sem internet.
 */
import { figureAt, skeletonAt, type MuscleId, type Movement, type Pt, type Side, type Skeleton } from './movimento.ts';

export interface Shape {
  d: string;
  fill?: string;
  stroke?: string;
  sw?: number;
  op?: number;
}

export const PAL = {
  body: '#4A4A4A',
  bodyFar: '#2C2C2C',
  bodyLine: '#5C5C5C',
  prop: '#8A8A8A',
  propDark: '#1C1C1C',
  bench: '#2B2B2B',
  primary: '#9B55CC',
  glow: '#D29BF5',
  secondary: '#5B2A86',
};

// ---------------------------------------------------------------------------
// geometria

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const plus = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const len = (a: Pt) => Math.hypot(a[0], a[1]) || 1;
const unit = (a: Pt): Pt => mul(a, 1 / len(a));
/** Gira 90° no sentido do relógio da tela (y para baixo). */
const rotCW = (a: Pt): Pt => [-a[1], a[0]];
const rotCCW = (a: Pt): Pt => [a[1], -a[0]];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const f = (n: number) => (Math.round(n * 10) / 10).toString();
const P = (p: Pt) => `${f(p[0])} ${f(p[1])}`;

export function circle(c: Pt, r: number): string {
  return `M${f(c[0] - r)} ${f(c[1])}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

/** Cápsula afinando de a (meia-largura wa) até b (wb). */
export function capsule(a: Pt, b: Pt, wa: number, wb: number): string {
  const u = unit(sub(b, a));
  const n = rotCW(u);
  const a1 = plus(a, mul(n, wa)), a2 = plus(a, mul(n, -wa));
  const b1 = plus(b, mul(n, wb)), b2 = plus(b, mul(n, -wb));
  return `M${P(a1)}L${P(b1)}A${f(wb)} ${f(wb)} 0 0 0 ${P(b2)}L${P(a2)}A${f(wa)} ${f(wa)} 0 0 0 ${P(a1)}Z`;
}

/** Contorno fechado e suave passando perto dos pontos. */
function smooth(pts: Pt[]): string {
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${P(mid(pts[pts.length - 1], pts[0]))}`;
  for (let i = 0; i < pts.length; i++) d += `Q${P(pts[i])} ${P(mid(pts[i], pts[(i + 1) % pts.length]))}`;
  return d + 'Z';
}

/** Barriga do músculo: lente de a até b, estufando `out` para o lado n e `inn` para o outro. */
function lens(a: Pt, b: Pt, n: Pt, out: number, inn: number): string {
  const d = sub(b, a);
  let p = unit(rotCW(d));
  if (Math.abs(dot(p, n)) > 0.05 && dot(p, n) < 0) p = mul(p, -1);
  const k = 1.33;
  const c1 = plus(plus(a, mul(d, 0.3)), mul(p, out * k)), c2 = plus(plus(a, mul(d, 0.7)), mul(p, out * k));
  const c3 = plus(plus(a, mul(d, 0.7)), mul(p, -inn * k)), c4 = plus(plus(a, mul(d, 0.3)), mul(p, -inn * k));
  return `M${P(a)}C${P(c1)} ${P(c2)} ${P(b)}C${P(c3)} ${P(c4)} ${P(a)}Z`;
}

// ---------------------------------------------------------------------------
// segmentos do corpo

type Seg = 'torso' | 'uarm' | 'farm' | 'thigh' | 'shin';

interface Frame { o: Pt; u: Pt; L: number; n: Pt }

/**
 * Referencial de um segmento: origem, direção ao longo dele e normal.
 * De lado, a normal aponta para a frente do corpo. De frente/costas, para fora (lado do braço).
 */
function frame(k: Skeleton, side: Side, seg: Seg, dir: 1 | -1): Frame {
  const ends: Record<Seg, [Pt, Pt]> = {
    torso: [k.hip, k.sh], uarm: [side.sh, side.el], farm: [side.el, side.ha], thigh: [side.hip, side.kn], shin: [side.kn, side.an],
  };
  const [o, e] = ends[seg];
  const d = sub(e, o);
  const u = unit(d);
  let n: Pt;
  if (!k.front) n = seg === 'torso' ? rotCW(u) : rotCCW(u);
  else {
    n = rotCW(u);
    if (n[0] * dir < 0 || (Math.abs(n[0]) < 0.05 && seg === 'torso' && dir < 0)) n = mul(n, -1);
  }
  return { o, u, L: len(d), n };
}

const at = (fr: Frame, s: number, lat: number): Pt => plus(plus(fr.o, mul(fr.u, fr.L * s)), mul(fr.n, lat));

/** Tronco de lado: [posição ao longo, frente, costas]. */
const TORSO_SIDE: [number, number, number][] = [
  [-0.08, 7, 9.5], [0.12, 7.5, 9.5], [0.32, 7, 8], [0.5, 8.5, 8.5], [0.7, 12, 9.5], [0.86, 12, 9.5], [0.97, 8, 8], [1.04, 4, 5],
];
/** Tronco de frente: [posição ao longo, meia-largura]. */
const TORSO_FRONT: [number, number][] = [
  [-0.1, 12.5], [0.12, 11], [0.36, 10], [0.6, 11.5], [0.82, 14], [0.95, 15], [1.03, 12], [1.08, 5],
];

function torsoPath(k: Skeleton): string {
  const fr = frame(k, k.near, 'torso', 1);
  if (!k.front) {
    const front = TORSO_SIDE.map(([s, a]) => at(fr, s, a));
    const back = TORSO_SIDE.map(([s, , b]) => at(fr, s, -b)).reverse();
    return smooth([...front, ...back]);
  }
  const right = TORSO_FRONT.map(([s, w]) => plus(at(fr, s, 0), [w, 0]));
  const left = TORSO_FRONT.map(([s, w]) => plus(at(fr, s, 0), [-w, 0])).reverse();
  return smooth([...right, ...left]);
}

const WIDTH: Record<Seg | 'foot', [number, number]> = {
  torso: [0, 0], uarm: [6, 4.6], farm: [4.6, 3.3], thigh: [8.5, 5.6], shin: [5.6, 3.6], foot: [3.2, 2.2],
};

function arm(s: Side): string[] {
  return [capsule(s.sh, s.el, ...WIDTH.uarm), capsule(s.el, s.ha, ...WIDTH.farm), circle(s.ha, 3.9)];
}
function leg(s: Side, front: boolean): string[] {
  const out = [capsule(s.hip, s.kn, ...WIDTH.thigh), capsule(s.kn, s.an, ...WIDTH.shin)];
  if (!front) out.push(capsule(s.an, s.toe, ...WIDTH.foot));
  else out.push(circle(s.an, 3.8));
  return out;
}

// ---------------------------------------------------------------------------
// músculos: onde ficam em cada vista

/** [segmento, início, fim, lateral no início, lateral no fim, estufa para o lado n, estufa para o outro]. */
type Belly = [Seg, number, number, number, number, number, number];
type View = 'side' | 'front' | 'back';

const SIDE_MAP: Partial<Record<MuscleId, Belly[]>> = {
  peitoral: [['torso', 0.55, 0.97, 7, 7.5, 6, 4]],
  peitoralSup: [['torso', 0.75, 0.99, 7, 7, 5, 3]],
  abdomen: [['torso', 0.04, 0.56, 4, 4.5, 3.8, 2.5]],
  dorsal: [['torso', 0.38, 0.9, -5, -5.5, 2.5, 5.5]],
  lombar: [['torso', 0.02, 0.42, -5, -5, 2.5, 3.8]],
  trapezio: [['torso', 0.8, 1.13, -5.5, -2, 2.5, 4.5]],
  deltAnt: [['uarm', -0.12, 0.42, 2, 2, 4.8, 2.5]],
  deltLat: [['uarm', -0.2, 0.46, 0, 0, 6, 6]],
  deltPost: [['uarm', -0.12, 0.42, -2, -2, 2.5, 4.8]],
  biceps: [['uarm', 0.24, 0.9, 2.5, 2.5, 4.2, 2.6]],
  triceps: [['uarm', 0.12, 0.86, -2.5, -2.5, 2.6, 4.8]],
  antebraco: [['farm', 0.02, 0.62, 0, 0, 4.2, 3.8]],
  quadriceps: [['thigh', 0.08, 0.92, 3, 2.5, 6.5, 4.5]],
  posterior: [['thigh', 0.14, 0.9, -3, -2, 4.5, 6]],
  gluteo: [['thigh', -0.3, 0.3, -5, -4.5, 3.5, 7.5]],
  panturrilha: [['shin', 0.05, 0.58, -2.4, -2.4, 2.8, 5.2]],
};

const FRONT_MAP: Partial<Record<MuscleId, Belly[]>> = {
  peitoral: [['torso', 0.8, 0.78, 1.5, 14, 4.5, 7.5]],
  peitoralSup: [['torso', 0.88, 0.86, 1.5, 14, 3.5, 4.5]],
  abdomen: [['torso', 0.06, 0.6, 4, 4.5, 3.5, 3.5]],
  dorsal: [['torso', 0.45, 0.82, 9, 13.5, 3.5, 2]],
  trapezio: [['torso', 1.0, 0.98, 3.5, 14, 3.5, 2]],
  deltAnt: [['uarm', -0.16, 0.34, 0, 0, 5, 4.5]],
  deltLat: [['uarm', -0.18, 0.38, 1, 1, 6, 4]],
  biceps: [['uarm', 0.3, 0.9, 0, 0, 3.8, 3.8]],
  antebraco: [['farm', 0.02, 0.62, 0, 0, 4, 3.5]],
  quadriceps: [['thigh', 0.06, 0.92, 0, 0, 6, 6]],
  panturrilha: [['shin', 0.08, 0.55, 2, 2, 2.5, 1.5]],
};

const BACK_MAP: Partial<Record<MuscleId, Belly[]>> = {
  dorsal: [['torso', 0.32, 0.88, 2, 15, 6.5, 4]],
  trapezio: [['torso', 1.08, 0.55, 0.5, 0.5, 11, 0], ['torso', 0.98, 0.96, 3, 14, 3.5, 2.5]],
  lombar: [['torso', 0.04, 0.42, 3, 3, 3, 3]],
  deltPost: [['uarm', -0.16, 0.34, 0, 0, 5, 4.5]],
  deltLat: [['uarm', -0.18, 0.38, 1, 1, 6, 4]],
  triceps: [['uarm', 0.3, 0.9, 0, 0, 4, 4]],
  antebraco: [['farm', 0.02, 0.62, 0, 0, 4, 3.5]],
  gluteo: [['torso', -0.08, -0.12, 1, 12.5, 4, 8]],
  posterior: [['thigh', 0.12, 0.9, 0, 0, 5.5, 5.5]],
  panturrilha: [['shin', 0.04, 0.58, 0, 0, 5, 5]],
};

const MAPS: Record<View, Partial<Record<MuscleId, Belly[]>>> = { side: SIDE_MAP, front: FRONT_MAP, back: BACK_MAP };

function bellies(k: Skeleton, view: View, id: MuscleId, swell: number, segs: Seg[]): { near: string[]; far: string[] } {
  const out = { near: [] as string[], far: [] as string[] };
  for (const [seg, s0, s1, l0, l1, o, i] of MAPS[view][id] ?? []) {
    if (!segs.includes(seg)) continue;
    const sides: [Side, 1 | -1, 'near' | 'far'][] = k.front ? [[k.near, 1, 'near'], [k.far, -1, 'near']] : [[k.near, 1, 'near'], [k.far, 1, 'far']];
    for (const [side, dir, where] of sides) {
      // o tronco de lado é um só: não desenha de novo do lado de trás
      if (seg === 'torso' && where === 'far') continue;
      const fr = frame(k, side, seg, dir);
      const torsoFront = seg === 'torso' && k.front;
      const a = torsoFront ? plus(at(fr, s0, 0), [dir * l0, 0]) : at(fr, s0, l0);
      const b = torsoFront ? plus(at(fr, s1, 0), [dir * l1, 0]) : at(fr, s1, l1);
      const n = torsoFront ? fr.u : fr.n;
      out[where].push(lens(a, b, n, o * swell, i * swell));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// cena

export interface SceneOpts {
  /** 0 = alongado, 1 = contraído. Controla a pose e o "pulsar" do músculo alvo. */
  contraction: number;
  /** Desenha os aparelhos (barra, banco…). */
  props?: boolean;
}

function viewOf(m: Movement): View {
  return !m.front ? 'side' : m.back ? 'back' : 'front';
}

/** Tudo o que se desenha num quadro da animação, de trás para a frente. */
export function sceneAt(m: Movement, t: number, opts: SceneOpts): Shape[] {
  const k = skeletonAt(m, t);
  const fig = figureAt(m, t);
  const view = viewOf(m);
  const c = opts.contraction;
  const out: Shape[] = [];
  const showProps = opts.props ?? true;

  if (showProps) {
    for (const r of fig.props.rects) out.push({ d: roundRect(r.x, r.y, r.w, r.h, 3), fill: PAL.bench });
    for (const [a, b] of fig.props.lines) out.push({ d: `M${P(a)}L${P(b)}`, stroke: PAL.prop, sw: 4, op: 0.55 });
    for (const [a, b] of fig.props.cables) out.push({ d: `M${P(a)}L${P(b)}`, stroke: PAL.prop, sw: 1.4, op: 0.6 });
  }

  const muscles = m.muscles ?? { p: [], s: [] };
  const all: [MuscleId, boolean][] = [...muscles.s.map((id) => [id, false] as [MuscleId, boolean]), ...muscles.p.map((id) => [id, true] as [MuscleId, boolean])];
  const paint = (paths: string[], primary: boolean, far: boolean) => {
    for (const d of paths) {
      if (primary) {
        out.push({ d, stroke: PAL.glow, sw: 2 + 2.5 * c, op: (far ? 0.12 : 0.22) * (0.4 + 0.6 * c) });
        out.push({ d, fill: PAL.primary, op: (far ? 0.5 : 1) * (0.72 + 0.28 * c) });
      } else out.push({ d, fill: PAL.secondary, op: far ? 0.5 : 0.95 });
    }
  };
  const muscleLayer = (where: 'near' | 'far', segs: Seg[]) => {
    for (const [id, primary] of all) {
      const swell = primary ? 1 + 0.18 * c : 1;
      paint(bellies(k, view, id, swell, segs)[where], primary, where === 'far');
      // brilho no meio da barriga do músculo alvo, mais forte quando contrai
      if (primary && where === 'near') {
        for (const d of bellies(k, view, id, 0.38, segs).near) out.push({ d, fill: PAL.glow, op: 0.18 + 0.3 * c });
      }
    }
  };

  if (!k.front) {
    for (const d of [...leg(k.far, false), ...arm(k.far)]) out.push({ d, fill: PAL.bodyFar });
    muscleLayer('far', ['uarm', 'farm', 'thigh', 'shin']);
    out.push({ d: capsule(k.sh, k.head, 4.2, 4.2), fill: PAL.body });
    out.push({ d: circle(k.head, 9.5), fill: PAL.body });
    for (const d of leg(k.near, false)) out.push({ d, fill: PAL.body });
    out.push({ d: torsoPath(k), fill: PAL.body });
    muscleLayer('near', ['torso', 'thigh', 'shin']);
    if (showProps) heldProps(fig, out, 'behind');
    for (const d of arm(k.near)) out.push({ d, fill: PAL.body, stroke: PAL.bench, sw: 0.8 });
    muscleLayer('near', ['uarm', 'farm']);
  } else {
    for (const d of [...leg(k.near, true), ...leg(k.far, true)]) out.push({ d, fill: PAL.body });
    out.push({ d: capsule(k.sh, k.head, 4.5, 4.5), fill: PAL.body });
    out.push({ d: torsoPath(k), fill: PAL.body });
    out.push({ d: circle(k.head, 9.5), fill: PAL.body });
    for (const d of [...arm(k.near), ...arm(k.far)]) out.push({ d, fill: PAL.body, stroke: PAL.bench, sw: 0.8 });
    muscleLayer('near', ['torso', 'uarm', 'farm', 'thigh', 'shin']);
    if (showProps) heldProps(fig, out, 'behind');
  }
  if (showProps) heldProps(fig, out, 'front');
  return out;
}

function heldProps(fig: ReturnType<typeof figureAt>, out: Shape[], layer: 'behind' | 'front') {
  if (layer === 'behind') {
    for (const [a, b] of fig.props.plates) out.push({ d: `M${P(a)}L${P(b)}`, stroke: PAL.prop, sw: 6 });
    return;
  }
  for (const dt of fig.props.dots) {
    if (dt.kind === 'bar') {
      // anilha vazada: dá para ver o músculo atrás dela
      out.push({ d: circle(dt.c, 13), fill: PAL.propDark, op: 0.35 });
      out.push({ d: circle(dt.c, 12), stroke: PAL.prop, sw: 2.4 });
      out.push({ d: circle(dt.c, 8), stroke: PAL.prop, sw: 1, op: 0.5 });
      out.push({ d: circle(dt.c, 2.6), fill: PAL.prop });
    } else if (dt.kind === 'dumbbell') {
      out.push({ d: circle(dt.c, 6.5), fill: PAL.propDark, stroke: PAL.prop, sw: 2 });
      out.push({ d: circle(dt.c, 2), fill: PAL.prop });
    } else out.push({ d: circle(dt.c, 5.5), fill: PAL.prop, op: 0.8 });
  }
}

export function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}

// ---------------------------------------------------------------------------
// mapa do corpo (frente e costas, parado) com os músculos do exercício

const MAP_FRONT: Movement = {
  front: true, anchor: 'an', at: [null, 170],
  a: { torso: -90, uarm: 80, farm: 86, thigh: 94, shin: 90 }, b: { torso: -90, uarm: 80, farm: 86, thigh: 94, shin: 90 },
};

export function bodyMap(muscles: { p: MuscleId[]; s: MuscleId[] }, back: boolean): Shape[] {
  return sceneAt({ ...MAP_FRONT, back, muscles }, 0, { contraction: 0.6, props: false });
}

/**
 * Quadro (viewBox) que cabe o movimento inteiro com folga, para o corpo ocupar o espaço
 * em vez de ficar pequeno no canto. Sempre inclui o chão. Proporção fixa `ratio` (largura/altura).
 */
export function fitBox(m: Movement, ratio: number, pad = 12): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (p: Pt, r = 0) => {
    x0 = Math.min(x0, p[0] - r); x1 = Math.max(x1, p[0] + r);
    y0 = Math.min(y0, p[1] - r); y1 = Math.max(y1, p[1] + r);
  };
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const k = skeletonAt(m, t);
    const fig = figureAt(m, t);
    take(k.head, 10);
    for (const s of [k.near, k.far]) for (const p of Object.values(s)) take(p as Pt, 9);
    for (const d of fig.props.dots) take(d.c, d.kind === 'bar' ? 13 : 7);
    for (const r of fig.props.rects) { take([r.x, r.y]); take([r.x + r.w, r.y + r.h]); }
  }
  y1 = Math.max(y1, 174);
  x0 -= pad; x1 += pad; y0 -= pad; y1 += 4;
  let w = x1 - x0, h = y1 - y0;
  if (w / h < ratio) { const nw = h * ratio; x0 -= (nw - w) / 2; w = nw; }
  else { const nh = w / ratio; y0 -= nh - h; h = nh; }
  return [x0, y0, w, h];
}
