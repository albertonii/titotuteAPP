import {
  db,
  type Macrocycle,
  type Mesocycle,
  type Microcycle,
  type Session,
  type PlanningStatus,
  type SessionStatus,
} from "@/lib/db-local/db";
import { queueOutboxAction } from "@/lib/sync/outbox";

const DEFAULT_PLANNING_STATUS: PlanningStatus = "draft";
const DEFAULT_SESSION_STATUS: SessionStatus = "scheduled";

const nowIso = () => new Date().toISOString();

const enqueue = async (
  table: string,
  payload: unknown,
  operation: "insert" | "update" | "delete" = "insert"
) => {
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table,
    operation,
    payload,
  });
};

export interface MacrocycleInput {
  name: string;
  season?: string | null;
  start_date: string;
  end_date: string;
  goal?: string | null;
  notes?: string | null;
  status?: PlanningStatus;
  created_by?: string | null;
}

export interface MesocycleInput {
  macrocycle_id: string;
  name: string;
  start_date: string;
  end_date: string;
  phase?: string | null;
  focus?: string | null;
  goal?: string | null;
  order_index?: number;
  status?: PlanningStatus;
}

export interface MicrocycleInput {
  mesocycle_id: string;
  name: string;
  week_number: number;
  start_date?: string | null;
  end_date?: string | null;
  focus?: string | null;
  load?: string | null;
  status?: PlanningStatus;
}

export interface SessionInput {
  mesocycle_id?: string | null;
  microcycle_id?: string | null;
  macrocycle_id?: string | null;
  trainer_id?: string | null;
  name?: string | null;
  date: string;
  session_type: string;
  order_index?: number;
  status?: SessionStatus;
  notes?: string | null;
}

export const createMacrocycle = async (
  input: MacrocycleInput
): Promise<Macrocycle> => {
  const macrocycle: Macrocycle = {
    id: crypto.randomUUID(),
    name: input.name,
    season: input.season ?? null,
    start_date: input.start_date,
    end_date: input.end_date,
    goal: input.goal ?? null,
    notes: input.notes ?? null,
    status: input.status ?? DEFAULT_PLANNING_STATUS,
    created_by: input.created_by ?? null,
    updated_at: nowIso(),
  };

  await db.macrocycles.put(macrocycle);
  await enqueue("macrocycles", macrocycle, "insert");
  return macrocycle;
};

export const createMesocycle = async (
  input: MesocycleInput
): Promise<Mesocycle> => {
  const mesocycle: Mesocycle = {
    id: crypto.randomUUID(),
    macrocycle_id: input.macrocycle_id,
    name: input.name,
    start_date: input.start_date,
    end_date: input.end_date,
    phase: input.phase ?? null,
    focus: input.focus ?? null,
    goal: input.goal ?? null,
    order_index: input.order_index ?? 0,
    status: input.status ?? DEFAULT_PLANNING_STATUS,
    updated_at: nowIso(),
  };

  await db.mesocycles.put(mesocycle);
  await enqueue("mesocycles", mesocycle, "insert");
  return mesocycle;
};

export const createMicrocycle = async (
  input: MicrocycleInput
): Promise<Microcycle> => {
  const microcycle: Microcycle = {
    id: crypto.randomUUID(),
    mesocycle_id: input.mesocycle_id,
    name: input.name,
    week_number: input.week_number,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    focus: input.focus ?? null,
    load: input.load ?? null,
    status: input.status ?? DEFAULT_PLANNING_STATUS,
    updated_at: nowIso(),
  };

  await db.microcycles.put(microcycle);
  await enqueue("microcycles", microcycle, "insert");
  return microcycle;
};

export const createSessionPlan = async (
  input: SessionInput
): Promise<Session> => {
  const session: Session = {
    id: crypto.randomUUID(),
    macrocycle_id: input.macrocycle_id ?? null,
    mesocycle_id: input.mesocycle_id ?? null,
    microcycle_id: input.microcycle_id ?? null,
    trainer_id: input.trainer_id ?? null,
    name: input.name ?? null,
    date: input.date,
    session_type: input.session_type,
    order_index: input.order_index ?? 0,
    status: input.status ?? DEFAULT_SESSION_STATUS,
    notes: input.notes ?? null,
    updated_at: nowIso(),
  };

  await db.sessions.put(session);
  await enqueue("sessions", session, "insert");
  return session;
};

export const listMacrocycles = async (): Promise<Macrocycle[]> => {
  return db.macrocycles.orderBy("start_date").toArray();
};

export const listMesocyclesByMacrocycle = async (
  macrocycleId: string
): Promise<Mesocycle[]> => {
  return db.mesocycles
    .where("macrocycle_id")
    .equals(macrocycleId)
    .sortBy("order_index");
};

export const listMicrocyclesByMesocycle = async (
  mesocycleId: string
): Promise<Microcycle[]> => {
  return db.microcycles
    .where("mesocycle_id")
    .equals(mesocycleId)
    .sortBy("week_number");
};

