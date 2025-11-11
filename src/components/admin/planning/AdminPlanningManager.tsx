"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  db,
  type Macrocycle,
  type Mesocycle,
  type Microcycle,
  type PlanningStatus,
  type Session,
  type SessionStatus,
  type User,
} from "@/lib/db-local/db";
import {
  createMacrocycle,
  createMesocycle,
  createMicrocycle,
  createSessionPlan,
  deleteMacrocycle,
  deleteMesocycle,
  deleteMicrocycle,
  deleteSessionPlan,
  listMacrocycles,
  listMesocyclesByMacrocycle,
  listMicrocyclesByMesocycle,
  listSessionsByMacrocycle,
  listSessionsByMesocycle,
  listSessionsByMicrocycle,
  updateMacrocycle,
  updateMesocycle,
  updateMicrocycle,
  updateSessionPlan,
} from "@/lib/services/planning";
import { listLocalUsers } from "@/lib/services/users";
import { useAuthStore } from "@/lib/state/auth";
import type { TrainingMap } from "@/types/training";

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const formatShortDate = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return SHORT_DATE_FORMATTER.format(date);
};

const formatWeekdayDate = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return WEEKDAY_DATE_FORMATTER.format(date);
};

interface MacrocycleFormState {
  name: string;
  season: string;
  start_date: string;
  end_date: string;
  goal: string;
  notes: string;
  status: PlanningStatus;
}

interface MesocycleFormState {
  name: string;
  start_date: string;
  end_date: string;
  phase: string;
  focus: string;
  goal: string;
  order_index: string;
  status: PlanningStatus;
}

interface MicrocycleFormState {
  name: string;
  week_number: string;
  start_date: string;
  end_date: string;
  focus: string;
  load: string;
  status: PlanningStatus;
}

interface SessionFormState {
  name: string;
  date: string;
  session_type: string;
  trainer_id: string;
  order_index: string;
  status: SessionStatus;
  notes: string;
}

type MacrocycleSummary = Macrocycle & { duration: string };
type MesocycleSummary = Mesocycle & { duration: string };

const DEFAULT_MACROCYCLE_FORM: MacrocycleFormState = {
  name: "",
  season: "",
  start_date: "",
  end_date: "",
  goal: "",
  notes: "",
  status: "draft",
};

const DEFAULT_MESOCYCLE_FORM: MesocycleFormState = {
  name: "",
  start_date: "",
  end_date: "",
  phase: "",
  focus: "",
  goal: "",
  order_index: "0",
  status: "draft",
};

const DEFAULT_MICROCYCLE_FORM: MicrocycleFormState = {
  name: "",
  week_number: "1",
  start_date: "",
  end_date: "",
  focus: "",
  load: "",
  status: "draft",
};

const DEFAULT_SESSION_FORM: SessionFormState = {
  name: "",
  date: "",
  session_type: "",
  trainer_id: "",
  order_index: "0",
  status: "scheduled",
  notes: "",
};

const planningStatusLabel: Record<PlanningStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

const sessionStatusLabel: Record<SessionStatus, string> = {
  draft: "Borrador",
  scheduled: "Programada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const planningStatusStyle: Record<PlanningStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-700",
  archived: "bg-slate-200 text-slate-600",
};

const sessionStatusStyle: Record<SessionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

type EditorState =
  | { type: "macrocycle"; mode: "create" | "edit" }
  | { type: "mesocycle"; mode: "create" | "edit" }
  | { type: "microcycle"; mode: "create" | "edit" }
  | { type: "session"; mode: "create" | "edit" };

