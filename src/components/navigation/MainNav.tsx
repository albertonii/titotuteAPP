"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncStore } from "@/lib/state/sync";
import { UserBadge } from "./UserBadge";
import logoHorizontal from "../../../public/brand/logo_horizontal.png";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/coach", label: "Coach" },
  { href: "/athlete", label: "Atleta" },
  { href: "/sync", label: "Sync" },
  { href: "/login", label: "Acceso" },
];

export function MainNav() {
  const pathname = usePathname();
  const { status, queueCount } = useSyncStore((state) => ({
    status: state.status,
    queueCount: state.queueCount,
  }));

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
        return "text-amber-300";
      case "error":
        return "text-red-300";
      case "syncing":
        return "text-brand-accent animate-pulse";
      default:
        return "text-white/60";
    }
  })();

  return (
    <nav className="flex w-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image
            src={logoHorizontal}
            alt="Tito & Tute Training"
            priority
            className="h-8 w-auto"
          />
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
                      ? "bg-brand-primary text-brand-dark"
                      : "text-white/80 hover:text-white"
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
