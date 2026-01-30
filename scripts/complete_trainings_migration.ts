/**
 * Script para completar la migración de trainings.json
 * Agrega warmups y ejercicios a las sesiones creadas
 *
 * Ejecutar con: npx tsx scripts/complete_trainings_migration.ts
 *
 * Requiere variables de entorno:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Se requieren las variables de entorno:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error(
    "   - SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY)"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface TrainingData {
  sheet: string;
  phase: string;
  title: string;
  microcycles: string[];
  warmups: Array<{
    description: string;
    resource?: string;
  }>;
  exercises: Array<{
    name: string;
    header: (string | null)[];
    notes: (string | null)[][];
    series: (string | null)[][];
    rest: (string | null)[] | null;
  }>;
}

type TrainingMap = Record<string, TrainingData>;

async function completeMigration() {
  console.log("🚀 Completando migración de trainings.json...\n");

  try {
    // 1. Leer JSON
    const jsonPath = join(process.cwd(), "public", "data", "trainings.json");
    console.log(`📖 Leyendo archivo: ${jsonPath}`);
    const trainings: TrainingMap = JSON.parse(readFileSync(jsonPath, "utf-8"));
    console.log(
      `✅ Se encontraron ${Object.keys(trainings).length} entrenamientos\n`
    );

    // 2. Obtener el macrociclo y mesociclo
    const { data: macrocycles, error: macroError } = await supabase
      .from("macrocycles")
      .select("id, name")
      .eq("name", "I MACROCICLO");

    if (macroError) throw macroError;
    if (!macrocycles || macrocycles.length === 0) {
      throw new Error(
        "No se encontró el macrociclo 'I MACROCICLO'. Ejecuta primero la migración SQL."
      );
    }

    const macrocycle = macrocycles[0];
    const { data: mesocycles, error: mesoError } = await supabase
      .from("mesocycles")
      .select("id, name")
      .eq("macrocycle_id", macrocycle.id);

    if (mesoError) throw mesoError;
    if (!mesocycles || mesocycles.length === 0) {
      throw new Error(
        "No se encontró el mesociclo. Ejecuta primero la migración SQL."
      );
    }

    const mesocycle = mesocycles[0];
    const { data: microcycles, error: microError } = await supabase
      .from("microcycles")
      .select("id, name, week_number")
      .eq("mesocycle_id", mesocycle.id)
      .order("week_number", { ascending: true });

    if (microError) throw microError;
    if (!microcycles || microcycles.length === 0) {
      throw new Error(
        "No se encontraron microciclos. Ejecuta primero la migración SQL."
      );
    }

    console.log(`📊 Macrociclo: ${macrocycle.name}`);
    console.log(`📊 Mesociclo: ${mesocycle.name}`);
    console.log(`📊 Microciclos: ${microcycles.length}\n`);

    // 3. Para cada entrenamiento, encontrar sus sesiones y agregar warmups/ejercicios
    for (const [trainingKey, trainingData] of Object.entries(trainings)) {
      console.log(`\n📝 Procesando ${trainingKey}...`);

      // Buscar todas las sesiones de este tipo de entrenamiento
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("id, name, microcycle_id")
        .eq("session_type", trainingKey)
        .eq("macrocycle_id", macrocycle.id);

      if (sessionsError) throw sessionsError;
      if (!sessions) continue;

      console.log(`   Encontradas ${sessions.length} sesiones`);

      for (const session of sessions) {
        // Determinar qué microciclo es esta sesión
        const microcycle = microcycles.find(
          (m) => m.id === session.microcycle_id
        );
        if (!microcycle) continue;

        const microcycleIndex = microcycles.indexOf(microcycle);
        const microcycleName =
          trainingData.microcycles[microcycleIndex] ||
          `${microcycle.week_number}º`;

        console.log(`   Procesando sesión ${session.name} (${microcycleName})`);

        // Agregar warmups
        for (let i = 0; i < trainingData.warmups.length; i++) {
          const warmup = trainingData.warmups[i];
          const { error: warmupError } = await supabase
            .from("session_warmups")
            .insert({
              session_id: session.id,
              description: warmup.description,
              resource: warmup.resource || null,
              order_index: i,
            });

          if (warmupError) {
            console.error(`   ❌ Error creando warmup ${i}:`, warmupError);
          }
        }

        // Agregar ejercicios
        for (let i = 0; i < trainingData.exercises.length; i++) {
          const exercise = trainingData.exercises[i];

          // Extraer información del ejercicio
          const allNotes = exercise.notes.flat();
          const generalInstructions =
            allNotes.find(
              (note) => note && typeof note === "string" && note.includes("TUT")
            ) || null;

          const warnings =
            allNotes.find(
              (note) =>
                note &&
                typeof note === "string" &&
                (note.includes("SPEED CHANGES") || note.includes("OJO"))
            ) || null;

          const videoResource =
            allNotes.find(
              (note) =>
                note && typeof note === "string" && note.startsWith("http")
            ) || null;

          // Extraer rest por microciclo del array rest
          let restByMicrocycle: Record<string, string> | null = null;
          if (exercise.rest && exercise.rest.length > 1) {
            const restMap: Record<string, string> = {};
            for (let m = 0; m < trainingData.microcycles.length; m++) {
              const restIndex = 2 + m * 2;
              if (
                restIndex < exercise.rest.length &&
                exercise.rest[restIndex]
              ) {
                restMap[trainingData.microcycles[m]] = exercise.rest[
                  restIndex
                ] as string;
              }
            }
            if (Object.keys(restMap).length > 0) {
              restByMicrocycle = restMap;
            }
          }

          // Crear ejercicio
          const { data: sessionExercise, error: exerciseError } = await supabase
            .from("session_exercises")
            .insert({
              session_id: session.id,
              exercise_name: exercise.name,
              order_index: i,
              rest: exercise.rest?.[2] || null,
              rest_by_microcycle: restByMicrocycle
                ? JSON.stringify(restByMicrocycle)
                : null,
              video_resource: videoResource,
              general_instructions: generalInstructions,
              warnings: warnings,
              notes_json: JSON.stringify(exercise.notes),
              header_json: JSON.stringify(exercise.header),
              exercise_variations: null,
            })
            .select()
            .single();

          if (exerciseError) {
            console.error(`   ❌ Error creando ejercicio ${i}:`, exerciseError);
            continue;
          }

          if (!sessionExercise) continue;

          // Agregar series del ejercicio
          for (let s = 0; s < exercise.series.length; s++) {
            const series = exercise.series[s];
            const seriesLabel = series[1] || `${s + 1}ª Serie`;

            const microcycleColIndex = 2 + microcycleIndex * 2;

            const load = series[microcycleColIndex] || null;
            const reps = series[microcycleColIndex + 1] || null;

            const rir =
              series.find(
                (val) => val && typeof val === "string" && val.includes("RIR")
              ) || null;

            const specialInstructions =
              series.find(
                (val) =>
                  val &&
                  typeof val === "string" &&
                  (val.includes("R.P") ||
                    val.includes("DROP") ||
                    val.includes("STRIPP") ||
                    val.includes("AMRAP") ||
                    val.includes("MAX"))
              ) || null;

            const { error: seriesError } = await supabase
              .from("exercise_series")
              .insert({
                session_exercise_id: sessionExercise.id,
                series_number: s + 1,
                series_label: seriesLabel,
                microcycle_name: microcycleName,
                load: load,
                reps: reps,
                rir: rir,
                notes: null,
                rest: exercise.rest?.[microcycleColIndex + 1] || null,
                special_instructions: specialInstructions,
                exercise_variation: null,
              });

            if (seriesError) {
              console.error(`   ❌ Error creando serie ${s + 1}:`, seriesError);
            }
          }
        }
      }
    }

    console.log("\n✅ Migración completada exitosamente!");
  } catch (error) {
    console.error("❌ Error en la migración:", error);
    process.exit(1);
  }
}

completeMigration();
