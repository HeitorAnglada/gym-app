import type { ProgramPlan } from './plan.ts';

/**
 * Ficha do Heitor enviada em 19/11/2026 (A1 → B → A2).
 * Cargas entre parênteses na ficha original viram `load`.
 */
export const HEITOR_PROGRAM: ProgramPlan = {
  name: 'Hipertrofia ABC',
  routines: [
    {
      code: 'A1',
      name: 'Superiores, empurrar + braços',
      weekday: 1,
      slots: [
        { main: { key: 'supino-reto-barra', load: 10 }, subs: [{ key: 'supino-reto-halteres', load: 18 }, { key: 'supino-maquina' }, { key: 'supino-reto-smith' }], sets: [3, 4], reps: [6, 8] },
        { main: { key: 'remada-curvada-barra', load: 35 }, subs: [{ key: 'remada-curvada-halteres' }, { key: 'remada-articulada-pronada' }, { key: 'remada-cavalinho' }, { key: 'remada-baixa-barra-reta' }], sets: [3, 4], reps: [8, 10] },
        { main: { key: 'desenvolvimento-halteres' }, subs: [{ key: 'desenvolvimento-militar-barra' }, { key: 'desenvolvimento-smith' }, { key: 'desenvolvimento-maquina', load: 17.5 }], sets: [3, 3], reps: [8, 10] },
        { main: { key: 'paralelas', load: 50 }, subs: [{ key: 'supino-declinado-halteres' }, { key: 'flexao-braco-peso' }, { key: 'crossover-polia-alta-inferior' }], sets: [3, 3], reps: [8, 10] },
        { main: { key: 'puxada-alta-aberta', load: 40 }, subs: [{ key: 'barra-fixa-pronada' }, { key: 'puxada-articulada-convergente' }, { key: 'puxada-cabo-duplo' }], sets: [3, 3], reps: [10, 12] },
        { main: { key: 'triceps-polia-barra' }, subs: [{ key: 'triceps-corda' }, { key: 'triceps-testa' }, { key: 'triceps-banco' }, { key: 'triceps-maquina-paralela' }], sets: [3, 3], reps: [10, 12] },
        { main: { key: 'elevacao-lateral-halteres', load: 6 }, subs: [{ key: 'elevacao-lateral-polia' }, { key: 'elevacao-lateral-maquina' }, { key: 'elevacao-lateral-inclinado' }], sets: [3, 4], reps: [12, 15] },
        { main: { key: 'rosca-martelo-halteres', load: 10 }, subs: [{ key: 'rosca-martelo-corda' }, { key: 'rosca-invertida-w' }, { key: 'rosca-martelo-scott' }], sets: [3, 3], reps: [10, 12] },
      ],
    },
    {
      code: 'B',
      name: 'Inferiores completo + core',
      weekday: 3,
      slots: [
        { main: { key: 'agachamento-livre' }, subs: [{ key: 'leg-press-45' }, { key: 'agachamento-smith' }, { key: 'hack-squat' }, { key: 'goblet-squat' }], sets: [4, 4], reps: [6, 8] },
        { main: { key: 'rdl-halteres' }, subs: [{ key: 'rdl-barra' }, { key: 'stiff-barra', load: 40 }, { key: 'good-morning' }, { key: 'elevacao-pelvica' }], sets: [3, 4], reps: [8, 10] },
        { main: { key: 'cadeira-extensora', load: 42.5 }, subs: [{ key: 'passada-halteres' }, { key: 'agachamento-bulgaro' }, { key: 'sissy-squat' }], sets: [3, 3], reps: [10, 12] },
        { main: { key: 'cadeira-flexora', load: 50 }, subs: [{ key: 'mesa-flexora' }, { key: 'flexora-vertical-unilateral' }, { key: 'flexao-nordica' }], sets: [3, 3], reps: [10, 12] },
        { main: { key: 'panturrilha-leg-press' }, subs: [{ key: 'panturrilha-smith' }, { key: 'panturrilha-maquina-em-pe' }, { key: 'panturrilha-sentado' }, { key: 'panturrilha-unilateral' }], sets: [4, 4], reps: [12, 15] },
        { main: { key: 'abdominal-crunch-polia' }, subs: [{ key: 'abdominal-infra-paralela' }, { key: 'abdominal-maquina' }, { key: 'abdominal-declinado' }, { key: 'prancha' }], sets: [3, 3], reps: [12, 15] },
      ],
    },
    {
      code: 'A2',
      name: 'Superiores, puxar + bíceps + tríceps cabeça longa',
      weekday: 5,
      slots: [
        { main: { key: 'barra-fixa' }, subs: [{ key: 'puxada-alta-triangulo', load: 47 }, { key: 'puxada-alta-supinada' }, { key: 'puxada-articulada-fechada' }], sets: [3, 4], reps: [6, 8] },
        { main: { key: 'supino-inclinado-halteres', load: 16 }, subs: [{ key: 'supino-inclinado-barra' }, { key: 'supino-inclinado-maquina' }, { key: 'supino-inclinado-smith' }], sets: [3, 4], reps: [8, 10] },
        { main: { key: 'remada-unilateral-serrote' }, subs: [{ key: 'remada-baixa-triangulo' }, { key: 'remada-articulada-neutra', load: 30 }, { key: 'remada-cavalinho-unilateral' }], sets: [3, 3], reps: [8, 10] },
        { main: { key: 'peck-deck', load: 35 }, subs: [{ key: 'crossover-polia-media' }, { key: 'crucifixo-reto-halteres' }, { key: 'crucifixo-inclinado-halteres' }], sets: [3, 3], reps: [12, 15] },
        { main: { key: 'face-pull' }, subs: [{ key: 'crucifixo-invertido-peck-deck', load: 25 }, { key: 'crucifixo-invertido-halteres' }, { key: 'remada-alta-aberta' }], sets: [3, 3], reps: [12, 15] },
        { main: { key: 'triceps-frances' }, subs: [{ key: 'triceps-testa-inclinado' }, { key: 'triceps-coice-polia' }, { key: 'triceps-corda-overhead' }], sets: [3, 3], reps: [10, 12] },
        { main: { key: 'rosca-direta-w' }, subs: [{ key: 'rosca-alternada' }, { key: 'rosca-cabo-barra-reta' }, { key: 'rosca-scott', load: 10 }], sets: [3, 3], reps: [8, 10] },
        { main: { key: 'rosca-inclinado-45' }, subs: [{ key: 'rosca-scott-halteres' }, { key: 'rosca-aranha' }, { key: 'rosca-bayesian' }], sets: [2, 3], reps: [10, 12] },
      ],
    },
  ],
};
