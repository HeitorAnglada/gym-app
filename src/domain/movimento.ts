/**
 * Animação dos exercícios: um boneco desenhado em SVG que vai e volta entre duas poses.
 * Tudo é calculado aqui, sem arquivo de imagem, então funciona offline e vale para
 * exercícios criados pelo usuário (pelo nome ou, sem acerto, pelo grupo muscular).
 *
 * Ângulos em graus no sistema do SVG (y para baixo): 0 = direita, 90 = baixo, -90 = cima, 180 = esquerda.
 * O boneco de lado olha para a direita. Cada segmento tem ângulo absoluto, não relativo ao anterior.
 */

export const VIEW = { w: 200, h: 180, ground: 172 } as const;

const LEN = { torso: 45, neck: 14, uarm: 27, farm: 25, thigh: 36, shin: 34, foot: 13, shoulder: 14, hip: 8 } as const;

export type Pt = [number, number];
type Joint = 'hip' | 'sh' | 'el' | 'ha' | 'kn' | 'an' | 'toe' | 'head';

interface Pose {
  torso: number;
  uarm: number;
  farm: number;
  thigh: number;
  shin: number;
  foot?: number;
  /** Sobe os ombros (encolhimento), em px. */
  lift?: number;
}

type Prop =
  | { kind: 'bar' | 'dumbbell' | 'pad'; at: Joint; dy?: number }
  | { kind: 'cable'; from: Pt; to: Joint }
  | { kind: 'plate'; at: Joint; angle: number }
  | { kind: 'line'; from: Pt; to: Pt }
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  /** Estofado inclinado (encosto do banco inclinado). */
  | { kind: 'slab'; from: Pt; to: Pt };

export interface Movement {
  /** Vista de frente (braços e pernas espelhados) ou de lado. */
  front?: boolean;
  /** Ponto que fica parado no lugar (o pé no agachamento, a mão na barra fixa…). */
  anchor: Joint;
  /** Onde fica o ponto fixo. null no x = não mexe na horizontal. */
  at: [number | null, number];
  a: Pose;
  b: Pose;
  props?: Prop[];
  /** Segundos de uma ida e volta. */
  period?: number;
  /** Pose fixa do braço/perna de trás (ou esquerdo), quando não acompanha o da frente (serrote). */
  far?: Partial<Pose>;
  /** Pose do músculo contraído (fim da subida). Padrão: b. */
  peak?: 'a' | 'b';
  /** Vista de frente, mas mostrando as costas (barra fixa, puxada). */
  back?: boolean;
  /** Músculos trabalhados: p = alvo, s = auxiliares. */
  muscles?: { p: MuscleId[]; s: MuscleId[] };
}

export type MuscleId =
  | 'peitoral' | 'peitoralSup' | 'deltAnt' | 'deltLat' | 'deltPost' | 'trapezio' | 'dorsal' | 'lombar'
  | 'abdomen' | 'biceps' | 'triceps' | 'antebraco' | 'quadriceps' | 'posterior' | 'gluteo' | 'panturrilha';

export const MUSCLE_NAME: Record<MuscleId, string> = {
  peitoral: 'peitoral', peitoralSup: 'peitoral superior', deltAnt: 'ombro (frente)', deltLat: 'ombro (lateral)',
  deltPost: 'ombro (posterior)', trapezio: 'trapézio', dorsal: 'dorsal', lombar: 'lombar', abdomen: 'abdômen',
  biceps: 'bíceps', triceps: 'tríceps', antebraco: 'antebraço', quadriceps: 'quadríceps', posterior: 'posterior de coxa',
  gluteo: 'glúteo', panturrilha: 'panturrilha',
};

/**
 * Ritmo de uma repetição: sobe (concêntrica) mais rápido, segura em cima, desce devagar, respira embaixo.
 * Devolve quanto já foi do caminho até o músculo contraído (0 = alongado, 1 = contraído).
 */
export function tempo(seconds: number, period: number): number {
  const x = (((seconds / period) % 1) + 1) % 1;
  const ease = (v: number) => (1 - Math.cos(Math.PI * v)) / 2;
  const UP = 0.32, TOP = 0.13, DOWN = 0.45; // o resto (0,10) é a pausa embaixo; mesmo corte de tempoPhase
  if (x < UP) return ease(x / UP);
  if (x < UP + TOP) return 1;
  if (x < UP + TOP + DOWN) return 1 - ease((x - UP - TOP) / DOWN);
  return 0;
}

