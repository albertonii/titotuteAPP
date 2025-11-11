import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { MainNav } from "@/components/navigation/MainNav";

export const metadata: Metadata = {
  title: "Tito & Tute Training",
  description: "MVP offline-first para el gimnasio Tito & Tute Training",
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
      <body className="bg-slate-50 text-slate-900">
        <Providers>
          <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-6">
            <MainNav />
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
