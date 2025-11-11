"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useAuthStore } from "@/lib/state/auth";
import { useAuthGuard } from "@/lib/hooks/useAuthGuard";
import { db, ExerciseLog } from "@/lib/db-local/db";
import { queueOutboxAction } from "@/lib/sync/outbox";
import type {
  TrainingExercise,
  TrainingMap,
  TrainingSheetData,
} from "@/types/training";

interface TrainingPlannerProps {
  trainings: TrainingMap;
}

interface ExerciseLogFormState {
  load: string;
  reps: string;
  rir: string;
  notes: string;
}

const MICRO_INDEXES = [2, 4, 6, 8, 10, 12];

function getColumnIndex(selectedIndex: number, offset: number) {
  const base = MICRO_INDEXES[selectedIndex] ?? 2;
  return base + offset;
}

function getValue(
  row: (string | null)[] | null,
  selectedIndex: number,
  offset = 0
) {
  if (!row) return null;
  const idx = getColumnIndex(selectedIndex, offset);
  return row[idx] ?? null;
}

function useExerciseLogs(
  userId: string | undefined,
  sheet: string,
  exercise: string,
  microcycle: string | undefined
) {
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!userId) {
      setLogs([]);
      return;
    }
    setLoading(true);
    try {
      const collection = await db.exercise_logs
        .where("user_id")
        .equals(userId)
        .and(
          (item) =>
            item.training_sheet === sheet && item.exercise_name === exercise
        )
        .reverse()
        .sortBy("performed_at");
      setLogs(collection);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sheet, exercise, microcycle]);

  return { logs, loading, refresh };
}

interface ExerciseCardProps {
  exercise: TrainingExercise;
  training: TrainingSheetData;
  selectedIndex: number;
  userId?: string;
}

