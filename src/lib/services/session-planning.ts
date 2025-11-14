import {
  db,
  type SessionWarmup,
  type SessionExercise,
  type ExerciseSeries,
} from "@/lib/db-local/db";
import { queueOutboxAction } from "@/lib/sync/outbox";

const nowIso = () => new Date().toISOString();

export interface SessionWarmupInput {
  session_id: string;
  description: string;
  resource?: string | null;
  order_index?: number;
}

export interface SessionExerciseInput {
  session_id: string;
  exercise_name: string;
  order_index?: number;
  rest?: string | null;
  rest_by_microcycle?: string | null; // JSON stringified
  video_resource?: string | null;
  general_instructions?: string | null;
  warnings?: string | null;
  notes_json?: string | null;
  header_json?: string | null;
  exercise_variations?: string | null; // JSON stringified
}

export interface ExerciseSeriesInput {
  session_exercise_id: string;
  series_number: number;
  series_label?: string | null;
  microcycle_name?: string | null;
  load?: string | null;
  reps?: string | null;
  rir?: string | null;
  notes?: string | null;
  rest?: string | null;
  special_instructions?: string | null;
  exercise_variation?: string | null;
}

export const createSessionWarmup = async (
  input: SessionWarmupInput
): Promise<SessionWarmup> => {
  const warmup: SessionWarmup = {
    id: crypto.randomUUID(),
    session_id: input.session_id,
    description: input.description,
    resource: input.resource ?? null,
    order_index: input.order_index ?? 0,
    updated_at: nowIso(),
  };

  await db.session_warmups.put(warmup);
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: "session_warmups",
    operation: "insert",
    payload: warmup,
  });
  return warmup;
};

export const createSessionExercise = async (
  input: SessionExerciseInput
): Promise<SessionExercise> => {
  const exercise: SessionExercise = {
    id: crypto.randomUUID(),
    session_id: input.session_id,
    exercise_name: input.exercise_name,
    order_index: input.order_index ?? 0,
    rest: input.rest ?? null,
    rest_by_microcycle: input.rest_by_microcycle ?? null,
    video_resource: input.video_resource ?? null,
    general_instructions: input.general_instructions ?? null,
    warnings: input.warnings ?? null,
    notes_json: input.notes_json ?? null,
    header_json: input.header_json ?? null,
    exercise_variations: input.exercise_variations ?? null,
    updated_at: nowIso(),
  };

  await db.session_exercises.put(exercise);
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: "session_exercises",
    operation: "insert",
    payload: exercise,
  });
  return exercise;
};

export const createExerciseSeries = async (
  input: ExerciseSeriesInput
): Promise<ExerciseSeries> => {
  const series: ExerciseSeries = {
    id: crypto.randomUUID(),
    session_exercise_id: input.session_exercise_id,
    series_number: input.series_number,
    series_label: input.series_label ?? null,
    microcycle_name: input.microcycle_name ?? null,
    load: input.load ?? null,
    reps: input.reps ?? null,
    rir: input.rir ?? null,
    notes: input.notes ?? null,
    rest: input.rest ?? null,
    special_instructions: input.special_instructions ?? null,
    exercise_variation: input.exercise_variation ?? null,
    updated_at: nowIso(),
  };

  await db.exercise_series.put(series);
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: "exercise_series",
    operation: "insert",
    payload: series,
  });
  return series;
};

export const listWarmupsBySession = async (
  session_id: string
): Promise<SessionWarmup[]> => {
  return db.session_warmups
    .where("session_id")
    .equals(session_id)
    .sortBy("order_index");
};

export const listExercisesBySession = async (
  session_id: string
): Promise<SessionExercise[]> => {
  return db.session_exercises
    .where("session_id")
    .equals(session_id)
    .sortBy("order_index");
};

export const listSeriesByExercise = async (
  session_exercise_id: string
): Promise<ExerciseSeries[]> => {
  return db.exercise_series
    .where("session_exercise_id")
    .equals(session_exercise_id)
    .sortBy("series_number");
};

