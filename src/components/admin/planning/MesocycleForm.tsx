"use client";

import type {
  MesocycleFormState,
  EditorMode,
} from "@/components/admin/planning/planningTypes";
import type { PlanningStatus } from "@/lib/db-local/db";
import type { Dispatch, FormEvent, SetStateAction, ChangeEvent } from "react";

interface MesocycleFormProps {
  form: MesocycleFormState;
  onChange: Dispatch<SetStateAction<MesocycleFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  mode: EditorMode;
  statusLabel: Record<PlanningStatus, string>;
}

export function MesocycleForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  mode,
  statusLabel,
}: MesocycleFormProps) {
  const handleChange =
    (field: keyof MesocycleFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      onChange((prev) => ({ ...prev, [field]: value }));
    };

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange((prev) => ({
      ...prev,
      status: event.target.value as PlanningStatus,
    }));
  };

  const submitLabel = mode === "edit" ? "Guardar cambios" : "Crear mesociclo";

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
            placeholder="Fase de acumulación"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Orden
          </span>
          <input
            type="number"
            min={0}
            value={form.order_index}
            onChange={handleChange("order_index")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fase
          </span>
          <input
            value={form.phase}
            onChange={handleChange("phase")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            placeholder="Acumulación, intensificación, taper..."
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Enfoque
          </span>
          <input
            value={form.focus}
            onChange={handleChange("focus")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            placeholder="Fuerza máxima, potencia..."
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
            placeholder="Metas específicas de la fase"
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
