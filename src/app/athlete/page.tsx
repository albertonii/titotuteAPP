"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import dynamic from "next/dynamic";
import {
  type AthleteProgress,
  type InjuryLog,
  type NutritionProfile,
  db,
} from "@/lib/db-local/db";
import { queueOutboxAction } from "@/lib/sync/outbox";
import { useAuthGuard } from "@/lib/hooks/useAuthGuard";
import {
  getNutritionProfile,
  listInjuryLogsByUser,
  listProgressByUser,
  resolveInjuryLog,
  upsertInjuryLog,
  upsertNutritionProfile,
} from "@/lib/services/athlete";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
);
const Line = dynamic(() => import("recharts").then((mod) => mod.Line), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), {
  ssr: false,
});

const NUMBER_FORMAT = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
});

const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
});

const FULL_DATE_FORMAT = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "short",
});

const ENERGY_OPTIONS: Array<{
  value: "low" | "medium" | "high";
  label: string;
}> = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];

const INJURY_SEVERITIES = [
  { value: "leve", label: "Leve" },
  { value: "moderada", label: "Moderada" },
  { value: "grave", label: "Grave" },
];

const DAILY_DEFAULT_STATE = {
  weight: "",
  quality: "8",
  rpe: "7",
  duration: "60",
  energy: "medium" as "low" | "medium" | "high",
  notes: "",
};

type DailyFormState = typeof DAILY_DEFAULT_STATE;

type SummaryWindow = {
  averageWeight: number | null;
  averageRpe: number | null;
  averageQuality: number | null;
  sessionsLogged: number;
  adherence: number;
};

type ChartPoint = {
  date: string;
  weight: number | null;
  rpe: number;
  quality: number;
};

const computeSummaryForRange = (
  entries: AthleteProgress[],
  days: number
): SummaryWindow => {
  const now = Date.now();
  const rangeEntries: AthleteProgress[] = [];
  const uniqueDays = new Set<string>();

  entries.forEach((entry) => {
    const updatedAt = new Date(entry.updated_at).getTime();
    const diffDays = (now - updatedAt) / (1000 * 60 * 60 * 24);
    if (diffDays <= days) {
      rangeEntries.push(entry);
      uniqueDays.add(entry.updated_at.slice(0, 10));
    }
  });

  if (rangeEntries.length === 0) {
    return {
      averageWeight: null,
      averageRpe: null,
      averageQuality: null,
      sessionsLogged: 0,
      adherence: 0,
    };
  }

  const weightValues = rangeEntries
    .map((entry) => entry.weight_morning)
    .filter((value): value is number => typeof value === "number");

  const average = (list: number[]) =>
    list.length ? list.reduce((acc, val) => acc + val, 0) / list.length : null;

  const averageWeight = average(weightValues);
  const averageRpe = average(rangeEntries.map((entry) => entry.rpe));
  const averageQuality = average(
    rangeEntries.map((entry) => entry.training_quality)
  );

  const adherence = Math.min(100, Math.round((uniqueDays.size / days) * 100));

  return {
    averageWeight,
    averageRpe,
    averageQuality,
    sessionsLogged: rangeEntries.length,
    adherence,
  };
};

const buildChartData = (entries: AthleteProgress[]): ChartPoint[] => {
  const ordered = [...entries].sort(
    (a, b) =>
      new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  );
  return ordered.slice(-28).map((entry) => ({
    date: DATE_FORMAT.format(new Date(entry.updated_at)),
    weight: entry.weight_morning ?? null,
    rpe: entry.rpe,
    quality: entry.training_quality,
  }));
};

