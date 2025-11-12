import {
  db,
  type AthleteProgress,
  type InjuryLog,
  type NutritionProfile,
} from "@/lib/db-local/db";
import { queueOutboxAction } from "@/lib/sync/outbox";

export const listProgressByUser = async (
  userId: string
): Promise<AthleteProgress[]> => {
  return db.athlete_progress
    .where("user_id")
    .equals(userId)
    .reverse()
    .sortBy("updated_at");
};

export const listInjuryLogsByUser = async (
  userId: string
): Promise<InjuryLog[]> => {
  return db.injury_logs
    .where("user_id")
    .equals(userId)
    .reverse()
    .sortBy("start_date");
};

export const upsertInjuryLog = async (log: InjuryLog) => {
  await db.injury_logs.put(log);
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: "injury_logs",
    operation: "update",
    payload: log,
  });
};

export const resolveInjuryLog = async (id: string, endDate: string) => {
  const existing = await db.injury_logs.get(id);
  if (!existing) return;
  const updated: InjuryLog = {
    ...existing,
    end_date: endDate,
    updated_at: new Date().toISOString(),
  };
  await db.injury_logs.put(updated);
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: "injury_logs",
    operation: "update",
    payload: updated,
  });
};

export const getNutritionProfile = async (
  userId: string
): Promise<NutritionProfile | null> => {
  const profile = await db.nutrition_profiles.get(userId);
  return profile ?? null;
};

export const upsertNutritionProfile = async (profile: NutritionProfile) => {
  await db.nutrition_profiles.put(profile);
  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: "nutrition_profiles",
    operation: "update",
    payload: profile,
  });
};