/** Em que parte da repetição está, para a legenda embaixo da animação. */
export function tempoPhase(seconds: number, period: number): 'contrai' | 'segura' | 'volta devagar' | 'alonga' {
  const x = (((seconds / period) % 1) + 1) % 1;
  if (x < 0.32) return 'contrai';
  if (x < 0.45) return 'segura';
  if (x < 0.9) return 'volta devagar';
  return 'alonga';
}

/** Pose (t de figureAt) para uma contração c (0..1). */
export const poseT = (m: Movement, c: number) => ((m.peak ?? 'b') === 'b' ? c : 1 - c);

export interface Figure {
  bones: [Pt, Pt][];
  head: Pt;
  props: { lines: [Pt, Pt][]; cables: [Pt, Pt][]; dots: { c: Pt; r: number; kind: 'bar' | 'dumbbell' | 'pad' }[]; plates: [Pt, Pt][]; rects: { x: number; y: number; w: number; h: number }[]; slabs: [Pt, Pt][] };
}

const rad = (d: number) => (d * Math.PI) / 180;
const step = (p: Pt, len: number, ang: number): Pt => [p[0] + len * Math.cos(rad(ang)), p[1] + len * Math.sin(rad(ang))];
const add = (p: Pt, d: Pt): Pt => [p[0] + d[0], p[1] + d[1]];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Espelha um ângulo no eixo vertical (braço/perna do outro lado, na vista de frente). */
const mirror = (ang: number) => 180 - ang;

function lerpPose(a: Pose, b: Pose, t: number): Required<Pose> {
  return {
    torso: lerp(a.torso, b.torso, t),
    uarm: lerp(a.uarm, b.uarm, t),
    farm: lerp(a.farm, b.farm, t),
    thigh: lerp(a.thigh, b.thigh, t),
    shin: lerp(a.shin, b.shin, t),
    foot: lerp(a.foot ?? 0, b.foot ?? 0, t),
    lift: lerp(a.lift ?? 0, b.lift ?? 0, t),
  };
}

/** Vai e volta suave: 0 → 1 → 0 em um período. */
export function phase(seconds: number, period: number): number {
  return (1 - Math.cos((2 * Math.PI * seconds) / period)) / 2;
}

/** Um lado do corpo: braço e perna. */
export interface Side { sh: Pt; el: Pt; ha: Pt; hip: Pt; kn: Pt; an: Pt; toe: Pt }

/**
 * Esqueleto no instante t. De lado, `near` é o lado que a gente vê e `far` o de trás
 * (mesma pose, um pouco deslocado, para dar profundidade). De frente, `near` = direita e `far` = esquerda.
 */
export interface Skeleton {
  front: boolean;
  hip: Pt;
  sh: Pt;
  head: Pt;
  near: Side;
  far: Side;
}

/** Deslocamento do lado de trás na vista de lado. */
const FAR: Pt = [-3, -2];

export function skeletonAt(m: Movement, t: number): Skeleton {
  const p = lerpPose(m.a, m.b, t);
  const hip: Pt = [100, 100];
  const sh = add(step(hip, LEN.torso, p.torso), [0, -p.lift]);
  const head = step(sh, LEN.neck, p.torso);
  if (m.front) head[1] = sh[1] - LEN.neck;

  const side = (dir: 1 | -1, p: Required<Pose>): Side => {
    const ang = (a: number) => (dir === 1 ? a : mirror(a));
    const s: Pt = m.front ? [sh[0] + dir * LEN.shoulder, sh[1]] : sh;
    const el = step(s, LEN.uarm, ang(p.uarm));
    const ha = step(el, LEN.farm, ang(p.farm));
    const h: Pt = m.front ? [hip[0] + dir * LEN.hip, hip[1]] : hip;
    const kn = step(h, LEN.thigh, ang(p.thigh));
    const an = step(kn, LEN.shin, ang(p.shin));
    const toe = step(an, LEN.foot, ang(p.foot));
    return { sh: s, el, ha, hip: h, kn, an, toe };
  };
  const near = side(1, p);
  const farPose = { ...p, ...m.far };
  let far = side(-1, farPose);
  if (!m.front) {
    const n = side(1, farPose);
    far = Object.fromEntries(Object.entries(n).map(([k, v]) => [k, add(v, FAR)])) as unknown as Side;
  }

  const joints: Record<Joint, Pt> = { hip, sh, el: near.el, ha: near.ha, kn: near.kn, an: near.an, toe: near.toe, head };
  const cur = joints[m.anchor];
  const d: Pt = [m.at[0] == null ? 0 : m.at[0] - cur[0], m.at[1] - cur[1]];
  const mv = (q: Pt) => add(q, d);
  const mvSide = (s: Side): Side => ({ sh: mv(s.sh), el: mv(s.el), ha: mv(s.ha), hip: mv(s.hip), kn: mv(s.kn), an: mv(s.an), toe: mv(s.toe) });
  return { front: !!m.front, hip: mv(hip), sh: mv(sh), head: mv(head), near: mvSide(near), far: mvSide(far) };
}

