"use client";

import { useState } from "react";
import { useAuthGuard } from "@/lib/hooks/useAuthGuard";
import type { TrainingMap } from "@/types/training";
import {
  createMacrocycle,
  createMesocycle,
  createMicrocycle,
  createSessionPlan,
  listMacrocycles,
} from "@/lib/services/planning";

interface MigrationProgress {
  step: string;
  status: "idle" | "running" | "success" | "error";
  message: string;
  details?: string[];
}

export default function MigrateTrainingsPage() {
  useAuthGuard({ allowedRoles: ["admin", "trainer"] });
  const [progress, setProgress] = useState<MigrationProgress>({
    step: "idle",
    status: "idle",
    message: "Listo para iniciar la migración",
  });
  const [isRunning, setIsRunning] = useState(false);

  const parseTrainingData = (trainings: TrainingMap) => {
    const firstTraining = Object.values(trainings)[0];
    if (!firstTraining) {
      throw new Error("No se encontraron entrenamientos en el JSON");
    }

    const title = firstTraining.title || "";
    const macrocycleMatch = title.match(/([IVX]+)\s*MACROCICLO/i);
    const macrocycleName = macrocycleMatch
      ? `${macrocycleMatch[1]} MACROCICLO`
      : "MACROCICLO PRINCIPAL";

    const mesocycleMatch = title.match(/(\d+)[º°]\s*MESOCICLO/i);
    const mesocycleName = mesocycleMatch
      ? `${mesocycleMatch[1]}º MESOCICLO`
      : "MESOCICLO PRINCIPAL";

    const typeMatch = title.match(/\(([^)]+)\)/);
    const trainingType = typeMatch ? typeMatch[1] : "PLAN DE ENTRENAMIENTO";
    const phase = firstTraining.phase || "FASE ACUMULACION";

    const trainingList = Object.values(trainings).map((training) => ({
      sheet: training.sheet,
      title: training.title || training.sheet,
      microcycles: training.microcycles,
    }));

    return {
      macrocycleName,
      mesocycleName,
      phase,
      trainingType,
      trainings: trainingList,
    };
  };

  const handleMigrate = async () => {
    setIsRunning(true);
    const details: string[] = [];

    try {
      // 1. Cargar JSON
      setProgress({
        step: "loading",
        status: "running",
        message: "Cargando archivo trainings.json...",
        details,
      });

      const response = await fetch("/data/trainings.json");
      if (!response.ok) {
        throw new Error("No se pudo cargar el archivo trainings.json");
      }
      const trainings: TrainingMap = await response.json();
      details.push(`✅ Se encontraron ${Object.keys(trainings).length} entrenamientos`);

      // 2. Parsear datos
      setProgress({
        step: "parsing",
        status: "running",
        message: "Analizando estructura de datos...",
        details: [...details],
      });

      const parsed = parseTrainingData(trainings);
      details.push(`📊 Macrociclo: ${parsed.macrocycleName}`);
      details.push(`📊 Mesociclo: ${parsed.mesocycleName}`);
      details.push(`📊 Fase: ${parsed.phase}`);
      details.push(`📊 Entrenamientos: ${parsed.trainings.length}`);

      // 3. Verificar/Crear macrociclo
      setProgress({
        step: "macrocycle",
        status: "running",
        message: "Verificando/Creando macrociclo...",
        details: [...details],
      });

      const existingMacrocycles = await listMacrocycles();
      const existingMacro = existingMacrocycles.find(
        (m) => m.name === parsed.macrocycleName
      );

      let macrocycleId: string;
      if (existingMacro) {
        macrocycleId = existingMacro.id;
        details.push(`⚠️  Macrociclo existente encontrado, usando: ${existingMacro.id}`);
      } else {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), 0, 1);
        const endDate = new Date(today.getFullYear(), 11, 31);

        const macrocycle = await createMacrocycle({
          name: parsed.macrocycleName,
          season: `${today.getFullYear()}`,
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          goal: parsed.trainingType,
          notes: `Migrado automáticamente desde trainings.json`,
          status: "published",
        });
        macrocycleId = macrocycle.id;
        details.push(`✅ Macrociclo creado: ${macrocycle.id}`);
      }

      // 4. Crear mesociclo
      setProgress({
        step: "mesocycle",
        status: "running",
        message: "Creando mesociclo...",
        details: [...details],
      });

      const mesoStartDate = new Date();
      mesoStartDate.setMonth(0);
      const mesoEndDate = new Date();
      mesoEndDate.setMonth(11);

      const mesocycle = await createMesocycle({
        macrocycle_id: macrocycleId,
        name: parsed.mesocycleName,
        start_date: mesoStartDate.toISOString().split("T")[0],
        end_date: mesoEndDate.toISOString().split("T")[0],
        phase: parsed.phase,
        focus: parsed.trainingType,
        goal: `Mesociclo del ${parsed.macrocycleName}`,
        order_index: 1,
        status: "published",
      });
      const mesocycleId = mesocycle.id;
      details.push(`✅ Mesociclo creado: ${mesocycle.id}`);

      // 5. Crear microciclos
      setProgress({
        step: "microcycles",
        status: "running",
        message: "Creando microciclos...",
        details: [...details],
      });

      const maxMicrocycles = Math.max(
        ...parsed.trainings.map((t) => t.microcycles.length)
      );
      const microcycleIds: string[] = [];

      for (let i = 0; i < maxMicrocycles; i++) {
        const microName = parsed.trainings[0]?.microcycles[i] || `${i + 1}º`;
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() + i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const microcycle = await createMicrocycle({
          mesocycle_id: mesocycleId,
          name: microName,
          week_number: i + 1,
          start_date: weekStart.toISOString().split("T")[0],
          end_date: weekEnd.toISOString().split("T")[0],
          focus: `Microciclo ${microName}`,
          status: "published",
        });
        microcycleIds.push(microcycle.id);
        details.push(`   ✅ Microciclo ${i + 1}: ${microName}`);
      }

      // 6. Crear sesiones
      setProgress({
        step: "sessions",
        status: "running",
        message: "Creando sesiones de entrenamiento...",
        details: [...details],
      });

      let sessionCount = 0;
      for (const training of parsed.trainings) {
        for (let i = 0; i < training.microcycles.length; i++) {
          const microcycleId = microcycleIds[i];
          const microcycleName = training.microcycles[i];

          const baseDate = new Date();
          baseDate.setDate(baseDate.getDate() + i * 7);
          const dayOffset = parsed.trainings.indexOf(training) % 7;
          const sessionDate = new Date(baseDate);
          sessionDate.setDate(sessionDate.getDate() + dayOffset);

          await createSessionPlan({
            macrocycle_id: macrocycleId,
            mesocycle_id: mesocycleId,
            microcycle_id: microcycleId,
            name: `${training.sheet} - ${microcycleName}`,
            date: sessionDate.toISOString().split("T")[0],
            session_type: training.sheet,
            order_index: i + 1,
            status: "scheduled",
            notes: training.title,
          });
          sessionCount++;
        }
      }
      details.push(`✅ ${sessionCount} sesiones creadas`);

      // Éxito
      setProgress({
        step: "complete",
        status: "success",
        message: "✅ Migración completada exitosamente!",
        details: [...details],
      });
    } catch (error) {
      console.error("Error durante la migración:", error);
      setProgress({
        step: "error",
        status: "error",
        message: `❌ Error: ${error instanceof Error ? error.message : "Error desconocido"}`,
        details: [...details],
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Migración de Entrenamientos
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Este proceso migrará los datos de trainings.json a la estructura de
            planificación en la base de datos (macrociclo, mesociclo, microciclo,
            sesión).
          </p>
        </header>

        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                progress.status === "running"
                  ? "animate-pulse bg-blue-500"
                  : progress.status === "success"
                  ? "bg-emerald-500"
                  : progress.status === "error"
                  ? "bg-rose-500"
                  : "bg-slate-400"
              }`}
            />
            <span className="text-sm font-medium text-slate-900">
              {progress.message}
            </span>
          </div>

          {progress.details && progress.details.length > 0 && (
            <div className="mt-4 max-h-96 overflow-y-auto rounded border border-slate-200 bg-white p-3 text-xs">
              {progress.details.map((detail, index) => (
                <div key={index} className="mb-1 font-mono text-slate-700">
                  {detail}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleMigrate}
          disabled={isRunning}
          className="w-full rounded bg-brand-primary px-4 py-3 font-semibold text-white transition hover:bg-brand-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? "Migrando..." : "Iniciar Migración"}
        </button>

        {progress.status === "success" && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-medium">✅ Migración completada</p>
            <p className="mt-1 text-xs">
              Puedes verificar los datos en la sección de Planificación del panel
              de administración.
            </p>
          </div>
        )}

        {progress.status === "error" && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-medium">❌ Error durante la migración</p>
            <p className="mt-1 text-xs">
              Revisa la consola del navegador para más detalles.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

