"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface PlanningModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export function PlanningModal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: PlanningModalProps) {
  const backdropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-6"
    >
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={(event) => {
          if (event.target === backdropRef.current) {
            onClose();
          }
        }}
      />
      <div className="relative z-10 flex w-full max-w-3xl flex-col gap-4 rounded-3xl bg-white p-5 shadow-xl">
        <header className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle ? (
              <p className="text-xs text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
            aria-label="Cerrar editor"
          >
            Cerrar
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}