export default function AthletePage() {
  const { user } = useAuthGuard({
    allowedRoles: ["athlete", "trainer", "admin", "nutritionist"],
  });

  const [entries, setEntries] = useState<AthleteProgress[]>([]);
  const [injuryLogs, setInjuryLogs] = useState<InjuryLog[]>([]);
  const [nutritionProfile, setNutritionProfile] =
    useState<NutritionProfile | null>(null);
  const [nutritionForm, setNutritionForm] = useState({
    goal: "",
    kcal: "",
    protein: "",
    carbs: "",
    fats: "",
  });
  const [dailyForm, setDailyForm] =
    useState<DailyFormState>(DAILY_DEFAULT_STATE);
  const [injuryForm, setInjuryForm] = useState({
    area: "",
    severity: "moderada" as InjuryLog["severity"],
    startDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [statusMessage, setStatusMessage] = useState<string>(
    "Listo para registrar."
  );
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingInjuries, setLoadingInjuries] = useState(true);
  const [loadingNutrition, setLoadingNutrition] = useState(true);

  useEffect(() => {
    const syncOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", syncOnlineStatus);
    window.addEventListener("offline", syncOnlineStatus);
    return () => {
      window.removeEventListener("online", syncOnlineStatus);
      window.removeEventListener("offline", syncOnlineStatus);
    };
  }, []);

  const refreshEntries = useCallback(async () => {
    if (!user?.id) return;
    setLoadingEntries(true);
    const data = await listProgressByUser(user.id);
    setEntries(data);
    setLoadingEntries(false);
  }, [user?.id]);

  const refreshInjuries = useCallback(async () => {
    if (!user?.id) return;
    setLoadingInjuries(true);
    const data = await listInjuryLogsByUser(user.id);
    setInjuryLogs(data);
    setLoadingInjuries(false);
  }, [user?.id]);

  const refreshNutrition = useCallback(async () => {
    if (!user?.id) return;
    setLoadingNutrition(true);
    const profile = await getNutritionProfile(user.id);
    setNutritionProfile(profile);
    setNutritionForm({
      goal: profile?.goal ?? "",
      kcal: profile?.kcal_target ? String(profile.kcal_target) : "",
      protein: profile?.protein_target ? String(profile.protein_target) : "",
      carbs: profile?.carbs_target ? String(profile.carbs_target) : "",
      fats: profile?.fats_target ? String(profile.fats_target) : "",
    });
    setLoadingNutrition(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    refreshEntries();
    refreshInjuries();
    refreshNutrition();
  }, [user?.id, refreshEntries, refreshInjuries, refreshNutrition]);

  const summary7days = useMemo(
    () => computeSummaryForRange(entries, 7),
    [entries]
  );
  const summary28days = useMemo(
    () => computeSummaryForRange(entries, 28),
    [entries]
  );
  const chartData = useMemo(() => buildChartData(entries), [entries]);

  const handleDailyChange =
    (field: keyof DailyFormState) => (value: string) => {
      setDailyForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleDailySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id) return;

    const now = new Date();
    const progress: AthleteProgress = {
      id: crypto.randomUUID(),
      user_id: user.id,
      session_id: `${now.toISOString()}::${user.id}`,
      weight_morning: dailyForm.weight ? Number(dailyForm.weight) : undefined,
      training_quality: Number(dailyForm.quality) || 0,
      rpe: Number(dailyForm.rpe) || 0,
      duration_min: Number(dailyForm.duration) || 0,
      energy_level: dailyForm.energy,
      notes: dailyForm.notes || undefined,
      updated_at: now.toISOString(),
    };

    await db.athlete_progress.put(progress);
    await queueOutboxAction({
      id: crypto.randomUUID(),
      table: "athlete_progress",
      operation: "insert",
      payload: progress,
    });

    setDailyForm(DAILY_DEFAULT_STATE);
    setStatusMessage("Sesión guardada localmente.");
    refreshEntries();
  };

  const handleInjurySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id) return;
    const now = new Date().toISOString();
    const log: InjuryLog = {
      id: crypto.randomUUID(),
      user_id: user.id,
      area: injuryForm.area,
      severity: injuryForm.severity,
      start_date: injuryForm.startDate,
      notes: injuryForm.notes || null,
      updated_at: now,
    };
    await upsertInjuryLog(log);
    setInjuryForm({
      area: "",
      severity: "moderada",
      startDate: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    refreshInjuries();
  };

  const handleResolveInjury = async (id: string) => {
    await resolveInjuryLog(id, new Date().toISOString().slice(0, 10));
    refreshInjuries();
  };

  const handleNutritionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id) return;

    const profile: NutritionProfile = {
      id: user.id,
      user_id: user.id,
      goal: nutritionForm.goal || null,
      kcal_target: nutritionForm.kcal ? Number(nutritionForm.kcal) : null,
      protein_target: nutritionForm.protein
        ? Number(nutritionForm.protein)
        : null,
      carbs_target: nutritionForm.carbs ? Number(nutritionForm.carbs) : null,
      fats_target: nutritionForm.fats ? Number(nutritionForm.fats) : null,
      updated_at: new Date().toISOString(),
    };
    await upsertNutritionProfile(profile);
    setNutritionProfile(profile);
    refreshNutrition();
  };

  return (
    <section className="flex flex-col gap-8 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-brand-primary">
          Mi progreso
        </h1>
        <p className="text-sm text-slate-600">
          Gestioná tus datos diarios aun sin conexión. Se sincronizarán en
          cuanto haya Internet.
        </p>
        <span className="text-xs text-brand-primary">
          {isOnline ? "Online" : "Offline"} · {entries.length} registros
          históricos
        </span>
      </header>

      <SummarySection
        summary7={summary7days}
        summary28={summary28days}
        lastEntry={entries[0] ?? null}
      />

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <TrendChart data={chartData} loading={loadingEntries} />
        <DailyLogForm
          form={dailyForm}
          onChange={handleDailyChange}
          onSubmit={handleDailySubmit}
          statusMessage={statusMessage}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <InjurySection
          form={injuryForm}
          onChange={setInjuryForm}
          onSubmit={handleInjurySubmit}
          loading={loadingInjuries}
          logs={injuryLogs}
          onResolve={handleResolveInjury}
        />
        <NutritionSection
          loading={loadingNutrition}
          profile={nutritionProfile}
          form={nutritionForm}
          onChange={setNutritionForm}
          onSubmit={handleNutritionSubmit}
        />
      </section>
    </section>
  );
}

