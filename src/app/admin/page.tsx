"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { type User, type UserRole } from "@/lib/db-local/db";
import { useAuthGuard } from "@/lib/hooks/useAuthGuard";
import {
  createLocalUser,
  getPendingUserIds,
  listLocalUsers,
} from "@/lib/services/users";
import { useSyncStore } from "@/lib/state/sync";
import {
  getPendingCredentialMap,
  queueCredentialInvite,
} from "@/lib/sync/credentials";
import { AdminPlanningManager } from "@/components/admin/planning/AdminPlanningManager";
import { useAuthStore } from "@/lib/state/auth";

const roles: UserRole[] = ["trainer", "athlete", "nutritionist", "admin"];

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
});

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return TIMESTAMP_FORMATTER.format(date);
};

interface FormState {
  name: string;
  email: string;
  role: UserRole;
  height: string;
  birthdate: string;
  goal: string;
}

const DEFAULT_FORM: FormState = {
  name: "",
  email: "",
  role: "athlete",
  height: "",
  birthdate: "",
  goal: "",
};

export default function AdminPage() {
  useAuthGuard({ allowedRoles: ["admin", "trainer"] });
  const authUser = useAuthStore((state) => state.user);
  const isAdmin = authUser?.role === "admin";
  const [activeTab, setActiveTab] = useState<"planning" | "users">("planning");
  const [users, setUsers] = useState<User[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [pendingCredentials, setPendingCredentials] = useState<
    Map<
      string,
      {
        retries: number;
        last_error?: string;
      }
    >
  >(new Map());
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [status, setStatus] = useState<string>(
    "Registra integrantes y staff para sincronizar con Supabase."
  );
  const [loading, setLoading] = useState(false);
  const refreshQueueCount = useSyncStore((state) => state.refreshQueueCount);

  const loadData = async () => {
    const [list, pending, credentials] = await Promise.all([
      listLocalUsers(),
      getPendingUserIds(),
      getPendingCredentialMap(),
    ]);
    setUsers(list);
    setPendingIds(pending);
    setPendingCredentials(credentials);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const user = await createLocalUser({
        name: form.name,
        email: form.email,
        role: form.role,
        height: form.height ? Number(form.height) : undefined,
        birthdate: form.birthdate || undefined,
        goal: form.goal || undefined,
      });
      setStatus("Usuario guardado localmente. Procesando invitación…");

      if (navigator.onLine) {
        try {
          const response = await fetch("/api/admin/create-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              role: user.role,
              userId: user.id,
            }),
          });
          if (!response.ok) {
            throw new Error(
              (await response.json()).message ??
                "No se pudo invitar al usuario."
            );
          }
          setStatus(
            "Usuario listo. Se envió invitación para configurar acceso en Supabase."
          );
        } catch (error) {
          await queueCredentialInvite({
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          });
          setStatus(
            `Guardado offline. Invitación pendiente: ${
              error instanceof Error ? error.message : "Error desconocido"
            }`
          );
        }
      } else {
        await queueCredentialInvite({
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        });
        setStatus(
          "Sin conexión. Invitación a Supabase se enviará automáticamente al reconectar."
        );
      }

      setForm(DEFAULT_FORM);
      await loadData();
      await refreshQueueCount();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo crear el usuario.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  const groupedByRole = useMemo(() => {
    return roles.map((role) => ({
      role,
      users: users.filter((user) => user.role === role),
    }));
  }, [users]);

  useEffect(() => {
    if (!isAdmin && activeTab === "users") {
      setActiveTab("planning");
    }
  }, [activeTab, isAdmin]);

  const userManagementSection = (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-slate-900">
          Gestión de usuarios
        </h2>
        <p className="text-sm text-slate-600">
          Crea y sincroniza usuarios de manera local-first. Al volver la
          conexión, los registros se enviarán a Supabase.
        </p>
        <span className="text-xs text-brand-primary">{status}</span>
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1">
          <span>Nombre completo</span>
          <input
            required
            className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="Ej. Ana Pérez"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Email</span>
          <input
            type="email"
            required
            className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            value={form.email}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
            placeholder="ana@ejemplo.com"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Rol</span>
          <select
            className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            value={form.role}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                role: event.target.value as UserRole,
              }))
            }
          >
            {roles.map((role) => (
              <option key={role} value={role} className="capitalize">
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span>Altura (cm)</span>
          <input
            type="number"
            className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            value={form.height}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, height: event.target.value }))
            }
            placeholder="170"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Fecha de nacimiento</span>
          <input
            type="date"
            className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            value={form.birthdate}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, birthdate: event.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Objetivo</span>
          <input
            className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            value={form.goal}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, goal: event.target.value }))
            }
            placeholder="Ej. aumentar fuerza"
          />
        </label>
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-brand-primary px-4 py-2 font-semibold text-white transition hover:bg-brand-accent disabled:opacity-60"
          >
            {loading ? "Guardando…" : "Guardar usuario local"}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-4">
        {groupedByRole.map(({ role, users }) => (
          <div
            key={role}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold capitalize">{role}</h2>
              <span className="text-xs text-slate-500">
                {users.length} registrados
              </span>
            </header>
            <ul className="flex flex-col gap-3">
              {users.length === 0 ? (
                <li className="text-xs text-slate-400">
                  Sin usuarios en esta categoría.
                </li>
              ) : (
                users.map((user) => {
                  const pending = pendingIds.has(user.id);
                  const credential = pendingCredentials.get(user.id);
                  return (
                    <li
                      key={user.id}
                      className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">
                          {user.name}
                        </span>
                        <span className="text-slate-500">{user.email}</span>
                        <span className="text-slate-500">
                          Última actualización:{" "}
                          {formatTimestamp(user.updated_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.goal ? (
                          <span className="text-slate-500">
                            Meta: {user.goal}
                          </span>
                        ) : null}
                        {pending ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] text-amber-700">
                            Pendiente de sincronización
                          </span>
                        ) : (
                          <span className="rounded-full bg-brand-primary/10 px-2 py-1 text-[11px] text-brand-primary">
                            Sincronizado
                          </span>
                        )}
                        {credential ? (
                          <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] text-sky-700">
                            Invitación pendiente
                            {credential.last_error
                              ? ` · ${credential.last_error}`
                              : credential.retries > 0
                              ? ` · Reintentos: ${credential.retries}`
                              : ""}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ))}
      </section>
    </section>
  );

  return (
    <section className="flex flex-col gap-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-brand-primary">
          Panel de gestión
        </h1>
        <p className="text-sm text-slate-600">
          Administra el plan deportivo y los perfiles del staff con un enfoque
          offline-first.
        </p>
      </header>

      {isAdmin ? (
        <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1 text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab("planning")}
            className={`rounded-full px-3 py-1 transition ${
              activeTab === "planning"
                ? "bg-white text-slate-900 shadow-sm"
                : "hover:text-slate-900"
            }`}
          >
            Planificación
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`rounded-full px-3 py-1 transition ${
              activeTab === "users"
                ? "bg-white text-slate-900 shadow-sm"
                : "hover:text-slate-900"
            }`}
          >
            Usuarios
          </button>
        </div>
      ) : null}

      {activeTab === "planning" ? <AdminPlanningManager /> : null}
      {isAdmin && activeTab === "users" ? userManagementSection : null}
    </section>
  );
}
