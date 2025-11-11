import { db, type OutboxAction } from '@/lib/db-local/db';

export const queueOutboxAction = async (action: Omit<OutboxAction, 'created_at' | 'retries'>) => {
  await db.outbox.add({
    ...action,
    created_at: Date.now(),
    retries: 0
  });
};
