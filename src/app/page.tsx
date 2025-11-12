"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuthStore } from "@/lib/state/auth";
import type { UserRole } from "@/lib/db-local/db";

interface LandingAction {
  label: string;
  href: string;
  description: string;
  highlight?: string;
}

const roleActionMap: Record<UserRole | "guest", LandingAction> = {
  guest: {
    label: "Iniciar sesión",
    href: "/login",
    description: "Accede al panel offline-first con tus credenciales Supabase.",
    highlight: "Comienza ahora",
  },
  admin: {
    label: "Gestionar usuarios y planificación",
    href: "/admin",
    description:
      "Define temporadas, duplica mesociclos y sincroniza al staff en segundos.",
    highlight: "Panel Admin",
  },
  trainer: {
    label: "Abrir Coach Mode",
    href: "/coach",
    description:
      "Controla el estado del grupo, registra métricas y duplica sesiones en vivo.",
    highlight: "Coach Mode",
  },
  athlete: {
    label: "Registrar plan de trabajo",
    href: "/training",
    description:
      "Completa tu microciclo, marca ejercicios en curso y guarda tu progreso offline.",
    highlight: "Tu entrenamiento",
  },
  nutritionist: {
    label: "Revisar nutrición y progreso",
    href: "/athlete",
    description:
      "Analiza indicadores, objetivos de macros y alertas de energía en un solo lugar.",
    highlight: "Panel Nutrición",
  },
};

const secondaryLinks: LandingAction[] = [
  {
    label: "Estado de sincronización",
    href: "/sync",
    description:
      "Consulta el outbox, reintenta credenciales y verifica el modo offline.",
  },
  {
    label: "Biblioteca de entrenamiento",
    href: "/training",
    description:
      "Explora el planner local-first y la estructura 7/28 días del atleta.",
  },
];

export default function HomePage() {
  const { user, status } = useAuthStore();
  const isAuthenticated = status === "authenticated" && Boolean(user);

  const primaryAction = useMemo(() => {
    if (!user) return roleActionMap.guest;
    return roleActionMap[user.role] ?? roleActionMap.guest;
  }, [user]);

  const personaBadge = user
    ? `${
        user.role === "athlete"
          ? "Atleta"
          : user.role === "trainer"
          ? "Coach"
          : user.role === "admin"
          ? "Administrador"
          : "Staff"
      }`
    : "Offline-first";

  return (
    <main className="flex flex-col gap-10 pb-16">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-primary via-brand-accent/90 to-brand-primary/90 px-6 py-16 text-white shadow-lg sm:px-12">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_55%)]"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
            {personaBadge}
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Entrena, planifica y sincroniza sin depender de la conexión
          </h1>
          <p className="max-w-2xl text-balance text-base text-white/85 sm:text-lg">
            Tito &amp; Tute Training centraliza la planificación de macrociclos,
            el registro diario de atletas y la sincronización con Supabase.
            Diseñado mobile-first, pensado para sesiones semipersonales y
            trabajo offline.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Link
              href={primaryAction.href}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-primary shadow-md transition hover:shadow-lg"
            >
              {primaryAction.highlight ?? primaryAction.label}
            </Link>
            {isAuthenticated ? (
              <Link
                href={secondaryLinks[0].href}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {secondaryLinks[0].label}
              </Link>
            ) : (
              <Link
                href={secondaryLinks[1].href}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ver planner demo
              </Link>
            )}
          </div>

          <div className="grid w-full gap-4 rounded-2xl bg-black/10 p-5 text-left sm:grid-cols-3 sm:gap-6">
            <LandingHighlight
              title="Modo offline garantizado"
              description="Persistencia Dexie + outbox con Workbox. Sigue operando aunque pierdas la red."
            />
            <LandingHighlight
              title="Roles claros"
              description="Entrenadores controlan grupos, el admin gestiona usuarios y el atleta registra su plan."
            />
            <LandingHighlight
              title="Sincronización automática"
              description="PUSH/PULL con Supabase y resolución de conflictos priorizando al coach."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 sm:px-6">
        <header className="flex flex-col gap-2 text-left sm:text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary">
            Tu próximo paso
          </span>
          <h2 className="text-2xl font-semibold text-slate-900">
            {user
              ? "Qué quieres hacer hoy"
              : "Empieza a profesionalizar tus sesiones"}
          </h2>
          <p className="text-sm text-slate-600 sm:text-base">
            {primaryAction.description}
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <ActionCard action={primaryAction} primary />
          {(isAuthenticated ? secondaryLinks : secondaryLinks.slice(0, 1)).map(
            (item) => (
              <ActionCard key={item.href} action={item} />
            )
          )}
        </div>
      </section>
    </main>
  );
}

interface HighlightProps {
  title: string;
  description: string;
}

const LandingHighlight = ({ title, description }: HighlightProps) => (
  <div className="flex flex-col gap-2 rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur">
    <span className="text-sm font-semibold text-white">{title}</span>
    <p className="text-xs text-white/80">{description}</p>
  </div>
);

const ActionCard = ({
  action,
  primary,
}: {
  action: LandingAction;
  primary?: boolean;
}) => (
  <Link
    href={action.href}
    className={`group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
      primary ? "ring-2 ring-brand-primary/20" : ""
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-brand-primary">
        {primary ? "Principal" : "Explorar"}
      </span>
      <span className="text-sm text-slate-400 transition group-hover:text-brand-primary">
        →
      </span>
    </div>
    <h3 className="text-lg font-semibold text-slate-900">{action.label}</h3>
    <p className="text-sm text-slate-600">{action.description}</p>
  </Link>
);