export const listSessionsByMicrocycle = async (
  microcycleId: string
): Promise<Session[]> => {
  return db.sessions
    .where("microcycle_id")
    .equals(microcycleId)
    .sortBy("order_index");
};

export const listSessionsByMesocycle = async (
  mesocycleId: string
): Promise<Session[]> => {
  return db.sessions
    .where("mesocycle_id")
    .equals(mesocycleId)
    .sortBy("order_index");
};

export const listSessionsByMacrocycle = async (
  macrocycleId: string
): Promise<Session[]> => {
  return db.sessions
    .where("macrocycle_id")
    .equals(macrocycleId)
    .sortBy("order_index");
};

const ensureEntity = <T>(entity: T | undefined, message: string): T => {
  if (!entity) {
    throw new Error(message);
  }
  return entity;
};

export const updateMacrocycle = async (
  id: string,
  changes: Partial<MacrocycleInput>
): Promise<Macrocycle> => {
  const existing = ensureEntity(
    await db.macrocycles.get(id),
    "Macrociclo no encontrado"
  );

  const updated: Macrocycle = {
    ...existing,
    ...changes,
    season: changes.season ?? existing.season ?? null,
    goal: changes.goal ?? existing.goal ?? null,
    notes: changes.notes ?? existing.notes ?? null,
    status: changes.status ?? existing.status,
    updated_at: nowIso(),
  };

  await db.macrocycles.put(updated);
  await enqueue("macrocycles", updated, "update");
  return updated;
};

export const deleteMacrocycle = async (id: string) => {
  await db.transaction(
    "rw",
    db.macrocycles,
    db.mesocycles,
    db.microcycles,
    db.sessions,
    async () => {
      const mesocycles = await db.mesocycles
        .where("macrocycle_id")
        .equals(id)
        .toArray();

      const mesocycleIds = mesocycles.map((meso) => meso.id);

      const microcycles = mesocycleIds.length
        ? await db.microcycles
            .where("mesocycle_id")
            .anyOf(mesocycleIds)
            .toArray()
        : [];

      const microcycleIds = microcycles.map((micro) => micro.id);

      if (microcycleIds.length) {
        await db.sessions.where("microcycle_id").anyOf(microcycleIds).delete();
      }

      if (mesocycleIds.length) {
        await db.sessions.where("mesocycle_id").anyOf(mesocycleIds).delete();
        await db.microcycles.where("mesocycle_id").anyOf(mesocycleIds).delete();
      }

      await db.mesocycles.where("macrocycle_id").equals(id).delete();
      await db.sessions.where("macrocycle_id").equals(id).delete();
      await db.macrocycles.delete(id);
    }
  );

  await enqueue("macrocycles", { id }, "delete");
};

export const updateMesocycle = async (
  id: string,
  changes: Partial<Omit<MesocycleInput, "macrocycle_id">> &
    Partial<Pick<Mesocycle, "status" | "order_index">>
): Promise<Mesocycle> => {
  const existing = ensureEntity(
    await db.mesocycles.get(id),
    "Mesociclo no encontrado"
  );

  const updated: Mesocycle = {
    ...existing,
    ...changes,
    phase: changes.phase ?? existing.phase ?? null,
    focus: changes.focus ?? existing.focus ?? null,
    goal: changes.goal ?? existing.goal ?? null,
    status: changes.status ?? existing.status,
    order_index: changes.order_index ?? existing.order_index ?? 0,
    updated_at: nowIso(),
  };

  await db.mesocycles.put(updated);
  await enqueue("mesocycles", updated, "update");
  return updated;
};

export const deleteMesocycle = async (id: string) => {
  const microcycles = await db.microcycles
    .where("mesocycle_id")
    .equals(id)
    .toArray();
  const microcycleIds = microcycles.map((micro) => micro.id);

  if (microcycleIds.length) {
    await db.sessions.where("microcycle_id").anyOf(microcycleIds).delete();
    await db.microcycles.where("mesocycle_id").equals(id).delete();
  }

  await db.sessions.where("mesocycle_id").equals(id).delete();
  await db.mesocycles.delete(id);

  await enqueue("mesocycles", { id }, "delete");
};

export const updateMicrocycle = async (
  id: string,
  changes: Partial<Omit<MicrocycleInput, "mesocycle_id">> &
    Partial<Pick<Microcycle, "status">>
): Promise<Microcycle> => {
  const existing = ensureEntity(
    await db.microcycles.get(id),
    "Microciclo no encontrado"
  );

  const updated: Microcycle = {
    ...existing,
    ...changes,
    start_date: changes.start_date ?? existing.start_date ?? null,
    end_date: changes.end_date ?? existing.end_date ?? null,
    focus: changes.focus ?? existing.focus ?? null,
    load: changes.load ?? existing.load ?? null,
    status: changes.status ?? existing.status,
    updated_at: nowIso(),
  };

  await db.microcycles.put(updated);
  await enqueue("microcycles", updated, "update");
  return updated;
};

