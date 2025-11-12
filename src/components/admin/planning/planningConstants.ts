import type { PlanningStatus, SessionStatus } from "@/lib/db-local/db";

export const planningStatusLabel: Record<PlanningStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

export const planningStatusStyle: Record<PlanningStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-700",
  archived: "bg-slate-200 text-slate-600",
};

export const sessionStatusLabel: Record<SessionStatus, string> = {
  draft: "Borrador",
  scheduled: "Programada",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const sessionStatusStyle: Record<SessionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};
