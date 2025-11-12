"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type { Dispatch, SetStateAction } from "react";
import { useAuthStore } from "@/lib/state/auth";
import { useAuthGuard } from "@/lib/hooks/useAuthGuard";
import { db, ExerciseLog } from "@/lib/db-local/db";
import { queueOutboxAction } from "@/lib/sync/outbox";
import type {
  TrainingExercise,
  TrainingMap,
  TrainingSheetData,
  TrainingWarmup,
} from "@/types/training";

const RIR_QUICK_OPTIONS = ["6", "7", "8", "9", "10"] as const;
const MICRO_INDEXES = [2, 4, 6, 8, 10, 12] as const;
const TRAINING_KEYS_ORDER = [
  "ENTRENAMIENTO A",
  "ENTRENAMIENTO B",
  "ENTRENAMIENTO C",
  "ENTRENAMIENTO D",
  "ENTRENAMIENTO E",
] as const;

const TIME_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_BADGE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const HISTORY_HEADER_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "short",
});

const isSameLocalDay = (
  iso: string | undefined | null,
  reference = new Date()
) => {
  if (!iso) return false;
  const date = new Date(iso);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
};

interface TrainingPlannerProps {
  trainings: TrainingMap;
}

interface ExerciseLogFormState {
  load: string;
  reps: string;
  rir: string;
  notes: string;
}

interface ExerciseStatus {
  completed: boolean;
  lastPerformedAt?: string | null;
  lastLog?: ExerciseLog;
}

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
  onStatusChange?: (exerciseName: string, status: ExerciseStatus) => void;
}

