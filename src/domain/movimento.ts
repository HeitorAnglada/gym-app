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

type Pt = [number, number];
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
  | { kind: 'rect'; x: number; y: number; w: number; h: number };

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
}

export interface Figure {
  bones: [Pt, Pt][];
  head: Pt;
  props: { lines: [Pt, Pt][]; cables: [Pt, Pt][]; dots: { c: Pt; r: number }[]; rects: { x: number; y: number; w: number; h: number }[] };
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

/** O boneco e os aparelhos no instante t (0 = pose a, 1 = pose b). */
export function figureAt(m: Movement, t: number): Figure {
  const p = lerpPose(m.a, m.b, t);
  const hip: Pt = [100, 100];
  const sh = add(step(hip, LEN.torso, p.torso), [0, -p.lift]);
  const head = step(sh, LEN.neck, p.torso);
  if (m.front) head[1] = sh[1] - LEN.neck;

  // lado direito (ou o único, de lado)
  const shR: Pt = m.front ? [sh[0] + LEN.shoulder, sh[1]] : sh;
  const elR = step(shR, LEN.uarm, p.uarm);
  const haR = step(elR, LEN.farm, p.farm);
  const hipR: Pt = m.front ? [hip[0] + LEN.hip, hip[1]] : hip;
  const knR = step(hipR, LEN.thigh, p.thigh);
  const anR = step(knR, LEN.shin, p.shin);
  const toe = step(anR, LEN.foot, p.foot);

  const joints: Record<Joint, Pt> = { hip, sh, el: elR, ha: haR, kn: knR, an: anR, toe, head };
  const target = m.at;
  const cur = joints[m.anchor];
  const d: Pt = [target[0] == null ? 0 : target[0] - cur[0], target[1] - cur[1]];
  const mv = (q: Pt) => add(q, d);

  const bones: [Pt, Pt][] = [];
  const handsList: Pt[] = [];
  const anklesList: Pt[] = [];
  if (m.front) {
    const shL: Pt = [sh[0] - LEN.shoulder, sh[1]];
    const elL = step(shL, LEN.uarm, mirror(p.uarm));
    const haL = step(elL, LEN.farm, mirror(p.farm));
    const hipL: Pt = [hip[0] - LEN.hip, hip[1]];
    const knL = step(hipL, LEN.thigh, mirror(p.thigh));
    const anL = step(knL, LEN.shin, mirror(p.shin));
    bones.push(
      [shL, shR], [hipL, hipR], [hip, sh],
      [shR, elR], [elR, haR], [shL, elL], [elL, haL],
      [hipR, knR], [knR, anR], [hipL, knL], [knL, anL],
    );
    handsList.push(haR, haL);
    anklesList.push(anR, anL);
  } else {
    bones.push([hip, sh], [sh, elR], [elR, haR], [hip, knR], [knR, anR], [anR, toe]);
    handsList.push(haR);
    anklesList.push(anR);
  }

  const at = (j: Joint): Pt[] => {
    if (j === 'ha') return handsList.map(mv);
    if (j === 'an') return anklesList.map(mv);
    return [mv(joints[j])];
  };

  const props: Figure['props'] = { lines: [], cables: [], dots: [], rects: [] };
  for (const pr of m.props ?? []) {
    switch (pr.kind) {
      case 'bar': {
        const pts = at(pr.at).map((q) => add(q, [0, pr.dy ?? 0]));
        if (m.front && pts.length === 2) {
          const [r, l] = pts;
          props.lines.push([[l[0] - 10, l[1]], [r[0] + 10, r[1]]]);
        } else pts.forEach((q) => props.dots.push({ c: q, r: 6 }));
        break;
      }
      case 'dumbbell':
        at(pr.at).forEach((q) => props.dots.push({ c: add(q, [0, pr.dy ?? 0]), r: 4.5 }));
        break;
      case 'pad':
        at(pr.at).forEach((q) => props.dots.push({ c: add(q, [0, pr.dy ?? 0]), r: 5 }));
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
    }
  }

  return { bones: bones.map(([a, b]) => [mv(a), mv(b)]), head: mv(head), props };
}

// ---------------------------------------------------------------------------
// Movimentos

const STAND: Pose = { torso: -90, uarm: 90, farm: 90, thigh: 90, shin: 90, foot: 0 };
const FRONT_LEGS = { thigh: 94, shin: 90 };
const BENCH: Prop = { kind: 'rect', x: 30, y: 144, w: 100, h: 7 };
const BENCH_LEGS: Prop[] = [
  { kind: 'line', from: [40, 151], to: [40, 172] },
  { kind: 'line', from: [120, 151], to: [120, 172] },
];
const SEAT = (x: number, y: number): Prop[] => [
  { kind: 'rect', x: x - 22, y, w: 44, h: 7 },
  { kind: 'line', from: [x, y + 7], to: [x, 172] },
];
const LYING = { anchor: 'hip' as const, at: [110, 138] as [number, number] };
const LYING_LEGS = { thigh: 0, shin: 90, foot: 0 };

export const MOVEMENTS = {
  supino: {
    ...LYING,
    a: { torso: 180, uarm: 45, farm: -95, ...LYING_LEGS },
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
  facePull: {
    anchor: 'toe', at: [96, 172],
    a: { ...STAND, torso: -92, uarm: 0, farm: 0 },
    b: { ...STAND, torso: -92, uarm: -172, farm: -25 },
    props: [{ kind: 'cable', from: [196, 46], to: 'ha' }],
  },
} satisfies Record<string, Movement>;

export type MovementName = keyof typeof MOVEMENTS;

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
  [/triceps banco|mergulho|paralela|dips/, 'paralelas'],
  [/triceps/, 'tricepsPolia'],
  [/rosca/, 'rosca'],
  [/crucifixo invertido|face pull|posterior de ombro/, 'facePull'],
  [/crossover/, 'crossover'],
  [/crucifixo|peck deck|voador/, 'crucifixo'],
  [/supino/, 'supino'],
  [/elevacao lateral/, 'elevacaoLateral'],
  [/elevacao frontal/, 'elevacaoFrontal'],
  [/desenvolvimento|militar/, 'desenvolvimento'],
  [/encolhimento/, 'encolhimento'],
  [/remada alta/, 'remadaAlta'],
  [/remada baixa|remada sentada|remada articulada|remada na maquina/, 'remadaSentada'],
  [/remada|serrote|cavalinho/, 'remada'],
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