function ExerciseCard({
  exercise,
  training,
  selectedIndex,
  userId,
}: ExerciseCardProps) {
  const [form, setForm] = useState<ExerciseLogFormState>({
    load: "",
    reps: "",
    rir: "",
    notes: "",
  });
  const microcycle = training.microcycles[selectedIndex];
  const { logs, refresh } = useExerciseLogs(
    userId,
    training.sheet,
    exercise.name,
    microcycle
  );

  const lastLog = logs[0];

  const handleChange =
    (field: keyof ExerciseLogFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) return;
    const now = new Date().toISOString();
    const log: ExerciseLog = {
      id: crypto.randomUUID(),
      user_id: userId,
      training_sheet: training.sheet,
      exercise_name: exercise.name,
      microcycle,
      load: form.load || undefined,
      reps: form.reps || undefined,
      rir: form.rir || undefined,
      notes: form.notes || undefined,
      performed_at: now,
      updated_at: now,
    };
    await db.exercise_logs.put(log);
    await queueOutboxAction({
      id: crypto.randomUUID(),
      table: "exercise_logs",
      operation: "insert",
      payload: log,
    });
    setForm({ load: "", reps: "", rir: "", notes: "" });
    refresh();
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <header className="mb-3 flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-slate-900">
          {exercise.name}
        </h3>
        <p className="text-sm text-slate-500">Microciclo {microcycle}</p>
      </header>

      <div className="grid gap-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Objetivo</dt>
              <dd className="font-medium text-slate-800">
                {getValue(exercise.header, selectedIndex) ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Descanso</dt>
              <dd className="font-medium text-slate-800">
                {getValue(exercise.rest, selectedIndex) ?? "—"}
              </dd>
            </div>
          </dl>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {exercise.notes.map((row, index) => {
              const label = row[1];
              const info = getValue(row, selectedIndex);
              const extra = getValue(row, selectedIndex, 1);
              if (!label && !info && !extra) return null;
              return (
                <li key={index} className="flex flex-col">
                  {label ? (
                    <span className="font-medium text-slate-700">{label}</span>
                  ) : null}
                  <span>
                    {[info, extra].filter(Boolean).join(" · ") || null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {exercise.series.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-2 py-1">Serie</th>
                  <th className="px-2 py-1">Carga</th>
                  <th className="px-2 py-1">Reps / Indicaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exercise.series.map((row, index) => {
                  const label = row[1];
                  const load = getValue(row, selectedIndex);
                  const repetitions = getValue(row, selectedIndex, 1);
                  return (
                    <tr key={`${exercise.name}-series-${label ?? index}`}>
                      <td className="px-2 py-1 font-medium text-slate-700">
                        {label}
                      </td>
                      <td className="px-2 py-1 text-slate-800">
                        {load ?? "—"}
                      </td>
                      <td className="px-2 py-1 text-slate-800">
                        {repetitions ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <footer className="mt-4 grid gap-3 border-t border-slate-200 pt-4">
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 sm:grid-cols-4 sm:items-end"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Carga / Peso</span>
            <input
              value={form.load}
              onChange={handleChange("load")}
              placeholder="kg, nivel, etc."
              className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Repeticiones</span>
            <input
              value={form.reps}
              onChange={handleChange("reps")}
              placeholder="reps o formato"
              className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">RIR / Sensaciones</span>
            <input
              value={form.rir}
              onChange={handleChange("rir")}
              placeholder="RIR, RPE, etc."
              className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-4">
            <span className="text-slate-600">Notas</span>
            <textarea
              value={form.notes}
              onChange={handleChange("notes")}
              placeholder="Anota ajustes, parones, sensaciones..."
              className="h-20 rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
            />
          </label>
          <div className="sm:col-span-4 flex justify-end">
            <button
              type="submit"
              className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-accent"
            >
              Guardar registro
            </button>
          </div>
        </form>

        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <h4 className="text-sm font-semibold text-slate-700">
            Últimos registros
          </h4>
          {lastLog ? (
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {logs.slice(0, 3).map((log) => (
                <li key={log.id} className="flex flex-col">
                  <span className="text-slate-700">
                    {new Date(log.performed_at).toLocaleString("es-ES", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <span>
                    {[log.load, log.reps, log.rir]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos"}
                  </span>
                  {log.notes ? (
                    <span className="text-xs text-slate-500">{log.notes}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Aún no tienes registros para este ejercicio.
            </p>
          )}
        </div>
      </footer>
    </article>
  );
}

export default function TrainingPlanner({ trainings }: TrainingPlannerProps) {
  const sheets = useMemo(() => Object.keys(trainings), [trainings]);
  const defaultSheet = sheets[0];
  const [selectedSheet, setSelectedSheet] = useState<string>(defaultSheet);
  const [selectedMicro, setSelectedMicro] = useState<number>(0);
  const { user } = useAuthStore();
  useAuthGuard({
    allowedRoles: ["athlete", "trainer", "admin", "nutritionist"],
  });

  useEffect(() => {
    setSelectedMicro(0);
  }, [selectedSheet]);

  const training = trainings[selectedSheet];
  if (!training) {
    return (
      <p className="text-sm text-slate-500">
        No se encontró información de entrenamientos.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-500">Entrenamiento</span>
            <select
              value={selectedSheet}
              onChange={(event) => setSelectedSheet(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring focus:ring-brand-primary/50"
            >
              {sheets.map((sheet) => (
                <option key={sheet} value={sheet}>
                  {sheet}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-500">Microciclo</span>
            <select
              value={selectedMicro}
              onChange={(event) => setSelectedMicro(Number(event.target.value))}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring focus:ring-brand-primary/50"
            >
              {training.microcycles.map((micro, index) => (
                <option key={micro} value={index}>
                  {micro}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4">
          <h1 className="text-2xl font-semibold text-brand-primary">
            {training.title}
          </h1>
          {training.phase ? (
            <p className="text-sm text-slate-600">Fase: {training.phase}</p>
          ) : null}
        </div>
      </header>

      {training.warmups.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Calentamiento
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {training.warmups.map((warmup, index) => (
              <li key={index} className="flex flex-col">
                <span className="font-medium text-slate-700">
                  {warmup.description}
                </span>
                {warmup.resource ? (
                  <a
                    href={warmup.resource}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-primary underline"
                  >
                    Ver referencia
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-6">
        {training.exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.name}
            exercise={exercise}
            training={training}
            selectedIndex={selectedMicro}
            userId={user?.id}
          />
        ))}
      </section>
    </section>
  );
}
