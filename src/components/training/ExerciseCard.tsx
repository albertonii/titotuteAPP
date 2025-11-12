"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type SyntheticEvent,
} from "react";
import { db, type ExerciseLog } from "@/lib/db-local/db";
import { queueOutboxAction } from "@/lib/sync/outbox";
import type { TrainingExercise, TrainingSheetData } from "@/types/training";

const RIR_QUICK_OPTIONS = ["6", "7", "8", "9", "10"] as const;
const MICRO_INDEXES = [2, 4, 6, 8, 10, 12] as const;

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

interface ExerciseLogFormState {
  load: string;
  reps: string;
  rir: string;
  notes: string;
}

export interface ExerciseStatus {
  completed: boolean;
  lastPerformedAt?: string | null;
  lastLog?: ExerciseLog;
}

interface ExerciseCardProps {
  exercise: TrainingExercise;
  training: TrainingSheetData;
  selectedIndex: number;
  userId?: string;
  onStatusChange?: (exerciseName: string, status: ExerciseStatus) => void;
  isActive?: boolean;
  onToggle?: (exerciseName: string, isOpen: boolean) => void;
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

function getValueByIndex(
  row: (string | null)[] | null,
  microIndex: number,
  offset = 0
) {
  if (!row) return null;
  const idx = MICRO_INDEXES[microIndex] ?? 2;
  const target = idx + offset;
  return row[target] ?? null;
}

function useExerciseLogs(
  userId: string | undefined,
  sheet: string,
  exercise: string,
  microcycle: string | undefined
) {
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
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
  }, [exercise, sheet, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh, userId, sheet, exercise, microcycle]);

  return { logs, loading, refresh };
}

export const ExerciseCard = ({
  exercise,
  training,
  selectedIndex,
  userId,
  onStatusChange,
  isActive,
  onToggle,
}: ExerciseCardProps) => {
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

  const plannedSeriesByMicrocycle = useMemo(() => {
    return training.microcycles.reduce((acc, microName, idx) => {
      const planned = exercise.series.reduce((total, row) => {
        const value = getValueByIndex(row, idx);
        if (!value) return total;
        if (typeof value === "string" && value.trim() === "") return total;
        return total + 1;
      }, 0);
      acc[microName] = planned || exercise.series.length;
      return acc;
    }, {} as Record<string, number>);
  }, [exercise.series, training.microcycles]);

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
      isToday: boolean;
      entries: Array<{
        log: ExerciseLog;
        time: string;
        deltas: {
          load?: string | null;
          reps?: string | null;
          rir?: string | null;
        };
        serie: number;
        total: number;
        planned: number;
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
          isToday: isSameLocalDay(log.performed_at),
          entries: [],
        };
        groups.push(group);
      }
      const previous = logs[index + 1];
      const targetMicro =
        log.microcycle ?? training.microcycles[selectedIndex] ?? "";
      const plannedTotal =
        plannedSeriesByMicrocycle[targetMicro] ?? exercise.series.length;
      group.entries.push({
        log,
        time: TIME_FORMATTER.format(performedAt),
        deltas: {
          load: formatDelta(log.load, previous?.load),
          reps: formatDelta(log.reps, previous?.reps),
          rir: formatDelta(log.rir, previous?.rir),
        },
        serie: group.entries.length + 1,
        total: group.entries.length + 1,
        planned: plannedTotal,
      });
    });

    groups.forEach((group) => {
      const total = group.entries.length;
      group.entries = group.entries.map((entry, idx) => ({
        ...entry,
        serie: idx + 1,
        total: Math.max(entry.planned, total),
      }));
    });

    return groups;
  }, [
    exercise.series.length,
    logs,
    plannedSeriesByMicrocycle,
    selectedIndex,
    training.microcycles,
  ]);

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

  const handleDetailsToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = (event.target as HTMLDetailsElement).open;
    onToggle?.(exercise.name, isOpen);
  };

  let cardTone =
    "group w-full rounded-2xl border border-slate-200 bg-white/90 shadow-sm transition hover:border-brand-primary/40 hover:shadow-md";
  if (isCompletedToday) {
    cardTone += " border-emerald-200 bg-emerald-50/80";
  }
  if (isActive) {
    cardTone +=
      " border-brand-primary/70 bg-brand-primary/10 ring-2 ring-brand-primary/15";
  }

  return (
    <details className={cardTone} onToggle={handleDetailsToggle}>
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
              {isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/15 px-3 py-1 text-[11px] font-semibold text-brand-primary">
                  ▶ En curso
                </span>
              ) : null}
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
                    key={`${exercise.name}-series-mobile-${index}`}
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
                      <tr key={`${exercise.name}-series-${index}`}>
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
              {groupedHistory.slice(0, 4).map((group) => {
                const dayLabel = group.isToday ? "Hoy" : group.label;
                return (
                  <div
                    key={group.key}
                    className={`rounded-xl border px-3 py-3 ${
                      group.isToday
                        ? "border-brand-primary/60 bg-brand-primary/10"
                        : "border-slate-100 bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700 capitalize">
                          {dayLabel}
                        </span>
                        {group.microcycle ? (
                          <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] font-semibold text-brand-primary">
                            {group.microcycle}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs text-slate-400">
                        {group.entries.length} registro
                        {group.entries.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {group.entries.map(
                        ({ log, time, deltas, serie, total }) => (
                          <div
                            key={log.id}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4"
                          >
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                                {serie}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                  Serie {serie}/{total}
                                </span>
                                <span className="text-sm font-semibold text-slate-700">
                                  {time}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-col gap-2 text-xs text-slate-600 sm:mt-0 sm:w-auto grid grid-cols-3 sm:gap-3">
                              <div className="rounded-lg bg-slate-50 px-3 py-2 sm:px-2 flex flex-col justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Carga
                                </p>
                                <div className="mt-1 flex items-center justify-between gap-2 sm:flex-col sm:items-start">
                                  <p className="text-sm font-semibold text-slate-700">
                                    {log.load ?? "—"}
                                  </p>
                                  {deltas.load ? (
                                    <span
                                      className={`text-xs font-semibold ${deltaTone(
                                        deltas.load
                                      )}`}
                                    >
                                      {deltas.load}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="rounded-lg bg-slate-50 px-3 py-2 sm:px-2 flex flex-col justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Reps / Indicaciones
                                </p>
                                <div className="mt-1 flex items-center justify-between gap-2 sm:flex-col sm:items-start">
                                  <p className="text-sm font-semibold text-slate-700">
                                    {log.reps ?? "—"}
                                  </p>
                                  {deltas.reps ? (
                                    <span
                                      className={`text-xs font-semibold ${deltaTone(
                                        deltas.reps
                                      )}`}
                                    >
                                      {deltas.reps}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="rounded-lg bg-slate-50 px-3 py-2 sm:px-2 flex flex-col justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  RIR / Sensación
                                </p>
                                <div className="mt-1 flex items-center justify-between gap-2 sm:flex-col sm:items-start">
                                  <p className="text-sm font-semibold text-slate-700">
                                    {log.rir ?? "—"}
                                  </p>
                                  {deltas.rir ? (
                                    <span
                                      className={`text-xs font-semibold ${deltaTone(
                                        deltas.rir
                                      )}`}
                                    >
                                      {deltas.rir}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            {log.notes ? (
                              <p className="mt-2 text-xs italic text-slate-500 sm:mt-0 sm:max-w-xs">
                                “
                                {log.notes.length > 140
                                  ? `${log.notes.slice(0, 137)}…`
                                  : log.notes}
                                ”
                              </p>
                            ) : null}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
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
};
