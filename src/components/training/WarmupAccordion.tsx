"use client";

import type { FC } from "react";
import type { TrainingWarmup } from "@/types/training";

interface WarmupAccordionProps {
  warmups: TrainingWarmup[];
}

export const WarmupAccordion: FC<WarmupAccordionProps> = ({ warmups }) => {
  if (!warmups.length) return null;

  return (
    <details className="rounded-3xl border border-slate-200 bg-white/95 shadow-sm">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-3xl px-4 py-3 text-left text-lg font-semibold text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 sm:px-5">
        Calentamiento
        <span className="text-sm font-medium text-brand-primary/70">
          mostrar/ocultar
        </span>
      </summary>
      <div className="px-4 pb-4 pt-2 sm:px-5">
        <ul className="space-y-3 text-sm text-slate-600">
          {warmups.map((warmup, index) => (
            <li
              key={`${warmup.description}-${index}`}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
            >
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-semibold text-brand-primary">
                {index + 1}
              </span>
              <div className="flex flex-col gap-2">
                <span className="font-medium text-slate-700">
                  {warmup.description}
                </span>
                {warmup.resource ? (
                  <a
                    href={warmup.resource}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-brand-primary underline underline-offset-4"
                  >
                    Vídeo / Referencia
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
};
