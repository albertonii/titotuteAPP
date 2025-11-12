"use client";

import type {
  SessionFormState,
  EditorMode,
} from "@/components/admin/planning/planningTypes";
import type { SessionStatus, User } from "@/lib/db-local/db";
import type { Dispatch, FormEvent, SetStateAction, ChangeEvent } from "react";

interface SessionFormProps {
  form: SessionFormState;
  onChange: Dispatch<SetStateAction<SessionFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  mode: EditorMode;
  statusLabel: Record<SessionStatus, string>;
  trainers: User[];
  trainingSheets: string[];
}

export function SessionForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  mode,
  statusLabel,
  trainers,
  trainingSheets,
}: SessionFormProps) {
  const handleChange =
    (field: keyof SessionFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      onChange((prev) => ({ ...prev, [field]: value }));
    };

  const handleSelectChange =
    (field: keyof SessionFormState) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      onChange((prev) => ({ ...prev, [field]: value }));
    };

  const submitLabel = mode === "edit" ? "Guardar cambios" : "Crear sesión";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 p-1 text-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Título (opcional)
          </span>
          <input
            value={form.name}
            onChange={handleChange("name")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            placeholder="Sesión de fuerza A"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fecha
          </span>
          <input
            type="date"
            required
            value={form.date}
            onChange={handleChange("date")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Entrenamiento asignado
          </span>
          <select
            required
            value={form.session_type}
            onChange={handleSelectChange("session_type")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
          >
            <option value="">Selecciona un entrenamiento</option>
            {trainingSheets.map((sheet) => (
              <option key={sheet} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Responsable
          </span>
          <select
            value={form.trainer_id}
            onChange={handleSelectChange("trainer_id")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
          >
            <option value="">Sin asignar</option>
            {trainers.map((trainer) => (
              <option key={trainer.id} value={trainer.id}>
                {trainer.name}
              </option>
            ))}
          </select>
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
            Estado
          </span>
          <select
            value={form.status}
            onChange={handleSelectChange("status")}
            className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
          >
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Notas
          </span>
          <textarea
            value={form.notes}
            onChange={handleChange("notes")}
            className="min-h-[80px] rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            placeholder="Indicaciones para atletas, recordatorios logísticos o métricas a controlar"
          />
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
