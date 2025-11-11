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

const roles: UserRole[] = ["trainer", "athlete", "nutritionist", "admin"];

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
  const [users, setUsers] = useState<User[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [status, setStatus] = useState<string>(
    "Registra integrantes y staff para sincronizar con Supabase."
  );
  const [loading, setLoading] = useState(false);
  const refreshQueueCount = useSyncStore((state) => state.refreshQueueCount);

  const loadData = async () => {
    const [list, pending] = await Promise.all([
      listLocalUsers(),
      getPendingUserIds(),
    ]);
    setUsers(list);
    setPendingIds(pending);
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
      await createLocalUser({
        name: form.name,
        email: form.email,
        role: form.role,
        height: form.height ? Number(form.height) : undefined,
        birthdate: form.birthdate || undefined,
        goal: form.goal || undefined,
      });
      setStatus(
        "Usuario guardado localmente. Se sincronizará cuando haya conexión."
      );
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

  return (
    <section className="flex flex-col gap-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-brand-primary">
          Gestión de usuarios
        </h1>
        <p className="text-sm text-white/70">
          Crea y sincroniza usuarios de manera local-first. Al volver la
          conexión, los registros se enviarán a Supabase.
        </p>
        <span className="text-xs text-brand-accent">{status}</span>
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm backdrop-blur sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1">
          <span>Nombre completo</span>
          <input
            required
            className="rounded bg-white/10 p-2 text-white"
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
            className="rounded bg-white/10 p-2 text-white"
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
            className="rounded bg-white/10 p-2 text-white"
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
            className="rounded bg-white/10 p-2 text-white"
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
            className="rounded bg-white/10 p-2 text-white"
            value={form.birthdate}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, birthdate: event.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Objetivo</span>
          <input
            className="rounded bg-white/10 p-2 text-white"
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
            className="rounded bg-brand-primary px-4 py-2 font-semibold text-brand-dark transition hover:bg-brand-accent disabled:opacity-60"
          >
            {loading ? "Guardando…" : "Guardar usuario local"}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-4">
        {groupedByRole.map(({ role, users }) => (
          <div
            key={role}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold capitalize">{role}</h2>
              <span className="text-xs text-white/60">
                {users.length} registrados
              </span>
            </header>
            <ul className="flex flex-col gap-3">
              {users.length === 0 ? (
                <li className="text-xs text-white/40">
                  Sin usuarios en esta categoría.
                </li>
              ) : (
                users.map((user) => {
                  const pending = pendingIds.has(user.id);
                  return (
                    <li
                      key={user.id}
                      className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/80 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">
                          {user.name}
                        </span>
                        <span className="text-white/60">{user.email}</span>
                        <span className="text-white/50">
                          Última actualización:{" "}
                          {new Date(user.updated_at).toLocaleString("es-AR")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.goal ? (
                          <span className="text-white/60">
                            Meta: {user.goal}
                          </span>
                        ) : null}
                        {pending ? (
                          <span className="rounded-full bg-amber-500/20 px-2 py-1 text-[11px] text-amber-300">
                            Pendiente de sincronización
                          </span>
                        ) : (
                          <span className="rounded-full bg-brand-primary/20 px-2 py-1 text-[11px] text-brand-accent">
                            Sincronizado
                          </span>
                        )}
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
}
