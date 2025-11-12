"use client";

import type { MesocycleSummary } from "@/components/admin/planning/planningTypes";
import type { PlanningStatus } from "@/lib/db-local/db";

interface MesocycleColumnProps {
  mesocycles: MesocycleSummary[];
  selectedId: string | null;
  selectedMacrocycleName?: string | null;
  onCreate: () => void;
  onSelect: (mesocycleId: string) => void;
  onEdit: (mesocycle: MesocycleSummary) => void;
  onDuplicate: (mesocycle: MesocycleSummary) => void | Promise<void>;
  onDelete: (mesocycle: MesocycleSummary) => void | Promise<void>;
  statusLabel: Record<PlanningStatus, string>;
  statusStyle: Record<PlanningStatus, string>;
  isCreateDisabled: boolean;
}

export function MesocycleColumn({
  mesocycles,
  selectedId,
  selectedMacrocycleName,
  onCreate,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  statusLabel,
  statusStyle,
  isCreateDisabled,
}: MesocycleColumnProps) {
  return (
    <section className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Fases
          </span>
          <h3 className="text-base font-semibold text-slate-900">Mesociclos</h3>
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
        {selectedMacrocycleName
          ? `Organiza las fases de ${selectedMacrocycleName}.`
          : "Selecciona un macrociclo para detallar sus fases intermedias."}
      </p>
      <ul className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {!selectedMacrocycleName ? (
          <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
            Selecciona un macrociclo para ver y crear sus mesociclos.
          </li>
        ) : mesocycles.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
            Aún no hay mesociclos. Añade fases para estructurar la temporada.
          </li>
        ) : (
          mesocycles.map((mesocycle) => {
            const isSelected = mesocycle.id === selectedId;
            return (
              <li key={mesocycle.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(mesocycle.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(mesocycle.id);
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
                        {mesocycle.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {mesocycle.duration}
                        {typeof mesocycle.order_index === "number"
                          ? ` · Orden ${mesocycle.order_index}`
                          : ""}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        statusStyle[mesocycle.status]
                      }`}
                    >
                      {statusLabel[mesocycle.status]}
                    </span>
                  </div>
                  {mesocycle.goal ? (
                    <p className="text-xs text-slate-600">
                      Objetivo: {mesocycle.goal}
                    </p>
                  ) : null}
                  {mesocycle.focus ? (
                    <p className="text-xs text-slate-500">
                      Enfoque: {mesocycle.focus}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-2 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(mesocycle);
                      }}
                      className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicate(mesocycle);
                      }}
                      className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(mesocycle);
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