export const updateSessionWarmup = async (
  id: string,
  updates: Partial<Omit<SessionWarmupInput, "session_id">>
): Promise<SessionWarmup> => {
  const existing = await db.session_warmups.get(id);
  if (!existing) {
    throw new Error("Warmup no encontrado");
  }

  const updated: SessionWarmup = {
    ...existing,
    description: updates.description ?? existing.description,
    resource: updates.resource ?? existing.resource,
    order_index: updates.order_index ?? existing.order_index,
    updated_at: nowIso(),
  };

  await db.session_warmups.put(updated);
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: "session_warmups",
    operation: "update",
    payload: updated,
  });
  return updated;
};

export const updateSessionExercise = async (
  id: string,
  updates: Partial<Omit<SessionExerciseInput, "session_id">>
): Promise<SessionExercise> => {
  const existing = await db.session_exercises.get(id);
  if (!existing) {
    throw new Error("Ejercicio no encontrado");
  }

  const updated: SessionExercise = {
    ...existing,
    exercise_name: updates.exercise_name ?? existing.exercise_name,
    order_index: updates.order_index ?? existing.order_index,
    rest: updates.rest ?? existing.rest,
    rest_by_microcycle: updates.rest_by_microcycle ?? existing.rest_by_microcycle,
    video_resource: updates.video_resource ?? existing.video_resource,
    general_instructions: updates.general_instructions ?? existing.general_instructions,
    warnings: updates.warnings ?? existing.warnings,
    notes_json: updates.notes_json ?? existing.notes_json,
    header_json: updates.header_json ?? existing.header_json,
    exercise_variations: updates.exercise_variations ?? existing.exercise_variations,
    updated_at: nowIso(),
  };

  await db.session_exercises.put(updated);
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: "session_exercises",
    operation: "update",
    payload: updated,
  });
  return updated;
};

export const updateExerciseSeries = async (
  id: string,
  updates: Partial<Omit<ExerciseSeriesInput, "session_exercise_id">>
): Promise<ExerciseSeries> => {
  const existing = await db.exercise_series.get(id);
  if (!existing) {
    throw new Error("Serie no encontrada");
  }

  const updated: ExerciseSeries = {
    ...existing,
    series_number: updates.series_number ?? existing.series_number,
    series_label: updates.series_label ?? existing.series_label,
    microcycle_name: updates.microcycle_name ?? existing.microcycle_name,
    load: updates.load ?? existing.load,
    reps: updates.reps ?? existing.reps,
    rir: updates.rir ?? existing.rir,
    notes: updates.notes ?? existing.notes,
    rest: updates.rest ?? existing.rest,
    special_instructions: updates.special_instructions ?? existing.special_instructions,
    exercise_variation: updates.exercise_variation ?? existing.exercise_variation,
    updated_at: nowIso(),
  };

  await db.exercise_series.put(updated);
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: "exercise_series",
    operation: "update",
    payload: updated,
  });
  return updated;
};

export const deleteSessionWarmup = async (id: string): Promise<void> => {
  const existing = await db.session_warmups.get(id);
  if (!existing) {
    throw new Error("Warmup no encontrado");
  }

  await db.session_warmups.delete(id);
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: "session_warmups",
    operation: "delete",
    payload: existing,
  });
};

export const deleteSessionExercise = async (id: string): Promise<void> => {
  const existing = await db.session_exercises.get(id);
  if (!existing) {
    throw new Error("Ejercicio no encontrado");
  }

  // Eliminar también todas las series asociadas
  const series = await listSeriesByExercise(id);
  for (const s of series) {
    await db.exercise_series.delete(s.id);
    await queueOutboxAction({
      id: crypto.randomUUID(),
      table: "exercise_series",
      operation: "delete",
      payload: s,
    });
  }

  await db.session_exercises.delete(id);
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: "session_exercises",
    operation: "delete",
    payload: existing,
  });
};

export const deleteExerciseSeries = async (id: string): Promise<void> => {
  const existing = await db.exercise_series.get(id);
  if (!existing) {
    throw new Error("Serie no encontrada");
  }

  await db.exercise_series.delete(id);
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: "exercise_series",
    operation: "delete",
    payload: existing,
  });
};

