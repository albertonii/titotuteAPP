"use client";

import type { FC } from "react";

interface PlanSelectorProps {
  sheetKeys: string[];
  selectedSheet: string;
  onSelectSheet: (sheet: string) => void;
}

export const PlanSelector: FC<PlanSelectorProps> = ({
  sheetKeys,
  selectedSheet,
  onSelectSheet,
}) => {
  if (!sheetKeys.length) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Entrenamientos disponibles
          </h2>
          <p className="text-xs text-slate-400">Elige el plan asignado para hoy.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 pb-1 pt-1">
          {sheetKeys.map((sheet) => {
            const isActive = sheet === selectedSheet;
            return (
              <button
                key={sheet}
                type="button"
                onClick={() => onSelectSheet(sheet)}
                className={
                  "rounded-full border px-3 py-2 text-sm font-medium transition " +
                  (isActive
                    ? "border-brand-primary bg-brand-primary text-white shadow"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-primary/40 hover:text-brand-primary")
                }
              >
                {sheet.replace("ENTRENAMIENTO ", "Entrenamiento ")}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
