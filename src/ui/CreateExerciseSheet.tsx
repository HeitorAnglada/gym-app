import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Text } from 'react-native';

import { DEFAULT_STEP, MUSCLE_LABEL, type Equipment, type MuscleGroup } from '../data/catalog.ts';
import { createExercise } from '../db/editing.ts';
import { formatLoad } from '../domain/editing.ts';
import { Chips, Field, Input, Muted, Sheet, SheetActions } from './components.tsx';
import { colors, fonts } from './theme.ts';

const MUSCLES = Object.keys(MUSCLE_LABEL) as MuscleGroup[];
const EQUIPMENT: Equipment[] = ['barra', 'halteres', 'maquina', 'polia', 'smith', 'peso_corporal', 'outro'];
export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barra: 'Barra', halteres: 'Halteres', maquina: 'Máquina', polia: 'Polia', smith: 'Smith', peso_corporal: 'Peso do corpo', outro: 'Outro',
};

/** Gaveta "Criar exercício": nome, grupo muscular e equipamento (que define o passo do −/+). */
export function CreateExerciseSheet({ visible, initialName, onClose, onCreated }: {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (exerciseId: string) => void;
}) {
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [busy, setBusy] = useState(false);

  // Cada vez que abre, começa do zero, com o nome que estava na busca.
  const openedWith = visible ? initialName : null;
  const [lastOpened, setLastOpened] = useState<string | null>(null);
  if (openedWith !== lastOpened) {
    setLastOpened(openedWith);
    if (openedWith !== null) {
      const n = openedWith.trim();
      setName(n ? n.charAt(0).toUpperCase() + n.slice(1) : '');
      setMuscle(null);
      setEquipment(null);
    }
  }

  const ready = !!name.trim() && !!muscle && !!equipment && !busy;

  return (
    <Sheet visible={visible} onClose={onClose} title="Criar exercício">
      <Field label="nome">
        <Input value={name} onChangeText={setName} placeholder="ex.: Remada máquina hammer" maxLength={60} />
      </Field>
      <Field label="grupo muscular">
        <Chips items={MUSCLES} value={muscle} onChange={setMuscle} label={(m) => MUSCLE_LABEL[m]} />
      </Field>
      <Field label="equipamento">
        <Chips items={EQUIPMENT} value={equipment} onChange={setEquipment} label={(e) => EQUIPMENT_LABEL[e]} />
      </Field>
      {equipment && (
        <Muted style={{ fontSize: 12 }}>
          Passo do −/+: <Text style={{ fontFamily: fonts.num, color: colors.text }}>{formatLoad(DEFAULT_STEP[equipment])} kg</Text>, pelo equipamento.
        </Muted>
      )}
      <SheetActions
        confirm="Criar"
        disabled={!ready}
        onCancel={onClose}
        onConfirm={async () => {
          if (!muscle || !equipment) return;
          setBusy(true);
          try {
            const id = await createExercise(db, name, muscle, equipment);
            onCreated(id);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Sheet>
  );
}
