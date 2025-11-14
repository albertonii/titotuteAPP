/**
 * Script para migrar los datos de trainings.json a la estructura de planificación
 * en la base de datos (macrociclo, mesociclo, microciclo, sesión)
 * 
 * Ejecutar con: npx tsx scripts/migrate_trainings_to_db.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { TrainingMap } from "../src/types/training";
import {
  createMacrocycle,
  createMesocycle,
  createMicrocycle,
  createSessionPlan,
  listMacrocycles,
} from "../src/lib/services/planning";
import { db } from "../src/lib/db-local/db";

interface ParsedTrainingData {
  macrocycleName: string;
  mesocycleName: string;
  phase: string;
  trainingType: string;
  trainings: Array<{
    sheet: string;
    title: string;
    microcycles: string[];
  }>;
}

function parseTrainingData(trainings: TrainingMap): ParsedTrainingData {
  // Extraer información del primer entrenamiento (todos parecen ser del mismo macrociclo/mesociclo)
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

  // Obtener fase común (todos parecen tener la misma fase)
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
}

async function migrateTrainingsToDB() {
  console.log("🚀 Iniciando migración de entrenamientos a la base de datos...\n");

  try {
    // 1. Leer el archivo JSON
    const jsonPath = join(process.cwd(), "public", "data", "trainings.json");
    console.log(`📖 Leyendo archivo: ${jsonPath}`);
    const jsonContent = readFileSync(jsonPath, "utf-8");
    const trainings: TrainingMap = JSON.parse(jsonContent);
    console.log(`✅ Se encontraron ${Object.keys(trainings).length} entrenamientos\n`);

    // 2. Parsear la información
    const parsed = parseTrainingData(trainings);
    console.log("📊 Información extraída:");
    console.log(`   - Macrociclo: ${parsed.macrocycleName}`);
    console.log(`   - Mesociclo: ${parsed.mesocycleName}`);
    console.log(`   - Fase: ${parsed.phase}`);
    console.log(`   - Tipo: ${parsed.trainingType}`);
    console.log(`   - Entrenamientos: ${parsed.trainings.length}\n`);

    // 3. Verificar si ya existe el macrociclo
    const existingMacrocycles = await listMacrocycles();
    const existingMacro = existingMacrocycles.find(
      (m) => m.name === parsed.macrocycleName
    );

    let macrocycleId: string;
    if (existingMacro) {
      console.log(`⚠️  El macrociclo "${parsed.macrocycleName}" ya existe. Usando el existente.`);
      macrocycleId = existingMacro.id;
    } else {
      // Crear macrociclo
      console.log(`📝 Creando macrociclo: ${parsed.macrocycleName}`);
      const today = new Date();
      const startDate = new Date(today.getFullYear(), 0, 1); // Inicio del año
      const endDate = new Date(today.getFullYear(), 11, 31); // Fin del año

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
      console.log(`✅ Macrociclo creado con ID: ${macrocycleId}\n`);
    }

    // 4. Crear mesociclo
    console.log(`📝 Creando mesociclo: ${parsed.mesocycleName}`);
    const mesoStartDate = new Date();
    mesoStartDate.setMonth(0); // Enero
    const mesoEndDate = new Date();
    mesoEndDate.setMonth(11); // Diciembre

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
    console.log(`✅ Mesociclo creado con ID: ${mesocycleId}\n`);

    // 5. Obtener el número máximo de microciclos de todos los entrenamientos
    const maxMicrocycles = Math.max(
      ...parsed.trainings.map((t) => t.microcycles.length)
    );
    console.log(`📝 Creando ${maxMicrocycles} microciclos...`);

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
      console.log(`   ✅ Microciclo ${i + 1}: ${microName} (ID: ${microcycle.id})`);
    }
    console.log("");

    // 6. Crear sesiones para cada combinación de entrenamiento y microciclo
    console.log(`📝 Creando sesiones de entrenamiento...`);
    let sessionCount = 0;

    for (const training of parsed.trainings) {
      for (let i = 0; i < training.microcycles.length; i++) {
        const microcycleId = microcycleIds[i];
        const microcycleName = training.microcycles[i];
        
        // Calcular fecha de la sesión (distribuir a lo largo de la semana)
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + i * 7);
        
        // Distribuir los entrenamientos en diferentes días de la semana
        const dayOffset = parsed.trainings.indexOf(training) % 7;
        const sessionDate = new Date(baseDate);
        sessionDate.setDate(sessionDate.getDate() + dayOffset);

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
        console.log(
          `   ✅ Sesión: ${training.sheet} - ${microcycleName} (${sessionDate.toISOString().split("T")[0]})`
        );
      }
    }

    console.log(`\n✅ Migración completada exitosamente!`);
    console.log(`📊 Resumen:`);
    console.log(`   - Macrociclo: 1`);
    console.log(`   - Mesociclo: 1`);
    console.log(`   - Microciclos: ${microcycleIds.length}`);
    console.log(`   - Sesiones: ${sessionCount}`);
    console.log(`\n🎉 Los datos han sido migrados a la base de datos.`);
  } catch (error) {
    console.error("❌ Error durante la migración:", error);
    if (error instanceof Error) {
      console.error("   Mensaje:", error.message);
      console.error("   Stack:", error.stack);
    }
    process.exit(1);
  }
}

// Ejecutar la migración
if (require.main === module) {
  migrateTrainingsToDB()
    .then(() => {
      console.log("\n✨ Proceso finalizado.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Error fatal:", error);
      process.exit(1);
    });
}

export { migrateTrainingsToDB };

