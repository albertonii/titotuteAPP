"use client";

import type { FC } from "react";

interface MicroSelectorProps {
  microcycles: string[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  completedExercises: number;
  totalExercises: number;
}

export const MicroSelector: FC<MicroSelectorProps> = ({
  microcycles,
  selectedIndex,
  onSelectIndex,
  completedExercises,
  totalExercises,
}) => {
  if (!microcycles.length) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-slate-700">Microciclo (semana)</h2>
            <p className="text-xs text-slate-500">
              {completedExercises}/{totalExercises} ejercicios registrados hoy.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 pb-1 pt-1">
          {microcycles.map((micro, index) => {
            const isActive = selectedIndex === index;
            return (
              <button
                key={micro}
                type="button"
                onClick={() => onSelectIndex(index)}
                className={
                  "rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition " +
                  (isActive
                    ? "bg-brand-primary text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-brand-primary/10 hover:text-brand-primary")
                }
              >
                {micro}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
