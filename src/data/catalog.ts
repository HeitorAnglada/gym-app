/** Catálogo que vem com o app. `key` é estável: nunca mude uma key já publicada. */

export type MuscleGroup =
  | 'peito' | 'costas' | 'ombro' | 'biceps' | 'triceps' | 'antebraco'
  | 'quadriceps' | 'posterior' | 'gluteo' | 'panturrilha' | 'core';

export type Equipment = 'barra' | 'halteres' | 'maquina' | 'polia' | 'smith' | 'peso_corporal' | 'outro';

/** carga × reps, ou só tempo (prancha). Exercícios por tempo entram na v1.1. */
export type ExerciseKind = 'carga' | 'tempo';

export interface CatalogExercise {
  key: string;
  name: string;
  muscle: MuscleGroup;
  equipment: Equipment;
  kind?: ExerciseKind;
}

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  peito: 'Peito', costas: 'Costas', ombro: 'Ombro', biceps: 'Bíceps', triceps: 'Tríceps',
  antebraco: 'Antebraço', quadriceps: 'Quadríceps', posterior: 'Posterior', gluteo: 'Glúteo',
  panturrilha: 'Panturrilha', core: 'Core',
};

/** Passo padrão do −/+ pelo equipamento, em kg. */
export const DEFAULT_STEP: Record<Equipment, number> = {
  barra: 2.5, halteres: 2, maquina: 5, polia: 5, smith: 2.5, peso_corporal: 2.5, outro: 2.5,
};

const e = (key: string, name: string, muscle: MuscleGroup, equipment: Equipment, kind: ExerciseKind = 'carga'): CatalogExercise =>
  ({ key, name, muscle, equipment, kind });

