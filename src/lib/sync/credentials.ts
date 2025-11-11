import { db, type PendingCredential, type UserRole } from "@/lib/db-local/db";

interface QueueParams {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

export const queueCredentialInvite = async ({
  userId,
  email,
  name,
  role,
}: QueueParams) => {
  const existing = await db.pending_credentials
    .where("user_id")
    .equals(userId)
    .first();
  if (existing) {
    await db.pending_credentials.update(existing.id, {
      email,
      name,
      role,
      created_at: new Date().toISOString(),
      retries: existing.retries,
    });
    return existing;
  }

  const entry: PendingCredential = {
    id: crypto.randomUUID(),
    user_id: userId,
    email,
    name,
    role,
    created_at: new Date().toISOString(),
    retries: 0,
  };

  await db.pending_credentials.put(entry);
  return entry;
};

const inviteRemoteUser = async (payload: PendingCredential) => {
  const response = await fetch("/api/admin/create-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: payload.email,
      name: payload.name,
      role: payload.role,
      userId: payload.user_id,
    }),
  });

  if (!response.ok) {
    const message = await response
      .json()
      .catch(() => ({ message: "Error desconocido" }));
    throw new Error(
      (message as { message?: string }).message ?? "Error al invitar al usuario"
    );
  }
};

export const processPendingCredentials = async () => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }

  const entries = await db.pending_credentials.orderBy("created_at").toArray();
  for (const entry of entries) {
    try {
      await inviteRemoteUser(entry);
      await db.pending_credentials.delete(entry.id);
    } catch (error) {
      await db.pending_credentials.update(entry.id, {
        retries: entry.retries + 1,
        last_error:
          error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
};

export const getPendingCredentialMap = async () => {
  const entries = await db.pending_credentials.toArray();
  return new Map(
    entries.map((entry) => [
      entry.user_id,
      {
        retries: entry.retries,
        last_error: entry.last_error,
      },
    ])
  );
};
