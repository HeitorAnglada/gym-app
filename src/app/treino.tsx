import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { listSubstitutes, setExerciseStep } from '../db/editing.ts';
import { getSettings, type Settings } from '../db/settings.ts';
import {
  addSet, changeRest, currentExercise, endSet, goToExercise, moveOn, nextValues, removeSet, setNext, startSet, targetOf, toggleSkip,
} from '../db/treino.ts';
import {
  deleteSet, deleteWorkout, exerciseOutlook, exerciseSessions, finishWorkout, loadWorkout, setExerciseNote, swapExercise, updateSet,
  type ExerciseOutlook, type SetRow, type WorkoutData, type WorkoutExerciseRow,
} from '../db/workout.ts';
import { dayMonth } from '../domain/dates.ts';
import { formatLoad, parseLoad, parseStep, STEP_OPTIONS } from '../domain/editing.ts';
import { addLoad } from '../domain/progression.ts';
import { formatClock } from '../domain/rest.ts';
import { afterSet, describeSets, nextPending, plannedSets } from '../domain/session.ts';
import { askPermission, buzz, cancelRestEnd, clearOngoing, restEndNow, scheduleRestEnd, setupAlerts, showOngoing } from '../ui/alerts.ts';
import { BigButton, Chips, Field, Input, Label, LinkText, Muted, Option, Sheet, SheetActions, Stepper, s } from '../ui/components.tsx';
import { MovementAnimation } from '../ui/MovementAnimation.tsx';
import { colors, fonts, radius } from '../ui/theme.ts';
import { Text } from '../ui/text.tsx';

type SheetName = null | 'lista' | 'trocar' | 'menu' | 'nota' | 'descanso' | 'carga' | { set: SetRow; step: number };

interface SwapOption {
  exerciseId: string;
  name: string;
  initialLoad: number | null;
  main: boolean;
  last: string;
}

const range = (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`);
const elapsed = (fromIso: string | null, now: number) => (fromIso ? Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000)) : 0);

function clockLong(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s2 = String(sec % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s2}` : `${m}:${s2}`;
}

