"use client";

import { useMemo } from "react";
import type { Macrocycle } from "@/lib/db-local/db";
import { planningStatusLabel, planningStatusStyle } from "./planningConstants";

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

interface MacrocycleListViewProps {
  macrocycles: Macrocycle[];
  onCreate: () => void;
  onEdit: (macrocycle: Macrocycle) => void;
  onView: (macrocycle: Macrocycle) => void;
  onDelete: (macrocycle: Macrocycle) => void;
  onDuplicate: (macrocycle: Macrocycle) => void;
}

export function MacrocycleListView({
  macrocycles,
  onCreate,
  onEdit,
  onView,
  onDelete,
  onDuplicate,
}: MacrocycleListViewProps) {
  const sortedMacrocycles = useMemo(() => {
    return [...macrocycles].sort((a, b) => {
      // Ordenar por fecha de inicio (más reciente primero)
      const dateA = new Date(a.start_date).getTime();
      const dateB = new Date(b.start_date).getTime();
      return dateB - dateA;
    });
  }, [macrocycles]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Macrociclos
          </h2>
          <p className="text-sm text-slate-600">
            Gestiona todas tus planificaciones de temporada
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-accent"
        >
          + Nuevo Macrociclo
        </button>
      </div>

      {sortedMacrocycles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">
            No hay macrociclos creados. Crea uno para comenzar.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedMacrocycles.map((macrocycle) => (
            <div
              key={macrocycle.id}
              className="group relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-primary/40 hover:shadow-md"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {macrocycle.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatShortDate(macrocycle.start_date)} -{" "}
                    {formatShortDate(macrocycle.end_date)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    planningStatusStyle[macrocycle.status]
                  }`}
                >
                  {planningStatusLabel[macrocycle.status]}
                </span>
              </div>

              {/* Información adicional */}
              <div className="flex flex-col gap-1 text-xs text-slate-600">
                {macrocycle.season && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Temporada:</span>
                    <span>{macrocycle.season}</span>
                  </div>
                )}
                {macrocycle.goal && (
                  <div className="flex items-start gap-2">
                    <span className="font-medium">Objetivo:</span>
                    <span className="flex-1">{macrocycle.goal}</span>
                  </div>
                )}
                {macrocycle.notes && (
                  <p className="mt-1 line-clamp-2 text-slate-500">
                    {macrocycle.notes}
                  </p>
                )}
              </div>

              {/* Acciones */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onView(macrocycle)}
                  className="flex-1 rounded bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-accent"
                >
                  Ver y Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(macrocycle)}
                  className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Duplicar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(macrocycle)}
                  className="rounded border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

