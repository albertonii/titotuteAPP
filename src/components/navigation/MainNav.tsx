"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncStore } from "@/lib/state/sync";
import { UserBadge } from "./UserBadge";
import logoHorizontal from "../../../public/brand/logo_horizontal.png";
import { useAuthStore } from "@/lib/state/auth";

export function MainNav() {
  const pathname = usePathname();
  const { status, queueCount } = useSyncStore((state) => ({
    status: state.status,
    queueCount: state.queueCount,
  }));
  const user = useAuthStore((state) => state.user);

  const statusLabel = (() => {
    switch (status) {
      case "syncing":
        return `Sincronizando… (${queueCount})`;
      case "offline":
        return `Offline · ${queueCount}`;
      case "error":
        return `Error · ${queueCount}`;
      default:
        return queueCount > 0 ? `Pendiente · ${queueCount}` : "Todo al día";
    }
  })();

  const statusStyle = (() => {
    switch (status) {
      case "offline":
        return "text-amber-600";
      case "error":
        return "text-red-500";
      case "syncing":
        return "text-brand-primary animate-pulse";
      default:
        return "text-slate-500";
    }
  })();

  const navigationLinks = () => {
    const links = [
      { href: "/", label: "Inicio" },
      { href: "/sync", label: "Sync" },
    ];

    if (user?.role === "athlete") {
      links.push({ href: "/training", label: "Plan" });
      links.push({ href: "/athlete", label: "Atleta" });
    }

    if (user?.role === "trainer") {
      links.push({ href: "/coach", label: "Coach" });
    }

    if (user?.role === "admin") {
      links.push({ href: "/admin", label: "Gestión" });
    }

    return links;
  };

  const links = navigationLinks();

  return (
    <nav className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <Image
              src={logoHorizontal}
              alt="Tito & Tute Training"
              priority
              width={260}
              height={64}
              className="h-12 w-auto object-contain"
            />
          </div>
          <div className="sm:hidden">
            <Image
              src={logoHorizontal}
              alt="Tito & Tute Training"
              priority
              width={200}
              height={48}
              className="h-10 w-auto object-contain"
            />
          </div>
        </div>
        <span className={`text-xs ${statusStyle}`}>{statusLabel}</span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <ul className="flex items-center gap-3 overflow-x-auto">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`rounded-full px-3 py-1 transition ${
                    isActive
                      ? "bg-brand-primary text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <UserBadge />
      </div>
    </nav>
  );
}