/** O boneco e os aparelhos no instante t (0 = pose a, 1 = pose b). */
export function figureAt(m: Movement, t: number): Figure {
  const k = skeletonAt(m, t);
  const { near, far } = k;
  const bones: [Pt, Pt][] = [];
  const handsList: Pt[] = [near.ha];
  const anklesList: Pt[] = [near.an];
  if (m.front) {
    bones.push(
      [far.sh, near.sh], [far.hip, near.hip], [k.hip, k.sh],
      [near.sh, near.el], [near.el, near.ha], [far.sh, far.el], [far.el, far.ha],
      [near.hip, near.kn], [near.kn, near.an], [far.hip, far.kn], [far.kn, far.an],
    );
    handsList.push(far.ha);
    anklesList.push(far.an);
  } else {
    bones.push([k.hip, k.sh], [k.sh, near.el], [near.el, near.ha], [k.hip, near.kn], [near.kn, near.an], [near.an, near.toe]);
  }
  const joints: Record<Joint, Pt> = { hip: k.hip, sh: k.sh, el: near.el, ha: near.ha, kn: near.kn, an: near.an, toe: near.toe, head: k.head };
  const mv = (q: Pt) => q;

  const at = (j: Joint): Pt[] => {
    if (j === 'ha') return handsList.map(mv);
    if (j === 'an') return anklesList.map(mv);
    return [mv(joints[j])];
  };

  const props: Figure['props'] = { lines: [], cables: [], dots: [], rects: [], slabs: [], plates: [] };
  for (const pr of m.props ?? []) {
    switch (pr.kind) {
      case 'bar': {
        const pts = at(pr.at).map((q) => add(q, [0, pr.dy ?? 0]));
        if (m.front && pts.length === 2) {
          const [r, l] = pts;
          props.lines.push([[l[0] - 16, l[1]], [r[0] + 16, r[1]]]);
          // barra de polia (puxada) não tem anilha
          if (!m.props?.some((q) => q.kind === 'cable')) props.plates.push([[l[0] - 12, l[1] - 9], [l[0] - 12, l[1] + 9]], [[r[0] + 12, r[1] - 9], [r[0] + 12, r[1] + 9]]);
        } else pts.forEach((q) => props.dots.push({ c: q, r: 6, kind: 'bar' }));
        break;
      }
      case 'dumbbell':
        at(pr.at).forEach((q) => props.dots.push({ c: add(q, [0, pr.dy ?? 0]), r: 4.5, kind: 'dumbbell' }));
        break;
      case 'pad':
        at(pr.at).forEach((q) => props.dots.push({ c: add(q, [0, pr.dy ?? 0]), r: 5, kind: 'pad' }));
        break;
      case 'cable':
        at(pr.to).forEach((q, i) => {
          const from: Pt = m.front && i === 1 ? [VIEW.w - pr.from[0], pr.from[1]] : pr.from;
          props.cables.push([from, q]);
        });
        break;
      case 'plate':
        at(pr.at).forEach((q) => props.lines.push([step(q, 12, pr.angle), step(q, 12, pr.angle + 180)]));
        break;
      case 'line':
        props.lines.push([pr.from, pr.to]);
        break;
      case 'rect':
        props.rects.push({ x: pr.x, y: pr.y, w: pr.w, h: pr.h });
        break;
      case 'slab':
        props.slabs.push([pr.from, pr.to]);
        break;
    }
  }

  return { bones, head: k.head, props };
}

