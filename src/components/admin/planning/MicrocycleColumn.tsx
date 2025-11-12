"use client";

import type { Microcycle } from "@/lib/db-local/db";
import type { PlanningStatus } from "@/lib/db-local/db";

interface MicrocycleColumnProps {
  microcycles: Microcycle[];
  selectedId: string | null;
  selectedMesocycleName?: string | null;
  onCreate: () => void;
  onSelect: (microcycleId: string) => void;
  onEdit: (microcycle: Microcycle) => void;
  onDuplicate: (microcycle: Microcycle) => void | Promise<void>;
  onDelete: (microcycle: Microcycle) => void | Promise<void>;
  statusLabel: Record<PlanningStatus, string>;
  statusStyle: Record<PlanningStatus, string>;
  isCreateDisabled: boolean;
}

export function MicrocycleColumn({
  microcycles,
  selectedId,
  selectedMesocycleName,
  onCreate,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  statusLabel,
  statusStyle,
  isCreateDisabled,
}: MicrocycleColumnProps) {
  return (
    <section className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Microciclos
          </span>
          <h3 className="text-base font-semibold text-slate-900">
            Semanas clave
          </h3>
        </div>
        <button
          type="button"
          onClick={isCreateDisabled ? undefined : onCreate}
          disabled={isCreateDisabled}
          className={`rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
            isCreateDisabled
              ? "cursor-not-allowed border-slate-200 text-slate-400"
              : "border-brand-primary/60 text-brand-primary hover:bg-brand-primary/10"
          }`}
        >
          + Nuevo
        </button>
      </header>
      <p className="text-xs text-slate-500">
        {selectedMesocycleName
          ? `Detalla la planificación semanal dentro de ${selectedMesocycleName}.`
          : "Selecciona un mesociclo para gestionar sus microciclos."}
      </p>
      <ul className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {!selectedMesocycleName ? (
          <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
            Selecciona un mesociclo para ver sus microciclos.
          </li>
        ) : microcycles.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
            Añade microciclos semanales para reflejar el Excel.
          </li>
        ) : (
          microcycles.map((microcycle) => {
            const isSelected = microcycle.id === selectedId;
            return (
              <li key={microcycle.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(microcycle.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(microcycle.id);
                    }
                  }}
                  className={`flex w-full flex-col gap-2 rounded-xl border bg-white p-4 text-left text-sm shadow-sm transition ${
                    isSelected
                      ? "border-brand-primary/60 ring-2 ring-brand-primary/20"
                      : "border-slate-200 hover:border-brand-primary/40 hover:shadow-md"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-base font-semibold text-slate-900">
                        {microcycle.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        Semana {microcycle.week_number}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        statusStyle[microcycle.status]
                      }`}
                    >
                      {statusLabel[microcycle.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    {microcycle.focus ? (
                      <span>· {microcycle.focus}</span>
                    ) : null}
                    {microcycle.load ? (
                      <span>· Carga {microcycle.load}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(microcycle);
                      }}
                      className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicate(microcycle);
                      }}
                      className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(microcycle);
                      }}
                      className="rounded border border-rose-200 px-3 py-1 font-medium text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
