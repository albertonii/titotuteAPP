"use client";

import { FormEvent, useState } from "react";
import type { SessionExercise } from "@/lib/db-local/db";

interface ExerciseFormProps {
  exercise?: SessionExercise;
  onSubmit: (data: {
    exercise_name: string;
    rest?: string | null;
    video_resource?: string | null;
    general_instructions?: string | null;
    warnings?: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}

export function ExerciseForm({
  exercise,
  onSubmit,
  onCancel,
}: ExerciseFormProps) {
  const [exerciseName, setExerciseName] = useState(
    exercise?.exercise_name || ""
  );
  const [rest, setRest] = useState(exercise?.rest || "");
  const [videoResource, setVideoResource] = useState(
    exercise?.video_resource || ""
  );
  const [generalInstructions, setGeneralInstructions] = useState(
    exercise?.general_instructions || ""
  );
  const [warnings, setWarnings] = useState(exercise?.warnings || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!exerciseName.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        exercise_name: exerciseName.trim(),
        rest: rest.trim() || null,
        video_resource: videoResource.trim() || null,
        general_instructions: generalInstructions.trim() || null,
        warnings: warnings.trim() || null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Nombre del Ejercicio *
        </label>
        <input
          type="text"
          value={exerciseName}
          onChange={(e) => setExerciseName(e.target.value)}
          required
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="Ej: MAQUINA DE ADDUCTORES"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Video del Ejercicio (URL)
        </label>
        <input
          type="url"
          value={videoResource}
          onChange={(e) => setVideoResource(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="https://youtu.be/..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Instrucciones Generales
        </label>
        <textarea
          value={generalInstructions}
          onChange={(e) => setGeneralInstructions(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="Ej: TUT EN TODO MOMENTO CONTROLADO"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Advertencias
        </label>
        <textarea
          value={warnings}
          onChange={(e) => setWarnings(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="Ej: OJO A LAS SERIES SPEED CHANGES"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Descanso General
        </label>
        <input
          type="text"
          value={rest}
          onChange={(e) => setRest(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder='Ej: 60" a 90"'
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !exerciseName.trim()}
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-accent disabled:opacity-50">
          {loading ? "Guardando..." : exercise ? "Actualizar" : "Crear"}
        </button>
      </div>
    </form>
  );
}
