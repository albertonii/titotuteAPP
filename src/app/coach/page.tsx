"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  db,
  type AthleteProgress,
  type Attendance,
  type User,
} from "@/lib/db-local/db";
import { queueOutboxAction } from "@/lib/sync/outbox";
import { useAuthGuard } from "@/lib/hooks/useAuthGuard";

type FormState = {
  weight: string;
  quality: string;
  rpe: string;
  duration: string;
  energy: "low" | "medium" | "high";
  present: boolean;
  notes: string;
};

const DEFAULT_FORM: FormState = {
  weight: "",
  quality: "8",
  rpe: "7",
  duration: "60",
  energy: "medium",
  present: true,
  notes: "",
};

const ensureSeedData = async () => {
  const count = await db.users.count();
  if (count > 0) return;

  const now = new Date().toISOString();

  await db.users.bulkPut([
    {
      id: "trainer-tito",
      name: "Tito",
      role: "trainer",
      email: "tito@example.com",
      updated_at: now,
    },
    {
      id: "trainer-tute",
      name: "Tute",
      role: "trainer",
      email: "tute@example.com",
      updated_at: now,
    },
    {
      id: "athlete-1",
      name: "Luna",
      role: "athlete",
      email: "luna@example.com",
      updated_at: now,
    },
    {
      id: "athlete-2",
      name: "Leo",
      role: "athlete",
      email: "leo@example.com",
      updated_at: now,
    },
  ]);

  await db.groups.add({
    id: "group-morning",
    name: "Mañana 07:00",
    trainer_id: "trainer-tito",
    schedule: "Lun-Mié-Vie 07:00",
    updated_at: now,
  });

  await db.group_members.bulkPut([
    { id: "gm-1", group_id: "group-morning", user_id: "athlete-1", since: now },
    { id: "gm-2", group_id: "group-morning", user_id: "athlete-2", since: now },
  ]);
};

export default function CoachPage() {
  useAuthGuard({ allowedRoles: ["trainer", "admin"] });
  const [athletes, setAthletes] = useState<User[]>([]);
  const [formState, setFormState] = useState<Record<string, FormState>>({});
  const [status, setStatus] = useState<string>("Listo para registrar.");

  useEffect(() => {
    const load = async () => {
      await ensureSeedData();
      const result = await db.users
        .where("role")
        .equals("athlete")
        .limit(8)
        .toArray();
      setAthletes(result);
      setFormState(
        Object.fromEntries(
          result.map((athlete) => [athlete.id, { ...DEFAULT_FORM }])
        )
      );
    };

    load();
  }, []);

  const handleChange = (
    athleteId: string,
    field: keyof FormState,
    value: string | boolean
  ) => {
    setFormState((prev) => ({
      ...prev,
      [athleteId]: {
        ...(prev[athleteId] ?? DEFAULT_FORM),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
    athlete: User
  ) => {
    event.preventDefault();
    const form = formState[athlete.id] ?? DEFAULT_FORM;
    const now = new Date();
    const entryId = crypto.randomUUID();
    const sessionId = `${now.toISOString()}::${athlete.id}`;

    const progress: AthleteProgress = {
      id: entryId,
      user_id: athlete.id,
      session_id: sessionId,
      weight_morning: form.weight ? Number(form.weight) : undefined,
      training_quality: Number(form.quality),
      rpe: Number(form.rpe),
      duration_min: Number(form.duration),
      energy_level: form.energy,
      notes: form.notes,
      updated_at: now.toISOString(),
    };

    const attendance: Attendance = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      user_id: athlete.id,
      status: form.present ? "present" : "absent",
      updated_at: now.toISOString(),
    };

    await db.transaction("rw", db.athlete_progress, db.attendance, async () => {
      await db.athlete_progress.put(progress);
      await db.attendance.put(attendance);
    });

    await Promise.all([
      queueOutboxAction({
        id: crypto.randomUUID(),
        table: "athlete_progress",
        operation: "insert",
        payload: progress,
      }),
      queueOutboxAction({
        id: crypto.randomUUID(),
        table: "attendance",
        operation: "insert",
        payload: attendance,
      }),
    ]);

    setStatus(`Guardado localmente para ${athlete.name}.`);
    setFormState((prev) => ({
      ...prev,
      [athlete.id]: { ...DEFAULT_FORM },
    }));
  };

  return (
    <section className="flex flex-col gap-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-brand-primary">
          Coach Mode
        </h1>
        <p className="text-sm text-slate-600">
          Registra métricas rápidamente para cada atleta. Funciona sin conexión.
        </p>
        <span className="text-xs text-brand-primary">{status}</span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {athletes.map((athlete) => {
          const form = formState[athlete.id] ?? DEFAULT_FORM;
          return (
            <form
              key={athlete.id}
              onSubmit={(event) => handleSubmit(event, athlete)}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 className="text-lg font-medium">{athlete.name}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span>Peso (kg)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                    value={form.weight}
                    onChange={(event) =>
                      handleChange(athlete.id, "weight", event.target.value)
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>Calidad (1-10)</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                    value={form.quality}
                    onChange={(event) =>
                      handleChange(athlete.id, "quality", event.target.value)
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>RPE</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                    value={form.rpe}
                    onChange={(event) =>
                      handleChange(athlete.id, "rpe", event.target.value)
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>Duración (min)</span>
                  <input
                    type="number"
                    min={0}
                    className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                    value={form.duration}
                    onChange={(event) =>
                      handleChange(athlete.id, "duration", event.target.value)
                    }
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span>Energía</span>
                <select
                  className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                  value={form.energy}
                  onChange={(event) =>
                    handleChange(athlete.id, "energy", event.target.value)
                  }
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.present}
                  onChange={(event) =>
                    handleChange(athlete.id, "present", event.target.checked)
                  }
                  className="h-5 w-5 rounded border border-slate-300 text-brand-primary focus:ring-brand-primary"
                />
                Check-in realizado
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>Notas</span>
                <textarea
                  className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                  rows={2}
                  value={form.notes}
                  onChange={(event) =>
                    handleChange(athlete.id, "notes", event.target.value)
                  }
                />
              </label>

              <button
                type="submit"
                className="rounded bg-brand-primary py-2 text-sm font-semibold text-white transition hover:bg-brand-accent"
              >
                Guardar en dispositivo
              </button>
            </form>
          );
        })}
      </div>
    </section>
  );
}
