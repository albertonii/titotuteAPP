"use client";

import { useEffect } from "react";
import { runFullSync } from "@/lib/sync/sync";
import { useSyncStore } from "@/lib/state/sync";

const SYNC_INTERVAL_MS = 30_000;

export const useAutoSync = () => {
  const setStatus = useSyncStore((state) => state.setStatus);
  const setError = useSyncStore((state) => state.setError);
  const setLastSync = useSyncStore((state) => state.setLastSync);
  const refreshQueueCount = useSyncStore((state) => state.refreshQueueCount);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let abort = false;
    void refreshQueueCount();

    const syncNow = async () => {
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      setStatus("syncing");
      setError(undefined);
      try {
        const result = await runFullSync();
        if (abort) return;
        setLastSync(result.lastRun);
      } catch (error) {
        if (abort) return;
        const message =
          error instanceof Error ? error.message : "Error de sincronización";
        setError(message);
        setStatus("error");
        return;
      }
      await refreshQueueCount();
      if (!abort) {
        setStatus("idle");
      }
    };

    const startInterval = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(syncNow, SYNC_INTERVAL_MS);
    };

    const stopInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const handleOnline = () => {
      setStatus("idle");
      syncNow();
      startInterval();
    };

    const handleOffline = () => {
      setStatus("offline");
      stopInterval();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (navigator.onLine) {
      syncNow();
      startInterval();
    } else {
      setStatus("offline");
    }

    return () => {
      abort = true;
      stopInterval();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshQueueCount, setError, setLastSync, setStatus]);
};