function ExerciseCard({
  exercise,
  training,
  selectedIndex,
  userId,
  onStatusChange,
}: ExerciseCardProps) {
  const [form, setForm] = useState<ExerciseLogFormState>({
    load: "",
    reps: "",
    rir: "",
    notes: "",
  });
  const microcycle = training.microcycles[selectedIndex];
  const { logs, loading, refresh } = useExerciseLogs(
    userId,
    training.sheet,
    exercise.name,
    microcycle
  );

  const lastLog = logs[0];
  const lastLogDateLabel = lastLog
    ? DATE_BADGE_FORMATTER.format(new Date(lastLog.performed_at))
    : null;
  const isCompletedToday = useMemo(() => {
    if (!lastLog) return false;
    return (
      lastLog.microcycle === microcycle && isSameLocalDay(lastLog.performed_at)
    );
  }, [lastLog, microcycle]);

  useEffect(() => {
    if (!onStatusChange) return;
    onStatusChange(exercise.name, {
      completed: isCompletedToday,
      lastPerformedAt: lastLog?.performed_at ?? null,
      lastLog,
    });
  }, [exercise.name, isCompletedToday, lastLog, onStatusChange]);

  const parseMetricValue = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.replace(",", ".").match(/-?\d+(\.\d+)?/);
    if (!normalized) return null;
    const numeric = Number.parseFloat(normalized[0]);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const formatDelta = (current?: string | null, previous?: string | null) => {
    const currentNum = parseMetricValue(current);
    const prevNum = parseMetricValue(previous);
    if (currentNum === null || prevNum === null) return null;
    const diff = currentNum - prevNum;
    if (Math.abs(diff) < 0.05) return "≈";
    const rounded =
      Math.abs(diff) < 1 ? Math.round(diff * 10) / 10 : Math.round(diff);
    return `${diff > 0 ? "+" : "-"}${Math.abs(rounded)}`;
  };

  const deltaTone = (delta?: string | null) => {
    if (!delta) return "text-slate-400";
    if (delta === "≈") return "text-amber-500";
    if (delta.startsWith("+")) return "text-emerald-600";
    return "text-rose-500";
  };

  const groupedHistory = useMemo(() => {
    if (!logs.length) return [];
    const groups: Array<{
      key: string;
      label: string;
      microcycle?: string | null;
      entries: Array<{
        log: ExerciseLog;
        time: string;
        deltas: {
          load?: string | null;
          reps?: string | null;
          rir?: string | null;
        };
      }>;
    }> = [];

    logs.forEach((log, index) => {
      const performedAt = new Date(log.performed_at);
      const dateKey = performedAt.toISOString().split("T")[0];
      const key = `${dateKey}-${log.microcycle ?? ""}`;
      let group = groups.find((item) => item.key === key);
      if (!group) {
        group = {
          key,
          label: HISTORY_HEADER_FORMATTER.format(performedAt),
          microcycle: log.microcycle,
          entries: [],
        };
        groups.push(group);
      }
      const previous = logs[index + 1];
      group.entries.push({
        log,
        time: TIME_FORMATTER.format(performedAt),
        deltas: {
          load: formatDelta(log.load, previous?.load),
          reps: formatDelta(log.reps, previous?.reps),
          rir: formatDelta(log.rir, previous?.rir),
        },
      });
    });

    return groups;
  }, [logs]);

  const handleChange =
    (field: keyof ExerciseLogFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleUseLastLog = () => {
    if (!lastLog) return;
    setForm({
      load: lastLog.load ?? "",
      reps: lastLog.reps ?? "",
      rir: lastLog.rir ?? "",
      notes: lastLog.notes ?? "",
    });
  };

  const handleClearForm = () => {
    setForm({ load: "", reps: "", rir: "", notes: "" });
  };

  const handleQuickRir = (value: string) => {
    setForm((prev) => ({ ...prev, rir: value }));
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
    <details className="group w-full rounded-2xl border border-slate-200 bg-white/90 shadow-sm transition hover:border-brand-primary/40 hover:shadow-md">
      <summary className="flex w-full cursor-pointer select-none flex-col gap-2.5 rounded-2xl px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-slate-900">
                {exercise.name}
              </h3>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-primary">
                Microciclo {microcycle}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {isCompletedToday ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-600">
                  ✓ Registrado hoy
                </span>
              ) : null}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {logs.length > 0 ? `${logs.length} registros` : "Sin registros"}
              </span>
            </div>
          </div>
          {lastLog ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="flex items-center gap-2 font-medium text-slate-700">
                Último registro
                <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] font-semibold text-brand-primary">
                  {lastLogDateLabel}
                </span>
              </span>
              <span className="truncate">
                {[lastLog.load, lastLog.reps, lastLog.rir]
                  .filter(Boolean)
                  .join(" · ") || "Sin datos"}
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Toca para ver indicaciones y registrar tus datos.
            </p>
          )}
        </div>
        <span className="flex shrink-0 items-center text-lg text-slate-400 transition group-open:rotate-180 sm:block">
          ▼
        </span>
      </summary>

      <div className="grid w-full gap-4 border-t border-slate-200 px-3 pb-4 pt-3 sm:px-4">
        <details className="group rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm shadow-inner sm:px-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-700 transition group-open:text-brand-primary">
            Plan de trabajo
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400 group-open:text-brand-primary">
              ver detalles
            </span>
          </summary>
          <div className="mt-2.5 space-y-3 text-sm text-slate-600">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Objetivo
                </p>
                <p className="font-semibold text-slate-800">
                  {getValue(exercise.header, selectedIndex) ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Descanso
                </p>
                <p className="font-semibold text-slate-800">
                  {getValue(exercise.rest, selectedIndex) ?? "—"}
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              {exercise.notes.map((row, index) => {
                const label = row[1];
                const info = getValue(row, selectedIndex);
                const extra = getValue(row, selectedIndex, 1);
                if (!label && !info && !extra) return null;
                return (
                  <div
                    key={`${exercise.name}-note-${index}`}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
                  >
                    {label ? (
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {label}
                      </p>
                    ) : null}
                    <p className="text-sm text-slate-600">
                      {[info, extra].filter(Boolean).join(" · ") || null}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </details>

        {exercise.series.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="grid gap-2 p-3 text-sm text-slate-700 sm:hidden">
              {exercise.series.map((row, index) => {
                const label = row[1];
                const load = getValue(row, selectedIndex);
                const repetitions = getValue(row, selectedIndex, 1);
                return (
                  <article
                    key={`${exercise.name}-series-mobile-${label ?? index}`}
                    className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <header className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                      <span className="font-semibold text-slate-600">
                        {label}
                      </span>
                      {load ? (
                        <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-brand-primary">
                          {load}
                        </span>
                      ) : null}
                    </header>
                    <p className="mt-2 text-sm text-slate-700">
                      {repetitions ?? "—"}
                    </p>
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[320px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-3">Serie</th>
                    <th className="px-3 py-3">Carga</th>
                    <th className="px-3 py-3">Reps / Indicaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exercise.series.map((row, index) => {
                    const label = row[1];
                    const load = getValue(row, selectedIndex);
                    const repetitions = getValue(row, selectedIndex, 1);
                    return (
                      <tr key={`${exercise.name}-series-${label ?? index}`}>
                        <td className="px-3 py-2 font-medium text-slate-700">
                          {label}
                        </td>
                        <td className="px-3 py-2 text-slate-800">
                          {load ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-800">
                          {repetitions ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-4 sm:items-end sm:p-4"
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
            <div className="flex flex-wrap gap-1 pt-1 text-[11px]">
              {RIR_QUICK_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleQuickRir(option)}
                  className={`rounded-full border px-2 py-0.5 transition ${
                    form.rir === option
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-slate-200 bg-white text-slate-500 hover:border-brand-primary/40 hover:text-brand-primary"
                  }`}
                >
                  RIR {option}
                </button>
              ))}
            </div>
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
          <div className="sm:col-span-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={handleUseLastLog}
              disabled={!lastLog}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 font-semibold transition hover:border-brand-primary/40 hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Usar último registro
            </button>
            <button
              type="button"
              onClick={handleClearForm}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 font-semibold transition hover:border-rose-200/60 hover:text-rose-500"
            >
              Limpiar campos
            </button>
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <button
              type="submit"
              className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-accent"
            >
              Guardar registro
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-3 sm:p-4">
          <h4 className="text-sm font-semibold text-slate-700">
            Historial reciente
          </h4>
          {loading ? (
            <p className="mt-2 text-sm text-slate-400 animate-pulse">
              Cargando registros...
            </p>
          ) : groupedHistory.length > 0 ? (
            <div className="mt-3 flex flex-col gap-3 text-sm text-slate-600">
              {groupedHistory.slice(0, 4).map((group) => (
                <div
                  key={group.key}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-700 capitalize">
                      {group.label}
                    </span>
                    {group.microcycle ? (
                      <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary">
                        {group.microcycle}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    {group.entries.map(({ log, time, deltas }) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">
                            Sesión • {time}
                          </span>
                          {log.microcycle ? (
                            <span className="text-[10px] uppercase tracking-wide text-slate-400">
                              {log.microcycle}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-lg bg-slate-50 px-2 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              Carga
                            </p>
                            <p className="text-sm font-semibold text-slate-700">
                              {log.load ?? "—"}
                            </p>
                            {deltas.load ? (
                              <p
                                className={`text-xs font-semibold ${deltaTone(
                                  deltas.load
                                )}`}
                              >
                                {deltas.load}
                              </p>
                            ) : null}
                          </div>
                          <div className="rounded-lg bg-slate-50 px-2 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              Reps / Indicaciones
                            </p>
                            <p className="text-sm font-semibold text-slate-700">
                              {log.reps ?? "—"}
                            </p>
                            {deltas.reps ? (
                              <p
                                className={`text-xs font-semibold ${deltaTone(
                                  deltas.reps
                                )}`}
                              >
                                {deltas.reps}
                              </p>
                            ) : null}
                          </div>
                          <div className="rounded-lg bg-slate-50 px-2 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              RIR / Sensación
                            </p>
                            <p className="text-sm font-semibold text-slate-700">
                              {log.rir ?? "—"}
                            </p>
                            {deltas.rir ? (
                              <p
                                className={`text-xs font-semibold ${deltaTone(
                                  deltas.rir
                                )}`}
                              >
                                {deltas.rir}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        {log.notes ? (
                          <p className="mt-2 text-xs italic text-slate-500">
                            “
                            {log.notes.length > 160
                              ? `${log.notes.slice(0, 157)}…`
                              : log.notes}
                            ”
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Aún no tienes registros para este ejercicio.
            </p>
          )}
        </div>
      </footer>
    </details>
  );
}

interface TrainingHeroProps {
  title: string | null;
  phase: string | null;
  microcycle: string;
  totalExercises: number;
  completedExercises: number;
  lastUpdate: string | null;
}

function TrainingHero({
  title,
  phase,
  microcycle,
  totalExercises,
  completedExercises,
  lastUpdate,
}: TrainingHeroProps) {
  const progress = totalExercises
    ? Math.round((completedExercises / totalExercises) * 100)
    : 0;
  const lastUpdateLabel = lastUpdate
    ? DATE_BADGE_FORMATTER.format(new Date(lastUpdate))
    : null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              Plan de trabajo
            </span>
            <h1 className="text-2xl font-semibold text-brand-primary">
              {title ?? "Entrenamiento"}
            </h1>
            <p className="text-sm text-slate-500">
              Estás en el microciclo
              <span className="font-semibold text-slate-700">
                {" "}
                {microcycle}
              </span>
              . Completa los ejercicios y registra tus métricas para seguir tu
              avance.
            </p>
          </div>
          {phase ? (
            <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
              {phase}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Progreso de hoy
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-slate-900">
                {completedExercises}
              </p>
              <span className="text-sm text-slate-500">
                de {totalExercises}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-brand-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Microciclo activo
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {microcycle}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Revisa el plan, ejecuta con calma y registra cómo te sentiste en
              cada bloque.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Último registro
            </p>
            {lastUpdateLabel ? (
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {lastUpdateLabel}
              </p>
            ) : (
              <p className="mt-2 text-lg font-semibold text-slate-900">—</p>
            )}
            <p className="mt-1 text-sm text-slate-500">
              {lastUpdateLabel
                ? "Tu información está al día. ¡Bien!"
                : "Aún no registraste este microciclo."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

interface PlanSelectorProps {
  sheetKeys: string[];
  selectedSheet: string;
  onSelectSheet: (sheet: string) => void;
}

function PlanSelector({
  sheetKeys,
  selectedSheet,
  onSelectSheet,
}: PlanSelectorProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Entrenamientos disponibles
          </h2>
          <p className="text-xs text-slate-400">
            Elige el plan asignado para hoy.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 pb-1 pt-1">
          {sheetKeys.map((sheet) => {
            const isActive = sheet === selectedSheet;
            return (
              <button
                key={sheet}
                type="button"
                onClick={() => onSelectSheet(sheet)}
                className={
                  "rounded-full border px-3 py-2 text-sm font-medium transition " +
                  (isActive
                    ? "border-brand-primary bg-brand-primary text-white shadow"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-primary/40 hover:text-brand-primary")
                }
              >
                {sheet.replace("ENTRENAMIENTO ", "Entrenamiento ")}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface MicroSelectorProps {
  microcycles: string[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  completedExercises: number;
  totalExercises: number;
}

function MicroSelector({
  microcycles,
  selectedIndex,
  onSelectIndex,
  completedExercises,
  totalExercises,
}: MicroSelectorProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-slate-700">
              Microciclo (semana)
            </h2>
            <p className="text-xs text-slate-500">
              {completedExercises}/{totalExercises} ejercicios registrados hoy.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 pb-1 pt-1">
          {microcycles.map((micro, index) => {
            const isActive = selectedIndex === index;
            return (
              <button
                key={micro}
                type="button"
                onClick={() => onSelectIndex(index)}
                className={
                  "rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition " +
                  (isActive
                    ? "bg-brand-primary text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-brand-primary/10 hover:text-brand-primary")
                }
              >
                {micro}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface WarmupSectionProps {
  warmups: TrainingWarmup[];
}

function WarmupSection({ warmups }: WarmupSectionProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-slate-900">Calentamiento</h2>
      <ul className="mt-3 space-y-3 text-sm text-slate-600">
        {warmups.map((warmup, index) => (
          <li
            key={`${warmup.description}-${index}`}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
          >
            <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-semibold text-brand-primary">
              {index + 1}
            </span>
            <div className="flex flex-col gap-2">
              <span className="font-medium text-slate-700">
                {warmup.description}
              </span>
              {warmup.resource ? (
                <a
                  href={warmup.resource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-brand-primary underline underline-offset-4"
                >
                  Vídeo / Referencia
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function TrainingPlanner({ trainings }: TrainingPlannerProps) {
  const sheetKeys = useMemo(() => {
    const keys = Object.keys(trainings);
    const ordered = TRAINING_KEYS_ORDER.filter((key) =>
      keys.includes(key)
    ) as string[];
    const remaining = keys.filter(
      (key) => !TRAINING_KEYS_ORDER.includes(key as any)
    );
    return [...ordered, ...remaining];
  }, [trainings]);
  const defaultSheet = sheetKeys[0] ?? "";
  const [selectedSheet, setSelectedSheet] = useState<string>(defaultSheet);
  const [selectedMicro, setSelectedMicro] = useState<number>(0);
  const { user } = useAuthStore();
  useAuthGuard({
    allowedRoles: ["athlete", "trainer", "admin", "nutritionist"],
  });

  const [exerciseStatuses, setExerciseStatuses] = useState<
    Record<string, ExerciseStatus>
  >({});

  useEffect(() => {
    setSelectedMicro(0);
  }, [selectedSheet]);

  useEffect(() => {
    setExerciseStatuses({});
  }, [selectedSheet, selectedMicro]);

  const handleExerciseStatusChange = useCallback(
    (exerciseName: string, status: ExerciseStatus) => {
      setExerciseStatuses((prev) => {
        const previous = prev[exerciseName];
        if (
          previous?.completed === status.completed &&
          previous?.lastPerformedAt === status.lastPerformedAt
        ) {
          return prev;
        }
        return { ...prev, [exerciseName]: status };
      });
    },
    []
  );

  const training = trainings[selectedSheet];
  if (!training) {
    return (
      <p className="text-sm text-slate-500">
        No se encontró información de entrenamientos.
      </p>
    );
  }

  const totalExercises = training.exercises.length;
  const completedExercises = useMemo(() => {
    return Object.values(exerciseStatuses).filter((status) => status.completed)
      .length;
  }, [exerciseStatuses]);

  const latestUpdateIso = useMemo(() => {
    const timestamps = Object.values(exerciseStatuses)
      .map((status) => status.lastPerformedAt)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime());
    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps)).toISOString();
  }, [exerciseStatuses]);

  const selectedMicrocycleLabel =
    training.microcycles[selectedMicro] ?? training.microcycles[0] ?? "";

  return (
    <section className="w-full">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 sm:py-5 sm:gap-6 sm:px-5 lg:max-w-5xl lg:px-8">
        <TrainingHero
          title={training.title}
          phase={training.phase}
          microcycle={selectedMicrocycleLabel}
          totalExercises={totalExercises}
          completedExercises={completedExercises}
          lastUpdate={latestUpdateIso}
        />

        <PlanSelector
          sheetKeys={sheetKeys}
          selectedSheet={selectedSheet}
          onSelectSheet={(sheet) => {
            setSelectedSheet(sheet);
            setSelectedMicro(0);
          }}
        />

        <MicroSelector
          microcycles={training.microcycles}
          selectedIndex={selectedMicro}
          onSelectIndex={setSelectedMicro}
          completedExercises={completedExercises}
          totalExercises={totalExercises}
        />

        {training.warmups.length > 0 ? (
          <WarmupSection warmups={training.warmups} />
        ) : null}

        <section className="flex flex-col gap-5">
          {training.exercises.map((exercise) => (
            <ExerciseCard
              key={`${training.sheet}-${exercise.name}`}
              exercise={exercise}
              training={training}
              selectedIndex={selectedMicro}
              userId={user?.id}
              onStatusChange={handleExerciseStatusChange}
            />
          ))}
        </section>
      </div>
    </section>
  );
}
