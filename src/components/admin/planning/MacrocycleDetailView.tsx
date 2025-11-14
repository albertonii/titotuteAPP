"use client";

import { useState, useCallback, useEffect } from "react";
import type { Macrocycle, Mesocycle, Microcycle, Session } from "@/lib/db-local/db";
import {
  listMesocyclesByMacrocycle,
  listMicrocyclesByMesocycle,
  listSessionsByMacrocycle,
  listSessionsByMesocycle,
  listSessionsByMicrocycle,
} from "@/lib/services/planning";
import { planningStatusLabel, planningStatusStyle } from "./planningConstants";
import { MacrocycleForm } from "./MacrocycleForm";
import { MesocycleForm } from "./MesocycleForm";
import { MicrocycleForm } from "./MicrocycleForm";
import { SessionForm } from "./SessionForm";
import { PlanningModal } from "./PlanningModal";
import { SessionDetailView } from "./SessionDetailView";
import type {
  MacrocycleFormState,
  MesocycleFormState,
  MicrocycleFormState,
  SessionFormState,
} from "./planningTypes";
import {
  createMesocycle,
  createMicrocycle,
  createSessionPlan,
  updateMesocycle,
  updateMicrocycle,
  updateSessionPlan,
} from "@/lib/services/planning";
import { sessionStatusLabel } from "./planningConstants";

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

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const formatShortDate = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return SHORT_DATE_FORMATTER.format(date);
};

interface MacrocycleDetailViewProps {
  macrocycle: Macrocycle;
  onBack: () => void;
  onUpdate: () => void;
  onCreateMesocycle: (input: MesocycleFormState) => Promise<void>;
  onUpdateMesocycle: (id: string, input: MesocycleFormState) => Promise<void>;
  onDeleteMesocycle: (id: string) => Promise<void>;
  onDuplicateMesocycle: (id: string) => Promise<void>;
  onCreateMicrocycle: (input: MicrocycleFormState) => Promise<void>;
  onUpdateMicrocycle: (id: string, input: MicrocycleFormState) => Promise<void>;
  onDeleteMicrocycle: (id: string) => Promise<void>;
  onDuplicateMicrocycle: (id: string) => Promise<void>;
  onCreateSession: (input: SessionFormState) => Promise<void>;
  onUpdateSession: (id: string, input: SessionFormState) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onDuplicateSession: (id: string) => Promise<void>;
  onUpdateMacrocycle: (id: string, input: MacrocycleFormState) => Promise<void>;
  trainers: Array<{ id: string; name: string }>;
  trainingSheets: string[];
}

