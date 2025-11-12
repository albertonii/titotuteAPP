"use client";

import type { Session, SessionStatus } from "@/lib/db-local/db";

interface SessionsColumnProps {
  sessions: Session[];
  sessionScopeLabel: string;
  onCreate: () => void;
  onEdit: (session: Session) => void;
  onDuplicate: (session: Session) => void | Promise<void>;
  onDelete: (session: Session) => void | Promise<void>;
  statusLabel: Record<SessionStatus, string>;
  statusStyle: Record<SessionStatus, string>;
  isCreateDisabled: boolean;
  canViewSessions: boolean;
  formatDate: (iso: string) => string;
  trainerNamesById: Record<string, string>;
}

export function SessionsColumn({
  sessions,
  sessionScopeLabel,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
  statusLabel,
  statusStyle,
  isCreateDisabled,
  canViewSessions,
  formatDate,
  trainerNamesById,
}: SessionsColumnProps) {
  return (
    <section className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {sessionScopeLabel}
          </span>
          <h3 className="text-base font-semibold text-slate-900">Sesiones</h3>
        </div>
        <button
          type="button"
          onClick={isCreateDisabled ? undefined : onCreate}
          disabled={isCreateDisabled}
          className={`rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
            isCreateDisabled
              ? "cursor-not-allowed border-slate-200 text-slate-400"
              : "border-brand-primary/60 text-brand-primary hover:bg-brand-primary/10"
          }`}
        >
          + Nueva
        </button>
      </header>
      <p className="text-xs text-slate-500">
        {isCreateDisabled
          ? "Selecciona al menos un macrociclo para planificar sesiones."
          : "Programa entrenamientos específicos y alinea al staff incluso offline."}
      </p>
      <ul className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {!canViewSessions ? (
          <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
            Selecciona un macrociclo o microciclo para ver las sesiones
            asociadas.
          </li>
        ) : sessions.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
            No hay sesiones registradas para esta selección.
          </li>
        ) : (
          sessions.map((session) => (
            <li key={session.id}>
              <article className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm transition hover:border-brand-primary/40 hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-base font-semibold text-slate-900">
                      {session.name || session.session_type}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDate(session.date)}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      statusStyle[session.status]
                    }`}
                  >
                    {statusLabel[session.status]}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {session.microcycle_id
                    ? "Microciclo asignado"
                    : session.mesocycle_id
                    ? "Mesociclo general"
                    : "Macrociclo general"}
                  {session.trainer_id ? (
                    <span>
                      · Coach:{" "}
                      {trainerNamesById[session.trainer_id] ??
                        session.trainer_id.slice(0, 8)}
                    </span>
                  ) : null}
                  <span>· Plan: {session.session_type}</span>
                </div>
                {session.notes ? (
                  <p className="text-xs text-slate-600">{session.notes}</p>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2 pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onEdit(session)}
                    className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicate(session)}
                    className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(session)}
                    className="rounded border border-rose-200 px-3 py-1 font-medium text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