// ---------------------------------------------------------------------------
// Movimentos

const STAND: Pose = { torso: -90, uarm: 90, farm: 90, thigh: 90, shin: 90, foot: 0 };
const FRONT_LEGS = { thigh: 94, shin: 90 };
const BENCH: Prop = { kind: 'rect', x: 30, y: 143, w: 100, h: 9 };
const BENCH_LEGS: Prop[] = [
  { kind: 'line', from: [40, 152], to: [40, 172] },
  { kind: 'line', from: [120, 152], to: [120, 172] },
];
const SEAT = (x: number, y: number): Prop[] => [
  { kind: 'rect', x: x - 22, y, w: 44, h: 7 },
  { kind: 'line', from: [x, y + 7], to: [x, 172] },
];
const LYING = { anchor: 'hip' as const, at: [110, 134] as [number, number] };
const LYING_LEGS = { thigh: 0, shin: 90, foot: 0 };

export const MOVEMENTS = {
  supino: {
    ...LYING,
    a: { torso: 180, uarm: 25, farm: -100, ...LYING_LEGS },
    b: { torso: 180, uarm: -85, farm: -90, ...LYING_LEGS },
    props: [BENCH, ...BENCH_LEGS, { kind: 'bar', at: 'ha' }],
  },
  crucifixo: {
    front: true, anchor: 'an', at: [null, 170],
    a: { torso: -90, uarm: -5, farm: -10, ...FRONT_LEGS },
    b: { torso: -90, uarm: 110, farm: 95, ...FRONT_LEGS },
    props: [{ kind: 'dumbbell', at: 'ha' }],
  },
  crossover: {
    front: true, anchor: 'an', at: [null, 170],
    a: { torso: -90, uarm: -5, farm: -10, ...FRONT_LEGS },
    b: { torso: -90, uarm: 110, farm: 95, ...FRONT_LEGS },
    props: [{ kind: 'cable', from: [192, 8], to: 'ha' }, { kind: 'line', from: [192, 0], to: [192, 172] }, { kind: 'line', from: [8, 0], to: [8, 172] }],
  },
  flexao: {
    anchor: 'toe', at: [170, 172],
    a: { torso: -153, uarm: 90, farm: 90, thigh: 27, shin: 27, foot: 60 },
    b: { torso: -170, uarm: 5, farm: 132, thigh: 10, shin: 10, foot: 60 },
  },
  paralelas: {
    anchor: 'ha', at: [110, 70],
    a: { torso: -92, uarm: 90, farm: 90, thigh: 100, shin: 130, foot: 40 },
    b: { torso: -75, uarm: 170, farm: 80, thigh: 80, shin: 120, foot: 40 },
    props: [{ kind: 'line', from: [80, 70], to: [140, 70] }],
  },
  remada: {
    anchor: 'toe', at: [125, 172],
    a: { torso: -35, uarm: 92, farm: 90, thigh: 72, shin: 100, foot: 0 },
    b: { torso: -35, uarm: 172, farm: 95, thigh: 72, shin: 100, foot: 0 },
    props: [{ kind: 'bar', at: 'ha' }],
  },
  remadaSentada: {
    anchor: 'hip', at: [62, 145],
    a: { torso: -65, uarm: 5, farm: 0, thigh: -8, shin: 12, foot: -80 },
    b: { torso: -95, uarm: 160, farm: 0, thigh: -8, shin: 12, foot: -80 },
    props: [...SEAT(62, 147), { kind: 'cable', from: [196, 140], to: 'ha' }, { kind: 'line', from: [196, 110], to: [196, 172] }],
  },
  puxada: {
    front: true, anchor: 'hip', at: [100, 118],
    a: { torso: -90, uarm: -75, farm: -85, thigh: 35, shin: 95 },
    b: { torso: -90, uarm: 35, farm: -80, thigh: 35, shin: 95 },
    props: [...SEAT(100, 120), { kind: 'bar', at: 'ha' }, { kind: 'cable', from: [100, 0], to: 'ha' }],
  },
  barraFixa: {
    front: true, anchor: 'ha', at: [null, 10],
    a: { torso: -90, uarm: -78, farm: -86, thigh: 92, shin: 92 },
    b: { torso: -90, uarm: 35, farm: -80, thigh: 92, shin: 92 },
    props: [{ kind: 'line', from: [40, 10], to: [160, 10] }],
  },
  pulldownBracoReto: {
    anchor: 'toe', at: [112, 172],
    a: { torso: -70, uarm: -40, farm: -40, thigh: 92, shin: 92, foot: 0 },
    b: { torso: -70, uarm: 100, farm: 100, thigh: 92, shin: 92, foot: 0 },
    props: [{ kind: 'cable', from: [175, 4], to: 'ha' }],
  },
  terra: {
    anchor: 'toe', at: [112, 172],
    a: { ...STAND },
    b: { torso: -12, uarm: 90, farm: 90, thigh: 68, shin: 96, foot: 0 },
    props: [{ kind: 'bar', at: 'ha' }],
  },
  agachamento: {
    anchor: 'toe', at: [112, 172],
    a: { ...STAND, uarm: 135, farm: -55 },
    b: { torso: -52, uarm: 175, farm: -20, thigh: 12, shin: 115, foot: 0 },
    props: [{ kind: 'bar', at: 'sh', dy: -2 }],
  },
  legPress: {
    anchor: 'hip', at: [70, 132],
    a: { torso: -150, uarm: 80, farm: 20, thigh: -48, shin: 25, foot: -70 },
    b: { torso: -150, uarm: 80, farm: 20, thigh: -32, shin: -28, foot: -110 },
    props: [{ kind: 'line', from: [40, 160], to: [95, 137] }, { kind: 'plate', at: 'an', angle: 60 }],
  },
  extensora: {
    anchor: 'hip', at: [85, 118],
    a: { torso: -95, uarm: 80, farm: 15, thigh: 0, shin: 95, foot: 5 },
    b: { torso: -95, uarm: 80, farm: 15, thigh: 0, shin: 5, foot: -85 },
    props: [...SEAT(88, 120), { kind: 'pad', at: 'an' }],
  },
  flexora: {
    anchor: 'hip', at: [85, 118],
    a: { torso: -95, uarm: 80, farm: 15, thigh: 0, shin: 8, foot: -82 },
    b: { torso: -95, uarm: 80, farm: 15, thigh: 0, shin: 110, foot: 20 },
    props: [...SEAT(88, 120), { kind: 'pad', at: 'an', dy: 5 }],
  },
  panturrilha: {
    anchor: 'toe', at: [112, 172],
    a: { ...STAND },
    b: { ...STAND, foot: 28 },
    props: [{ kind: 'dumbbell', at: 'ha' }],
    period: 1.6,
  },
  elevacaoPelvica: {
    anchor: 'toe', at: [158, 172],
    a: { torso: -168, uarm: 40, farm: 10, thigh: 32, shin: 95, foot: 0 },
    b: { torso: -180, uarm: 40, farm: 10, thigh: 0, shin: 95, foot: 0 },
    props: [{ kind: 'bar', at: 'hip', dy: -7 }, { kind: 'rect', x: 20, y: 144, w: 50, h: 7 }, { kind: 'line', from: [45, 151], to: [45, 172] }],
  },
  abdominal: {
    anchor: 'hip', at: [110, 164],
    a: { torso: 180, uarm: -20, farm: 160, thigh: -45, shin: 50, foot: 0 },
    b: { torso: 210, uarm: -60, farm: 130, thigh: -45, shin: 50, foot: 0 },
    period: 2,
  },
  prancha: {
    anchor: 'toe', at: [170, 172],
    a: { torso: -167, uarm: 90, farm: 180, thigh: 13, shin: 13, foot: 60 },
    b: { torso: -165, uarm: 92, farm: 180, thigh: 15, shin: 15, foot: 60 },
    period: 3,
  },
  rosca: {
    anchor: 'toe', at: [106, 172],
    a: { ...STAND, uarm: 92, farm: 90 },
    b: { ...STAND, uarm: 96, farm: -72 },
    props: [{ kind: 'dumbbell', at: 'ha' }],
  },
  tricepsPolia: {
    anchor: 'toe', at: [100, 172],
    a: { ...STAND, torso: -84, uarm: 96, farm: -15 },
    b: { ...STAND, torso: -84, uarm: 96, farm: 88 },
    props: [{ kind: 'cable', from: [128, 4], to: 'ha' }],
  },
  tricepsTesta: {
    ...LYING,
    a: { torso: 180, uarm: -100, farm: 165, ...LYING_LEGS },
    b: { torso: 180, uarm: -100, farm: 265, ...LYING_LEGS },
    props: [BENCH, ...BENCH_LEGS, { kind: 'bar', at: 'ha' }],
  },
  tricepsFrances: {
    anchor: 'toe', at: [106, 172],
    a: { ...STAND, uarm: -100, farm: 115 },
    b: { ...STAND, uarm: -100, farm: 265 },
    props: [{ kind: 'dumbbell', at: 'ha' }],
  },
  desenvolvimento: {
    front: true, anchor: 'an', at: [null, 170],
    a: { torso: -90, uarm: 15, farm: -90, ...FRONT_LEGS },
    b: { torso: -90, uarm: -70, farm: -85, ...FRONT_LEGS },
    props: [{ kind: 'dumbbell', at: 'ha' }],
  },
  elevacaoLateral: {
    front: true, anchor: 'an', at: [null, 170],
    a: { torso: -90, uarm: 80, farm: 84, ...FRONT_LEGS },
    b: { torso: -90, uarm: -5, farm: 0, ...FRONT_LEGS },
    props: [{ kind: 'dumbbell', at: 'ha' }],
  },
  elevacaoFrontal: {
    anchor: 'toe', at: [106, 172],
    a: { ...STAND, uarm: 90, farm: 90 },
    b: { ...STAND, uarm: 0, farm: 0 },
    props: [{ kind: 'dumbbell', at: 'ha' }],
  },
  remadaAlta: {
    front: true, anchor: 'an', at: [null, 170],
    a: { torso: -90, uarm: 96, farm: 96, ...FRONT_LEGS },
    b: { torso: -90, uarm: -20, farm: 160, ...FRONT_LEGS },
    props: [{ kind: 'bar', at: 'ha' }],
  },
  encolhimento: {
    front: true, anchor: 'an', at: [null, 170],
    a: { torso: -90, uarm: 88, farm: 90, ...FRONT_LEGS },
    b: { torso: -90, uarm: 88, farm: 90, ...FRONT_LEGS, lift: 7 },
    props: [{ kind: 'dumbbell', at: 'ha' }],
    period: 1.6,
  },
  supinoInclinado: {
    anchor: 'hip', at: [118, 136],
    a: { torso: -150, uarm: 55, farm: -90, thigh: 0, shin: 90, foot: 0 },
    b: { torso: -150, uarm: -100, farm: -95, thigh: 0, shin: 90, foot: 0 },
    props: [
      { kind: 'rect', x: 104, y: 141, w: 34, h: 9 }, { kind: 'line', from: [120, 150], to: [120, 172] },
      { kind: 'slab', from: [110, 150], to: [64, 120] }, { kind: 'line', from: [72, 128], to: [72, 172] },
      { kind: 'bar', at: 'ha' },
    ],
  },
  remadaUnilateral: {
    anchor: 'hip', at: [122, 100],
    a: { torso: -168, uarm: 92, farm: 90, thigh: 95, shin: 90, foot: 0 },
    b: { torso: -168, uarm: -22, farm: 100, thigh: 95, shin: 90, foot: 0 },
    far: { uarm: 90, farm: 90, thigh: 90, shin: 0, foot: 0 },
    props: [
      { kind: 'rect', x: 50, y: 140, w: 112, h: 9 }, { kind: 'line', from: [60, 149], to: [60, 172] }, { kind: 'line', from: [150, 149], to: [150, 172] },
      { kind: 'dumbbell', at: 'ha' },
    ],
  },
  roscaInclinada: {
    anchor: 'hip', at: [96, 136],
    a: { torso: -128, uarm: 100, farm: 100, thigh: 0, shin: 90, foot: 0 },
    b: { torso: -128, uarm: 100, farm: -55, thigh: 0, shin: 90, foot: 0 },
    props: [
      { kind: 'rect', x: 80, y: 141, w: 36, h: 9 }, { kind: 'line', from: [98, 150], to: [98, 172] },
      { kind: 'slab', from: [90, 145], to: [52, 98] },
      { kind: 'dumbbell', at: 'ha' },
    ],
  },
  facePull: {
    anchor: 'toe', at: [96, 172],
    a: { ...STAND, torso: -92, uarm: 0, farm: 0 },
    b: { ...STAND, torso: -92, uarm: -172, farm: -25 },
    props: [{ kind: 'cable', from: [196, 46], to: 'ha' }],
  },
} satisfies Record<string, Movement>;

