"use client";

import type { MouseEventHandler } from "react";
import type {
  MacrocycleSummary,
  EditorMode,
} from "@/components/admin/planning/planningTypes";
import type { PlanningStatus } from "@/lib/db-local/db";

interface MacrocycleColumnProps {
  macrocycles: MacrocycleSummary[];
  selectedId: string | null;
  onCreate: () => void;
  onSelect: (macrocycleId: string) => void;
  onEdit: (macrocycle: MacrocycleSummary) => void;
  onDuplicate: (macrocycle: MacrocycleSummary) => void | Promise<void>;
  onDelete: (macrocycle: MacrocycleSummary) => void | Promise<void>;
  statusLabel: Record<PlanningStatus, string>;
  statusStyle: Record<PlanningStatus, string>;
}

export function MacrocycleColumn({
  macrocycles,
  selectedId,
  onCreate,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  statusLabel,
  statusStyle,
}: MacrocycleColumnProps) {
  const createClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    onCreate();
  };

  return (
    <section className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Temporadas
          </span>
          <h3 className="text-base font-semibold text-slate-900">
            Macrociclos
          </h3>
        </div>
        <button
          type="button"
          onClick={createClick}
          className="rounded-full border border-dashed border-brand-primary/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-primary transition hover:bg-brand-primary/10"
        >
          + Nuevo
        </button>
      </header>
      <p className="text-xs text-slate-500">
        {macrocycles.length
          ? `${macrocycles.length} temporadas configuradas`
          : "Configura objetivos anuales con la misma flexibilidad que en el Excel."}
      </p>
      <ul className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {macrocycles.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
            Aún no hay macrociclos. Crea el primero para comenzar.
          </li>
        ) : (
          macrocycles.map((macrocycle) => {
            const isSelected = macrocycle.id === selectedId;
            return (
              <li key={macrocycle.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(macrocycle.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(macrocycle.id);
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
                        {macrocycle.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {macrocycle.duration}
                        {macrocycle.season ? ` · ${macrocycle.season}` : ""}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        statusStyle[macrocycle.status]
                      }`}
                    >
                      {statusLabel[macrocycle.status]}
                    </span>
                  </div>
                  {macrocycle.goal ? (
                    <p className="text-xs text-slate-600">
                      Meta: {macrocycle.goal}
                    </p>
                  ) : null}
                  {macrocycle.notes ? (
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {macrocycle.notes}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-2 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(macrocycle);
                      }}
                      className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicate(macrocycle);
                      }}
                      className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(macrocycle);
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
