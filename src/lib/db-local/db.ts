import Dexie, { type Table } from "dexie";

if (typeof (globalThis as { self?: unknown }).self === "undefined") {
  (globalThis as { self: typeof globalThis }).self = globalThis;
}

import "dexie-observable";

export type UserRole = "trainer" | "athlete" | "nutritionist" | "admin";
export type PlanningStatus = "draft" | "published" | "archived";
export type SessionStatus = "draft" | "scheduled" | "completed" | "cancelled";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  height?: number;
  birthdate?: string;
  goal?: string;
  updated_at: string;
}

export interface Macrocycle {
  id: string;
  name: string;
  season?: string | null;
  start_date: string;
  end_date: string;
  goal?: string | null;
  notes?: string | null;
  status: PlanningStatus;
  created_by?: string | null;
  updated_at: string;
}

export interface Mesocycle {
  id: string;
  macrocycle_id?: string | null;
  name: string;
  start_date: string;
  end_date: string;
  phase?: string | null;
  focus?: string | null;
  goal?: string | null;
  order_index?: number;
  status: PlanningStatus;
  updated_at: string;
}

export interface Microcycle {
  id: string;
  mesocycle_id: string;
  name: string;
  week_number: number;
  start_date?: string | null;
  end_date?: string | null;
  focus?: string | null;
  load?: string | null;
  status: PlanningStatus;
  updated_at: string;
}

export interface Session {
  id: string;
  macrocycle_id?: string | null;
  mesocycle_id?: string | null;
  microcycle_id?: string | null;
  trainer_id?: string | null;
  name?: string | null;
  date: string;
  session_type: string;
  order_index?: number;
  status: SessionStatus;
  notes?: string | null;
  updated_at: string;
}

export interface AthleteProgress {
  id: string;
  user_id: string;
  session_id: string;
  weight_morning?: number;
  training_quality: number;
  rpe: number;
  duration_min: number;
  energy_level?: "low" | "medium" | "high";
  notes?: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  trainer_id: string;
  schedule: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  since: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  user_id: string;
  status: "present" | "absent";
  updated_at: string;
}

export interface OutboxAction {
  id: string;
  table: string;
  operation: "insert" | "update" | "delete";
  payload: unknown;
  created_at: number;
  retries: number;
}

export interface PendingCredential {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  retries: number;
  last_error?: string;
}

export interface ExerciseLog {
  id: string;
  user_id: string;
  training_sheet: string;
  exercise_name: string;
  microcycle?: string;
  load?: string;
  reps?: string;
  rir?: string;
  notes?: string;
  performed_at: string;
  updated_at: string;
}

export type InjurySeverity = "leve" | "moderada" | "grave" | "recuperado";

export interface InjuryLog {
  id: string;
  user_id: string;
  area: string;
  severity: InjurySeverity;
  start_date: string;
  end_date?: string | null;
  notes?: string | null;
  updated_at: string;
}

export interface NutritionProfile {
  id: string;
  user_id: string;
  goal?: string | null;
  kcal_target?: number | null;
  protein_target?: number | null;
  carbs_target?: number | null;
  fats_target?: number | null;
  updated_at: string;
}

class LocalDatabase extends Dexie {
  users!: Table<User>;
  macrocycles!: Table<Macrocycle>;
  mesocycles!: Table<Mesocycle>;
  microcycles!: Table<Microcycle>;
  sessions!: Table<Session>;
  athlete_progress!: Table<AthleteProgress>;
  groups!: Table<Group>;
  group_members!: Table<GroupMember>;
  attendance!: Table<Attendance>;
  outbox!: Table<OutboxAction>;
  pending_credentials!: Table<PendingCredential>;
  exercise_logs!: Table<ExerciseLog>;
  injury_logs!: Table<InjuryLog>;
  nutrition_profiles!: Table<NutritionProfile>;

  constructor() {
    super("tito_tute_local");

    this.version(1).stores({
      users: "id, email, updated_at, role",
      mesocycles: "id, updated_at, name",
      sessions: "id, trainer_id, mesocycle_id, date, updated_at",
      athlete_progress: "id, user_id, session_id, updated_at",
      groups: "id, trainer_id, updated_at",
      group_members: "id, group_id, user_id",
      attendance: "id, session_id, user_id, updated_at",
      outbox: "id, table, created_at, retries",
    });

    this.version(2).stores({
      pending_credentials: "id, email, role, user_id",
    });

    this.version(3).stores({
      exercise_logs:
        "id, user_id, training_sheet, exercise_name, microcycle, performed_at, updated_at",
    });

    this.version(4)
      .stores({
        macrocycles:
          "id, season, start_date, end_date, status, updated_at, created_by",
        mesocycles:
          "id, macrocycle_id, start_date, end_date, status, order_index, updated_at",
        microcycles:
          "id, mesocycle_id, week_number, start_date, end_date, status, updated_at",
        sessions:
          "id, macrocycle_id, mesocycle_id, microcycle_id, date, status, updated_at",
      })
      .upgrade(async (tx) => {
        await tx
          .table("mesocycles")
          .toCollection()
          .modify((item: any) => {
            item.status = item.status ?? "draft";
            item.order_index = item.order_index ?? 0;
          });
        await tx
          .table("sessions")
          .toCollection()
          .modify((item: any) => {
            item.status = item.status ?? "scheduled";
            item.order_index = item.order_index ?? 0;
          });
      });

    this.version(5)
      .stores({
        injury_logs: "id, user_id, start_date, updated_at",
        nutrition_profiles: "id, user_id, updated_at",
      })
      .upgrade(async (tx) => {
        await tx
          .table("injury_logs")
          .toCollection()
          .modify((item: any) => {
            item.updated_at = item.updated_at ?? new Date().toISOString();
          });
        await tx
          .table("nutrition_profiles")
          .toCollection()
          .modify((item: any) => {
            item.updated_at = item.updated_at ?? new Date().toISOString();
          });
      });
  }
}

export const db = new LocalDatabase();

export const resetDatabase = async () => {
  await db.delete();
  await db.open();
};
