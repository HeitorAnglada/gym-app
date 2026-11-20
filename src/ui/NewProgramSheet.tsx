import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { createProgram } from '../db/editing.ts';
import { copyName } from '../domain/editing.ts';
import { listPrograms, type ProgramRow } from '../db/queries.ts';
import { Field, Input, Option, Sheet, SheetActions } from './components.tsx';

/** Gaveta "Nova pasta": nome + em branco ou copiando outra pasta. Ao criar, abre a pasta. */
export function NewProgramSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  // Cada vez que abre, começa do zero.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName('');
      setCopyFrom(null);
      setPicking(false);
    }
  }

  useEffect(() => {
    if (visible) listPrograms(db).then(setPrograms);
  }, [visible, db]);

  const source = programs.find((p) => p.id === copyFrom);

  const create = async () => {
    setBusy(true);
    try {
      const id = await createProgram(db, name, copyFrom);
      onClose();
      router.push({ pathname: '/pasta/[id]', params: { id } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Nova pasta">
      <Field label="nome">
        <Input value={name} onChangeText={setName} placeholder="ex.: Hipertrofia ABC" autoFocus maxLength={40} />
      </Field>
      <Option title="Em branco" detail="você cria as fichas depois" selected={!copyFrom && !picking} onPress={() => { setCopyFrom(null); setPicking(false); }} />
      {programs.length > 0 && (
        <Option
          title="Copiar de uma pasta"
          detail={source ? `${source.name} · fichas, exercícios e substitutos` : 'fichas, exercícios e substitutos'}
          selected={!!copyFrom || picking}
          onPress={() => setPicking(true)}
        />
      )}
      {picking &&
        programs.map((p) => (
          <Option
            key={p.id}
            title={`   ${p.name}`}
            detail={`   ${p.routine_codes ?? 'sem fichas'}`}
            selected={copyFrom === p.id}
            onPress={() => { setCopyFrom(p.id); setPicking(false); if (!name.trim()) setName(copyName(p.name, programs.map((x) => x.name))); }}
          />
        ))}
      <SheetActions confirm="Criar" onCancel={onClose} onConfirm={create} disabled={!name.trim() || busy || (picking && !copyFrom)} />
    </Sheet>
  );
}