interface SummaryProps {
  summary7: SummaryWindow;
  summary28: SummaryWindow;
  lastEntry: AthleteProgress | null;
}

function SummarySection({ summary7, summary28, lastEntry }: SummaryProps) {
  const lastEntryLabel = lastEntry
    ? FULL_DATE_FORMAT.format(new Date(lastEntry.updated_at))
    : "Sin registros recientes";

  return (
    <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm lg:grid-cols-3">
      <SummaryCard
        title="Últimos 7 días"
        sessions={summary7.sessionsLogged}
        adherence={summary7.adherence}
        weight={summary7.averageWeight}
        rpe={summary7.averageRpe}
        quality={summary7.averageQuality}
      />
      <SummaryCard
        title="Últimos 28 días"
        sessions={summary28.sessionsLogged}
        adherence={summary28.adherence}
        weight={summary28.averageWeight}
        rpe={summary28.averageRpe}
        quality={summary28.averageQuality}
      />
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Último registro
          </span>
          <p className="text-sm font-medium text-slate-700">{lastEntryLabel}</p>
        </div>
        {lastEntry ? (
          <div className="grid gap-2 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Peso</span>
              <strong className="text-slate-900">
                {lastEntry.weight_morning
                  ? `${NUMBER_FORMAT.format(lastEntry.weight_morning)} kg`
                  : "—"}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span>RPE</span>
              <strong className="text-slate-900">
                {NUMBER_FORMAT.format(lastEntry.rpe)}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Calidad</span>
              <strong className="text-slate-900">
                {NUMBER_FORMAT.format(lastEntry.training_quality)}
              </strong>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Aún no registraste información. Completa tu primera sesión para
            comenzar a ver tus tendencias.
          </p>
        )}
      </div>
    </section>
  );
}

interface SummaryCardProps {
  title: string;
  sessions: number;
  adherence: number;
  weight: number | null;
  rpe: number | null;
  quality: number | null;
}