export function AdminPlanningManager() {
  const user = useAuthStore((state) => state.user);
  const [macrocycles, setMacrocycles] = useState<Macrocycle[]>([]);
  const [mesocycles, setMesocycles] = useState<Mesocycle[]>([]);
  const [microcycles, setMicrocycles] = useState<Microcycle[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [trainers, setTrainers] = useState<User[]>([]);
  const [trainingSheets, setTrainingSheets] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>("");
  const [editor, setEditor] = useState<EditorState | null>(null);

  const [selectedMacrocycleId, setSelectedMacrocycleId] = useState<
    string | null
  >(null);
  const [selectedMesocycleId, setSelectedMesocycleId] = useState<string | null>(
    null
  );
  const [selectedMicrocycleId, setSelectedMicrocycleId] = useState<
    string | null
  >(null);

  const [macroForm, setMacroForm] = useState<MacrocycleFormState>(
    DEFAULT_MACROCYCLE_FORM
  );
  const [mesoForm, setMesoForm] = useState<MesocycleFormState>(
    DEFAULT_MESOCYCLE_FORM
  );
  const [microForm, setMicroForm] = useState<MicrocycleFormState>(
    DEFAULT_MICROCYCLE_FORM
  );
  const [sessionForm, setSessionForm] =
    useState<SessionFormState>(DEFAULT_SESSION_FORM);

  const [editingMacroId, setEditingMacroId] = useState<string | null>(null);
  const [editingMesocycleId, setEditingMesocycleId] = useState<string | null>(
    null
  );
  const [editingMicrocycleId, setEditingMicrocycleId] = useState<string | null>(
    null
  );
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const selectedMacrocycle =
    macrocycles.find((item) => item.id === selectedMacrocycleId) ?? null;
  const selectedMesocycle =
    mesocycles.find((item) => item.id === selectedMesocycleId) ?? null;
  const selectedMicrocycle =
    microcycles.find((item) => item.id === selectedMicrocycleId) ?? null;

  const refreshMacrocycles = useCallback(async () => {
    setMacrocycles(await listMacrocycles());
  }, []);

  const refreshMesocycles = useCallback(async () => {
    if (!selectedMacrocycleId) {
      setMesocycles([]);
      return;
    }
    setMesocycles(await listMesocyclesByMacrocycle(selectedMacrocycleId));
  }, [selectedMacrocycleId]);

  const refreshMicrocycles = useCallback(async () => {
    if (!selectedMesocycleId) {
      setMicrocycles([]);
      return;
    }
    setMicrocycles(await listMicrocyclesByMesocycle(selectedMesocycleId));
  }, [selectedMesocycleId]);

  const sortSessions = (items: Session[]) =>
    [...items].sort((a, b) => {
      const orderA = a.order_index ?? 0;
      const orderB = b.order_index ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return new Date(a.date).valueOf() - new Date(b.date).valueOf();
    });

  const refreshSessions = useCallback(async () => {
    if (selectedMicrocycleId) {
      setSessions(
        sortSessions(await listSessionsByMicrocycle(selectedMicrocycleId))
      );
      return;
    }
    if (selectedMesocycleId) {
      setSessions(
        sortSessions(await listSessionsByMesocycle(selectedMesocycleId))
      );
      return;
    }
    if (selectedMacrocycleId) {
      setSessions(
        sortSessions(await listSessionsByMacrocycle(selectedMacrocycleId))
      );
      return;
    }
    setSessions([]);
  }, [selectedMacrocycleId, selectedMesocycleId, selectedMicrocycleId]);

  useEffect(() => {
    refreshMacrocycles();
  }, [refreshMacrocycles]);

  useEffect(() => {
    refreshMesocycles();
  }, [refreshMesocycles]);

  useEffect(() => {
    refreshMicrocycles();
  }, [refreshMicrocycles]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    const loadUsers = async () => {
      const users = await listLocalUsers();
      setTrainers(users.filter((item) => item.role === "trainer"));
    };
    loadUsers();
  }, []);

  useEffect(() => {
    const loadTrainings = async () => {
      try {
        const response = await fetch("/data/trainings.json");
        if (!response.ok) {
          throw new Error("No se pudo cargar el plan base");
        }
        const data: TrainingMap = await response.json();
        const sheets = new Set<string>();
        Object.values(data).forEach((item) => {
          if (item.sheet) {
            sheets.add(item.sheet);
          }
        });
        setTrainingSheets(
          Array.from(sheets).sort((a, b) => a.localeCompare(b, "es"))
        );
      } catch (error) {
        console.warn("No se pudieron cargar los entrenamientos base", error);
      }
    };
    loadTrainings();
  }, []);

  useEffect(() => {
    const handler = (changes: any[]) => {
      const touchedTables = new Set(
        changes.map((change) => change.table as string)
      );
      if (touchedTables.has("macrocycles")) {
        refreshMacrocycles();
      }
      if (touchedTables.has("mesocycles")) {
        refreshMesocycles();
      }
      if (touchedTables.has("microcycles")) {
        refreshMicrocycles();
      }
      if (touchedTables.has("sessions")) {
        refreshSessions();
      }
    };

    db.on("changes", handler);
    return () => {
      db.on("changes").unsubscribe(handler);
    };
  }, [
    refreshMacrocycles,
    refreshMesocycles,
    refreshMicrocycles,
    refreshSessions,
  ]);

  const resetMacroForm = () => {
    setMacroForm(DEFAULT_MACROCYCLE_FORM);
    setEditingMacroId(null);
  };

  const resetMesocycleForm = () => {
    setMesoForm(DEFAULT_MESOCYCLE_FORM);
    setEditingMesocycleId(null);
  };

  const resetMicrocycleForm = () => {
    setMicroForm(DEFAULT_MICROCYCLE_FORM);
    setEditingMicrocycleId(null);
  };

  const resetSessionForm = () => {
    setSessionForm(DEFAULT_SESSION_FORM);
    setEditingSessionId(null);
  };

  const closeEditor = () => {
    setEditor(null);
    setEditingMacroId(null);
    setEditingMesocycleId(null);
    setEditingMicrocycleId(null);
    setEditingSessionId(null);
  };

  const openCreateMacrocycle = () => {
    resetMacroForm();
    setEditor({ type: "macrocycle", mode: "create" });
  };

  const openCreateMesocycle = () => {
    if (!selectedMacrocycleId) {
      setFeedback("Selecciona un macrociclo para crear un mesociclo.");
      return;
    }
    resetMesocycleForm();
    setMesoForm((prev) => ({
      ...DEFAULT_MESOCYCLE_FORM,
      order_index: String(mesocycles.length + 1),
    }));
    setEditor({ type: "mesocycle", mode: "create" });
  };

  const openCreateMicrocycle = () => {
    if (!selectedMesocycleId) {
      setFeedback("Selecciona un mesociclo para crear un microciclo.");
      return;
    }
    resetMicrocycleForm();
    setMicroForm((prev) => ({
      ...DEFAULT_MICROCYCLE_FORM,
      week_number: String(microcycles.length + 1),
    }));
    setEditor({ type: "microcycle", mode: "create" });
  };

  const openCreateSession = () => {
    if (!selectedMacrocycleId) {
      setFeedback("Selecciona un macrociclo para programar sesiones.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const suggestedDate =
      selectedMicrocycle?.start_date ?? selectedMesocycle?.start_date ?? today;

    resetSessionForm();
    setSessionForm({
      ...DEFAULT_SESSION_FORM,
      date: suggestedDate,
      order_index: String(sessions.length + 1),
    });
    setEditor({ type: "session", mode: "create" });
  };

  const handleCloseEditor = () => {
    if (!editor) {
      closeEditor();
      return;
    }
    switch (editor.type) {
      case "macrocycle":
        resetMacroForm();
        break;
      case "mesocycle":
        resetMesocycleForm();
        break;
      case "microcycle":
        resetMicrocycleForm();
        break;
      case "session":
        resetSessionForm();
        break;
      default:
        break;
    }
    closeEditor();
  };

  const handleMacroSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!macroForm.name || !macroForm.start_date || !macroForm.end_date) {
      return;
    }

    const payload = {
      name: macroForm.name.trim(),
      season: macroForm.season.trim() || undefined,
      start_date: macroForm.start_date,
      end_date: macroForm.end_date,
      goal: macroForm.goal.trim() || undefined,
      notes: macroForm.notes.trim() || undefined,
      status: macroForm.status,
      created_by: user?.id,
    };

    try {
      if (editingMacroId) {
        await updateMacrocycle(editingMacroId, payload);
        setFeedback("Macrociclo actualizado.");
      } else {
        const created = await createMacrocycle(payload);
        setSelectedMacrocycleId(created.id);
        setFeedback("Macrociclo creado correctamente.");
      }
      await refreshMacrocycles();
      resetMacroForm();
      closeEditor();
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el macrociclo."
      );
    }
  };

  const handleMesocycleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMacrocycleId) return;
    if (!mesoForm.name || !mesoForm.start_date || !mesoForm.end_date) return;

    const payload = {
      macrocycle_id: selectedMacrocycleId,
      name: mesoForm.name.trim(),
      start_date: mesoForm.start_date,
      end_date: mesoForm.end_date,
      phase: mesoForm.phase.trim() || undefined,
      focus: mesoForm.focus.trim() || undefined,
      goal: mesoForm.goal.trim() || undefined,
      order_index: Number(mesoForm.order_index) || 0,
      status: mesoForm.status,
    };

    try {
      if (editingMesocycleId) {
        await updateMesocycle(editingMesocycleId, payload);
        setFeedback("Mesociclo actualizado.");
      } else {
        const created = await createMesocycle(payload);
        setSelectedMesocycleId(created.id);
        setFeedback("Mesociclo creado correctamente.");
      }
      await refreshMesocycles();
      resetMesocycleForm();
      closeEditor();
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el mesociclo."
      );
    }
  };

  const handleMicrocycleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMesocycleId) return;
    if (!microForm.name || !microForm.week_number) return;

    const payload = {
      mesocycle_id: selectedMesocycleId,
      name: microForm.name.trim(),
      week_number: Number(microForm.week_number),
      start_date: microForm.start_date || undefined,
      end_date: microForm.end_date || undefined,
      focus: microForm.focus.trim() || undefined,
      load: microForm.load.trim() || undefined,
      status: microForm.status,
    };

    try {
      if (editingMicrocycleId) {
        await updateMicrocycle(editingMicrocycleId, payload);
        setFeedback("Microciclo actualizado.");
      } else {
        const created = await createMicrocycle(payload);
        setSelectedMicrocycleId(created.id);
        setFeedback("Microciclo creado correctamente.");
      }
      await refreshMicrocycles();
      resetMicrocycleForm();
      closeEditor();
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el microciclo."
      );
    }
  };

  const handleSessionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMacrocycleId) return;
    if (!sessionForm.date || !sessionForm.session_type) return;

    const payload = {
      macrocycle_id: selectedMacrocycleId,
      mesocycle_id: selectedMesocycleId ?? undefined,
      microcycle_id: selectedMicrocycleId ?? undefined,
      trainer_id: sessionForm.trainer_id || undefined,
      name: sessionForm.name.trim() || undefined,
      date: sessionForm.date,
      session_type: sessionForm.session_type,
      order_index: Number(sessionForm.order_index) || 0,
      status: sessionForm.status,
      notes: sessionForm.notes.trim() || undefined,
    };

    try {
      if (editingSessionId) {
        await updateSessionPlan(editingSessionId, payload);
        setFeedback("Sesión actualizada.");
      } else {
        await createSessionPlan(payload);
        setFeedback("Sesión programada correctamente.");
      }
      await refreshSessions();
      resetSessionForm();
      closeEditor();
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error ? error.message : "No se pudo guardar la sesión."
      );
    }
  };

  const startMacroEdit = (macrocycle: Macrocycle) => {
    setEditingMacroId(macrocycle.id);
    setMacroForm({
      name: macrocycle.name,
      season: macrocycle.season ?? "",
      start_date: macrocycle.start_date,
      end_date: macrocycle.end_date,
      goal: macrocycle.goal ?? "",
      notes: macrocycle.notes ?? "",
      status: macrocycle.status,
    });
    setEditor({ type: "macrocycle", mode: "edit" });
  };

  const startMesocycleEdit = (mesocycle: Mesocycle) => {
    setEditingMesocycleId(mesocycle.id);
    if (mesocycle.macrocycle_id) {
      setSelectedMacrocycleId(mesocycle.macrocycle_id);
    }
    setSelectedMesocycleId(mesocycle.id);
    setMesoForm({
      name: mesocycle.name,
      start_date: mesocycle.start_date,
      end_date: mesocycle.end_date,
      phase: mesocycle.phase ?? "",
      focus: mesocycle.focus ?? "",
      goal: mesocycle.goal ?? "",
      order_index: String(mesocycle.order_index ?? 0),
      status: mesocycle.status,
    });
    setEditor({ type: "mesocycle", mode: "edit" });
  };

  const startMicrocycleEdit = (microcycle: Microcycle) => {
    setEditingMicrocycleId(microcycle.id);
    if (microcycle.mesocycle_id) {
      setSelectedMesocycleId(microcycle.mesocycle_id);
      const parentMesocycle = mesocycles.find(
        (item) => item.id === microcycle.mesocycle_id
      );
      if (parentMesocycle?.macrocycle_id) {
        setSelectedMacrocycleId(parentMesocycle.macrocycle_id);
      }
    }
    setSelectedMicrocycleId(microcycle.id);
    setMicroForm({
      name: microcycle.name,
      week_number: String(microcycle.week_number),
      start_date: microcycle.start_date ?? "",
      end_date: microcycle.end_date ?? "",
      focus: microcycle.focus ?? "",
      load: microcycle.load ?? "",
      status: microcycle.status,
    });
    setEditor({ type: "microcycle", mode: "edit" });
  };

  const startSessionEdit = (session: Session) => {
    setEditingSessionId(session.id);
    if (session.macrocycle_id) {
      setSelectedMacrocycleId(session.macrocycle_id);
    }
    if (session.mesocycle_id) {
      setSelectedMesocycleId(session.mesocycle_id);
    }
    if (session.microcycle_id) {
      setSelectedMicrocycleId(session.microcycle_id);
    }
    setSessionForm({
      name: session.name ?? "",
      date: session.date,
      session_type: session.session_type,
      trainer_id: session.trainer_id ?? "",
      order_index: String(session.order_index ?? 0),
      status: session.status,
      notes: session.notes ?? "",
    });
    setEditor({ type: "session", mode: "edit" });
  };

  const duplicateMacrocycle = async (macrocycle: Macrocycle) => {
    try {
      const copy = await createMacrocycle({
        name: `${macrocycle.name} (copia)`,
        season: macrocycle.season ?? undefined,
        start_date: macrocycle.start_date,
        end_date: macrocycle.end_date,
        goal: macrocycle.goal ?? undefined,
        notes: macrocycle.notes ?? undefined,
        status: "draft",
        created_by: user?.id,
      });
      await refreshMacrocycles();
      setSelectedMacrocycleId(copy.id);
      setFeedback("Macrociclo duplicado en borrador.");
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo duplicar el macrociclo."
      );
    }
  };

  const duplicateMesocycle = async (mesocycle: Mesocycle) => {
    const macrocycleId = mesocycle.macrocycle_id ?? selectedMacrocycleId;
    if (!macrocycleId) {
      setFeedback("Selecciona un macrociclo antes de duplicar el mesociclo.");
      return;
    }
    try {
      const copy = await createMesocycle({
        macrocycle_id: macrocycleId,
        name: `${mesocycle.name} (copia)`,
        start_date: mesocycle.start_date,
        end_date: mesocycle.end_date,
        phase: mesocycle.phase ?? undefined,
        focus: mesocycle.focus ?? undefined,
        goal: mesocycle.goal ?? undefined,
        order_index: mesocycles.length + 1,
        status: "draft",
      });
      await refreshMesocycles();
      setSelectedMesocycleId(copy.id);
      setFeedback("Mesociclo duplicado en borrador.");
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo duplicar el mesociclo."
      );
    }
  };

  const duplicateMicrocycle = async (microcycle: Microcycle) => {
    const mesocycleId = microcycle.mesocycle_id ?? selectedMesocycleId;
    if (!mesocycleId) {
      setFeedback("Selecciona un mesociclo antes de duplicar el microciclo.");
      return;
    }
    try {
      const copy = await createMicrocycle({
        mesocycle_id: mesocycleId,
        name: `${microcycle.name} (copia)`,
        week_number: microcycles.length + 1,
        start_date: microcycle.start_date ?? undefined,
        end_date: microcycle.end_date ?? undefined,
        focus: microcycle.focus ?? undefined,
        load: microcycle.load ?? undefined,
        status: "draft",
      });
      await refreshMicrocycles();
      setSelectedMicrocycleId(copy.id);
      setFeedback("Microciclo duplicado en borrador.");
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo duplicar el microciclo."
      );
    }
  };

  const duplicateSession = async (session: Session) => {
    const macrocycleId = session.macrocycle_id ?? selectedMacrocycleId;
    if (!macrocycleId) {
      setFeedback("Selecciona un macrociclo antes de duplicar la sesión.");
      return;
    }
    try {
      await createSessionPlan({
        macrocycle_id: macrocycleId,
        mesocycle_id: session.mesocycle_id ?? selectedMesocycleId ?? undefined,
        microcycle_id:
          session.microcycle_id ?? selectedMicrocycleId ?? undefined,
        trainer_id: session.trainer_id ?? undefined,
        name: session.name ? `${session.name} (copia)` : undefined,
        date: session.date,
        session_type: session.session_type,
        order_index: sessions.length + 1,
        status: "draft",
        notes: session.notes ?? undefined,
      });
      await refreshSessions();
      setFeedback("Sesión duplicada en borrador.");
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo duplicar la sesión."
      );
    }
  };

  const handleSelectMacrocycle = (id: string) => {
    setSelectedMacrocycleId(id);
    setSelectedMesocycleId(null);
    setSelectedMicrocycleId(null);
    resetMesocycleForm();
    resetMicrocycleForm();
    resetSessionForm();
  };

  const handleSelectMesocycle = (id: string) => {
    setSelectedMesocycleId(id);
    setSelectedMicrocycleId(null);
    resetMicrocycleForm();
    resetSessionForm();
  };

  const handleSelectMicrocycle = (id: string) => {
    setSelectedMicrocycleId(id);
    resetSessionForm();
  };

  const macrocycleSummary = useMemo<MacrocycleSummary[]>(() => {
    return macrocycles.map((macro) => ({
      ...macro,
      duration: `${formatShortDate(macro.start_date)} – ${formatShortDate(
        macro.end_date
      )}`,
    }));
  }, [macrocycles]);

  const mesocycleSummary = useMemo<MesocycleSummary[]>(() => {
    return mesocycles.map((meso) => ({
      ...meso,
      duration: `${formatShortDate(meso.start_date)} – ${formatShortDate(
        meso.end_date
      )}`,
    }));
  }, [mesocycles]);

  const sessionScopeLabel = selectedMicrocycle
    ? `Sesiones del microciclo ${selectedMicrocycle.name}`
    : selectedMesocycle
    ? `Sesiones del mesociclo ${selectedMesocycle.name}`
    : selectedMacrocycle
    ? `Sesiones del macrociclo ${selectedMacrocycle.name}`
    : "Sesiones";

  const editorTitle = editor
    ? editor.type === "macrocycle"
      ? editor.mode === "create"
        ? "Nuevo macrociclo"
        : "Editar macrociclo"
      : editor.type === "mesocycle"
      ? editor.mode === "create"
        ? "Nuevo mesociclo"
        : "Editar mesociclo"
      : editor.type === "microcycle"
      ? editor.mode === "create"
        ? "Nuevo microciclo"
        : "Editar microciclo"
      : editor.mode === "create"
      ? "Programar sesión"
      : "Editar sesión"
    : "";

  const editorSubtitle = editor
    ? (() => {
        switch (editor.type) {
          case "macrocycle":
            return "Define fechas clave, metas y notas generales.";
          case "mesocycle":
            return selectedMacrocycle
              ? `Dentro de ${selectedMacrocycle.name}`
              : "";
          case "microcycle":
            return selectedMesocycle
              ? `Dentro de ${selectedMesocycle.name}`
              : "";
          case "session":
            return selectedMacrocycle
              ? `Plan asociado a ${sessionScopeLabel.toLowerCase()}`
              : "";
          default:
            return "";
        }
      })()
    : "";

  const isEditorOpen = Boolean(editor);

  const renderEditorForm = () => {
    if (!editor) return null;

    const submitLabel = (defaultLabel: string, editLabel: string) =>
      editor.mode === "edit" ? editLabel : defaultLabel;

    switch (editor.type) {
      case "macrocycle":
        return (
          <form
            onSubmit={handleMacroSubmit}
            className="flex flex-col gap-4 p-4 text-sm"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nombre
                </span>
                <input
                  required
                  value={macroForm.name}
                  onChange={(event) =>
                    setMacroForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Temporada 2025"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Temporada
                </span>
                <input
                  value={macroForm.season}
                  onChange={(event) =>
                    setMacroForm((prev) => ({
                      ...prev,
                      season: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="2025-2026"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Inicio
                </span>
                <input
                  type="date"
                  required
                  value={macroForm.start_date}
                  onChange={(event) =>
                    setMacroForm((prev) => ({
                      ...prev,
                      start_date: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fin
                </span>
                <input
                  type="date"
                  required
                  value={macroForm.end_date}
                  onChange={(event) =>
                    setMacroForm((prev) => ({
                      ...prev,
                      end_date: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Objetivo
                </span>
                <input
                  value={macroForm.goal}
                  onChange={(event) =>
                    setMacroForm((prev) => ({
                      ...prev,
                      goal: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Preparación para competencia regional"
                />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Notas
                </span>
                <textarea
                  value={macroForm.notes}
                  onChange={(event) =>
                    setMacroForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  className="min-h-[80px] rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Lineamientos generales, hitos, recordatorios"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </span>
                <select
                  value={macroForm.status}
                  onChange={(event) =>
                    setMacroForm((prev) => ({
                      ...prev,
                      status: event.target.value as PlanningStatus,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                >
                  {Object.entries(planningStatusLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCloseEditor}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded bg-brand-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-brand-accent"
              >
                {submitLabel("Crear macrociclo", "Guardar cambios")}
              </button>
            </div>
          </form>
        );
      case "mesocycle":
        return (
          <form
            onSubmit={handleMesocycleSubmit}
            className="flex flex-col gap-4 p-4 text-sm"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nombre
                </span>
                <input
                  required
                  value={mesoForm.name}
                  onChange={(event) =>
                    setMesoForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Fase de acumulación"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Orden
                </span>
                <input
                  type="number"
                  value={mesoForm.order_index}
                  onChange={(event) =>
                    setMesoForm((prev) => ({
                      ...prev,
                      order_index: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline:none focus:ring-2 focus:ring-brand-primary/40"
                  min={0}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Inicio
                </span>
                <input
                  type="date"
                  required
                  value={mesoForm.start_date}
                  onChange={(event) =>
                    setMesoForm((prev) => ({
                      ...prev,
                      start_date: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline:none focus:ring-2 focus:ring-brand-primary/40"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fin
                </span>
                <input
                  type="date"
                  required
                  value={mesoForm.end_date}
                  onChange={(event) =>
                    setMesoForm((prev) => ({
                      ...prev,
                      end_date: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline:none focus:ring-2 focus:ring-brand-primary/40"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fase
                </span>
                <input
                  value={mesoForm.phase}
                  onChange={(event) =>
                    setMesoForm((prev) => ({
                      ...prev,
                      phase: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline:none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Acumulación, intensificación, taper..."
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Enfoque
                </span>
                <input
                  value={mesoForm.focus}
                  onChange={(event) =>
                    setMesoForm((prev) => ({
                      ...prev,
                      focus: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline:none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Fuerza máxima, potencia..."
                />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Objetivo
                </span>
                <input
                  value={mesoForm.goal}
                  onChange={(event) =>
                    setMesoForm((prev) => ({
                      ...prev,
                      goal: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline:none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Metas específicas de la fase"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </span>
                <select
                  value={mesoForm.status}
                  onChange={(event) =>
                    setMesoForm((prev) => ({
                      ...prev,
                      status: event.target.value as PlanningStatus,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline:none focus:ring-2 focus:ring-brand-primary/40"
                >
                  {Object.entries(planningStatusLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCloseEditor}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded bg-brand-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-brand-accent"
              >
                {submitLabel("Crear mesociclo", "Guardar cambios")}
              </button>
            </div>
          </form>
        );
      case "microcycle":
        return (
          <form
            onSubmit={handleMicrocycleSubmit}
            className="flex flex-col gap-4 p-4 text-sm"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nombre
                </span>
                <input
                  required
                  value={microForm.name}
                  onChange={(event) =>
                    setMicroForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Semana 1 - Base"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Semana
                </span>
                <input
                  type="number"
                  min={1}
                  required
                  value={microForm.week_number}
                  onChange={(event) =>
                    setMicroForm((prev) => ({
                      ...prev,
                      week_number: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Inicio (opcional)
                </span>
                <input
                  type="date"
                  value={microForm.start_date}
                  onChange={(event) =>
                    setMicroForm((prev) => ({
                      ...prev,
                      start_date: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fin (opcional)
                </span>
                <input
                  type="date"
                  value={microForm.end_date}
                  onChange={(event) =>
                    setMicroForm((prev) => ({
                      ...prev,
                      end_date: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Enfoque
                </span>
                <input
                  value={microForm.focus}
                  onChange={(event) =>
                    setMicroForm((prev) => ({
                      ...prev,
                      focus: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Volumen, técnica, recuperación..."
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Carga
                </span>
                <input
                  value={microForm.load}
                  onChange={(event) =>
                    setMicroForm((prev) => ({
                      ...prev,
                      load: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Alta, media, baja..."
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </span>
                <select
                  value={microForm.status}
                  onChange={(event) =>
                    setMicroForm((prev) => ({
                      ...prev,
                      status: event.target.value as PlanningStatus,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                >
                  {Object.entries(planningStatusLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCloseEditor}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded bg-brand-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-brand-accent"
              >
                {submitLabel("Crear microciclo", "Guardar cambios")}
              </button>
            </div>
          </form>
        );
      case "session":
        return (
          <form
            onSubmit={handleSessionSubmit}
            className="flex flex-col gap-4 p-4 text-sm"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Título (opcional)
                </span>
                <input
                  value={sessionForm.name}
                  onChange={(event) =>
                    setSessionForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Sesión de fuerza A"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fecha
                </span>
                <input
                  type="date"
                  required
                  value={sessionForm.date}
                  onChange={(event) =>
                    setSessionForm((prev) => ({
                      ...prev,
                      date: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Entrenamiento asignado
                </span>
                <select
                  required
                  value={sessionForm.session_type}
                  onChange={(event) =>
                    setSessionForm((prev) => ({
                      ...prev,
                      session_type: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                >
                  <option value="">Selecciona un entrenamiento</option>
                  {trainingSheets.map((sheet) => (
                    <option key={sheet} value={sheet}>
                      {sheet}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Responsable
                </span>
                <select
                  value={sessionForm.trainer_id}
                  onChange={(event) =>
                    setSessionForm((prev) => ({
                      ...prev,
                      trainer_id: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                >
                  <option value="">Sin asignar</option>
                  {trainers.map((trainer) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Orden
                </span>
                <input
                  type="number"
                  min={0}
                  value={sessionForm.order_index}
                  onChange={(event) =>
                    setSessionForm((prev) => ({
                      ...prev,
                      order_index: event.target.value,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </span>
                <select
                  value={sessionForm.status}
                  onChange={(event) =>
                    setSessionForm((prev) => ({
                      ...prev,
                      status: event.target.value as SessionStatus,
                    }))
                  }
                  className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                >
                  {Object.entries(sessionStatusLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Notas
                </span>
                <textarea
                  value={sessionForm.notes}
                  onChange={(event) =>
                    setSessionForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  className="min-h-[80px] rounded border border-slate-300 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Indicaciones para atletas, recordatorios logísticos o métricas a controlar"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCloseEditor}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded bg-brand-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-brand-accent"
              >
                {submitLabel("Crear sesión", "Guardar cambios")}
              </button>
            </div>
          </form>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <section className="relative flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-900">
            Planificación deportiva
          </h2>
          <p className="text-sm text-slate-600">
            Estructura la temporada replicando la lógica del Excel. Duplica,
            reordena y personaliza cada nivel con un flujo móvil y desktop.
          </p>
          {feedback ? (
            <span className="text-xs font-medium text-brand-primary/90">
              {feedback}
            </span>
          ) : null}
        </header>

        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-4 xl:gap-5">
          <section className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
            <header className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Temporadas
                </span>
                <h3 className="text-base font-semibold text-slate-900">
                  Macrociclos
                </h3>
              </div>
              <button
                type="button"
                onClick={openCreateMacrocycle}
                className="rounded-full border border-dashed border-brand-primary/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-primary transition hover:bg-brand-primary/10"
              >
                + Nuevo
              </button>
            </header>
            <p className="text-xs text-slate-500">
              {macrocycles.length
                ? `${macrocycles.length} temporadas configuradas`
                : "Configura objetivos anuales con la misma flexibilidad que en el Excel."}
            </p>
            <ul className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {macrocycleSummary.length === 0 ? (
                <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
                  Aún no hay macrociclos. Crea el primero para comenzar.
                </li>
              ) : (
                macrocycleSummary.map((macrocycle) => {
                  const isSelected = macrocycle.id === selectedMacrocycleId;
                  return (
                    <li key={macrocycle.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectMacrocycle(macrocycle.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleSelectMacrocycle(macrocycle.id);
                          }
                        }}
                        className={`flex flex-col gap-2 rounded-xl border bg-white p-4 text-sm shadow-sm transition ${
                          isSelected
                            ? "border-brand-primary/60 ring-2 ring-brand-primary/20"
                            : "border-slate-200 hover:border-brand-primary/40 hover:shadow-md"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="text-base font-semibold text-slate-900">
                              {macrocycle.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {macrocycle.duration}
                              {macrocycle.season
                                ? ` · ${macrocycle.season}`
                                : ""}
                            </span>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              planningStatusStyle[macrocycle.status]
                            }`}
                          >
                            {planningStatusLabel[macrocycle.status]}
                          </span>
                        </div>
                        {macrocycle.goal ? (
                          <p className="text-xs text-slate-600">
                            Meta: {macrocycle.goal}
                          </p>
                        ) : null}
                        {macrocycle.notes ? (
                          <p className="text-xs text-slate-500 line-clamp-2">
                            {macrocycle.notes}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap justify-end gap-2 pt-2 text-xs">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openCreateMacrocycle();
                              setMacroForm({
                                name: macrocycle.name,
                                season: macrocycle.season ?? "",
                                start_date: macrocycle.start_date,
                                end_date: macrocycle.end_date,
                                goal: macrocycle.goal ?? "",
                                notes: macrocycle.notes ?? "",
                                status: macrocycle.status,
                              });
                              setEditingMacroId(macrocycle.id);
                              setEditor({ type: "macrocycle", mode: "edit" });
                            }}
                            className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation();
                              await duplicateMacrocycle(macrocycle);
                            }}
                            className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation();
                              if (
                                window.confirm(
                                  "¿Eliminar este macrociclo y todo su contenido?"
                                )
                              ) {
                                try {
                                  await deleteMacrocycle(macrocycle.id);
                                  if (selectedMacrocycleId === macrocycle.id) {
                                    setSelectedMacrocycleId(null);
                                    setSelectedMesocycleId(null);
                                    setSelectedMicrocycleId(null);
                                  }
                                  await Promise.all([
                                    refreshMacrocycles(),
                                    refreshMesocycles(),
                                    refreshMicrocycles(),
                                    refreshSessions(),
                                  ]);
                                  setFeedback("Macrociclo eliminado.");
                                } catch (error) {
                                  console.error(error);
                                  setFeedback(
                                    error instanceof Error
                                      ? error.message
                                      : "No se pudo eliminar el macrociclo."
                                  );
                                }
                              }
                            }}
                            className="rounded border border-rose-200 px-3 py-1 font-medium text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
            <header className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Fases
                </span>
                <h3 className="text-base font-semibold text-slate-900">
                  Mesociclos
                </h3>
              </div>
              <button
                type="button"
                onClick={openCreateMesocycle}
                disabled={!selectedMacrocycleId}
                className={`rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  selectedMacrocycleId
                    ? "border-brand-primary/60 text-brand-primary hover:bg-brand-primary/10"
                    : "cursor-not-allowed border-slate-200 text-slate-400"
                }`}
              >
                + Nuevo
              </button>
            </header>
            <p className="text-xs text-slate-500">
              {selectedMacrocycle
                ? `Organiza las fases de ${selectedMacrocycle.name}.`
                : "Selecciona un macrociclo para detallar sus fases intermedias."}
            </p>
            <ul className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {!selectedMacrocycleId ? (
                <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
                  Selecciona un macrociclo para ver y crear sus mesociclos.
                </li>
              ) : mesocycleSummary.length === 0 ? (
                <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
                  Aún no hay mesociclos. Añade fases para estructurar la
                  temporada.
                </li>
              ) : (
                mesocycleSummary.map((mesocycle) => {
                  const isSelected = mesocycle.id === selectedMesocycleId;
                  return (
                    <li key={mesocycle.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectMesocycle(mesocycle.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleSelectMesocycle(mesocycle.id);
                          }
                        }}
                        className={`flex flex-col gap-2 rounded-xl border bg-white p-4 text-sm shadow-sm transition ${
                          isSelected
                            ? "border-brand-primary/60 ring-2 ring-brand-primary/20"
                            : "border-slate-200 hover:border-brand-primary/40 hover:shadow-md"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="text-base font-semibold text-slate-900">
                              {mesocycle.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {mesocycle.duration}
                              {typeof mesocycle.order_index === "number"
                                ? ` · Orden ${mesocycle.order_index}`
                                : ""}
                            </span>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              planningStatusStyle[mesocycle.status]
                            }`}
                          >
                            {planningStatusLabel[mesocycle.status]}
                          </span>
                        </div>
                        {mesocycle.goal ? (
                          <p className="text-xs text-slate-600">
                            Objetivo: {mesocycle.goal}
                          </p>
                        ) : null}
                        {mesocycle.focus ? (
                          <p className="text-xs text-slate-500">
                            Enfoque: {mesocycle.focus}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap justify-end gap-2 pt-2 text-xs">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingMesocycleId(mesocycle.id);
                              if (mesocycle.macrocycle_id) {
                                setSelectedMacrocycleId(
                                  mesocycle.macrocycle_id
                                );
                              }
                              setSelectedMesocycleId(mesocycle.id);
                              setMesoForm({
                                name: mesocycle.name,
                                start_date: mesocycle.start_date,
                                end_date: mesocycle.end_date,
                                phase: mesocycle.phase ?? "",
                                focus: mesocycle.focus ?? "",
                                goal: mesocycle.goal ?? "",
                                order_index: String(mesocycle.order_index ?? 0),
                                status: mesocycle.status,
                              });
                              setEditor({ type: "mesocycle", mode: "edit" });
                            }}
                            className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation();
                              await duplicateMesocycle(mesocycle);
                            }}
                            className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation();
                              if (
                                window.confirm(
                                  "¿Eliminar este mesociclo y sus microciclos?"
                                )
                              ) {
                                try {
                                  await deleteMesocycle(mesocycle.id);
                                  if (selectedMesocycleId === mesocycle.id) {
                                    setSelectedMesocycleId(null);
                                    setSelectedMicrocycleId(null);
                                  }
                                  await Promise.all([
                                    refreshMesocycles(),
                                    refreshMicrocycles(),
                                    refreshSessions(),
                                  ]);
                                  setFeedback("Mesociclo eliminado.");
                                } catch (error) {
                                  console.error(error);
                                  setFeedback(
                                    error instanceof Error
                                      ? error.message
                                      : "No se pudo eliminar el mesociclo."
                                  );
                                }
                              }
                            }}
                            className="rounded border border-rose-200 px-3 py-1 font-medium text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
            <header className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Microciclos
                </span>
                <h3 className="text-base font-semibold text-slate-900">
                  Semanas clave
                </h3>
              </div>
              <button
                type="button"
                onClick={openCreateMicrocycle}
                disabled={!selectedMesocycleId}
                className={`rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  selectedMesocycleId
                    ? "border-brand-primary/60 text-brand-primary hover:bg-brand-primary/10"
                    : "cursor-not-allowed border-slate-200 text-slate-400"
                }`}
              >
                + Nuevo
              </button>
            </header>
            <p className="text-xs text-slate-500">
              {selectedMesocycle
                ? `Detalla la planificación semanal dentro de ${selectedMesocycle.name}.`
                : "Selecciona un mesociclo para gestionar sus microciclos."}
            </p>
            <ul className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {!selectedMesocycleId ? (
                <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
                  Selecciona un mesociclo para ver sus microciclos.
                </li>
              ) : microcycles.length === 0 ? (
                <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
                  Añade microciclos semanales para reflejar el Excel.
                </li>
              ) : (
                microcycles.map((microcycle) => {
                  const isSelected = microcycle.id === selectedMicrocycleId;
                  return (
                    <li key={microcycle.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectMicrocycle(microcycle.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleSelectMicrocycle(microcycle.id);
                          }
                        }}
                        className={`flex flex-col gap-2 rounded-xl border bg-white p-4 text-sm shadow-sm transition ${
                          isSelected
                            ? "border-brand-primary/60 ring-2 ring-brand-primary/20"
                            : "border-slate-200 hover:border-brand-primary/40 hover:shadow-md"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="text-base font-semibold text-slate-900">
                              {microcycle.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              Semana {microcycle.week_number}
                            </span>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              planningStatusStyle[microcycle.status]
                            }`}
                          >
                            {planningStatusLabel[microcycle.status]}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          {microcycle.focus ? (
                            <span>· {microcycle.focus}</span>
                          ) : null}
                          {microcycle.load ? (
                            <span>· Carga {microcycle.load}</span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 pt-2 text-xs">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              startMicrocycleEdit(microcycle);
                            }}
                            className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation();
                              await duplicateMicrocycle(microcycle);
                            }}
                            className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation();
                              if (
                                window.confirm(
                                  "¿Eliminar este microciclo y las sesiones asociadas?"
                                )
                              ) {
                                try {
                                  await deleteMicrocycle(microcycle.id);
                                  if (selectedMicrocycleId === microcycle.id) {
                                    setSelectedMicrocycleId(null);
                                  }
                                  await Promise.all([
                                    refreshMicrocycles(),
                                    refreshSessions(),
                                  ]);
                                  setFeedback("Microciclo eliminado.");
                                } catch (error) {
                                  console.error(error);
                                  setFeedback(
                                    error instanceof Error
                                      ? error.message
                                      : "No se pudo eliminar el microciclo."
                                  );
                                }
                              }
                            }}
                            className="rounded border border-rose-200 px-3 py-1 font-medium text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
            <header className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {sessionScopeLabel}
                </span>
                <h3 className="text-base font-semibold text-slate-900">
                  Sesiones
                </h3>
              </div>
              <button
                type="button"
                onClick={openCreateSession}
                disabled={!selectedMacrocycleId}
                className={`rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  selectedMacrocycleId
                    ? "border-brand-primary/60 text-brand-primary hover:bg-brand-primary/10"
                    : "cursor-not-allowed border-slate-200 text-slate-400"
                }`}
              >
                + Nueva
              </button>
            </header>
            <p className="text-xs text-slate-500">
              {selectedMacrocycle
                ? "Programa entrenamientos específicos y alínea al staff incluso offline."
                : "Selecciona al menos un macrociclo para planificar sesiones."}
            </p>
            <ul className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {!selectedMacrocycleId ? (
                <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
                  Selecciona un macrociclo o microciclo para ver las sesiones
                  asociadas.
                </li>
              ) : sessions.length === 0 ? (
                <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
                  No hay sesiones registradas para esta selección.
                </li>
              ) : (
                sessions.map((session) => (
                  <li key={session.id}>
                    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm transition hover:border-brand-primary/40 hover:shadow-md">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-base font-semibold text-slate-900">
                            {session.name || session.session_type}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatWeekdayDate(session.date)}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            sessionStatusStyle[session.status]
                          }`}
                        >
                          {sessionStatusLabel[session.status]}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {session.microcycle_id
                          ? "Microciclo asignado"
                          : session.mesocycle_id
                          ? "Mesociclo general"
                          : "Macrociclo general"}
                        {session.trainer_id
                          ? (() => {
                              const trainer = trainers.find(
                                (item) => item.id === session.trainer_id
                              );
                              return trainer
                                ? `· Coach: ${trainer.name}`
                                : null;
                            })()
                          : null}
                        <span>· Plan: {session.session_type}</span>
                      </div>
                      {session.notes ? (
                        <p className="text-xs text-slate-600">
                          {session.notes}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap justify-end gap-2 pt-2 text-xs">
                        <button
                          type="button"
                          onClick={() => startSessionEdit(session)}
                          className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await duplicateSession(session);
                          }}
                          className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              window.confirm(
                                "¿Eliminar esta sesión programada?"
                              )
                            ) {
                              try {
                                await deleteSessionPlan(session.id);
                                if (editingSessionId === session.id) {
                                  resetSessionForm();
                                }
                                await refreshSessions();
                                setFeedback("Sesión eliminada.");
                              } catch (error) {
                                console.error(error);
                                setFeedback(
                                  error instanceof Error
                                    ? error.message
                                    : "No se pudo eliminar la sesión."
                                );
                              }
                            }
                          }}
                          className="rounded border border-rose-200 px-3 py-1 font-medium text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </section>

      {renderEditorForm()}
    </>
  );
}
