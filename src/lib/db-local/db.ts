import Dexie, { type Table } from "dexie";

export type UserRole = "trainer" | "athlete" | "nutritionist" | "admin";

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

export interface Mesocycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  phase: string;
  updated_at: string;
}

export interface Session {
  id: string;
  mesocycle_id: string;
  trainer_id: string;
  date: string;
  session_type: string;
  microcycle?: string;
  notes?: string;
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

class LocalDatabase extends Dexie {
  users!: Table<User>;
  mesocycles!: Table<Mesocycle>;
  sessions!: Table<Session>;
  athlete_progress!: Table<AthleteProgress>;
  groups!: Table<Group>;
  group_members!: Table<GroupMember>;
  attendance!: Table<Attendance>;
  outbox!: Table<OutboxAction>;
  pending_credentials!: Table<PendingCredential>;

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
  }
}

export const db = new LocalDatabase();

export const resetDatabase = async () => {
  await db.delete();
  await db.open();
};
