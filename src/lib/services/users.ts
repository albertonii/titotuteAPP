import { db, type User, type UserRole } from '@/lib/db-local/db';
import { queueOutboxAction } from '@/lib/sync/outbox';

export interface CreateUserInput {
  id?: string;
  name: string;
  role: UserRole;
  email: string;
  height?: number;
  birthdate?: string;
  goal?: string;
}

export const createLocalUser = async (input: CreateUserInput) => {
  const now = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();
  const normalizedEmail = input.email.trim().toLowerCase();

  const user: User = {
    id,
    name: input.name.trim(),
    role: input.role,
    email: normalizedEmail,
    height: input.height,
    birthdate: input.birthdate,
    goal: input.goal,
    updated_at: now
  };

  await db.transaction('rw', db.users, async () => {
    await db.users.put(user);
  });

  await queueOutboxAction({
    id: crypto.randomUUID(),
    table: 'users',
    operation: 'insert',
    payload: user
  });

  return user;
};

export const listLocalUsers = async () => {
  return db.users.orderBy('name').toArray();
};

export const getPendingUserIds = async () => {
  const entries = await db.outbox.where('table').equals('users').toArray();
  const ids = new Set<string>();
  entries.forEach((entry) => {
    const payload = entry.payload as User | undefined;
    if (payload?.id) {
      ids.add(payload.id);
    }
  });
  return ids;
};
