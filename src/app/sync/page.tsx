"use client";

import { useState } from "react";
import { runFullSync } from "@/lib/sync/sync";
import { useSyncStore } from "@/lib/state/sync";

export default function SyncPage() {
  const queueCount = useSyncStore((state) => state.queueCount);
  const lastSync = useSyncStore((state) => state.lastSync);
  const status = useSyncStore((state) => state.status);
  const currentError = useSyncStore((state) => state.error);
  const setStatus = useSyncStore((state) => state.setStatus);
  const setError = useSyncStore((state) => state.setError);
  const setLastSync = useSyncStore((state) => state.setLastSync);
  const refreshQueueCount = useSyncStore((state) => state.refreshQueueCount);
  const [localSyncing, setLocalSyncing] = useState(false);

  const handleSync = async () => {
    setLocalSyncing(true);
    setStatus("syncing");
    setError(undefined);
    try {
      const result = await runFullSync();
      setLastSync(result.lastRun);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLocalSyncing(false);
      await refreshQueueCount();
    }
  };

  return (
    <section className="flex flex-col gap-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-brand-primary">
          Sincronización
        </h1>
        <p className="text-sm text-white/70">
          Control manual para depuración y monitoreo del outbox.
        </p>
        <p className="text-xs text-brand-accent">
          Última sincronización:{" "}
          {lastSync ? new Date(lastSync).toLocaleString("es-AR") : "Nunca"}
        </p>
        <p className="text-xs text-white/60">Acciones en cola: {queueCount}</p>
        <p className="text-xs text-white/60">Estado actual: {status}</p>
      </header>

      <button
        onClick={handleSync}
        disabled={localSyncing}
        className="w-full rounded bg-brand-primary py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {localSyncing ? "Sincronizando..." : "Forzar sincronización"}
      </button>

      {currentError ? (
        <p className="text-sm text-red-400">Error: {currentError}</p>
      ) : null}
    </section>
  );
}
