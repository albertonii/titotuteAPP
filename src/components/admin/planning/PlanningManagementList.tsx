"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Macrocycle, User, PlanningAssignment } from "@/lib/db-local/db";
import {
  listMacrocycles,
  listPlanningAssignments,
  assignPlanningToUser,
  setActivePlanning,
  removePlanningAssignment,
  getActivePlanningForUser,
} from "@/lib/services/planning";
import { listLocalUsers } from "@/lib/services/users";
import { useAuthStore } from "@/lib/state/auth";
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

interface PlanningWithAssignments extends Macrocycle {
  assignments: PlanningAssignment[];
  assignedUsers: User[];
  activeUsers: User[];
}

export function PlanningManagementList({
  onEdit,
}: {
  onEdit: (macrocycle: Macrocycle) => void;
}) {
  const user = useAuthStore((state) => state.user);
  const [macrocycles, setMacrocycles] = useState<Macrocycle[]>([]);
  const [assignments, setAssignments] = useState<PlanningAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [feedback, setFeedback] = useState<string>("");
  const [selectedMacrocycleId, setSelectedMacrocycleId] = useState<
    string | null
  >(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    const [macros, assigns, userList] = await Promise.all([
      listMacrocycles(),
      listPlanningAssignments(),
      listLocalUsers(),
    ]);
    setMacrocycles(macros);
    setAssignments(assigns);
    setUsers(userList.filter((u) => u.role === "athlete"));
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const planningWithAssignments = useMemo<PlanningWithAssignments[]>(() => {
    return macrocycles.map((macro) => {
      const macroAssignments = assignments.filter(
        (a) => a.macrocycle_id === macro.id
      );
      const assignedUserIds = macroAssignments.map((a) => a.user_id);
      const activeUserIds = macroAssignments
        .filter((a) => a.is_active)
        .map((a) => a.user_id);
      return {
        ...macro,
        assignments: macroAssignments,
        assignedUsers: users.filter((u) => assignedUserIds.includes(u.id)),
        activeUsers: users.filter((u) => activeUserIds.includes(u.id)),
      };
    });
  }, [macrocycles, assignments, users]);

  const handleAssignPlanning = async () => {
    if (!selectedMacrocycleId || !selectedUserId) {
      setFeedback("Selecciona una planificación y un usuario.");
      return;
    }

    try {
      await assignPlanningToUser({
        user_id: selectedUserId,
        macrocycle_id: selectedMacrocycleId,
        is_active: false,
        assigned_by: user?.id ?? null,
      });
      setFeedback("Planificación asignada correctamente.");
      await refreshData();
      setSelectedMacrocycleId(null);
      setSelectedUserId(null);
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo asignar la planificación."
      );
    }
  };

  const handleSetActive = async (macrocycleId: string, userId: string) => {
    try {
      await setActivePlanning(userId, macrocycleId);
      setFeedback("Planificación activa actualizada.");
      await refreshData();
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la planificación activa."
      );
    }
  };

  const handleRemoveAssignment = async (
    macrocycleId: string,
    userId: string
  ) => {
    if (
      !window.confirm(
        "¿Eliminar esta asignación? El usuario ya no tendrá acceso a esta planificación."
      )
    ) {
      return;
    }

    try {
      await removePlanningAssignment(userId, macrocycleId);
      setFeedback("Asignación eliminada.");
      await refreshData();
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la asignación."
      );
    }
  };

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-slate-900">
          Gestión de planificaciones
        </h2>
        <p className="text-sm text-slate-600">
          Visualiza todas las planificaciones, asígnalas a usuarios y marca
          cuál está activa para cada atleta.
        </p>
        {feedback ? (
          <span className="text-xs font-medium text-brand-primary/90">
            {feedback}
          </span>
        ) : null}
      </header>

      {/* Formulario de asignación */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          Asignar planificación a usuario
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">
              Planificación
            </span>
            <select
              value={selectedMacrocycleId ?? ""}
              onChange={(e) => setSelectedMacrocycleId(e.target.value || null)}
              className="rounded border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            >
              <option value="">Seleccionar...</option>
              {macrocycles.map((macro) => (
                <option key={macro.id} value={macro.id}>
                  {macro.name} ({formatShortDate(macro.start_date)} -{" "}
                  {formatShortDate(macro.end_date)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Usuario</span>
            <select
              value={selectedUserId ?? ""}
              onChange={(e) => setSelectedUserId(e.target.value || null)}
              className="rounded border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            >
              <option value="">Seleccionar...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleAssignPlanning}
              disabled={!selectedMacrocycleId || !selectedUserId}
              className="w-full rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Asignar
            </button>
          </div>
        </div>
      </div>

      {/* Lista de planificaciones */}
      <div className="flex flex-col gap-4">
        {planningWithAssignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No hay planificaciones creadas. Crea una planificación para
            comenzar.
          </div>
        ) : (
          planningWithAssignments.map((planning) => (
            <div
              key={planning.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {planning.name}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        planningStatusStyle[planning.status]
                      }`}
                    >
                      {planningStatusLabel[planning.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {formatShortDate(planning.start_date)} -{" "}
                    {formatShortDate(planning.end_date)}
                    {planning.season ? ` · ${planning.season}` : ""}
                  </p>
                  {planning.goal && (
                    <p className="mt-1 text-sm text-slate-600">
                      {planning.goal}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(planning)}
                  className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  Editar
                </button>
              </div>

              {/* Usuarios asignados */}
              <div className="mt-4 border-t border-slate-200 pt-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Usuarios asignados ({planning.assignedUsers.length})
                </h4>
                {planning.assignedUsers.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No hay usuarios asignados a esta planificación.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {planning.assignedUsers.map((assignedUser) => {
                      const assignment = planning.assignments.find(
                        (a) => a.user_id === assignedUser.id
                      );
                      const isActive = assignment?.is_active ?? false;
                      return (
                        <div
                          key={assignedUser.id}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-900">
                              {assignedUser.name}
                            </span>
                            {isActive ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                Activa
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                Inactiva
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetActive(planning.id, assignedUser.id)
                                }
                                className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                              >
                                Activar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveAssignment(
                                  planning.id,
                                  assignedUser.id
                                )
                              }
                              className="rounded border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

