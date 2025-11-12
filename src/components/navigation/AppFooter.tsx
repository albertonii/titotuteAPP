"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/state/auth";
import type { UserRole } from "@/lib/db-local/db";

const footerActions: Record<
  UserRole | "guest",
  { label: string; href: string }
> = {
  guest: { label: "Inicia sesión", href: "/login" },
  admin: { label: "Gestionar usuarios", href: "/admin" },
  trainer: { label: "Coach Mode", href: "/coach" },
  athlete: { label: "Ver plan", href: "/training" },
  nutritionist: { label: "Panel de atletas", href: "/athlete" },
};

export function AppFooter() {
  const { user } = useAuthStore();
  const action = footerActions[user?.role ?? "guest"];

  return (
    <footer className="mt-10 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 px-5 py-6 text-sm text-slate-500 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary">
          Tito &amp; Tute Training
        </span>
        <p className="text-sm text-slate-600">
          Plataforma offline-first para planificación y seguimiento
          semipersonal. Diseñada por y para coaches que no quieren depender de
          la conexión.
        </p>
      </div>
      <div className="flex flex-col gap-3 text-sm sm:items-end">
        <Link
          href={action.href}
          className="inline-flex items-center justify-center rounded-full bg-brand-primary px-4 py-2 font-semibold text-white transition hover:bg-brand-accent"
        >
          {action.label}
        </Link>
        <p className="text-xs text-slate-400">
          ¿Influye tu rol? Autenticado como {user?.role ?? "invitado"}.
        </p>
      </div>
    </footer>
  );
}
