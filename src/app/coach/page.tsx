"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  db,
  type AthleteProgress,
  type Attendance,
  type User,
  type InjuryLog,
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

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

type QuickIndicator = {
  recencyLabel: string;
  recencyTone: Tone;
  rpeLabel: string;
  rpeTone: Tone;
  energyLabel: string;
  energyTone: Tone;
  adherenceLabel: string;
  adherenceTone: Tone;
  lastNotes?: string;
};

type AthleteDetail = {
  history: AthleteProgress[];
  attendance: Attendance[];
  activeFollowUp: boolean;
  activeFollowUpLabel?: string;
  stats: {
    averageRpe?: number;
    dominantEnergy?: AthleteProgress["energy_level"];
    sessionsLoggedLast7d: number;
  };
};

const toneBadgeClasses: Record<Tone, string> = {
  success:
    "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200",
  warning:
    "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200",
  danger:
    "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200",
  info: "border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-500/10 dark:text-sky-200",
  neutral:
    "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const toneAccentClasses: Record<Tone, string> = {
  success: "border-l-4 border-l-emerald-500",
  warning: "border-l-4 border-l-amber-500",
  danger: "border-l-4 border-l-rose-500",
  info: "border-l-4 border-l-sky-500",
  neutral: "border-l-4 border-l-slate-200",
};

const toneBadgeClass = (tone: Tone) =>
  toneBadgeClasses[tone] ?? toneBadgeClasses.neutral;

const formatRelativeDay = (
  isoString?: string
): { label: string; tone: Tone } => {
  if (!isoString) {
    return { label: "Sin registro reciente", tone: "danger" };
  }

  const target = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { label: "Hoy", tone: "success" };
  }
  if (diffDays === 1) {
    return { label: "Hace 1 día", tone: "info" };
  }
  if (diffDays <= 3) {
    return { label: `Hace ${diffDays} días`, tone: "warning" };
  }
  if (diffDays <= 7) {
    return { label: `Hace ${diffDays} días`, tone: "danger" };
  }
  const diffWeeks = Math.floor(diffDays / 7);
  return {
    label: diffWeeks === 1 ? "Hace 1 semana" : `Hace ${diffWeeks} semanas`,
    tone: "danger",
  };
};

const toneFromRpe = (rpe?: number): Tone => {
  if (typeof rpe !== "number") return "neutral";
  if (rpe >= 9) return "danger";
  if (rpe >= 8) return "warning";
  if (rpe <= 5) return "success";
  return "info";
};

const toneFromEnergy = (energy?: AthleteProgress["energy_level"]): Tone => {
  if (!energy) return "neutral";
  if (energy === "high") return "success";
  if (energy === "medium") return "info";
  return "warning";
};

const toneFromAdherence = (percentage?: number | null): Tone => {
  if (percentage == null) return "neutral";
  if (percentage >= 80) return "success";
  if (percentage >= 50) return "info";
  if (percentage >= 30) return "warning";
  return "danger";
};

