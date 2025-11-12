"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/state/auth";

export function AppFooter() {
  const { user } = useAuthStore();

  return (
    <footer className="mt-10 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 px-5 py-6 text-sm text-slate-500 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary">
          Tito &amp; Tute Training
        </span>
        <p className="text-sm text-slate-600">
          Entrenadores, atletas y nutricionistas comparten aquí un flujo
          offline-first. Los datos se guardan en Dexie y se sincronizan
          automáticamente con Supabase al recuperar la conexión.
        </p>
      </div>

      <div className="flex flex-col gap-2 text-xs text-slate-500 sm:items-end">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-700">
            Hola, {user?.name ?? "invitado"}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
            Rol · {user?.role ?? "sin sesión"}
          </span>
        </div>
        <p>
          ¿Necesitas ayuda? Revisa la guía rápida en el panel de{" "}
          <Link
            href="/sync"
            className="text-brand-primary underline underline-offset-4"
          >
            sincronización
          </Link>{" "}
          o contacta con tu administrador.
        </p>
        <p className="text-[11px] text-slate-400">
          Última versión ·{" "}
          {new Date().toLocaleDateString("es-AR", {
            year: "numeric",
            month: "short",
          })}
        </p>
      </div>
    </footer>
  );
}