export type MovementName = keyof typeof MOVEMENTS;

type Work = { p: MuscleId[]; s: MuscleId[] };
const w = (p: MuscleId[], s: MuscleId[] = []): Work => ({ p, s });

/** Músculos de cada movimento: p = alvo (açaí claro), s = ajudam (açaí escuro). */
export const WORK: Record<MovementName, Work> = {
  supino: w(['peitoral'], ['deltAnt', 'triceps']),
  supinoInclinado: w(['peitoralSup'], ['deltAnt', 'triceps']),
  crucifixo: w(['peitoral'], ['deltAnt']),
  crossover: w(['peitoral'], ['deltAnt']),
  flexao: w(['peitoral'], ['triceps', 'deltAnt', 'abdomen']),
  paralelas: w(['peitoral', 'triceps'], ['deltAnt']),
  remada: w(['dorsal'], ['trapezio', 'deltPost', 'biceps', 'lombar']),
  remadaUnilateral: w(['dorsal'], ['trapezio', 'deltPost', 'biceps']),
  remadaSentada: w(['dorsal'], ['trapezio', 'deltPost', 'biceps']),
  puxada: w(['dorsal'], ['biceps', 'trapezio', 'deltPost']),
  barraFixa: w(['dorsal'], ['biceps', 'trapezio', 'deltPost']),
  pulldownBracoReto: w(['dorsal'], ['triceps', 'abdomen']),
  terra: w(['posterior', 'gluteo'], ['lombar']),
  agachamento: w(['quadriceps', 'gluteo'], ['posterior', 'lombar']),
  legPress: w(['quadriceps', 'gluteo'], ['posterior']),
  extensora: w(['quadriceps']),
  flexora: w(['posterior'], ['panturrilha']),
  panturrilha: w(['panturrilha']),
  elevacaoPelvica: w(['gluteo'], ['posterior']),
  abdominal: w(['abdomen']),
  prancha: w(['abdomen'], ['deltAnt', 'quadriceps']),
  rosca: w(['biceps'], ['antebraco']),
  roscaInclinada: w(['biceps'], ['antebraco']),
  tricepsPolia: w(['triceps'], ['antebraco']),
  tricepsTesta: w(['triceps']),
  tricepsFrances: w(['triceps']),
  desenvolvimento: w(['deltAnt', 'deltLat'], ['triceps', 'trapezio']),
  elevacaoLateral: w(['deltLat'], ['trapezio']),
  elevacaoFrontal: w(['deltAnt'], ['peitoralSup']),
  remadaAlta: w(['deltLat', 'trapezio'], ['biceps']),
  encolhimento: w(['trapezio']),
  facePull: w(['deltPost'], ['trapezio']),
};

