"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServiceWorker } from "@/workers/register-sw";
import { useAutoSync } from "@/lib/sync/useAutoSync";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  useServiceWorker();
  useAutoSync();

  // Suprimir advertencias de hidratación causadas por extensiones del navegador
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalError = console.error;
    const originalWarn = console.warn;

    const filterHydrationWarnings = (...args: unknown[]) => {
      const message = args[0];
      if (typeof message === "string") {
        // Filtrar advertencias de hidratación causadas por extensiones del navegador
        if (
          message.includes("hydration") &&
          (message.includes("cz-shortcut-listen") ||
            message.includes("browser extension") ||
            message.includes("didn't match the client properties"))
        ) {
          return; // Suprimir esta advertencia específica
        }
      }
      return true;
    };

    console.error = (...args: unknown[]) => {
      if (filterHydrationWarnings(...args)) {
        originalError.apply(console, args);
      }
    };

    console.warn = (...args: unknown[]) => {
      if (filterHydrationWarnings(...args)) {
        originalWarn.apply(console, args);
      }
    };

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
