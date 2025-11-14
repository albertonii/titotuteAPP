"use client";

import { useState } from "react";
import type { TrainingMap } from "@/types/training";
import {
  createMacrocycle,
  createMesocycle,
  createMicrocycle,
  createSessionPlan,
  listMacrocycles,
} from "@/lib/services/planning";
import {
  createSessionWarmup,
  createSessionExercise,
  createExerciseSeries,
} from "@/lib/services/session-planning";
import { useAuthStore } from "@/lib/state/auth";
import type { TrainingSheetData } from "@/types/training";

interface MigrationProgress {
  step: string;
  status: "idle" | "running" | "success" | "error";
  message: string;
  details?: string[];
}

interface TrainingMigrationProps {
  onComplete?: () => void;
}

export function TrainingMigration({ onComplete }: TrainingMigrationProps) {
  const user = useAuthStore((state) => state.user);
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
    
    // Extraer macrociclo del título (ej: "I MACROCICLO")
    const macrocycleMatch = title.match(/([IVX]+)\s*MACROCICLO/i);
    const macrocycleName = macrocycleMatch
      ? `${macrocycleMatch[1]} MACROCICLO`
      : "MACROCICLO PRINCIPAL";

    // Extraer mesociclo del título (ej: "10ºMesociclo")
    const mesocycleMatch = title.match(/(\d+)[º°]\s*MESOCICLO/i);
    const mesocycleName = mesocycleMatch
      ? `${mesocycleMatch[1]}º MESOCICLO`
      : "MESOCICLO PRINCIPAL";

    // Extraer tipo de entrenamiento (ej: "MIX OF LOADS 2")
    const typeMatch = title.match(/\(([^)]+)\)/);
    const trainingType = typeMatch ? typeMatch[1] : "PLAN DE ENTRENAMIENTO";
    const phase = firstTraining.phase || "FASE ACUMULACION";

    // Procesar todos los entrenamientos
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
      details.push(`📊 Tipo: ${parsed.trainingType}`);
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
          created_by: user?.id ?? null,
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

      // 6. Crear sesiones con warmups, ejercicios y series
      setProgress({
        step: "sessions",
        status: "running",
        message: "Creando sesiones de entrenamiento...",
        details: [...details],
      });

      let sessionCount = 0;
      let warmupCount = 0;
      let exerciseCount = 0;
      let seriesCount = 0;

      // Mapear trainings completos del JSON
      const trainingDataMap = new Map<string, TrainingSheetData>();
      for (const [key, value] of Object.entries(trainings)) {
        trainingDataMap.set(key, value);
      }

      for (const training of parsed.trainings) {
        const fullTraining = trainingDataMap.get(training.sheet);
        if (!fullTraining) continue;

        for (let i = 0; i < training.microcycles.length; i++) {
          const microcycleId = microcycleIds[i];
          const microcycleName = training.microcycles[i];

          const baseDate = new Date();
          baseDate.setDate(baseDate.getDate() + i * 7);
          const dayOffset = parsed.trainings.indexOf(training) % 7;
          const sessionDate = new Date(baseDate);
          sessionDate.setDate(sessionDate.getDate() + dayOffset);

          // Crear sesión
          const session = await createSessionPlan({
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

          // Crear warmups
          for (let w = 0; w < fullTraining.warmups.length; w++) {
            const warmup = fullTraining.warmups[w];
            await createSessionWarmup({
              session_id: session.id,
              description: warmup.description || "",
              resource: warmup.resource ?? null,
              order_index: w,
            });
            warmupCount++;
          }

          // Crear ejercicios
          for (let e = 0; e < fullTraining.exercises.length; e++) {
            const exercise = fullTraining.exercises[e];
            
            // Extraer información detallada de las notas
            let videoResource: string | null = null;
            let generalInstructions: string | null = null;
            let warnings: string | null = null;
            const exerciseVariations: Record<string, string> = {};
            const restByMicrocycle: Record<string, string> = {};
            
            // Procesar notas para extraer información estructurada
            if (exercise.notes && exercise.notes.length > 0) {
              for (const noteRow of exercise.notes) {
                // Buscar video en la segunda columna (índice 1)
                if (noteRow[1] && (noteRow[1].includes("YouTube") || noteRow[1].includes("youtu.be") || noteRow[1].includes("youtube.com"))) {
                  videoResource = noteRow[1];
                }
                
                // Buscar instrucciones generales (ej: "TUT EN TODO MOMENTO CONTROLADO")
                if (noteRow[1] && (noteRow[1].includes("TUT") || noteRow[1].includes("CONTROLADO") || noteRow[1].includes("MOMENTO"))) {
                  generalInstructions = noteRow[1];
                }
                
                // Buscar advertencias (ej: "OJO A LAS SERIES SPEED CHANGES")
                if (noteRow[1] && (noteRow[1].includes("OJO") || noteRow[1].includes("SPEED CHANGES") || noteRow[1].includes("ATENCIÓN"))) {
                  warnings = noteRow[1];
                }
                
                // Buscar variaciones de ejercicio por microciclo
                // Las variaciones suelen estar en filas que tienen valores en columnas de microciclos
                for (let mcIdx = 0; mcIdx < training.microcycles.length; mcIdx++) {
                  const microcycleName = training.microcycles[mcIdx];
                  const columnIdx = 2 + (mcIdx * 2); // Índice de columna para este microciclo
                  
                  if (noteRow[columnIdx] && noteRow[columnIdx].trim()) {
                    const variation = noteRow[columnIdx].trim();
                    // Si no es un número ni RIR, probablemente es una variación
                    if (!variation.match(/^\d+$/) && !variation.includes("RIR") && !variation.includes("R.I.R")) {
                      exerciseVariations[microcycleName] = variation;
                    }
                  }
                }
              }
            }
            
            // Procesar rest para extraer descanso por microciclo
            if (exercise.rest && exercise.rest.length > 0) {
              // El primer elemento suele ser "Tiempo de pausa entre series"
              for (let mcIdx = 0; mcIdx < training.microcycles.length; mcIdx++) {
                const microcycleName = training.microcycles[mcIdx];
                const columnIdx = 2 + (mcIdx * 2); // Índice de columna para este microciclo
                
                if (exercise.rest[columnIdx] && exercise.rest[columnIdx].trim()) {
                  restByMicrocycle[microcycleName] = exercise.rest[columnIdx].trim();
                }
              }
            }
            
            const sessionExercise = await createSessionExercise({
              session_id: session.id,
              exercise_name: exercise.name,
              order_index: e,
              rest: exercise.rest && exercise.rest[1] ? exercise.rest[1] : null, // "Tiempo de pausa entre series"
              rest_by_microcycle: Object.keys(restByMicrocycle).length > 0 ? JSON.stringify(restByMicrocycle) : null,
              video_resource: videoResource,
              general_instructions: generalInstructions,
              warnings: warnings,
              notes_json: JSON.stringify(exercise.notes),
              header_json: JSON.stringify(exercise.header),
              exercise_variations: Object.keys(exerciseVariations).length > 0 ? JSON.stringify(exerciseVariations) : null,
            });
            exerciseCount++;

            // Crear series para este ejercicio
            // La estructura del JSON: cada par de columnas después del nombre representa un microciclo
            // header: [null, "EJERCICIO", "3X", null, "3X", null, ...] 
            // series: [[null, "1ª Serie", carga1, reps1, carga2, reps2, ...], ...]
            const header = exercise.header || [];
            const seriesData = exercise.series || [];
            const notesData = exercise.notes || [];

            // Encontrar el índice del nombre del ejercicio (normalmente índice 1)
            const exerciseNameIdx = header.findIndex((h, idx) => idx > 0 && h && h === exercise.name);
            const startIdx = exerciseNameIdx >= 0 ? exerciseNameIdx + 1 : 2;

            // Identificar pares de columnas (carga, reps) para cada microciclo
            // Cada microciclo ocupa 2 columnas: carga y reps
            const microcycleColumnPairs: Array<{ loadIdx: number; repsIdx: number; microcycleIndex: number }> = [];
            for (let h = startIdx; h < header.length - 1; h += 2) {
              // Verificar que hay un indicador de series (ej: "3X", "2X") o datos
              if (header[h] || header[h + 1]) {
                const microcycleIndex = Math.floor((h - startIdx) / 2);
                if (microcycleIndex < training.microcycles.length) {
                  microcycleColumnPairs.push({
                    loadIdx: h,
                    repsIdx: h + 1,
                    microcycleIndex,
                  });
                }
              }
            }

            // Procesar cada serie
            for (let s = 0; s < seriesData.length; s++) {
              const seriesRow = seriesData[s];
              if (!seriesRow || seriesRow.length === 0) continue;

              // Extraer número de serie y etiqueta completa
              let seriesNumber = s + 1;
              let seriesLabel: string | null = null;
              const seriesLabelCell = seriesRow.find((cell) =>
                cell?.toLowerCase().includes("serie")
              );
              if (seriesLabelCell) {
                seriesLabel = seriesLabelCell.trim();
                const match = seriesLabelCell.match(/(\d+)/);
                if (match) {
                  seriesNumber = parseInt(match[1], 10);
                }
              }

              // Para cada microciclo, crear una serie si corresponde
              for (const pair of microcycleColumnPairs) {
                // Solo crear serie para el microciclo actual de esta sesión
                if (pair.microcycleIndex === i) {
                  const load = seriesRow[pair.loadIdx]?.trim() || null;
                  let reps = seriesRow[pair.repsIdx]?.trim() || null;
                  
                  // Buscar instrucciones especiales en la columna de reps (ej: "MAX+R.P 20\"", "10+R.P20\"")
                  let specialInstructions: string | null = null;
                  if (reps && (reps.includes("R.P") || reps.includes("MAX") || reps.includes("+"))) {
                    // Separar reps de instrucciones especiales
                    const parts = reps.split("+");
                    if (parts.length > 1) {
                      reps = parts[0].trim();
                      specialInstructions = parts.slice(1).join("+").trim();
                    } else if (reps.includes("R.P")) {
                      specialInstructions = reps;
                      reps = null;
                    }
                  }

                  // Buscar RIR en las notas para este microciclo
                  let rir: string | null = null;
                  for (const noteRow of notesData) {
                    const rirValue = noteRow[pair.loadIdx] || noteRow[pair.repsIdx];
                    if (rirValue && (rirValue.includes("RIR") || rirValue.includes("R.I.R"))) {
                      rir = rirValue.trim();
                      break;
                    }
                  }
                  
                  // Buscar variación de ejercicio para esta serie
                  let exerciseVariation: string | null = null;
                  for (const noteRow of notesData) {
                    const variationValue = noteRow[pair.loadIdx] || noteRow[pair.repsIdx];
                    if (variationValue && !variationValue.includes("RIR") && !variationValue.includes("R.I.R") && !variationValue.match(/^\d+$/)) {
                      // Si no es RIR ni número, probablemente es una variación
                      if (variationValue.includes("PRENSA") || variationValue.includes("UNIL") || variationValue.includes("MANC")) {
                        exerciseVariation = variationValue.trim();
                        break;
                      }
                    }
                  }
                  
                  // Buscar advertencias específicas de serie (ej: "2º SERIE SPEED CHANGES")
                  let seriesWarnings: string | null = null;
                  for (const noteRow of notesData) {
                    const warningValue = noteRow[pair.loadIdx] || noteRow[pair.repsIdx];
                    if (warningValue && (warningValue.includes("SPEED CHANGES") || warningValue.includes("SERIE"))) {
                      seriesWarnings = warningValue.trim();
                      break;
                    }
                  }

                  // Buscar notas adicionales
                  const notes = seriesRow
                    .slice(0, startIdx)
                    .find((cell) => cell && !cell.toLowerCase().includes("serie")) || null;

                  // Solo crear serie si hay al menos carga, reps, rir o instrucciones especiales
                  if (load || reps || rir || specialInstructions) {
                    await createExerciseSeries({
                      session_exercise_id: sessionExercise.id,
                      series_number: seriesNumber,
                      series_label: seriesLabel,
                      microcycle_name: microcycleName,
                      load: load,
                      reps: reps,
                      rir: rir,
                      notes: notes || seriesWarnings,
                      special_instructions: specialInstructions,
                      exercise_variation: exerciseVariation,
                    });
                    seriesCount++;
                  }
                }
              }
            }
          }
        }
      }

      details.push(`✅ ${sessionCount} sesiones creadas`);
      details.push(`✅ ${warmupCount} warmups creados`);
      details.push(`✅ ${exerciseCount} ejercicios creados`);
      details.push(`✅ ${seriesCount} series creadas`);

      // Éxito
      setProgress({
        step: "complete",
        status: "success",
        message: "✅ Migración completada exitosamente!",
        details: [...details],
      });

      // Llamar callback para refrescar datos
      if (onComplete) {
        onComplete();
      }
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Migrar desde trainings.json
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Analiza el archivo JSON y crea un macrociclo completo con mesociclos,
          microciclos y sesiones. La estructura será totalmente editable después
          de la migración.
        </p>
      </header>

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
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
          <div className="mt-3 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white p-2 text-xs">
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
        className="w-full rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRunning ? "Migrando..." : "Iniciar Migración"}
      </button>

      {progress.status === "success" && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <p className="font-medium">✅ Migración completada</p>
          <p className="mt-1">
            El macrociclo ha sido creado y ahora es totalmente editable en la
            sección de planificación.
          </p>
        </div>
      )}

      {progress.status === "error" && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <p className="font-medium">❌ Error durante la migración</p>
          <p className="mt-1">
            Revisa la consola del navegador para más detalles.
          </p>
        </div>
      )}
    </div>
  );
}

