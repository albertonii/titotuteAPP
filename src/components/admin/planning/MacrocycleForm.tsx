"use client";

import type {
  MacrocycleFormState,
  EditorMode,
} from "@/components/admin/planning/planningTypes";
import type { PlanningStatus } from "@/lib/db-local/db";
import type { Dispatch, FormEvent, SetStateAction, ChangeEvent } from "react";

interface MacrocycleFormProps {
  form: MacrocycleFormState;
  onChange: Dispatch<SetStateAction<MacrocycleFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  mode: EditorMode;
  statusLabel: Record<PlanningStatus, string>;
}

export function MacrocycleForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  mode,
  statusLabel,
}: MacrocycleFormProps) {
  const handleChange =
    (field: keyof MacrocycleFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      onChange((prev) => ({ ...prev, [field]: value }));
    };

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange((prev) => ({
      ...prev,
      status: event.target.value as PlanningStatus,
    }));
  };

  const submitLabel = mode === "edit" ? "Guardar cambios" : "Crear macrociclo";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 p-1 text-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Nombre
          </span>
          <input
            required
            value={form.name}
            onChange={handleChange("name")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            placeholder="Temporada 2025"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Temporada
          </span>
          <input
            value={form.season}
            onChange={handleChange("season")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            placeholder="2025-2026"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Inicio
          </span>
          <input
            type="date"
            required
            value={form.start_date}
            onChange={handleChange("start_date")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fin
          </span>
          <input
            type="date"
            required
            value={form.end_date}
            onChange={handleChange("end_date")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Objetivo
          </span>
          <input
            value={form.goal}
            onChange={handleChange("goal")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            placeholder="Preparación para competencia regional"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Notas
          </span>
          <textarea
            value={form.notes}
            onChange={handleChange("notes")}
            className="min-h-[80px] rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            placeholder="Lineamientos generales, hitos, recordatorios"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Estado
          </span>
          <select
            value={form.status}
            onChange={handleStatusChange}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
          >
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded bg-brand-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-brand-accent"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
