import type {
  Macrocycle,
  Mesocycle,
  Microcycle,
  PlanningStatus,
  Session,
  SessionStatus,
} from "@/lib/db-local/db";

export type EditorMode = "create" | "edit";

export type EditorType = "macrocycle" | "mesocycle" | "microcycle" | "session";

export type EditorState =
  | { type: "macrocycle"; mode: EditorMode }
  | { type: "mesocycle"; mode: EditorMode }
  | { type: "microcycle"; mode: EditorMode }
  | { type: "session"; mode: EditorMode };

export interface MacrocycleFormState {
  name: string;
  season: string;
  start_date: string;
  end_date: string;
  goal: string;
  notes: string;
  status: PlanningStatus;
}

export interface MesocycleFormState {
  name: string;
  start_date: string;
  end_date: string;
  phase: string;
  focus: string;
  goal: string;
  order_index: string;
  status: PlanningStatus;
}

export interface MicrocycleFormState {
  name: string;
  week_number: string;
  start_date: string;
  end_date: string;
  focus: string;
  load: string;
  status: PlanningStatus;
}

export interface SessionFormState {
  name: string;
  date: string;
  session_type: string;
  trainer_id: string;
  order_index: string;
  status: SessionStatus;
  notes: string;
}

export type MacrocycleSummary = Macrocycle & { duration: string };
export type MesocycleSummary = Mesocycle & { duration: string };
