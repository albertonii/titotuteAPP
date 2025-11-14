"use client";

import { FormEvent, useCallback, useEffect, useImperativeHandle, useMemo, useState, forwardRef } from "react";
import {
  db,
  type Macrocycle,
  type Mesocycle,
  type Microcycle,
  type Session,
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
import { MacrocycleColumn } from "./MacrocycleColumn";
import { MesocycleColumn } from "./MesocycleColumn";
import { MicrocycleColumn } from "./MicrocycleColumn";
import { SessionsColumn } from "./SessionsColumn";
import { PlanningModal } from "./PlanningModal";
import { MacrocycleForm } from "./MacrocycleForm";
import { MesocycleForm } from "./MesocycleForm";
import { MicrocycleForm } from "./MicrocycleForm";
import { SessionForm } from "./SessionForm";
import {
  MacrocycleFormState,
  MesocycleFormState,
  MicrocycleFormState,
  SessionFormState,
  EditorState,
  MacrocycleSummary,
  MesocycleSummary,
} from "./planningTypes";
import {
  planningStatusLabel,
  planningStatusStyle,
  sessionStatusLabel,
  sessionStatusStyle,
} from "./planningConstants";

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

export interface AdminPlanningManagerRef {
  editMacrocycle: (macrocycle: Macrocycle) => void;
}

export const AdminPlanningManager = forwardRef<AdminPlanningManagerRef, {}>((props, ref) => {
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

  const startMacroEdit = useCallback((macrocycle: Macrocycle) => {
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
  }, []);

  useImperativeHandle(ref, () => ({
    editMacrocycle: startMacroEdit,
  }));

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

  const handleMacroDelete = async (macrocycle: Macrocycle) => {
    if (
      !window.confirm("¿Eliminar este macrociclo y todo su contenido asociado?")
    ) {
      return;
    }
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
  };

  const handleMesocycleDelete = async (mesocycle: Mesocycle) => {
    if (
      !window.confirm("¿Eliminar este mesociclo y sus microciclos asociados?")
    ) {
      return;
    }
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
  };

  const handleMicrocycleDelete = async (microcycle: Microcycle) => {
    if (
      !window.confirm("¿Eliminar este microciclo y las sesiones asociadas?")
    ) {
      return;
    }
    try {
      await deleteMicrocycle(microcycle.id);
      if (selectedMicrocycleId === microcycle.id) {
        setSelectedMicrocycleId(null);
      }
      await Promise.all([refreshMicrocycles(), refreshSessions()]);
      setFeedback("Microciclo eliminado.");
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el microciclo."
      );
    }
  };

  const handleSessionDelete = async (session: Session) => {
    if (!window.confirm("¿Eliminar esta sesión programada?")) {
      return;
    }
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

  const trainerNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    trainers.forEach((trainer) => {
      map[trainer.id] = trainer.name;
    });
    return map;
  }, [trainers]);

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

    switch (editor.type) {
      case "macrocycle":
        return (
          <MacrocycleForm
            form={macroForm}
            onChange={setMacroForm}
            onSubmit={handleMacroSubmit}
            onCancel={handleCloseEditor}
            mode={editor.mode}
            statusLabel={planningStatusLabel}
          />
        );
      case "mesocycle":
        return (
          <MesocycleForm
            form={mesoForm}
            onChange={setMesoForm}
            onSubmit={handleMesocycleSubmit}
            onCancel={handleCloseEditor}
            mode={editor.mode}
            statusLabel={planningStatusLabel}
          />
        );
      case "microcycle":
        return (
          <MicrocycleForm
            form={microForm}
            onChange={setMicroForm}
            onSubmit={handleMicrocycleSubmit}
            onCancel={handleCloseEditor}
            mode={editor.mode}
            statusLabel={planningStatusLabel}
          />
        );
      case "session":
        return (
          <SessionForm
            form={sessionForm}
            onChange={setSessionForm}
            onSubmit={handleSessionSubmit}
            onCancel={handleCloseEditor}
            mode={editor.mode}
            statusLabel={sessionStatusLabel}
            trainers={trainers}
            trainingSheets={trainingSheets}
          />
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
          <MacrocycleColumn
            macrocycles={macrocycleSummary}
            selectedId={selectedMacrocycleId}
            onCreate={openCreateMacrocycle}
            onSelect={handleSelectMacrocycle}
            onEdit={startMacroEdit}
            onDuplicate={duplicateMacrocycle}
            onDelete={handleMacroDelete}
            statusLabel={planningStatusLabel}
            statusStyle={planningStatusStyle}
          />

          <MesocycleColumn
            mesocycles={mesocycleSummary}
            selectedId={selectedMesocycleId}
            selectedMacrocycleName={selectedMacrocycle?.name ?? null}
            onCreate={openCreateMesocycle}
            onSelect={handleSelectMesocycle}
            onEdit={startMesocycleEdit}
            onDuplicate={duplicateMesocycle}
            onDelete={handleMesocycleDelete}
            statusLabel={planningStatusLabel}
            statusStyle={planningStatusStyle}
            isCreateDisabled={!selectedMacrocycleId}
          />

          <MicrocycleColumn
            microcycles={microcycles}
            selectedId={selectedMicrocycleId}
            selectedMesocycleName={selectedMesocycle?.name ?? null}
            onCreate={openCreateMicrocycle}
            onSelect={handleSelectMicrocycle}
            onEdit={startMicrocycleEdit}
            onDuplicate={duplicateMicrocycle}
            onDelete={handleMicrocycleDelete}
            statusLabel={planningStatusLabel}
            statusStyle={planningStatusStyle}
            isCreateDisabled={!selectedMesocycleId}
          />

          <SessionsColumn
            sessions={sessions}
            sessionScopeLabel={sessionScopeLabel}
            onCreate={openCreateSession}
            onEdit={startSessionEdit}
            onDuplicate={duplicateSession}
            onDelete={handleSessionDelete}
            statusLabel={sessionStatusLabel}
            statusStyle={sessionStatusStyle}
            isCreateDisabled={!selectedMacrocycleId}
            canViewSessions={Boolean(selectedMacrocycleId)}
            formatDate={formatWeekdayDate}
            trainerNamesById={trainerNamesById}
          />
        </div>
      </section>

      <PlanningModal
        open={isEditorOpen}
        title={editorTitle}
        subtitle={editorSubtitle}
        onClose={handleCloseEditor}
      >
        {renderEditorForm()}
      </PlanningModal>
    </>
  );
});

AdminPlanningManager.displayName = "AdminPlanningManager";