export default function Treino() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  /** undefined = carregando; null = não existe mais (apagado/descartado). */
  const [data, setData] = useState<WorkoutData | null | undefined>(undefined);
  const [outlook, setOutlook] = useState<ExerciseOutlook | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sheet, setSheet] = useState<SheetName>(null);
  const [swapOptions, setSwapOptions] = useState<SwapOption[]>([]);
  const [noteText, setNoteText] = useState('');
  const [restEdit, setRestEdit] = useState(90);
  const [setEdit, setSetEdit] = useState({ load: 0, reps: 0 });
  const [loadText, setLoadText] = useState('');
  const [stepText, setStepText] = useState('');
  const [showMove, setShowMove] = useState(false);
  /** Descanso (início|alvo) que já teve aviso com a tela aberta. */
  const alerted = useRef<string | null>(null);
  const permission = useRef(false);
  /** Uma ação por vez: o segundo toque enquanto a primeira grava é ignorado. */
  const busy = useRef(false);

  const reload = useCallback(async () => {
    const d = await loadWorkout(db, id);
    setData(d);
    return d;
  }, [db, id]);

  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      if (busy.current) return;
      busy.current = true;
      try {
        await fn();
      } catch (e) {
        Alert.alert('Não consegui salvar', (e as Error).message);
      } finally {
        await reload().catch(() => {});
        busy.current = false;
      }
    },
    [reload],
  );

  useFocusEffect(
    useCallback(() => {
      reload().then((d) => {
        if (d && d.workout.status !== 'aberto') router.replace({ pathname: '/fim/[id]', params: { id: d.workout.id } });
      });
    }, [reload]),
  );

  // relógio da tela
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // ajustes, avisos, tela ligada
  useEffect(() => {
    let left = false;
    let keep = false;
    (async () => {
      const st = await getSettings(db);
      if (left) return;
      setSettings(st);
      // Uma falha aqui (tela ligada ou permissão de aviso) não pode impedir a outra.
      if (st.keepAwake) {
        keep = true;
        await activateKeepAwakeAsync('treino').catch(() => {});
        // saiu da tela enquanto ligava: desliga aqui mesmo
        if (left) deactivateKeepAwake('treino').catch(() => {});
      }
      try {
        await setupAlerts();
        permission.current = await askPermission();
      } catch {
        permission.current = false;
      }
    })();
    return () => {
      left = true;
      if (keep) deactivateKeepAwake('treino').catch(() => {});
    };
  }, [db]);

  const workout = data?.workout;
  const exercises = data?.exercises ?? [];
  const current = data ? currentExercise(data) : null;

  // notificação fixa
  useEffect(() => {
    if (workout?.routine_code) showOngoing(`Treino ${workout.routine_code} em andamento`, 'Toque para voltar ao treino');
  }, [workout?.routine_code]);

  // o que se sabe do exercício atual
  const currentKey = current ? `${current.id}:${current.exercise_id}:${current.sets_min}:${current.reps_max}` : '';
  useEffect(() => {
    if (!current) return;
    let alive = true;
    exerciseOutlook(db, current.exercise_id, targetOf(current), current.step_kg, current.initial_load, current.workout_id).then(
      (o) => alive && setOutlook(o),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, currentKey]);

  // Aviso do fim do descanso com a tela aberta, na hora certa. O agendado (Android) pode
  // atrasar sem a permissão de alarme exato; aqui ele é trocado por um aviso imediato.
  // Só avisa se a tela viu o alvo chegar (até 3 s depois): ao voltar para a tela com o
  // descanso já passado, o aviso agendado já cuidou disso.
  const restElapsed = workout?.phase === 'descanso' ? elapsed(workout.phase_started_at, now) : 0;
  const restTarget = workout?.rest_target_sec ?? 0;
  const restKey = workout?.phase === 'descanso' ? `${workout.phase_started_at}|${restTarget}` : null;
  const nextUpName = current?.name ?? '';
  useEffect(() => {
    if (!restKey || !settings || restTarget <= 0 || restElapsed < restTarget || alerted.current === restKey) return;
    alerted.current = restKey;
    if (restElapsed - restTarget > 3 || AppState.currentState !== 'active') return;
    if (permission.current && (settings.sound || settings.vibrate)) {
      restEndNow(restTarget, nextUpName, { sound: settings.sound, vibrate: settings.vibrate });
    } else if (settings.vibrate) {
      buzz();
    }
  }, [restKey, restElapsed, restTarget, settings, nextUpName]);

  if (data === undefined) return <SafeAreaView style={s.screen} />;
  if (!data || !workout) {
    return (
      <SafeAreaView style={[s.screen, s.pad]}>
        <Text style={st.name}>Treino não encontrado<Text style={{ color: colors.acaiLight }}>.</Text></Text>
        <Muted>Ele foi finalizado ou descartado em outro lugar.</Muted>
        <BigButton title="Voltar ao início" onPress={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  const total = exercises.length;
  const doneCount = exercises.filter((e) => e.status !== 'pendente').length;
  // em qual exercício está (o mesmo número no rodapé, na lista e no início)
  const position = Math.min(doneCount + (current ? 1 : 0), total);
  const following = current ? nextPending(exercises, current.id) : null;
  const planned = current ? plannedSets(current.sets_min, current.sets_max, current.sets_adjust) : { min: 0, max: 0 };
  const done = current?.sets.length ?? 0;
  const outcome = current ? afterSet(done, planned.min, planned.max) : 'completo';
  const { load: nextLoad, reps: nextReps } = current ? nextValues(current, outlook?.prefill) : { load: 0, reps: 8 };

  const allSets = exercises.flatMap((e) => e.sets.map((x) => ({ ...x, name: e.name, weId: e.id })));
  const lastLogged = allSets.sort((a, b) => (a.set_ended_at ?? '').localeCompare(b.set_ended_at ?? '')).at(-1) ?? null;

  // ---------- ações ----------

  const doStartSet = () =>
    act(async () => {
      if (await startSet(db, data)) await cancelRestEnd();
    });

  /** Registra a série com a carga e as reps da tela. `approx`: fez sem tocar em "Iniciar série". */
  const doEndSet = (approx = false) =>
    act(async () => {
      const rest = await endSet(db, data, approx);
      if (rest && settings && (settings.sound || settings.vibrate)) {
        await scheduleRestEnd(rest.seconds, rest.seconds, rest.nextName, { sound: settings.sound, vibrate: settings.vibrate });
      }
    });

  const doMoveOn = () =>
    act(async () => {
      setSheet(null);
      if (!(await moveOn(db, data))) await cancelRestEnd();
    });

  const changeValue = (load: number, reps: number) => {
    if (!current) return;
    return act(() => setNext(db, current, load, reps));
  };

  const goTo = (we: WorkoutExerciseRow) => {
    if (workout.phase === 'serie') {
      Alert.alert('Série em andamento', 'Termine a série (Iniciar descanso) antes de trocar de exercício.');
      return;
    }
    setSheet(null);
    return act(() => goToExercise(db, data, we.id));
  };

  const doToggleSkip = (we: WorkoutExerciseRow) => act(() => toggleSkip(db, data, we.id));

  const finish = () => {
    const pending = exercises.filter((e) => e.status === 'pendente' && e.sets.length === 0).length;
    const go = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        setSheet(null);
        await finishWorkout(db, workout.id);
        await clearOngoing();
        router.replace({ pathname: '/fim/[id]', params: { id: workout.id } });
      } catch (e) {
        Alert.alert('Não consegui finalizar', (e as Error).message);
      } finally {
        busy.current = false;
      }
    };
    if (pending === 0) return go();
    Alert.alert('Finalizar treino?', `${pending} ${pending === 1 ? 'exercício ainda não foi feito e vai' : 'exercícios ainda não foram feitos e vão'} como pulado.`, [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Finalizar', onPress: go },
    ]);
  };

  /** Cancela o treino em andamento: apaga tudo dele (nada fica no histórico). */
  const cancelWorkout = () => {
    setSheet(null);
    const sets = allSets.length;
    Alert.alert(
      'Cancelar este treino?',
      sets > 0
        ? `${sets} ${sets === 1 ? 'série registrada hoje vai ser apagada' : 'séries registradas hoje vão ser apagadas'}. Nada deste treino fica no histórico.`
        : 'Nada deste treino fica no histórico.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar treino',
          style: 'destructive',
          onPress: async () => {
            if (busy.current) return;
            busy.current = true;
            try {
              await deleteWorkout(db, workout.id);
              await cancelRestEnd().catch(() => {});
              await clearOngoing();
              router.replace('/');
            } catch (e) {
              Alert.alert('Não consegui cancelar', (e as Error).message);
            } finally {
              busy.current = false;
            }
          },
        },
      ],
    );
  };

  const openSwap = async () => {
    if (!current) return;
    if (current.sets.length > 0) {
      Alert.alert('Já tem série feita', 'Para trocar, use a lista do treino e adicione o outro exercício como extra.');
      return;
    }
    if (workout.phase === 'serie') {
      Alert.alert('Série em andamento', 'Termine a série (Iniciar descanso) antes de trocar o exercício.');
      return;
    }
    const opts: SwapOption[] = [];
    if (current.slot_id && current.main_exercise_id) {
      const main = await db.getFirstAsync<{ name: string; initial_load: number | null }>(
        `SELECT e.name, s.initial_load FROM slot s JOIN exercise e ON e.id = s.main_exercise_id WHERE s.id = ?`, current.slot_id,
      );
      if (main) opts.push({ exerciseId: current.main_exercise_id, name: main.name, initialLoad: main.initial_load, main: true, last: '' });
      for (const sub of await listSubstitutes(db, current.slot_id)) {
        opts.push({ exerciseId: sub.exercise_id, name: sub.name, initialLoad: sub.initial_load, main: false, last: '' });
      }
    }
    for (const o of opts) {
      const [last] = await exerciseSessions(db, o.exerciseId, { limit: 1, excludeWorkoutId: workout.id });
      o.last = last ? `último ${describeSets(last.sets)} · ${dayMonth(new Date(last.date))}` : 'nunca feito';
    }
    setSwapOptions(opts);
    setSheet('trocar');
  };

  const doSwap = (o: SwapOption) => {
    if (!current) return;
    setSheet(null);
    return act(() => swapExercise(db, current, o.exerciseId, o.initialLoad));
  };

  /** Apaga uma série já registrada (o exercício volta a pendente se ficar abaixo do mínimo). */
  const doDeleteSet = (set: SetRow) => {
    setSheet(null);
    return act(() => deleteSet(db, set.id));
  };

  // ---------- tela ----------

  const isRest = workout.phase === 'descanso';
  const over = isRest && restTarget > 0 && restElapsed >= restTarget;
  const savedSet = lastLogged;
  const sameExercise = savedSet && current && savedSet.weId === current.id;

  return (
    <SafeAreaView style={s.screen}>
      <View style={st.wrap}>
        <View style={st.top}>
          <Text style={st.nextTop} numberOfLines={1}>
            {following ? <>próximo <Text style={st.nextName}>{following.name}</Text></> : 'último exercício'}
          </Text>
          <Text style={st.clock}>{clockLong(elapsed(workout.started_at, now))}</Text>
          <Pressable hitSlop={8} onPress={() => setSheet('menu')} accessibilityLabel="Opções do treino" style={({ pressed }) => [st.menuBtn, pressed && { opacity: 0.8 }]}>
            <Text style={st.menuDots}>⋯</Text>
            <Text style={st.menuText}>opções</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          {!current ? (
            <View style={{ gap: 8, paddingTop: 24 }}>
              <Text style={st.name}>Tudo feito<Text style={{ color: colors.acaiLight }}>.</Text></Text>
              <Muted>Todos os exercícios estão feitos ou pulados. Finalize pela lista, ou toque num exercício para fazer mais.</Muted>
            </View>
          ) : (
            <>
              <Pressable onPress={openSwap}>
                <Text style={st.name}>
                  {current.is_priority ? '⭐ ' : ''}{current.name} {current.sets.length === 0 && <Text style={st.swap}>{'⇄\u00A0trocar'}</Text>}
                </Text>
              </Pressable>
              <Muted style={{ marginTop: -6 }}>
                {range(planned.min, planned.max)} × {range(current.reps_min, current.reps_max)} · descanso {formatClock(current.rest_sec)}
                {outlook ? ` · feito ${outlook.timesDone}×` : ''}
                {!current.slot_id ? ' · extra' : ''}
              </Muted>
              {outlook && (
                <View style={st.last}>
                  <Text style={st.lastText}>
                    {outlook.last ? <>último ({dayMonth(new Date(outlook.last.date))}): <Text style={st.lastStrong}>{describeSets(outlook.last.sets)}</Text></> : current.initial_load != null ? <>primeira vez · carga inicial <Text style={st.lastStrong}>{formatLoad(current.initial_load)} kg</Text></> : 'primeira vez com este exercício'}
                  </Text>
                </View>
              )}
              <LinkText muted={showMove} onPress={() => setShowMove((v) => !v)}>{showMove ? 'esconder movimento' : '▶ ver movimento'}</LinkText>
              {showMove && <MovementAnimation name={current.name} muscle={current.muscle_group} builtinKey={current.builtin_key} compact />}
              {outlook?.prefill.increased && done === 0 && (
                <Text style={[st.chip, { color: colors.green, backgroundColor: colors.greenBg }]}>⬆ subir carga · bateu {current.reps_max} em tudo</Text>
              )}
              {outlook?.stalled && !outlook.prefill.increased && done === 0 && (
                <Text style={[st.chip, { color: colors.yellow, backgroundColor: colors.yellowBg }]}>3 treinos sem progresso · tente +1 rep ou +1 passo</Text>
              )}
              {current.note ? <Muted style={{ fontSize: 12 }}>obs.: {current.note}</Muted> : null}

              <Dots done={done} min={planned.min} max={planned.max} label={isRest ? 'descansando' : outcome === 'completo' ? 'completo' : `série ${done + 1} de ${planned.min === planned.max ? planned.min : `${planned.min}–${planned.max}`}${done >= planned.min ? ' (opcional)' : ''}`} />

              {isRest ? (
                <>
                  <RestRing elapsedSec={restElapsed} target={restTarget} over={over} />
                  {savedSet && (
                    <View style={st.saved}>
                      <Muted>{sameExercise ? `série ${savedSet.idx + 1}` : `acabou ${savedSet.name}`}</Muted>
                      <Text style={st.savedVal}>{savedSet.load ? `${formatLoad(savedSet.load)} kg ` : ''}× {savedSet.reps}</Text>
                      <LinkText
                        onPress={() => {
                          setSetEdit({ load: savedSet.load, reps: savedSet.reps });
                          setSheet({ set: savedSet, step: exercises.find((e) => e.id === savedSet.weId)?.step_kg ?? current.step_kg });
                        }}
                      >
                        editar
                      </LinkText>
                    </View>
                  )}
                  <View style={st.last}>
                    <Text style={st.lastText}>
                      série {done + 1} vai com <Text style={st.lastStrong}>{nextLoad ? `${formatLoad(nextLoad)} kg × ${nextReps}` : `${nextReps} reps`}</Text> · ajuste ao iniciar
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  {workout.phase === 'serie' && <SetClock sec={elapsed(workout.phase_started_at, now)} />}
                  <BigStepper
                    value={formatLoad(nextLoad)}
                    unit="kg"
                    label={`passo ${formatLoad(current.step_kg)} kg · toque para mudar`}
                    onPressValue={() => {
                      setLoadText(formatLoad(nextLoad));
                      setStepText(formatLoad(current.step_kg));
                      setSheet('carga');
                    }}
                    onMinus={() => changeValue(addLoad(nextLoad, -current.step_kg), nextReps)}
                    onPlus={() => changeValue(addLoad(nextLoad, current.step_kg), nextReps)}
                  />
                  <BigStepper
                    value={String(nextReps)}
                    unit="reps"
                    label="repetições"
                    onMinus={() => changeValue(nextLoad, nextReps - 1)}
                    onPlus={() => changeValue(nextLoad, nextReps + 1)}
                  />
                </>
              )}
              {done > 0 && done >= planned.min && workout.phase !== 'serie' && (
                <LinkText onPress={doMoveOn}>
                  {outcome === 'completo' ? 'exercício completo · ir para o próximo' : 'pular série opcional e ir para o próximo'}
                </LinkText>
              )}
            </>
          )}
        </ScrollView>

        {current ? (
          workout.phase === 'serie' ? (
            <BigButton title="Iniciar descanso" onPress={() => doEndSet()} />
          ) : (
            <>
              <BigButton variant={isRest ? 'light' : 'acai'} title="Iniciar série" onPress={doStartSet} />
              {isRest && (
                <Pressable onPress={() => doEndSet(true)} hitSlop={6} style={{ alignSelf: 'center' }}>
                  <Muted style={{ fontSize: 12 }}>já fiz a série sem iniciar · registrar</Muted>
                </Pressable>
              )}
            </>
          )
        ) : (
          <BigButton title="Finalizar treino" onPress={finish} />
        )}
        <Pressable onPress={() => setSheet('lista')} style={st.handle} hitSlop={8}>
          <View style={st.handleBar} />
          <Text style={st.handleText}>{workout.routine_code ?? 'treino'} · {position} de {total} · ver lista</Text>
        </Pressable>
      </View>

      {/* lista do treino */}
      <Sheet visible={sheet === 'lista'} onClose={() => setSheet(null)} title={`Treino ${workout.routine_code ?? ''} · ${position} de ${total}`} subtitle="toque para ir · segure para pular">
        {exercises.map((e) => {
          const p = plannedSets(e.sets_min, e.sets_max, e.sets_adjust);
          const isCur = e.id === current?.id;
          const detail = e.status === 'pulado' ? 'pulado' : e.status === 'feito' ? `${e.sets.length} séries` : isCur || e.sets.length > 0 ? `${e.sets.length} de ${p.min}` : `${range(p.min, p.max)} × ${range(e.reps_min, e.reps_max)}`;
          return (
            <Pressable key={e.id} onPress={() => goTo(e)} onLongPress={() => doToggleSkip(e)} delayLongPress={350}>
              <View style={[st.row, isCur && st.rowCur]}>
                <View style={[st.status, e.status === 'feito' && st.statusOk, isCur && st.statusCur]}>
                  <Text style={st.statusText}>{e.status === 'feito' ? '✓' : e.status === 'pulado' ? '–' : ''}</Text>
                </View>
                <Text style={[st.rowName, e.status === 'pulado' && { color: colors.grey, textDecorationLine: 'line-through' }]} numberOfLines={1}>
                  {e.is_priority ? '⭐ ' : ''}{!e.slot_id ? '+ ' : ''}{e.name}
                </Text>
                <Muted style={{ fontSize: 12 }}>{detail}</Muted>
              </View>
            </Pressable>
          );
        })}
        <SheetActions
          cancel="+ extra"
          confirm="Finalizar"
          onCancel={() => {
            setSheet(null);
            if (workout.phase === 'serie') {
              Alert.alert('Série em andamento', 'Termine a série (Iniciar descanso) antes de adicionar um exercício.');
              return;
            }
            router.push({ pathname: '/escolher-exercicio', params: { modo: 'extra', treino: workout.id } });
          }}
          onConfirm={finish}
        />
        <Pressable onPress={cancelWorkout} style={{ alignSelf: 'center', paddingTop: 6 }} hitSlop={10}>
          <Text style={st.cancelLink}>cancelar treino</Text>
        </Pressable>
      </Sheet>

      {/* trocar exercício */}
      <Sheet visible={sheet === 'trocar'} onClose={() => setSheet(null)} title="Trocar por" subtitle={current?.slot_id ? `só neste treino · ${workout.routine_code ?? ''}` : 'só neste treino'}>
        {swapOptions.map((o) => (
          <Option key={o.exerciseId} title={o.name} detail={`${o.main ? 'principal · ' : ''}${o.last}`} selected={o.exerciseId === current?.exercise_id} onPress={() => doSwap(o)} />
        ))}
        <SheetActions
          cancel="+ outro (só hoje)"
          confirm="Editar lista"
          onCancel={() => { setSheet(null); if (current) router.push({ pathname: '/escolher-exercicio', params: { modo: 'trocar', we: current.id } }); }}
          onConfirm={() => { setSheet(null); if (current?.slot_id) router.push({ pathname: '/ficha/exercicio/[id]', params: { id: current.slot_id } }); }}
        />
      </Sheet>

      {/* menu ⋯ */}
      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={current?.name ?? `Treino ${workout.routine_code ?? ''}`}>
        {current && (
          <>
            <Option title="+ adicionar série" onPress={() => { setSheet(null); act(() => addSet(db, current)); }} />
            <Option title="− remover série" detail={planned.max <= Math.max(1, done) ? 'já fez todas as séries planejadas' : undefined} onPress={() => { setSheet(null); act(() => removeSet(db, current)); }} />
            <Option title="Observação" detail={current.note ?? undefined} onPress={() => { setNoteText(current.note ?? ''); setSheet('nota'); }} />
            <Option title="Mudar descanso" detail={`agora ${formatClock(current.rest_sec)} · só neste treino`} onPress={() => { setRestEdit(current.rest_sec); setSheet('descanso'); }} />
            <Option title="Pular exercício" onPress={() => { setSheet(null); doToggleSkip(current); }} />
            <Option title="Ver histórico do exercício" onPress={() => { setSheet(null); router.push({ pathname: '/exercicio/[id]', params: { id: current.exercise_id } }); }} />
          </>
        )}
        <Label>treino</Label>
        <Option title="Finalizar treino" detail="o que já fez fica no histórico" onPress={() => { setSheet(null); finish(); }} />
        <Option title="Cancelar treino" detail="apaga este treino, nada fica no histórico" danger onPress={cancelWorkout} />
      </Sheet>

      <Sheet visible={sheet === 'carga'} onClose={() => setSheet(null)} title="Carga e passo" subtitle={current?.name}>
        <Field label="carga desta série (kg)">
          <Input value={loadText} onChangeText={setLoadText} keyboardType="decimal-pad" placeholder="ex.: 22,5" selectTextOnFocus error={parseLoad(loadText) === 'invalid'} />
        </Field>
        <Field label="passo do − e +">
          <Chips items={STEP_OPTIONS} value={parseStep(stepText) as (typeof STEP_OPTIONS)[number] | null} label={(v) => `${formatLoad(v)} kg`} onChange={(v) => setStepText(formatLoad(v))} />
          <Input value={stepText} onChangeText={setStepText} keyboardType="decimal-pad" placeholder="outro passo, ex.: 1,5" error={!!stepText.trim() && parseStep(stepText) == null} />
        </Field>
        <Muted style={{ fontSize: 12 }}>O passo fica salvo neste exercício e vale nos próximos treinos.</Muted>
        <SheetActions
          confirm="Salvar"
          disabled={parseLoad(loadText) === 'invalid' || parseStep(stepText) == null}
          onCancel={() => setSheet(null)}
          onConfirm={() => {
            const load = parseLoad(loadText);
            const step = parseStep(stepText);
            setSheet(null);
            if (!current || load === 'invalid' || step == null) return;
            act(async () => {
              if (step !== current.step_kg) await setExerciseStep(db, current.exercise_id, step);
              if ((load ?? 0) !== nextLoad) await setNext(db, current, load ?? 0, nextReps);
            });
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'nota'} onClose={() => setSheet(null)} title="Observação" subtitle={current?.name}>
        <Input value={noteText} onChangeText={setNoteText} placeholder="ex.: banco no 3, pegada aberta" autoFocus multiline maxLength={200} />
        <SheetActions confirm="Salvar" onCancel={() => setSheet(null)} onConfirm={() => { setSheet(null); if (current) act(() => setExerciseNote(db, current.id, noteText)); }} />
      </Sheet>

      <Sheet visible={sheet === 'descanso'} onClose={() => setSheet(null)} title="Descanso" subtitle="só neste treino">
        <Stepper value={formatClock(restEdit)} onMinus={() => setRestEdit((v) => Math.max(15, v - 15))} onPlus={() => setRestEdit((v) => Math.min(600, v + 15))} />
        <Muted style={{ fontSize: 12 }}>Para mudar de vez, ajuste no treino da ficha ou na página do exercício.</Muted>
        <SheetActions
          confirm="Salvar"
          onCancel={() => setSheet(null)}
          onConfirm={() => {
            setSheet(null);
            if (!current) return;
            act(async () => {
              const left = await changeRest(db, data, current, restEdit);
              if (left != null && settings && (settings.sound || settings.vibrate)) {
                await scheduleRestEnd(left, restEdit, current.name, { sound: settings.sound, vibrate: settings.vibrate });
              }
            });
          }}
        />
      </Sheet>

      <Sheet visible={typeof sheet === 'object' && sheet !== null} onClose={() => setSheet(null)} title="Editar série">
        <Field label="carga (kg)">
          <Stepper
            value={formatLoad(setEdit.load)}
            onMinus={() => setSetEdit((v) => ({ ...v, load: addLoad(v.load, -(typeof sheet === 'object' && sheet ? sheet.step : 2.5)) }))}
            onPlus={() => setSetEdit((v) => ({ ...v, load: addLoad(v.load, typeof sheet === 'object' && sheet ? sheet.step : 2.5) }))}
          />
        </Field>
        <Field label="repetições">
          <Stepper value={String(setEdit.reps)} onMinus={() => setSetEdit((v) => ({ ...v, reps: Math.max(0, v.reps - 1) }))} onPlus={() => setSetEdit((v) => ({ ...v, reps: v.reps + 1 }))} />
        </Field>
        <SheetActions
          cancel="Apagar série"
          confirm="Salvar"
          onCancel={() => { if (typeof sheet === 'object' && sheet) doDeleteSet(sheet.set); }}
          onConfirm={() => {
            if (typeof sheet === 'object' && sheet) {
              const setId = sheet.set.id;
              setSheet(null);
              act(() => updateSet(db, setId, setEdit.load, setEdit.reps));
            }
          }}
        />
      </Sheet>
    </SafeAreaView>
  );
}