const mapEnergyLabel = (energy?: AthleteProgress["energy_level"]) => {
  switch (energy) {
    case "high":
      return "Energía alta";
    case "medium":
      return "Energía media";
    case "low":
      return "Energía baja";
    default:
      return "Sin dato energía";
  }
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
  const [quickIndicators, setQuickIndicators] = useState<
    Record<string, QuickIndicator>
  >({});
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>();
  const [athleteDetails, setAthleteDetails] = useState<
    Record<string, AthleteDetail>
  >({});

  const refreshIndicator = useCallback(async (athleteId: string) => {
    const [progressList, attendanceList] = await Promise.all([
      db.athlete_progress
        .where("user_id")
        .equals(athleteId)
        .sortBy("updated_at"),
      db.attendance.where("user_id").equals(athleteId).toArray(),
    ]);

    const lastProgress = progressList[progressList.length - 1];
    const { label: recencyLabel, tone: recencyTone } = formatRelativeDay(
      lastProgress?.updated_at
    );

    const rpeTone = toneFromRpe(lastProgress?.rpe);
    const energyTone = toneFromEnergy(lastProgress?.energy_level);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentAttendance = attendanceList.filter(
      (item) => new Date(item.updated_at) >= sevenDaysAgo
    );
    const attendanceCount = recentAttendance.length;
    const presentCount = recentAttendance.filter(
      (item) => item.status === "present"
    ).length;
    const adherencePercentage =
      attendanceCount > 0
        ? Math.round((presentCount / attendanceCount) * 100)
        : null;
    const adherenceTone = toneFromAdherence(adherencePercentage);

    setQuickIndicators((prev) => ({
      ...prev,
      [athleteId]: {
        recencyLabel,
        recencyTone,
        rpeLabel:
          typeof lastProgress?.rpe === "number"
            ? `RPE ${lastProgress.rpe}`
            : "Sin RPE",
        rpeTone,
        energyLabel: mapEnergyLabel(lastProgress?.energy_level),
        energyTone,
        adherenceLabel:
          adherencePercentage == null
            ? "Sin datos 7d"
            : `${adherencePercentage}% presencia`,
        adherenceTone,
        lastNotes: lastProgress?.notes,
      },
    }));
  }, []);

  const refreshAllIndicators = useCallback(
    async (athleteIds: string[]) => {
      await Promise.all(athleteIds.map((id) => refreshIndicator(id)));
    },
    [refreshIndicator]
  );

  const loadAthleteDetail = useCallback(async (athleteId: string) => {
    const [progressRaw, attendanceRaw, injuries] = await Promise.all([
      db.athlete_progress.where("user_id").equals(athleteId).toArray(),
      db.attendance.where("user_id").equals(athleteId).toArray(),
      db.injury_logs.where("user_id").equals(athleteId).toArray(),
    ]);

    const progress = [...progressRaw].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    const attendance = [...attendanceRaw].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const now = new Date();
    const activeInjury = injuries
      .filter((item: InjuryLog) => {
        if (item.severity === "recuperado") return false;
        if (!item.end_date) return true;
        return new Date(item.end_date) >= now;
      })
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sessionsLoggedLast7d = progress.filter(
      (item) => new Date(item.updated_at) >= sevenDaysAgo
    ).length;

    const recentRpe = progress.slice(0, 5);
    const averageRpe =
      recentRpe.length > 0
        ? Math.round(
            (recentRpe.reduce<number>((sum, item) => sum + item.rpe, 0) /
              recentRpe.length) *
              10
          ) / 10
        : undefined;

    const energyCounts = recentRpe.reduce<Record<string, number>>(
      (acc, item) => {
        if (!item.energy_level) return acc;
        acc[item.energy_level] = (acc[item.energy_level] ?? 0) + 1;
        return acc;
      },
      {}
    );
    const energyEntries = Object.entries(energyCounts) as Array<
      [string, number]
    >;
    const dominantEnergy =
      energyEntries.length > 0
        ? (energyEntries.sort((a, b) => b[1] - a[1])[0][0] as AthleteProgress["energy_level"])
        : undefined;

    setAthleteDetails((prev) => ({
      ...prev,
      [athleteId]: {
        history: progress.slice(0, 6),
        attendance: attendance.slice(0, 10),
        activeFollowUp: Boolean(activeInjury),
        activeFollowUpLabel: activeInjury
          ? `${activeInjury.area} · ${activeInjury.severity.toUpperCase()}`
          : undefined,
        stats: {
          averageRpe,
          dominantEnergy,
          sessionsLoggedLast7d,
        },
      },
    }));
  }, []);

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
      await refreshAllIndicators(result.map((athlete) => athlete.id));
      if (result.length > 0) {
        const firstId = result[0].id;
        setSelectedAthleteId(firstId);
        await loadAthleteDetail(firstId);
      }
    };

    load();
  }, [refreshAllIndicators, loadAthleteDetail]);

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

  useEffect(() => {
    if (!selectedAthleteId) return;
    loadAthleteDetail(selectedAthleteId);
  }, [selectedAthleteId, loadAthleteDetail]);

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
    await Promise.all([
      refreshIndicator(athlete.id),
      loadAthleteDetail(athlete.id),
    ]);
  };

  const selectedAthlete = selectedAthleteId
    ? athletes.find((athlete) => athlete.id === selectedAthleteId)
    : undefined;
  const selectedForm =
    selectedAthleteId && formState[selectedAthleteId]
      ? formState[selectedAthleteId]
      : DEFAULT_FORM;
  const selectedIndicators = selectedAthleteId
    ? quickIndicators[selectedAthleteId]
    : undefined;
  const selectedDetail = selectedAthleteId
    ? athleteDetails[selectedAthleteId]
    : undefined;

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

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,280px)_1fr]">
        <aside className="flex w-full flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Atletas en sesión
            </h2>
            <p className="text-xs text-slate-500">
              Selecciona un atleta para ver su ficha rápida y registrar
              métricas.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {athletes.map((athlete) => {
              const indicator = quickIndicators[athlete.id];
              const isSelected = athlete.id === selectedAthleteId;
              const accentTone = indicator?.recencyTone ?? "neutral";
              return (
                <button
                  key={athlete.id}
                  type="button"
                  onClick={() => setSelectedAthleteId(athlete.id)}
                  className={`flex flex-col items-start gap-1 rounded-lg border border-slate-200 bg-white p-3 text-left text-sm shadow-sm transition hover:border-brand-primary/60 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50 dark:border-slate-700 dark:bg-slate-900 ${
                    isSelected ? "ring-2 ring-brand-primary/60" : ""
                  } ${toneAccentClasses[accentTone]}`}
                >
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {athlete.name}
                  </span>
                  {indicator ? (
                    <div className="flex flex-wrap gap-1 text-[11px]">
                      <span
                        className={`rounded-full px-2 py-0.5 ${toneBadgeClass(
                          indicator.recencyTone
                        )}`}
                      >
                        {indicator.recencyLabel}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 ${toneBadgeClass(
                          indicator.rpeTone
                        )}`}
                      >
                        {indicator.rpeLabel}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 ${toneBadgeClass(
                          indicator.adherenceTone
                        )}`}
                      >
                        {indicator.adherenceLabel}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      Sin registros aún
                    </span>
                  )}
                  {athleteDetails[athlete.id]?.activeFollowUp && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
                      Seguimiento especial
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {selectedAthlete ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {selectedAthlete.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedAthlete.goal ?? "Objetivo no definido"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedIndicators && (
                    <>
                      <span
                        className={`rounded-full px-2 py-1 ${toneBadgeClass(
                          selectedIndicators.energyTone
                        )}`}
                      >
                        {selectedIndicators.energyLabel}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 ${toneBadgeClass(
                          selectedIndicators.rpeTone
                        )}`}
                      >
                        {selectedIndicators.rpeLabel}
                      </span>
                    </>
                  )}
                  {selectedDetail?.activeFollowUp && (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
                      {selectedDetail.activeFollowUpLabel ??
                        "Atención especial"}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Promedio RPE (5 reg.)
                  </h3>
                  <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {selectedDetail?.stats.averageRpe ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Energía predominante
                  </h3>
                  <p className="mt-1 text-base font-medium text-slate-900 dark:text-slate-100">
                    {mapEnergyLabel(selectedDetail?.stats.dominantEnergy)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Sesiones registradas (7d)
                  </h3>
                  <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {selectedDetail?.stats.sessionsLoggedLast7d ?? 0}
                  </p>
                </div>
              </div>

              {selectedIndicators?.lastNotes && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="font-medium">Última nota</p>
                  <p>{selectedIndicators.lastNotes}</p>
                </div>
              )}

              <form
                onSubmit={(event) => handleSubmit(event, selectedAthlete)}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-inner dark:border-slate-700 dark:bg-slate-900"
              >
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Registrar métricas rápidas
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <label className="flex flex-col gap-1">
                    <span>Peso (kg)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                      value={selectedForm.weight}
                      onChange={(event) =>
                        handleChange(
                          selectedAthlete.id,
                          "weight",
                          event.target.value
                        )
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
                      value={selectedForm.quality}
                      onChange={(event) =>
                        handleChange(
                          selectedAthlete.id,
                          "quality",
                          event.target.value
                        )
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
                      value={selectedForm.rpe}
                      onChange={(event) =>
                        handleChange(
                          selectedAthlete.id,
                          "rpe",
                          event.target.value
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Duración (min)</span>
                    <input
                      type="number"
                      min={0}
                      className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                      value={selectedForm.duration}
                      onChange={(event) =>
                        handleChange(
                          selectedAthlete.id,
                          "duration",
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Energía</span>
                  <select
                    className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                    value={selectedForm.energy}
                    onChange={(event) =>
                      handleChange(
                        selectedAthlete.id,
                        "energy",
                        event.target.value
                      )
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
                    checked={selectedForm.present}
                    onChange={(event) =>
                      handleChange(
                        selectedAthlete.id,
                        "present",
                        event.target.checked
                      )
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
                    value={selectedForm.notes}
                    onChange={(event) =>
                      handleChange(
                        selectedAthlete.id,
                        "notes",
                        event.target.value
                      )
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

              <div className="grid gap-4 md:grid-cols-2">
                <section className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Historial reciente
                  </h3>
                  {selectedDetail?.history.length ? (
                    <ul className="flex flex-col gap-2 text-xs">
                      {selectedDetail.history.map((entry) => (
                        <li
                          key={entry.id}
                          className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"
                        >
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            {new Date(entry.updated_at).toLocaleString()}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              RPE {entry.rpe}
                            </span>
                            {entry.training_quality && (
                              <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-600 dark:text-slate-300">
                                Calidad {entry.training_quality}
                              </span>
                            )}
                            {entry.energy_level && (
                              <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-600 dark:text-slate-300">
                                {mapEnergyLabel(entry.energy_level)}
                              </span>
                            )}
                          </div>
                          {entry.notes && (
                            <p className="mt-2 text-[13px] text-slate-600 dark:text-slate-300">
                              {entry.notes}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Aún no hay registros guardados para este atleta.
                    </p>
                  )}
                </section>

                <section className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Asistencias recientes
                  </h3>
                  {selectedDetail?.attendance.length ? (
                    <ul className="flex flex-col gap-2 text-xs">
                      {selectedDetail.attendance.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                        >
                          <span className="text-[11px] uppercase tracking-wide text-slate-500">
                            {new Date(entry.updated_at).toLocaleString()}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              entry.status === "present"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200"
                            }`}
                          >
                            {entry.status === "present"
                              ? "Presente"
                              : "Ausente"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Sin registros de asistencia para este atleta.
                    </p>
                  )}
                </section>
              </div>
            </>
          ) : (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
              <p>Selecciona un atleta en el panel lateral para comenzar.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
