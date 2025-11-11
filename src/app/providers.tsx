"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useServiceWorker } from "@/workers/register-sw";
import { useAutoSync } from "@/lib/sync/useAutoSync";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  useServiceWorker();
  useAutoSync();

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