function SummaryCard({
  title,
  sessions,
  adherence,
  weight,
  rpe,
  quality,
}: SummaryCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
          {adherence}% adherencia
        </span>
      </div>
      <dl className="grid gap-2 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <dt>Sesiones registradas</dt>
          <dd className="font-semibold text-slate-900">{sessions}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Peso promedio</dt>
          <dd className="font-semibold text-slate-900">
            {weight ? `${NUMBER_FORMAT.format(weight)} kg` : "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>RPE promedio</dt>
          <dd className="font-semibold text-slate-900">
            {rpe ? NUMBER_FORMAT.format(rpe) : "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Calidad promedio</dt>
          <dd className="font-semibold text-slate-900">
            {quality ? NUMBER_FORMAT.format(quality) : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

interface TrendChartProps {
  data: ChartPoint[];
  loading: boolean;
}

function TrendChart({ data, loading }: TrendChartProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Tendencias (últimos 28 días)
          </h2>
          <p className="text-sm text-slate-500">
            Visualiza tu evolución de peso, RPE y calidad.
          </p>
        </div>
      </header>
      <div className="mt-4 h-80 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400 animate-pulse">
            Cargando registros...
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Registra tus sesiones para ver las gráficas.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ left: 12, right: 12, top: 16, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#1e293b"
                tickLine={false}
                axisLine={{ stroke: "#94a3b8" }}
              />
              <YAxis
                stroke="#1e293b"
                tickLine={false}
                axisLine={{ stroke: "#94a3b8" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderColor: "#e2e8f0",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#0f172a" }}
                formatter={(value, name) => {
                  if (value === null || value === undefined) return ["—", name];
                  const numericValue =
                    typeof value === "number" ? value : Number(value);
                  if (!Number.isFinite(numericValue)) {
                    return [value, name];
                  }
                  return name === "weight"
                    ? [`${NUMBER_FORMAT.format(numericValue)} kg`, "Peso"]
                    : [
                        NUMBER_FORMAT.format(numericValue),
                        name === "rpe" ? "RPE" : "Calidad",
                      ];
                }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                name="Peso"
                stroke="#22c55e"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="quality"
                name="Calidad"
                stroke="#0ea5e9"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="rpe"
                name="RPE"
                stroke="#f97316"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

interface DailyLogFormProps {
  form: DailyFormState;
  onChange: (field: keyof DailyFormState) => (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  statusMessage: string;
}

function DailyLogForm({
  form,
  onChange,
  onSubmit,
  statusMessage,
}: DailyLogFormProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Registro diario
          </h2>
          <p className="text-sm text-slate-500">
            Guardá tus métricas en segundos. Se enviarán automáticamente cuando
            vuelvas a estar online.
          </p>
        </div>
      </header>
      <p className="mt-3 text-xs text-brand-primary">{statusMessage}</p>
      <form
        onSubmit={onSubmit}
        className="mt-4 grid gap-4 text-sm sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">Peso (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            value={form.weight}
            onChange={(event) => onChange("weight")(event.target.value)}
            placeholder="Ej. 72.5"
            className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">Duración (min)</span>
          <input
            type="number"
            min={0}
            value={form.duration}
            onChange={(event) => onChange("duration")(event.target.value)}
            placeholder="Ej. 60"
            className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">Calidad (1-10)</span>
          <input
            type="number"
            min={1}
            max={10}
            value={form.quality}
            onChange={(event) => onChange("quality")(event.target.value)}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">RPE</span>
          <input
            type="number"
            min={1}
            max={10}
            value={form.rpe}
            onChange={(event) => onChange("rpe")(event.target.value)}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
          />
        </label>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-slate-600">Energía percibida</span>
          <div className="flex flex-wrap gap-2">
            {ENERGY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange("energy")(option.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  form.energy === option.value
                    ? "bg-brand-primary text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-brand-primary/10 hover:text-brand-primary"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-slate-600">Notas</span>
          <textarea
            value={form.notes}
            onChange={(event) => onChange("notes")(event.target.value)}
            placeholder="Anota ajustes, parones, sensaciones..."
            className="h-24 rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
          />
        </label>
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-accent"
          >
            Guardar registro
          </button>
        </div>
      </form>
    </section>
  );
}

interface InjurySectionProps {
  form: {
    area: string;
    severity: InjuryLog["severity"];
    startDate: string;
    notes: string;
  };
  onChange: (form: InjurySectionProps["form"]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  logs: InjuryLog[];
  onResolve: (id: string) => void;
}

function InjurySection({
  form,
  onChange,
  onSubmit,
  loading,
  logs,
  onResolve,
}: InjurySectionProps) {
  const activeLogs = logs.filter((log) => !log.end_date);
  const resolvedLogs = logs.filter((log) => Boolean(log.end_date));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Lesiones & alertas
          </h2>
          <p className="text-sm text-slate-500">
            Registra molestias para que el equipo las tenga presentes.
          </p>
        </div>
      </header>
      <form onSubmit={onSubmit} className="mt-4 grid gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">Zona afectada</span>
          <input
            value={form.area}
            onChange={(event) =>
              onChange({ ...form, area: event.target.value })
            }
            placeholder="Ej. Hombro derecho"
            className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-slate-600">Severidad</span>
            <select
              value={form.severity}
              onChange={(event) =>
                onChange({
                  ...form,
                  severity: event.target.value as InjuryLog["severity"],
                })
              }
              className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
            >
              {INJURY_SEVERITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-600">Fecha de inicio</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(event) =>
                onChange({ ...form, startDate: event.target.value })
              }
              className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">Notas</span>
          <textarea
            value={form.notes}
            onChange={(event) =>
              onChange({ ...form, notes: event.target.value })
            }
            placeholder="Describe la molestia, recomendaciones médicas, etc."
            className="h-20 rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-accent"
          >
            Guardar lesión
          </button>
        </div>
      </form>

      <div className="mt-6 grid gap-4">
        <section className="space-y-3">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Lesiones activas
            </h3>
            {loading ? (
              <span className="text-xs text-slate-400">Cargando…</span>
            ) : null}
          </header>
          {loading ? (
            <p className="text-sm text-slate-400 animate-pulse">
              Cargando historial…
            </p>
          ) : activeLogs.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay lesiones activas. ¡Buen trabajo cuidándote!
            </p>
          ) : (
            <ul className="grid gap-3">
              {activeLogs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-amber-700">
                        {log.area}
                      </span>
                      <span className="text-xs text-amber-600">
                        Desde {DATE_FORMAT.format(new Date(log.start_date))}
                      </span>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                      {log.severity.toUpperCase()}
                    </span>
                  </div>
                  {log.notes ? (
                    <p className="mt-2 text-sm text-amber-800">{log.notes}</p>
                  ) : null}
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onResolve(log.id)}
                      className="text-xs font-semibold text-amber-700 underline underline-offset-4 hover:text-amber-800"
                    >
                      Marcar como resuelta
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Historial resuelto
          </h3>
          {loading ? (
            <p className="text-sm text-slate-400 animate-pulse">
              Cargando historial…
            </p>
          ) : resolvedLogs.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aún no registraste lesiones resueltas.
            </p>
          ) : (
            <ul className="grid gap-2">
              {resolvedLogs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">
                      {log.area}
                    </span>
                    <span>
                      {DATE_FORMAT.format(new Date(log.start_date))} →{" "}
                      {log.end_date
                        ? DATE_FORMAT.format(new Date(log.end_date))
                        : "—"}
                    </span>
                  </div>
                  {log.notes ? <p className="mt-1">{log.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

interface NutritionSectionProps {
  loading: boolean;
  profile: NutritionProfile | null;
  form: {
    goal: string;
    kcal: string;
    protein: string;
    carbs: string;
    fats: string;
  };
  onChange: (form: NutritionSectionProps["form"]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function NutritionSection({
  loading,
  profile,
  form,
  onChange,
  onSubmit,
}: NutritionSectionProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Nutrición & macros
          </h2>
          <p className="text-sm text-slate-500">
            Define tu objetivo y mantené a Rubén al tanto de tus macros.
          </p>
        </div>
        {profile ? (
          <span className="text-xs text-slate-400">
            Actualizado {DATE_FORMAT.format(new Date(profile.updated_at))}
          </span>
        ) : null}
      </header>
      <form onSubmit={onSubmit} className="mt-4 grid gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">Objetivo</span>
          <input
            value={form.goal}
            onChange={(event) =>
              onChange({ ...form, goal: event.target.value })
            }
            placeholder="Ej. Definición, rendimiento, recomposición"
            className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-slate-600">Calorías objetivo</span>
            <input
              type="number"
              min={0}
              value={form.kcal}
              onChange={(event) =>
                onChange({ ...form, kcal: event.target.value })
              }
              placeholder="Ej. 2300"
              className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-600">Proteínas (g)</span>
            <input
              type="number"
              min={0}
              value={form.protein}
              onChange={(event) =>
                onChange({ ...form, protein: event.target.value })
              }
              placeholder="Ej. 160"
              className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-600">Carbohidratos (g)</span>
            <input
              type="number"
              min={0}
              value={form.carbs}
              onChange={(event) =>
                onChange({ ...form, carbs: event.target.value })
              }
              placeholder="Ej. 250"
              className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-600">Grasas (g)</span>
            <input
              type="number"
              min={0}
              value={form.fats}
              onChange={(event) =>
                onChange({ ...form, fats: event.target.value })
              }
              placeholder="Ej. 70"
              className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-brand-primary/50 focus:ring"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-accent"
          >
            Guardar objetivo nutricional
          </button>
        </div>
        {loading ? (
          <p className="text-xs text-slate-400 animate-pulse">
            Sincronizando...
          </p>
        ) : null}
      </form>
    </section>
  );
}