/** Movimentos em que o músculo contrai na pose a (descer é a parte fácil). */
const PEAK_A: MovementName[] = ['flexao', 'paralelas', 'terra', 'agachamento'];
/** De frente, mas o que trabalha está nas costas: mostra o corpo de costas. */
const FROM_BACK: MovementName[] = ['puxada', 'barraFixa'];

for (const [k, mv] of Object.entries(MOVEMENTS) as [MovementName, Movement][]) {
  mv.muscles = WORK[k];
  if (PEAK_A.includes(k)) mv.peak = 'a';
  if (FROM_BACK.includes(k)) mv.back = true;
}

/** Ajustes pelo nome do exercício: halteres no lugar da barra, músculo alvo de variações. */
export function variantFor(key: MovementName, name: string): Movement {
  const n = strip(name);
  const base: Movement = MOVEMENTS[key];
  let props = base.props;
  if (/halter/.test(n) && ['supino', 'supinoInclinado', 'remada', 'terra', 'tricepsTesta'].includes(key)) {
    props = props?.map((p) => (p.kind === 'bar' ? { ...p, kind: 'dumbbell' as const } : p));
  }
  if (/barra|militar/.test(n) && ['rosca', 'desenvolvimento'].includes(key)) {
    props = props?.map((p) => (p.kind === 'dumbbell' ? { ...p, kind: 'bar' as const } : p));
  }
  let muscles = base.muscles;
  if (/martelo|invertida/.test(n)) muscles = w(['biceps', 'antebraco'], []);
  else if (/triceps banco|mergulho/.test(n)) muscles = w(['triceps'], ['peitoral', 'deltAnt']);
  else if (/declinad/.test(n)) muscles = w(['peitoral'], ['triceps', 'deltAnt']);
  else if (/inclinad/.test(n) && ['crucifixo', 'crossover'].includes(key)) muscles = w(['peitoralSup'], ['deltAnt']);
  else if (/passada|afundo|bulgaro/.test(n)) muscles = w(['quadriceps', 'gluteo'], ['posterior']);
  else if (/good morning|stiff/.test(n)) muscles = w(['posterior'], ['gluteo', 'lombar']);
  else if (/supinada|chin/.test(n)) muscles = w(['dorsal', 'biceps'], ['trapezio']);
  return props === base.props && muscles === base.muscles ? base : { ...base, props, muscles };
}