export function MacrocycleDetailView({
  macrocycle,
  onBack,
  onUpdate,
  onCreateMesocycle,
  onUpdateMesocycle,
  onDeleteMesocycle,
  onDuplicateMesocycle,
  onCreateMicrocycle,
  onUpdateMicrocycle,
  onDeleteMicrocycle,
  onDuplicateMicrocycle,
  onCreateSession,
  onUpdateSession,
  onDeleteSession,
  onDuplicateSession,
  onUpdateMacrocycle,
  trainers,
  trainingSheets,
}: MacrocycleDetailViewProps) {
  const [mesocycles, setMesocycles] = useState<Mesocycle[]>([]);
  const [microcycles, setMicrocycles] = useState<Microcycle[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedMesocycleId, setSelectedMesocycleId] = useState<string | null>(null);
  const [selectedMicrocycleId, setSelectedMicrocycleId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [editor, setEditor] = useState<"macrocycle" | "mesocycle" | "microcycle" | "session" | "session-detail" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    const [mesos, micros, sess] = await Promise.all([
      listMesocyclesByMacrocycle(macrocycle.id),
      selectedMesocycleId ? listMicrocyclesByMesocycle(selectedMesocycleId) : Promise.resolve([]),
      selectedMicrocycleId
        ? listSessionsByMicrocycle(selectedMicrocycleId)
        : selectedMesocycleId
        ? listSessionsByMesocycle(selectedMesocycleId)
        : listSessionsByMacrocycle(macrocycle.id),
    ]);
    setMesocycles(mesos);
    setMicrocycles(micros);
    setSessions(sess);
  }, [macrocycle.id, selectedMesocycleId, selectedMicrocycleId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleEditMacrocycle = () => {
    setEditor("macrocycle");
    setEditingId(macrocycle.id);
  };

  const handleEditMesocycle = (mesocycle: Mesocycle) => {
    setEditor("mesocycle");
    setEditingId(mesocycle.id);
  };

  const handleEditMicrocycle = (microcycle: Microcycle) => {
    setEditor("microcycle");
    setEditingId(microcycle.id);
  };

  const handleEditSession = (session: Session) => {
    setEditor("session");
    setEditingId(session.id);
  };

  const handleViewSessionDetail = (session: Session) => {
    setSelectedSessionId(session.id);
    setEditor("session-detail");
  };

  const selectedMesocycle = mesocycles.find((m) => m.id === selectedMesocycleId);
  const selectedMicrocycle = microcycles.find((m) => m.id === selectedMicrocycleId);
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header con información del macrociclo */}
        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="rounded border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                ← Volver
              </button>
              <h2 className="text-2xl font-semibold text-slate-900">
                {macrocycle.name}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  planningStatusStyle[macrocycle.status]
                }`}
              >
                {planningStatusLabel[macrocycle.status]}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
              <div>
                <span className="font-medium">Período:</span>{" "}
                {formatShortDate(macrocycle.start_date)} -{" "}
                {formatShortDate(macrocycle.end_date)}
              </div>
              {macrocycle.season && (
                <div>
                  <span className="font-medium">Temporada:</span> {macrocycle.season}
                </div>
              )}
              {macrocycle.goal && (
                <div>
                  <span className="font-medium">Objetivo:</span> {macrocycle.goal}
                </div>
              )}
            </div>
            {macrocycle.notes && (
              <p className="mt-3 text-sm text-slate-600">{macrocycle.notes}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleEditMacrocycle}
            className="rounded border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Editar Macrociclo
          </button>
        </div>

        {/* Mesociclos */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Mesociclos</h3>
            <button
              type="button"
              onClick={() => {
                setMesoForm({
                  ...DEFAULT_MESOCYCLE_FORM,
                  order_index: String(mesocycles.length + 1),
                });
                setEditor("mesocycle");
                setEditingId(null);
              }}
              className="rounded bg-brand-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-accent"
            >
              + Nuevo Mesociclo
            </button>
          </div>
          {mesocycles.length === 0 ? (
            <p className="text-sm text-slate-500">No hay mesociclos creados.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {mesocycles.map((meso) => (
                <div
                  key={meso.id}
                  className={`rounded-lg border p-4 transition ${
                    selectedMesocycleId === meso.id
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{meso.name}</h4>
                      <p className="text-xs text-slate-500">
                        {formatShortDate(meso.start_date)} -{" "}
                        {formatShortDate(meso.end_date)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMesocycleId(
                          selectedMesocycleId === meso.id ? null : meso.id
                        )
                      }
                      className="ml-2 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      {selectedMesocycleId === meso.id ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditMesocycle(meso)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateMesocycle(meso.id)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMesocycle(meso.id)}
                      className="rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Microciclos (si hay mesociclo seleccionado) */}
        {selectedMesocycleId && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Microciclos {selectedMesocycle && `- ${selectedMesocycle.name}`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (!selectedMesocycleId) return;
                  setMicroForm({
                    ...DEFAULT_MICROCYCLE_FORM,
                    week_number: String(microcycles.length + 1),
                  });
                  setEditor("microcycle");
                  setEditingId(null);
                }}
                className="rounded bg-brand-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-accent"
              >
                + Nuevo Microciclo
              </button>
            </div>
            {microcycles.length === 0 ? (
              <p className="text-sm text-slate-500">No hay microciclos creados.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {microcycles.map((micro) => (
                  <div
                    key={micro.id}
                    className={`rounded-lg border p-3 transition ${
                      selectedMicrocycleId === micro.id
                        ? "border-brand-primary bg-brand-primary/5"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{micro.name}</h4>
                        <p className="text-xs text-slate-500">
                          Semana {micro.week_number}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedMicrocycleId(
                            selectedMicrocycleId === micro.id ? null : micro.id
                          )
                        }
                        className="ml-2 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        {selectedMicrocycleId === micro.id ? "Ocultar" : "Ver"}
                      </button>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditMicrocycle(micro)}
                        className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateMicrocycle(micro.id)}
                        className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Duplicar
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMicrocycle(micro.id)}
                        className="rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Sesiones */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Sesiones
              {selectedMicrocycle && ` - ${selectedMicrocycle.name}`}
              {selectedMesocycle && !selectedMicrocycle && ` - ${selectedMesocycle.name}`}
            </h3>
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                setSessionForm({
                  ...DEFAULT_SESSION_FORM,
                  date: today,
                  order_index: String(sessions.length + 1),
                });
                setEditor("session");
                setEditingId(null);
              }}
              className="rounded bg-brand-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-accent"
            >
              + Nueva Sesión
            </button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500">No hay sesiones creadas.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <h4 className="font-semibold text-slate-900">
                    {session.name || session.session_type}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatShortDate(session.date)} · {session.session_type}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewSessionDetail(session)}
                      className="flex-1 rounded border border-brand-primary bg-brand-primary/10 px-2 py-1 text-xs font-medium text-brand-primary hover:bg-brand-primary/20"
                    >
                      Ver Detalles
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditSession(session)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateSession(session.id)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSession(session.id)}
                      className="rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modales de edición */}
      {editor === "macrocycle" && editingId === macrocycle.id && (
        <PlanningModal
          open={true}
          title="Editar Macrociclo"
          subtitle={macrocycle.name}
          onClose={() => {
            setEditor(null);
            setEditingId(null);
          }}
        >
          <MacrocycleForm
            form={{
              name: macrocycle.name,
              season: macrocycle.season ?? "",
              start_date: macrocycle.start_date,
              end_date: macrocycle.end_date,
              goal: macrocycle.goal ?? "",
              notes: macrocycle.notes ?? "",
              status: macrocycle.status,
            }}
            onChange={() => {}}
            onSubmit={async (form) => {
              await onUpdateMacrocycle(macrocycle.id, form);
              setEditor(null);
              setEditingId(null);
              onUpdate();
            }}
            onCancel={() => {
              setEditor(null);
              setEditingId(null);
            }}
            mode="edit"
            statusLabel={planningStatusLabel}
          />
        </PlanningModal>
      )}

      {/* Modal de mesociclo */}
      {editor === "mesocycle" && (
        <PlanningModal
          open={true}
          title={editingId ? "Editar Mesociclo" : "Nuevo Mesociclo"}
          subtitle={editingId ? mesocycles.find((m) => m.id === editingId)?.name : ""}
          onClose={() => {
            setEditor(null);
            setEditingId(null);
            setMesoForm(DEFAULT_MESOCYCLE_FORM);
          }}
        >
          <MesocycleForm
            form={mesoForm}
            onChange={setMesoForm}
            onSubmit={async (form) => {
              if (editingId) {
                await onUpdateMesocycle(editingId, form);
              } else {
                await onCreateMesocycle(form);
              }
              setEditor(null);
              setEditingId(null);
              setMesoForm(DEFAULT_MESOCYCLE_FORM);
              refreshData();
              onUpdate();
            }}
            onCancel={() => {
              setEditor(null);
              setEditingId(null);
              setMesoForm(DEFAULT_MESOCYCLE_FORM);
            }}
            mode={editingId ? "edit" : "create"}
            statusLabel={planningStatusLabel}
          />
        </PlanningModal>
      )}

      {/* Modal de microciclo */}
      {editor === "microcycle" && selectedMesocycleId && (
        <PlanningModal
          open={true}
          title={editingId ? "Editar Microciclo" : "Nuevo Microciclo"}
          subtitle={editingId ? microcycles.find((m) => m.id === editingId)?.name : ""}
          onClose={() => {
            setEditor(null);
            setEditingId(null);
            setMicroForm(DEFAULT_MICROCYCLE_FORM);
          }}
        >
          <MicrocycleForm
            form={microForm}
            onChange={setMicroForm}
            onSubmit={async (form) => {
              if (editingId) {
                await onUpdateMicrocycle(editingId, form);
              } else {
                if (!selectedMesocycleId) return;
                await createMicrocycle({
                  mesocycle_id: selectedMesocycleId,
                  name: form.name.trim(),
                  week_number: Number(form.week_number) || 1,
                  start_date: form.start_date || undefined,
                  end_date: form.end_date || undefined,
                  focus: form.focus.trim() || undefined,
                  load: form.load.trim() || undefined,
                  status: form.status,
                });
              }
              setEditor(null);
              setEditingId(null);
              setMicroForm(DEFAULT_MICROCYCLE_FORM);
              refreshData();
              onUpdate();
            }}
            onCancel={() => {
              setEditor(null);
              setEditingId(null);
              setMicroForm(DEFAULT_MICROCYCLE_FORM);
            }}
            mode={editingId ? "edit" : "create"}
            statusLabel={planningStatusLabel}
          />
        </PlanningModal>
      )}

      {/* Modal de sesión */}
      {editor === "session" && (
        <PlanningModal
          open={true}
          title={editingId ? "Editar Sesión" : "Nueva Sesión"}
          subtitle={editingId ? sessions.find((s) => s.id === editingId)?.name || "" : ""}
          onClose={() => {
            setEditor(null);
            setEditingId(null);
            setSessionForm(DEFAULT_SESSION_FORM);
          }}
        >
          <SessionForm
            form={sessionForm}
            onChange={setSessionForm}
            onSubmit={async (form) => {
              if (editingId) {
                await onUpdateSession(editingId, form);
              } else {
                await createSessionPlan({
                  macrocycle_id: macrocycle.id,
                  mesocycle_id: selectedMesocycleId || undefined,
                  microcycle_id: selectedMicrocycleId || undefined,
                  trainer_id: form.trainer_id || undefined,
                  name: form.name.trim() || undefined,
                  date: form.date,
                  session_type: form.session_type.trim(),
                  order_index: Number(form.order_index) || 0,
                  status: form.status,
                  notes: form.notes.trim() || undefined,
                });
              }
              setEditor(null);
              setEditingId(null);
              setSessionForm(DEFAULT_SESSION_FORM);
              refreshData();
              onUpdate();
            }}
            onCancel={() => {
              setEditor(null);
              setEditingId(null);
              setSessionForm(DEFAULT_SESSION_FORM);
            }}
            mode={editingId ? "edit" : "create"}
            statusLabel={sessionStatusLabel}
            trainers={trainers}
            trainingSheets={trainingSheets}
          />
        </PlanningModal>
      )}

      {editor === "session-detail" && selectedSession && (
        <SessionDetailView
          session={selectedSession}
          onClose={() => {
            setEditor(null);
            setSelectedSessionId(null);
            refreshData();
          }}
          trainers={trainers}
          trainingSheets={trainingSheets}
        />
      )}
    </>
  );
}

