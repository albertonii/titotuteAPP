export default function HomePage() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-semibold text-brand-primary">Tito &amp; Tute Training</h1>
      <p className="max-w-md text-balance text-sm text-slate-600">
        MVP offline-first para entrenadores y atletas. Usa el menú para acceder a Coach Mode, vista de atleta o estado de sincronización.
      </p>
    </section>
  );
}
