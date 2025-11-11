"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { db, type AthleteProgress } from "@/lib/db-local/db";
import { queueOutboxAction } from "@/lib/sync/outbox";
import { useAuthGuard } from "@/lib/hooks/useAuthGuard";

type FormState = {
  weight: string;
  quality: string;
  rpe: string;
  duration: string;
  notes: string;
};

const DEFAULT_FORM: FormState = {
  weight: "",
  quality: "8",
  rpe: "7",
  duration: "60",
  notes: "",
};

export default function AthletePage() {
  const { user } = useAuthGuard({
    allowedRoles: ["athlete", "trainer", "admin"],
  });
  const [entries, setEntries] = useState<AthleteProgress[]>([]);
  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM);
  const [status, setStatus] = useState<string>("Listo para registrar.");
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const syncOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", syncOnlineStatus);
    window.addEventListener("offline", syncOnlineStatus);
    return () => {
      window.removeEventListener("online", syncOnlineStatus);
      window.removeEventListener("offline", syncOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const loadEntries = async () => {
      const userId = user?.id ?? "athlete-1";
      const history = await db.athlete_progress
        .where("user_id")
        .equals(userId)
        .sortBy("updated_at");
      setEntries(history);
    };
    loadEntries();
  }, [user?.id]);

  const historicalChart = useMemo(
    () =>
      entries.slice(-10).map((item) => ({
        date: new Date(item.updated_at).toLocaleDateString("es-AR", {
          month: "short",
          day: "numeric",
        }),
        weight: item.weight_morning ?? null,
        quality: item.training_quality,
        rpe: item.rpe,
      })),
    [entries]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now = new Date();
    const userId = user?.id ?? "athlete-1";
    const progress: AthleteProgress = {
      id: crypto.randomUUID(),
      user_id: userId,
      session_id: `${now.toISOString()}::${userId}`,
      weight_morning: formState.weight ? Number(formState.weight) : undefined,
      training_quality: Number(formState.quality),
      rpe: Number(formState.rpe),
      duration_min: Number(formState.duration),
      notes: formState.notes,
      updated_at: now.toISOString(),
    };

    await db.athlete_progress.put(progress);
    await queueOutboxAction({
      id: crypto.randomUUID(),
      table: "athlete_progress",
      operation: "insert",
      payload: progress,
    });

    setEntries((prev) =>
      [...prev, progress].sort(
        (a, b) =>
          new Date(a.updated_at).valueOf() - new Date(b.updated_at).valueOf()
      )
    );
    setFormState({ ...DEFAULT_FORM });
    setStatus("Sesión guardada localmente.");
  };

  return (
    <section className="flex flex-col gap-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-brand-primary">Mi sesión</h1>
        <p className="text-sm text-white/70">
          Registra tus métricas aunque no tengas conexión. Se sincronizarán
          automáticamente.
        </p>
        <span className="text-xs text-brand-accent">
          {isOnline ? "Online" : "Offline"} · {entries.length} sesiones
          guardadas
        </span>
        <span className="text-xs text-white/60">{status}</span>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur"
      >
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span>Peso (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              className="rounded bg-white/10 p-2 text-white"
              value={formState.weight}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  weight: event.target.value,
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Calidad (1-10)</span>
            <input
              type="number"
              min={1}
              max={10}
              className="rounded bg-white/10 p-2 text-white"
              value={formState.quality}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  quality: event.target.value,
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>RPE</span>
            <input
              type="number"
              min={1}
              max={10}
              className="rounded bg-white/10 p-2 text-white"
              value={formState.rpe}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, rpe: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Duración (min)</span>
            <input
              type="number"
              min={0}
              className="rounded bg-white/10 p-2 text-white"
              value={formState.duration}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  duration: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span>Notas</span>
          <textarea
            className="rounded bg-white/10 p-2 text-white"
            rows={3}
            value={formState.notes}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, notes: event.target.value }))
            }
          />
        </label>

        <button
          type="submit"
          className="rounded bg-brand-primary py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-accent"
        >
          Guardar sesión
        </button>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Histórico reciente</h2>
        <div className="h-64 w-full rounded-lg border border-white/10 bg-white/5 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicalChart}>
              <XAxis
                dataKey="date"
                stroke="#cbd5f5"
                tickLine={false}
                axisLine={{ stroke: "#1f2937" }}
              />
              <YAxis
                stroke="#cbd5f5"
                tickLine={false}
                axisLine={{ stroke: "#1f2937" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#1f2937",
                  borderRadius: 8,
                }}
                cursor={{ stroke: "#1f2937" }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#22c55e"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="quality"
                stroke="#38bdf8"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="rpe"
                stroke="#f97316"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </section>
  );
}