function Dots({ done, min, max, label }: { done: number; min: number; max: number; label: string }) {
  return (
    <View style={st.dotsRow}>
      {Array.from({ length: max }, (_, i) => (
        <View key={i} style={[st.dot, i < done && st.dotOn, i >= min && i >= done && st.dotOptional]} />
      ))}
      <Muted style={{ marginLeft: 6 }}>{label}</Muted>
    </View>
  );
}

function BigStepper({ value, unit, label, onMinus, onPlus, onPressValue }: { value: string; unit: string; label: string; onMinus: () => void; onPlus: () => void; onPressValue?: () => void }) {
  return (
    <View style={st.big}>
      <Pressable onPress={onMinus} style={st.bigBtn} accessibilityLabel={`Menos ${unit}`}>
        <Text style={st.bigSign}>−</Text>
      </Pressable>
      <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={onPressValue} disabled={!onPressValue} accessibilityLabel={onPressValue ? `${value} ${unit}, ${label}` : undefined}>
        <Text style={st.bigVal}>
          {value}<Text style={st.bigUnit}> {unit}</Text>
        </Text>
        <Text style={[st.bigLabel, onPressValue && { color: colors.lilac }]}>{label}</Text>
      </Pressable>
      <Pressable onPress={onPlus} style={st.bigBtn} accessibilityLabel={`Mais ${unit}`}>
        <Text style={st.bigSign}>+</Text>
      </Pressable>
    </View>
  );
}

