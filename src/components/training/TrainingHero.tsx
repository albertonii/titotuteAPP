"use client";

import type { FC } from "react";

const DATE_BADGE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

interface TrainingHeroProps {
  title: string | null;
  phase: string | null;
  microcycle: string;
  totalExercises: number;
  completedExercises: number;
  lastUpdate: string | null;
}

export const TrainingHero: FC<TrainingHeroProps> = ({
  title,
  phase,
  microcycle,
  totalExercises,
  completedExercises,
  lastUpdate,
}) => {
  const progress = totalExercises
    ? Math.round((completedExercises / totalExercises) * 100)
    : 0;
  const lastUpdateLabel = lastUpdate
    ? DATE_BADGE_FORMATTER.format(new Date(lastUpdate))
    : null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              Plan de trabajo
            </span>
            <h1 className="text-2xl font-semibold text-brand-primary">
              {title ?? "Entrenamiento"}
            </h1>
            <p className="text-sm text-slate-500">
              Estás en el microciclo
              <span className="font-semibold text-slate-700"> {microcycle}</span>.
              Completa los ejercicios y registra tus métricas para seguir tu avance.
            </p>
          </div>
          {phase ? (
            <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
              {phase}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Progreso de hoy
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-slate-900">{completedExercises}</p>
              <span className="text-sm text-slate-500">de {totalExercises}</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-brand-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Microciclo activo
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{microcycle}</p>
            <p className="mt-1 text-sm text-slate-500">
              Revisa el plan, ejecuta con calma y registra cómo te sentiste en cada bloque.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Último registro
            </p>
            {lastUpdateLabel ? (
              <p className="mt-2 text-lg font-semibold text-slate-900">{lastUpdateLabel}</p>
            ) : (
              <p className="mt-2 text-lg font-semibold text-slate-900">—</p>
            )}
            <p className="mt-1 text-sm text-slate-500">
              {lastUpdateLabel
                ? "Tu información está al día. ¡Bien!"
                : "Aún no registraste este microciclo."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