const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Palavras do nome → movimento. A ordem importa: o primeiro que bate vence. */
const BY_NAME: [RegExp, MovementName][] = [
  [/prancha/, 'prancha'],
  [/abdominal|crunch/, 'abdominal'],
  [/panturrilha|gemeo/, 'panturrilha'],
  [/pelvica|hip thrust/, 'elevacaoPelvica'],
  [/flexao de braco|flexao braco/, 'flexao'],
  [/flexora|nordica|leg curl/, 'flexora'],
  [/extensora/, 'extensora'],
  [/leg press/, 'legPress'],
  [/agachamento|squat|hack|passada|afundo|bulgaro/, 'agachamento'],
  [/terra|rdl|stiff|good morning/, 'terra'],
  [/triceps testa|testa/, 'tricepsTesta'],
  [/frances|acima da cabeca|overhead/, 'tricepsFrances'],
  [/rosca.*inclinad|inclinad.*rosca|rosca banco/, 'roscaInclinada'],
  [/triceps banco|mergulho|paralela|dips/, 'paralelas'],
  [/triceps/, 'tricepsPolia'],
  [/rosca/, 'rosca'],
  [/crucifixo invertido|face pull|posterior de ombro/, 'facePull'],
  [/crossover/, 'crossover'],
  [/crucifixo|peck deck|voador/, 'crucifixo'],
  [/supino.*inclinad/, 'supinoInclinado'],
  [/supino/, 'supino'],
  [/elevacao lateral/, 'elevacaoLateral'],
  [/elevacao frontal/, 'elevacaoFrontal'],
  [/desenvolvimento|militar/, 'desenvolvimento'],
  [/encolhimento/, 'encolhimento'],
  [/remada alta/, 'remadaAlta'],
  [/remada baixa|remada sentada|remada articulada|remada na maquina/, 'remadaSentada'],
  [/serrote|unilateral/, 'remadaUnilateral'],
  [/remada|cavalinho/, 'remada'],
  [/braco reto|pullover/, 'pulldownBracoReto'],
  [/barra fixa|graviton|pull ?up|chin ?up/, 'barraFixa'],
  [/puxada|pulldown/, 'puxada'],
];

/** Sem palavra conhecida no nome: o movimento mais típico do grupo muscular. */
const BY_MUSCLE: Record<string, MovementName> = {
  peito: 'supino', costas: 'remada', ombro: 'desenvolvimento', biceps: 'rosca', triceps: 'tricepsPolia',
  antebraco: 'rosca', quadriceps: 'agachamento', posterior: 'terra', gluteo: 'elevacaoPelvica',
  panturrilha: 'panturrilha', core: 'abdominal',
};

/** Qual animação mostrar para um exercício, ou null quando não dá para saber. */
export function movementFor(name: string, muscle: string | null): MovementName | null {
  const n = strip(name);
  for (const [re, mv] of BY_NAME) if (re.test(n)) return mv;
  return (muscle && BY_MUSCLE[muscle]) || null;
}