/** Relógio grande da série em andamento: o que mais importa na tela enquanto a série roda. */
function SetClock({ sec }: { sec: number }) {
  const blink = sec % 2 === 0;
  return (
    <View style={st.setClock} accessibilityLabel={`Série em andamento, ${formatClock(sec)}`}>
      <View style={st.setClockHead}>
        <View style={[st.setClockDot, { opacity: blink ? 1 : 0.3 }]} />
        <Text style={st.setClockLabel}>série em andamento</Text>
      </View>
      <Text style={st.setClockVal}>{formatClock(sec)}</Text>
    </View>
  );
}

function RestRing({ elapsedSec, target, over }: { elapsedSec: number; target: number; over: boolean }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const p = target > 0 ? Math.min(1, elapsedSec / target) : 0;
  const color = over ? colors.orange : colors.acaiLight;
  return (
    <View style={st.ring}>
      <Svg width={200} height={200} viewBox="-50 -50 100 100">
        <Circle r={r} fill="none" stroke={colors.line} strokeWidth={5} />
        <Circle r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${c * p} ${c}`} strokeLinecap="round" transform="rotate(-90)" />
      </Svg>
      <View style={st.ringText}>
        <Text style={[st.ringVal, over && { color: colors.orange }]}>{formatClock(elapsedSec)}</Text>
        <Text style={st.ringOf}>de {formatClock(target)}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextTop: { flex: 1, fontFamily: fonts.text, fontSize: 12, color: colors.text2 },
  nextName: { fontFamily: fonts.textSemi, color: colors.text },
  clock: { fontFamily: fonts.num, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  menuBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.acaiBg, borderColor: colors.acai, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  menuDots: { color: colors.lilac, fontSize: 18, lineHeight: 18 },
  menuText: { fontFamily: fonts.textSemi, color: colors.lilac, fontSize: 13 },
  name: { fontFamily: fonts.num, fontSize: 28, letterSpacing: -0.8, color: colors.text },
  swap: { fontFamily: fonts.textSemi, fontSize: 13, color: colors.lilac },
  last: { backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  lastText: { fontFamily: fonts.text, fontSize: 13, color: colors.text2 },
  lastStrong: { fontFamily: fonts.num, color: colors.text },
  chip: { alignSelf: 'flex-start', fontFamily: fonts.textSemi, fontSize: 12, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, overflow: 'hidden' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.acaiLight },
  dotOn: { backgroundColor: colors.acaiLight },
  dotOptional: { borderStyle: 'dashed', borderColor: colors.grey },
  big: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: 8 },
  bigBtn: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' },
  bigSign: { fontFamily: fonts.textSemi, fontSize: 30, color: colors.text },
  bigVal: { fontFamily: fonts.num, fontSize: 40, letterSpacing: -1, color: colors.text, fontVariant: ['tabular-nums'] },
  bigUnit: { fontFamily: fonts.text, fontSize: 14, color: colors.grey, letterSpacing: 0 },
  bigLabel: { fontFamily: fonts.text, fontSize: 11, color: colors.grey },
  setClock: { alignItems: 'center', backgroundColor: colors.acaiBg, borderColor: colors.acaiLight, borderWidth: 1, borderRadius: radius.lg, paddingVertical: 14, gap: 2 },
  setClockHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setClockDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lilac },
  setClockLabel: { fontFamily: fonts.textSemi, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.lilac },
  setClockVal: { fontFamily: fonts.num, fontSize: 72, letterSpacing: -2, color: colors.white, fontVariant: ['tabular-nums'] },
  cancelLink: { fontFamily: fonts.textSemi, fontSize: 13, color: colors.orange },
  ring: { alignSelf: 'center', width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', alignItems: 'center' },
  ringVal: { fontFamily: fonts.num, fontSize: 44, letterSpacing: -1, color: colors.text, fontVariant: ['tabular-nums'] },
  ringOf: { fontFamily: fonts.text, fontSize: 13, color: colors.grey },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 },
  savedVal: { flex: 1, textAlign: 'right', fontFamily: fonts.num, fontSize: 16, color: colors.text },
  handle: { alignItems: 'center', gap: 4, paddingTop: 2 },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line },
  handleText: { fontFamily: fonts.textSemi, fontSize: 12, color: colors.text2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
  rowCur: { backgroundColor: colors.acaiBg },
  rowName: { flex: 1, fontFamily: fonts.textSemi, fontSize: 14, color: colors.text },
  status: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  statusOk: { backgroundColor: colors.acai, borderColor: colors.acai },
  statusCur: { borderColor: colors.lilac },
  statusText: { color: colors.white, fontSize: 11, fontFamily: fonts.textBold },
});
