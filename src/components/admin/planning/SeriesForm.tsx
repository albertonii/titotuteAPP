"use client";

import { FormEvent, useState } from "react";
import type { ExerciseSeries } from "@/lib/db-local/db";

interface SeriesFormProps {
  series?: ExerciseSeries;
  onSubmit: (data: {
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
  }) => Promise<void>;
  onCancel: () => void;
}

export function SeriesForm({ series, onSubmit, onCancel }: SeriesFormProps) {
  const [seriesNumber, setSeriesNumber] = useState(
    series?.series_number?.toString() || "1"
  );
  const [seriesLabel, setSeriesLabel] = useState(series?.series_label || "");
  const [microcycleName, setMicrocycleName] = useState(
    series?.microcycle_name || ""
  );
  const [load, setLoad] = useState(series?.load || "");
  const [reps, setReps] = useState(series?.reps || "");
  const [rir, setRir] = useState(series?.rir || "");
  const [notes, setNotes] = useState(series?.notes || "");
  const [rest, setRest] = useState(series?.rest || "");
  const [specialInstructions, setSpecialInstructions] = useState(
    series?.special_instructions || ""
  );
  const [exerciseVariation, setExerciseVariation] = useState(
    series?.exercise_variation || ""
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const num = Number.parseInt(seriesNumber, 10);
    if (!num || num < 1) return;
    setLoading(true);
    try {
      await onSubmit({
        series_number: num,
        series_label: seriesLabel.trim() || null,
        microcycle_name: microcycleName.trim() || null,
        load: load.trim() || null,
        reps: reps.trim() || null,
        rir: rir.trim() || null,
        notes: notes.trim() || null,
        rest: rest.trim() || null,
        special_instructions: specialInstructions.trim() || null,
        exercise_variation: exerciseVariation.trim() || null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Número de Serie *
          </label>
          <input
            type="number"
            min="1"
            value={seriesNumber}
            onChange={(e) => setSeriesNumber(e.target.value)}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Etiqueta de Serie
          </label>
          <input
            type="text"
            value={seriesLabel}
            onChange={(e) => setSeriesLabel(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            placeholder="Ej: 1ª Serie (60kg)"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Microciclo
        </label>
        <input
          type="text"
          value={microcycleName}
          onChange={(e) => setMicrocycleName(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="Ej: 1º"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Carga
          </label>
          <input
            type="text"
            value={load}
            onChange={(e) => setLoad(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            placeholder="Ej: 20"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Repeticiones
          </label>
          <input
            type="text"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            placeholder="Ej: 15"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            RIR
          </label>
          <input
            type="text"
            value={rir}
            onChange={(e) => setRir(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            placeholder="Ej: RIR 1-0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Descanso
          </label>
          <input
            type="text"
            value={rest}
            onChange={(e) => setRest(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            placeholder='Ej: 60"'
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Variación del Ejercicio
        </label>
        <input
          type="text"
          value={exerciseVariation}
          onChange={(e) => setExerciseVariation(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="Ej: PRENSA, UNIL MANC"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Instrucciones Especiales
        </label>
        <input
          type="text"
          value={specialInstructions}
          onChange={(e) => setSpecialInstructions(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder='Ej: SPEED CHANGES, R.P20"'
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Notas
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="Notas adicionales sobre esta serie"
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
          disabled={loading}
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-accent disabled:opacity-50">
          {loading ? "Guardando..." : series ? "Actualizar" : "Crear"}
        </button>
      </div>
    </form>
  );
}
