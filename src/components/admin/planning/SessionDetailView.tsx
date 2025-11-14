"use client";

import { useState, useEffect, useCallback } from "react";
import type { Session } from "@/lib/db-local/db";
import type {
  SessionWarmup,
  SessionExercise,
  ExerciseSeries,
} from "@/lib/db-local/db";
import {
  listWarmupsBySession,
  listExercisesBySession,
  listSeriesByExercise,
  createSessionWarmup,
  createSessionExercise,
  createExerciseSeries,
  updateSessionWarmup,
  updateSessionExercise,
  updateExerciseSeries,
  deleteSessionWarmup,
  deleteSessionExercise,
  deleteExerciseSeries,
} from "@/lib/services/session-planning";
import { PlanningModal } from "./PlanningModal";
import { WarmupForm } from "./WarmupForm";
import { ExerciseForm } from "./ExerciseForm";
import { SeriesForm } from "./SeriesForm";

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const formatShortDate = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return SHORT_DATE_FORMATTER.format(date);
};

interface SessionDetailViewProps {
  session: Session;
  onClose: () => void;
  trainers: Array<{ id: string; name: string }>;
  trainingSheets: string[];
}

export function SessionDetailView({
  session,
  onClose,
  trainers,
  trainingSheets,
}: SessionDetailViewProps) {
  const [warmups, setWarmups] = useState<SessionWarmup[]>([]);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [seriesByExercise, setSeriesByExercise] = useState<
    Record<string, ExerciseSeries[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [editingWarmup, setEditingWarmup] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<string | null>(null);
  const [editingSeries, setEditingSeries] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [warmupsData, exercisesData] = await Promise.all([
        listWarmupsBySession(session.id),
        listExercisesBySession(session.id),
      ]);

      setWarmups(warmupsData);
      setExercises(exercisesData);

      // Cargar series para cada ejercicio
      const seriesMap: Record<string, ExerciseSeries[]> = {};
      for (const exercise of exercisesData) {
        seriesMap[exercise.id] = await listSeriesByExercise(exercise.id);
      }
      setSeriesByExercise(seriesMap);
    } catch (error) {
      console.error("Error cargando datos de sesión:", error);
    } finally {
      setLoading(false);
    }
  }, [session.id]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  if (loading) {
    return (
      <PlanningModal open={true} title="Cargando..." subtitle="" onClose={onClose}>
        <p className="text-sm text-slate-500">Cargando detalles de la sesión...</p>
      </PlanningModal>
    );
  }

  return (
    <PlanningModal
      open={true}
      title={session.name || session.session_type}
      subtitle={`${formatShortDate(session.date)} · ${session.session_type}`}
      onClose={onClose}
    >
      <div className="flex max-h-[80vh] flex-col gap-6 overflow-y-auto">
        {/* Warmups */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Calentamiento</h3>
            <button
              type="button"
              onClick={() => {
                setEditingWarmup("new");
              }}
              className="rounded bg-brand-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-accent"
            >
              + Añadir Warmup
            </button>
          </div>
          {warmups.length === 0 ? (
            <p className="text-sm text-slate-500">No hay warmups configurados.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {warmups.map((warmup) => (
                <div
                  key={warmup.id}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {warmup.description}
                      </p>
                      {warmup.resource && (
                        <a
                          href={warmup.resource}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 text-xs text-brand-primary hover:underline"
                        >
                          Ver recurso →
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingWarmup(warmup.id)}
                        className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm("¿Eliminar este warmup?")) {
                            await deleteSessionWarmup(warmup.id);
                            refreshData();
                          }
                        }}
                        className="rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Ejercicios */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Ejercicios</h3>
            <button
              type="button"
              onClick={() => {
                setEditingExercise("new");
              }}
              className="rounded bg-brand-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-accent"
            >
              + Añadir Ejercicio
            </button>
          </div>
          {exercises.length === 0 ? (
            <p className="text-sm text-slate-500">No hay ejercicios configurados.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {exercises.map((exercise) => {
                const series = seriesByExercise[exercise.id] || [];
                const notes = exercise.notes_json
                  ? JSON.parse(exercise.notes_json)
                  : null;
                const header = exercise.header_json
                  ? JSON.parse(exercise.header_json)
                  : null;

                return (
                  <div
                    key={exercise.id}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-slate-900">
                          {exercise.exercise_name}
                        </h4>
                        {exercise.video_resource && (
                          <a
                            href={exercise.video_resource}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 text-xs text-brand-primary hover:underline"
                          >
                            Ver video del ejercicio →
                          </a>
                        )}
                        {exercise.general_instructions && (
                          <p className="mt-2 text-sm text-slate-600">
                            <span className="font-medium">Instrucciones:</span>{" "}
                            {exercise.general_instructions}
                          </p>
                        )}
                        {exercise.warnings && (
                          <p className="mt-1 text-sm text-amber-700">
                            <span className="font-medium">⚠️ Advertencia:</span>{" "}
                            {exercise.warnings}
                          </p>
                        )}
                        {exercise.rest && (
                          <p className="mt-1 text-xs text-slate-500">
                            <span className="font-medium">Descanso:</span> {exercise.rest}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingExercise(exercise.id)}
                          className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm("¿Eliminar este ejercicio y todas sus series?")) {
                              await deleteSessionExercise(exercise.id);
                              refreshData();
                            }
                          }}
                          className="rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    {/* Series */}
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h5 className="text-sm font-semibold text-slate-700">Series</h5>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSeries(`new-${exercise.id}`);
                          }}
                          className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          + Añadir Serie
                        </button>
                      </div>
                      {series.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No hay series configuradas para este ejercicio.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {series
                            .sort((a, b) => a.series_number - b.series_number)
                            .map((serie) => (
                              <div
                                key={serie.id}
                                className="rounded border border-slate-100 bg-slate-50 p-2"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-slate-700">
                                        {serie.series_label || `Serie ${serie.series_number}`}
                                      </span>
                                      {serie.microcycle_name && (
                                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                          {serie.microcycle_name}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 grid grid-cols-4 gap-2 text-xs">
                                      {serie.load && (
                                        <div>
                                          <span className="font-medium text-slate-500">
                                            Carga:
                                          </span>{" "}
                                          <span className="text-slate-900">{serie.load}</span>
                                        </div>
                                      )}
                                      {serie.reps && (
                                        <div>
                                          <span className="font-medium text-slate-500">
                                            Reps:
                                          </span>{" "}
                                          <span className="text-slate-900">{serie.reps}</span>
                                        </div>
                                      )}
                                      {serie.rir && (
                                        <div>
                                          <span className="font-medium text-slate-500">
                                            RIR:
                                          </span>{" "}
                                          <span className="text-slate-900">{serie.rir}</span>
                                        </div>
                                      )}
                                      {serie.rest && (
                                        <div>
                                          <span className="font-medium text-slate-500">
                                            Descanso:
                                          </span>{" "}
                                          <span className="text-slate-900">{serie.rest}</span>
                                        </div>
                                      )}
                                    </div>
                                    {serie.exercise_variation && (
                                      <p className="mt-1 text-xs text-slate-600">
                                        <span className="font-medium">Variación:</span>{" "}
                                        {serie.exercise_variation}
                                      </p>
                                    )}
                                    {serie.special_instructions && (
                                      <p className="mt-1 text-xs text-amber-700">
                                        <span className="font-medium">⚠️ Especial:</span>{" "}
                                        {serie.special_instructions}
                                      </p>
                                    )}
                                    {serie.notes && (
                                      <p className="mt-1 text-xs text-slate-600">
                                        {serie.notes}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditingSeries(serie.id)}
                                      className="rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (confirm("¿Eliminar esta serie?")) {
                                          await deleteExerciseSeries(serie.id);
                                          refreshData();
                                        }
                                      }}
                                      className="rounded border border-rose-200 px-2 py-1 text-[10px] font-medium text-rose-600 hover:bg-rose-50"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Modal de edición de warmup */}
      {editingWarmup && (
        <PlanningModal
          open={true}
          title={editingWarmup === "new" ? "Nuevo Warmup" : "Editar Warmup"}
          subtitle=""
          onClose={() => setEditingWarmup(null)}
        >
          <WarmupForm
            warmup={
              editingWarmup !== "new"
                ? warmups.find((w) => w.id === editingWarmup)
                : undefined
            }
            onSubmit={async (data) => {
              if (editingWarmup === "new") {
                await createSessionWarmup({
                  session_id: session.id,
                  description: data.description,
                  resource: data.resource,
                  order_index: warmups.length,
                });
              } else {
                await updateSessionWarmup(editingWarmup, {
                  description: data.description,
                  resource: data.resource,
                });
              }
              setEditingWarmup(null);
              refreshData();
            }}
            onCancel={() => setEditingWarmup(null)}
          />
        </PlanningModal>
      )}

      {/* Modal de edición de ejercicio */}
      {editingExercise && (
        <PlanningModal
          open={true}
          title={
            editingExercise === "new" ? "Nuevo Ejercicio" : "Editar Ejercicio"
          }
          subtitle=""
          onClose={() => setEditingExercise(null)}
        >
          <ExerciseForm
            exercise={
              editingExercise !== "new"
                ? exercises.find((e) => e.id === editingExercise)
                : undefined
            }
            onSubmit={async (data) => {
              if (editingExercise === "new") {
                await createSessionExercise({
                  session_id: session.id,
                  exercise_name: data.exercise_name,
                  order_index: exercises.length,
                  rest: data.rest,
                  video_resource: data.video_resource,
                  general_instructions: data.general_instructions,
                  warnings: data.warnings,
                });
              } else {
                await updateSessionExercise(editingExercise, {
                  exercise_name: data.exercise_name,
                  rest: data.rest,
                  video_resource: data.video_resource,
                  general_instructions: data.general_instructions,
                  warnings: data.warnings,
                });
              }
              setEditingExercise(null);
              refreshData();
            }}
            onCancel={() => setEditingExercise(null)}
          />
        </PlanningModal>
      )}

      {/* Modal de edición de serie */}
      {editingSeries && (
        <PlanningModal
          open={true}
          title={editingSeries.startsWith("new-") ? "Nueva Serie" : "Editar Serie"}
          subtitle=""
          onClose={() => setEditingSeries(null)}
        >
          <SeriesForm
            series={
              editingSeries.startsWith("new-")
                ? undefined
                : (() => {
                    for (const exercise of exercises) {
                      const series = seriesByExercise[exercise.id]?.find(
                        (s) => s.id === editingSeries
                      );
                      if (series) return series;
                    }
                    return undefined;
                  })()
            }
            onSubmit={async (data) => {
              if (editingSeries.startsWith("new-")) {
                const exerciseId = editingSeries.replace("new-", "");
                await createExerciseSeries({
                  session_exercise_id: exerciseId,
                  series_number: data.series_number,
                  series_label: data.series_label,
                  microcycle_name: data.microcycle_name,
                  load: data.load,
                  reps: data.reps,
                  rir: data.rir,
                  notes: data.notes,
                  rest: data.rest,
                  special_instructions: data.special_instructions,
                  exercise_variation: data.exercise_variation,
                });
              } else {
                await updateExerciseSeries(editingSeries, {
                  series_number: data.series_number,
                  series_label: data.series_label,
                  microcycle_name: data.microcycle_name,
                  load: data.load,
                  reps: data.reps,
                  rir: data.rir,
                  notes: data.notes,
                  rest: data.rest,
                  special_instructions: data.special_instructions,
                  exercise_variation: data.exercise_variation,
                });
              }
              setEditingSeries(null);
              refreshData();
            }}
            onCancel={() => setEditingSeries(null)}
          />
        </PlanningModal>
      )}
    </PlanningModal>
  );
}

