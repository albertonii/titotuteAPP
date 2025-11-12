import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MainNav } from "@/components/navigation/MainNav";
import { AppFooter } from "@/components/navigation/AppFooter";

const figtree = Figtree({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Tito & Tute Training",
  description:
    "Aplicación offline-first para entrenadores y atletas. Planificación, registro y sincronización con Supabase.",
  manifest: "/manifest.json",
  themeColor: "#16a34a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${figtree.className} bg-slate-50 text-slate-900`}>
        <Providers>
          <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-3 py-6 sm:px-6">
            <MainNav />
            <main className="flex-1">{children}</main>
            <AppFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