export const CATALOG: CatalogExercise[] = [
  // Peito
  e('supino-reto-barra', 'Supino reto com barra', 'peito', 'barra'),
  e('supino-reto-halteres', 'Supino reto com halteres', 'peito', 'halteres'),
  e('supino-maquina', 'Supino máquina articulada', 'peito', 'maquina'),
  e('supino-reto-smith', 'Supino reto no Smith', 'peito', 'smith'),
  e('supino-inclinado-barra', 'Supino inclinado com barra', 'peito', 'barra'),
  e('supino-inclinado-halteres', 'Supino inclinado com halteres', 'peito', 'halteres'),
  e('supino-inclinado-maquina', 'Supino inclinado na máquina articulada', 'peito', 'maquina'),
  e('supino-inclinado-smith', 'Supino inclinado no Smith', 'peito', 'smith'),
  e('supino-declinado-halteres', 'Supino declinado com halteres', 'peito', 'halteres'),
  e('supino-declinado-barra', 'Supino declinado com barra', 'peito', 'barra'),
  e('peck-deck', 'Crucifixo / Peck deck (voador)', 'peito', 'maquina'),
  e('crucifixo-reto-halteres', 'Crucifixo reto com halteres', 'peito', 'halteres'),
  e('crucifixo-inclinado-halteres', 'Crucifixo inclinado com halteres', 'peito', 'halteres'),
  e('crossover-polia-media', 'Crossover na polia média/alta', 'peito', 'polia'),
  e('crossover-polia-alta-inferior', 'Crossover polia alta (peitoral inferior)', 'peito', 'polia'),
  e('paralelas', 'Paralelas / Dips', 'peito', 'peso_corporal'),
  e('dips-maquina', 'Dips na máquina', 'peito', 'maquina'),
  e('flexao-braco', 'Flexão de braço', 'peito', 'peso_corporal'),
  e('flexao-braco-peso', 'Flexão de braço com peso nas costas', 'peito', 'peso_corporal'),
  // Costas
  e('remada-curvada-barra', 'Remada curvada com barra', 'costas', 'barra'),
  e('remada-curvada-halteres', 'Remada curvada com halteres', 'costas', 'halteres'),
  e('remada-articulada-pronada', 'Remada articulada pronada', 'costas', 'maquina'),
  e('remada-articulada-neutra', 'Remada articulada pegada neutra', 'costas', 'maquina'),
  e('remada-cavalinho', 'Remada cavalinho (barra T)', 'costas', 'barra'),
  e('remada-cavalinho-unilateral', 'Remada cavalinho unilateral', 'costas', 'barra'),
  e('remada-baixa-barra-reta', 'Remada baixa com barra reta', 'costas', 'polia'),
  e('remada-baixa-triangulo', 'Remada baixa na polia (triângulo)', 'costas', 'polia'),
  e('remada-unilateral-serrote', 'Remada unilateral (serrote)', 'costas', 'halteres'),
  e('puxada-alta-aberta', 'Puxada alta aberta na polia', 'costas', 'polia'),
  e('puxada-alta-triangulo', 'Puxada alta com triângulo', 'costas', 'polia'),
  e('puxada-alta-supinada', 'Puxada alta pegada supinada', 'costas', 'polia'),
  e('puxada-articulada-convergente', 'Puxada articulada convergente', 'costas', 'maquina'),
  e('puxada-articulada-fechada', 'Puxada articulada fechada', 'costas', 'maquina'),
  e('puxada-cabo-duplo', 'Puxada aberta no cabo duplo', 'costas', 'polia'),
  e('barra-fixa', 'Barra fixa', 'costas', 'peso_corporal'),
  e('barra-fixa-pronada', 'Barra fixa pronada', 'costas', 'peso_corporal'),
  e('graviton', 'Barra fixa no Graviton', 'costas', 'maquina'),
  e('pulldown-braco-reto', 'Pulldown braço reto na polia', 'costas', 'polia'),
  e('levantamento-terra', 'Levantamento terra', 'costas', 'barra'),
  // Ombro
  e('desenvolvimento-halteres', 'Desenvolvimento com halteres', 'ombro', 'halteres'),
  e('desenvolvimento-militar-barra', 'Desenvolvimento militar com barra', 'ombro', 'barra'),
  e('desenvolvimento-smith', 'Desenvolvimento no Smith', 'ombro', 'smith'),
  e('desenvolvimento-maquina', 'Desenvolvimento articulado na máquina', 'ombro', 'maquina'),
  e('elevacao-lateral-halteres', 'Elevação lateral com halteres', 'ombro', 'halteres'),
  e('elevacao-lateral-polia', 'Elevação lateral na polia baixa', 'ombro', 'polia'),
  e('elevacao-lateral-maquina', 'Elevação lateral na máquina', 'ombro', 'maquina'),
  e('elevacao-lateral-inclinado', 'Elevação lateral inclinado no banco', 'ombro', 'halteres'),
  e('elevacao-frontal', 'Elevação frontal com halteres', 'ombro', 'halteres'),
  e('face-pull', 'Face pull na polia (corda)', 'ombro', 'polia'),
  e('crucifixo-invertido-peck-deck', 'Crucifixo invertido no peck deck', 'ombro', 'maquina'),
  e('crucifixo-invertido-halteres', 'Crucifixo invertido com halteres (banco 45°)', 'ombro', 'halteres'),
  e('remada-alta-aberta', 'Remada alta pegada aberta', 'ombro', 'barra'),
  e('encolhimento-halteres', 'Encolhimento com halteres', 'ombro', 'halteres'),
  // Tríceps
  e('triceps-polia-barra', 'Tríceps na polia (barra reta/V)', 'triceps', 'polia'),
  e('triceps-corda', 'Tríceps corda na polia', 'triceps', 'polia'),
  e('triceps-testa', 'Tríceps testa (barra W ou halteres)', 'triceps', 'barra'),
  e('triceps-testa-inclinado', 'Tríceps testa no banco inclinado', 'triceps', 'barra'),
  e('triceps-banco', 'Tríceps no banco (mergulho)', 'triceps', 'peso_corporal'),
  e('triceps-maquina-paralela', 'Tríceps na máquina paralela', 'triceps', 'maquina'),
  e('triceps-frances', 'Tríceps francês (cabo ou halter)', 'triceps', 'halteres'),
  e('triceps-coice-polia', 'Tríceps coice na polia baixa', 'triceps', 'polia'),
  e('triceps-corda-overhead', 'Tríceps corda acima da cabeça', 'triceps', 'polia'),
  // Bíceps e antebraço
  e('rosca-martelo-halteres', 'Rosca martelo com halteres', 'biceps', 'halteres'),
  e('rosca-martelo-corda', 'Rosca martelo com corda na polia', 'biceps', 'polia'),
  e('rosca-martelo-scott', 'Rosca martelo no banco Scott', 'biceps', 'halteres'),
  e('rosca-direta-w', 'Rosca direta com barra W', 'biceps', 'barra'),
  e('rosca-direta-barra', 'Rosca direta com barra reta', 'biceps', 'barra'),
  e('rosca-alternada', 'Rosca alternada com halteres em pé', 'biceps', 'halteres'),
  e('rosca-cabo-barra-reta', 'Rosca bíceps no cabo com barra reta', 'biceps', 'polia'),
  e('rosca-scott', 'Rosca no banco Scott', 'biceps', 'barra'),
  e('rosca-scott-halteres', 'Rosca Scott com halteres', 'biceps', 'halteres'),
  e('rosca-inclinado-45', 'Rosca no banco inclinado 45°', 'biceps', 'halteres'),
  e('rosca-aranha', 'Rosca aranha no banco 45° (spider curl)', 'biceps', 'halteres'),
  e('rosca-bayesian', 'Rosca bayesian na polia', 'biceps', 'polia'),
  e('rosca-concentrada', 'Rosca concentrada', 'biceps', 'halteres'),
  e('rosca-invertida-w', 'Rosca invertida com barra W', 'antebraco', 'barra'),
  e('rosca-punho', 'Rosca de punho', 'antebraco', 'barra'),
  // Pernas
  e('agachamento-livre', 'Agachamento livre com barra', 'quadriceps', 'barra'),
  e('agachamento-smith', 'Agachamento no Smith', 'quadriceps', 'smith'),
  e('leg-press-45', 'Leg press 45°', 'quadriceps', 'maquina'),
  e('hack-squat', 'Hack squat na máquina', 'quadriceps', 'maquina'),
  e('goblet-squat', 'Goblet squat com halter', 'quadriceps', 'halteres'),
  e('cadeira-extensora', 'Cadeira extensora', 'quadriceps', 'maquina'),
  e('passada-halteres', 'Passada / afundo com halteres', 'quadriceps', 'halteres'),
  e('agachamento-bulgaro', 'Agachamento búlgaro no banco', 'quadriceps', 'halteres'),
  e('sissy-squat', 'Sissy squat', 'quadriceps', 'peso_corporal'),
  e('rdl-halteres', 'RDL / terra romeno com halteres', 'posterior', 'halteres'),
  e('rdl-barra', 'RDL com barra olímpica', 'posterior', 'barra'),
  e('stiff-barra', 'Stiff com barra', 'posterior', 'barra'),
  e('good-morning', 'Good morning com barra', 'posterior', 'barra'),
  e('cadeira-flexora', 'Cadeira flexora', 'posterior', 'maquina'),
  e('mesa-flexora', 'Mesa flexora', 'posterior', 'maquina'),
  e('flexora-vertical-unilateral', 'Flexora vertical unilateral em pé', 'posterior', 'maquina'),
  e('flexao-nordica', 'Flexão nórdica', 'posterior', 'peso_corporal'),
  e('elevacao-pelvica', 'Elevação pélvica (hip thrust)', 'gluteo', 'barra'),
  e('abducao-maquina', 'Abdução na máquina', 'gluteo', 'maquina'),
  e('gluteo-polia', 'Glúteo coice na polia', 'gluteo', 'polia'),
  e('panturrilha-leg-press', 'Panturrilha no leg press', 'panturrilha', 'maquina'),
  e('panturrilha-smith', 'Panturrilha em pé no Smith', 'panturrilha', 'smith'),
  e('panturrilha-maquina-em-pe', 'Panturrilha na máquina em pé', 'panturrilha', 'maquina'),
  e('panturrilha-sentado', 'Panturrilha sentado', 'panturrilha', 'maquina'),
  e('panturrilha-unilateral', 'Panturrilha unilateral com halter', 'panturrilha', 'halteres'),
  // Core
  e('abdominal-crunch-polia', 'Abdominal crunch na polia', 'core', 'polia'),
  e('abdominal-infra-paralela', 'Abdominal infra na paralela', 'core', 'peso_corporal'),
  e('abdominal-maquina', 'Abdominal na máquina', 'core', 'maquina'),
  e('abdominal-declinado', 'Abdominal declinado com anilha', 'core', 'outro'),
  e('prancha', 'Prancha isométrica', 'core', 'peso_corporal', 'tempo'),
  e('abdominal-roda', 'Abdominal com roda', 'core', 'outro'),
];
