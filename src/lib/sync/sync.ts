import { getSupabaseClient } from "@/lib/api/supabase";
import { db, type OutboxAction } from "@/lib/db-local/db";

export interface SyncResult {
  pushes: number;
  pulls: number;
  errors: number;
  lastRun: string;
}

const conflictResolver = <T extends { updated_at: string; role?: string }>(
  local: T,
  remote: T
): T => {
  if (local.updated_at === remote.updated_at) {
    return remote;
  }

  if (local.role === "trainer" && remote.role !== "trainer") {
    return local;
  }

  return new Date(local.updated_at) > new Date(remote.updated_at)
    ? local
    : remote;
};

export const syncPush = async (): Promise<number> => {
  const supabase = getSupabaseClient();
  if (!supabase || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return 0;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    console.info(
      "[sync] Supabase session not found; skipping push until login"
    );
    return 0;
  }

  const outboxEntries = await db.outbox.orderBy("created_at").toArray();
  let pushed = 0;

  for (const entry of outboxEntries) {
    try {
      if (entry.table === "users") {
        console.info(
          "[sync] Skipping users push; handled via credential invite endpoint"
        );
        await db.outbox.delete(entry.id);
        continue;
      }

      if (entry.operation === "delete") {
        const payload = entry.payload as { id?: string };
        if (!payload?.id) {
          throw new Error(`Delete action for ${entry.table} sin identificador`);
        }
        const { error } = await supabase
          .from(entry.table)
          .delete()
          .eq("id", payload.id);
        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from(entry.table)
          .upsert(entry.payload);
        if (error) {
          throw error;
        }
      }
      await db.outbox.delete(entry.id);
      pushed += 1;
    } catch (error) {
      await db.outbox.update(entry.id, {
        retries: entry.retries + 1,
      });
      console.error(`Failed to push ${entry.table} action`, error);
    }
  }

  return pushed;
};

export const syncPull = async (): Promise<number> => {
  const supabase = getSupabaseClient();
  if (!supabase || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return 0;
  }
  let pulled = 0;

  const tables = [
    "users",
    "macrocycles",
    "mesocycles",
    "microcycles",
    "sessions",
    "athlete_progress",
    "groups",
    "group_members",
    "attendance",
    "exercise_logs",
  ] as const;

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select();
      if (error) {
        throw error;
      }

      if (!data) {
        continue;
      }

      const writeOps = data.map(async (remoteRecord) => {
        const localRecord = await db.table(table).get(remoteRecord.id);
        if (localRecord) {
          const merged = conflictResolver(
            localRecord as any,
            remoteRecord as any
          );
          await db.table(table).put(merged);
        } else {
          await db.table(table).put(remoteRecord as any);
        }
      });

      await Promise.all(writeOps);
      pulled += data.length;
    } catch (error) {
      console.error(`Failed to pull ${table}`, error);
    }
  }

  return pulled;
};

export const runFullSync = async (): Promise<SyncResult> => {
  const [pushes, pulls] = await Promise.all([syncPush(), syncPull()]);
  return {
    pushes,
    pulls,
    errors: 0,
    lastRun: new Date().toISOString(),
  };
};