export const deleteMicrocycle = async (id: string) => {
  await db.sessions.where("microcycle_id").equals(id).delete();
  await db.microcycles.delete(id);
  await enqueue("microcycles", { id }, "delete");
};

export const updateSessionPlan = async (
  id: string,
  changes: Partial<SessionInput> &
    Partial<Pick<Session, "status" | "order_index">>
): Promise<Session> => {
  const existing = ensureEntity(
    await db.sessions.get(id),
    "Sesión no encontrada"
  );

  const updated: Session = {
    ...existing,
    ...changes,
    macrocycle_id:
      changes.macrocycle_id !== undefined
        ? changes.macrocycle_id
        : existing.macrocycle_id ?? null,
    mesocycle_id:
      changes.mesocycle_id !== undefined
        ? changes.mesocycle_id
        : existing.mesocycle_id ?? null,
    microcycle_id:
      changes.microcycle_id !== undefined
        ? changes.microcycle_id
        : existing.microcycle_id ?? null,
    trainer_id:
      changes.trainer_id !== undefined
        ? changes.trainer_id
        : existing.trainer_id ?? null,
    name: changes.name ?? existing.name ?? null,
    session_type: changes.session_type ?? existing.session_type,
    notes: changes.notes ?? existing.notes ?? null,
    order_index: changes.order_index ?? existing.order_index ?? 0,
    status: changes.status ?? existing.status,
    date: changes.date ?? existing.date,
    updated_at: nowIso(),
  };

  await db.sessions.put(updated);
  await enqueue("sessions", updated, "update");
  return updated;
};

export const deleteSessionPlan = async (id: string) => {
  await db.sessions.delete(id);
  await enqueue("sessions", { id }, "delete");
};

// Planning Assignments
export interface PlanningAssignmentInput {
  user_id: string;
  macrocycle_id: string;
  is_active?: boolean;
  assigned_by?: string | null;
}

export const assignPlanningToUser = async (
  input: PlanningAssignmentInput
) => {
  const existing = await db.planning_assignments
    .where("[user_id+macrocycle_id]")
    .equals([input.user_id, input.macrocycle_id])
    .first();

  const assignment = {
    id: existing?.id ?? crypto.randomUUID(),
    user_id: input.user_id,
    macrocycle_id: input.macrocycle_id,
    is_active: input.is_active ?? false,
    assigned_at: existing?.assigned_at ?? nowIso(),
    assigned_by: input.assigned_by ?? null,
    updated_at: nowIso(),
  };

  await db.planning_assignments.put(assignment);
  await enqueue("planning_assignments", assignment, existing ? "update" : "insert");
  return assignment;
};

export const setActivePlanning = async (
  user_id: string,
  macrocycle_id: string
) => {
  // Desactivar todas las asignaciones activas del usuario
  const activeAssignments = await db.planning_assignments
    .where("user_id")
    .equals(user_id)
    .filter((a) => a.is_active)
    .toArray();

  for (const assignment of activeAssignments) {
    const updated = { ...assignment, is_active: false, updated_at: nowIso() };
    await db.planning_assignments.put(updated);
    await enqueue("planning_assignments", updated, "update");
  }

  // Activar la asignación especificada
  const assignment = await db.planning_assignments
    .where("[user_id+macrocycle_id]")
    .equals([user_id, macrocycle_id])
    .first();

  if (assignment) {
    const updated = { ...assignment, is_active: true, updated_at: nowIso() };
    await db.planning_assignments.put(updated);
    await enqueue("planning_assignments", updated, "update");
    return updated;
  }

  // Si no existe, crearla
  return await assignPlanningToUser({
    user_id,
    macrocycle_id,
    is_active: true,
  });
};

export const listPlanningAssignments = async () => {
  return db.planning_assignments.toArray();
};

export const listAssignmentsByUser = async (user_id: string) => {
  return db.planning_assignments
    .where("user_id")
    .equals(user_id)
    .toArray();
};

export const listAssignmentsByMacrocycle = async (macrocycle_id: string) => {
  return db.planning_assignments
    .where("macrocycle_id")
    .equals(macrocycle_id)
    .toArray();
};

export const getActivePlanningForUser = async (user_id: string) => {
  return db.planning_assignments
    .where("user_id")
    .equals(user_id)
    .filter((a) => a.is_active)
    .first();
};

export const removePlanningAssignment = async (
  user_id: string,
  macrocycle_id: string
) => {
  const assignment = await db.planning_assignments
    .where("[user_id+macrocycle_id]")
    .equals([user_id, macrocycle_id])
    .first();

  if (assignment) {
    await db.planning_assignments.delete(assignment.id);
    await enqueue("planning_assignments", { id: assignment.id }, "delete");
  }
};
