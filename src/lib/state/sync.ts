'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@/lib/db-local/db';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

interface SyncState {
  status: SyncStatus;
  error?: string;
  queueCount: number;
  lastSync?: string;
  setStatus: (status: SyncStatus) => void;
  setError: (message?: string) => void;
  refreshQueueCount: () => Promise<void>;
  setLastSync: (iso: string) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      status: 'idle',
      queueCount: 0,
      error: undefined,
      lastSync: undefined,
      setStatus(status) {
        set({ status });
      },
      setError(message) {
        set({ error: message });
      },
      async refreshQueueCount() {
        const count = await db.outbox.count();
        set({ queueCount: count });
      },
      setLastSync(iso) {
        set({ lastSync: iso });
      }
    }),
    {
      name: 'sync-store'
    }
  )
);
