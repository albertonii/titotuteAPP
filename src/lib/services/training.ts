import type { TrainingMap, TrainingSheetData } from "@/types/training";
import {
  getActivePlanningForUser,
  listSessionsByMacrocycle,
  listMicrocyclesByMesocycle,
  listMesocyclesByMacrocycle,
} from "./planning";
import type { Session, Microcycle, Mesocycle } from "@/lib/db-local/db";

/**
 * Obtiene la planificación activa del usuario y la transforma al formato TrainingMap
 * combinando con los datos del JSON de entrenamientos base
 */
export async function getActiveTrainingPlan(
  userId: string,
  baseTrainings: TrainingMap
): Promise<TrainingMap> {
  // Obtener la planificación activa del usuario
  const activePlanning = await getActivePlanningForUser(userId);

  if (!activePlanning) {
    // Si no hay planificación activa, devolver el JSON base completo
    return baseTrainings;
  }

  // Obtener todas las sesiones del macrociclo activo
  const sessions = await listSessionsByMacrocycle(activePlanning.macrocycle_id);
  
  // Obtener mesociclos y microciclos para entender la estructura
  const mesocycles = await listMesocyclesByMacrocycle(activePlanning.macrocycle_id);
  const microcyclesByMeso: Record<string, Microcycle[]> = {};
  
  for (const meso of mesocycles) {
    microcyclesByMeso[meso.id] = await listMicrocyclesByMesocycle(meso.id);
  }

  // Agrupar sesiones por session_type (que corresponde al sheet del JSON)
  const sessionsByType: Record<string, Session[]> = {};
  for (const session of sessions) {
    if (session.session_type && session.status !== "cancelled") {
      if (!sessionsByType[session.session_type]) {
        sessionsByType[session.session_type] = [];
      }
      sessionsByType[session.session_type].push(session);
    }
  }

  // Crear un nuevo TrainingMap filtrado y estructurado según la planificación activa
  const activeTrainingMap: TrainingMap = {};

  for (const [sheetKey, baseTraining] of Object.entries(baseTrainings)) {
    // Solo incluir entrenamientos que tienen sesiones en la planificación activa
    if (!sessionsByType[sheetKey] || sessionsByType[sheetKey].length === 0) {
      continue;
    }

    // Obtener los microciclos únicos de las sesiones de este tipo
    const sessionMicrocycles = new Set<string>();
    const allMicrocycles: Microcycle[] = Object.values(microcyclesByMeso).flat();
    
    for (const session of sessionsByType[sheetKey]) {
      if (session.microcycle_id) {
        const micro = allMicrocycles.find(m => m.id === session.microcycle_id);
        if (micro) {
          sessionMicrocycles.add(micro.name || `Semana ${micro.week_number}`);
        }
      }
    }

    // Si no hay microciclos específicos, usar los del JSON base
    const microcycles = sessionMicrocycles.size > 0
      ? Array.from(sessionMicrocycles).sort()
      : baseTraining.microcycles;

    // Crear el entrenamiento activo
    activeTrainingMap[sheetKey] = {
      ...baseTraining,
      microcycles,
      // Opcionalmente, podríamos personalizar el título con información del macrociclo
      // title: baseTraining.title, // Mantener el título original por ahora
    };
  }

  // Si no hay entrenamientos activos, devolver el JSON base completo como fallback
  if (Object.keys(activeTrainingMap).length === 0) {
    return baseTrainings;
  }

  return activeTrainingMap;
}

/**
 * Obtiene las sesiones activas agrupadas por tipo de entrenamiento
 */
export async function getActiveSessionsByType(userId: string): Promise<Record<string, Session[]>> {
  const activePlanning = await getActivePlanningForUser(userId);
  
  if (!activePlanning) {
    return {};
  }

  const sessions = await listSessionsByMacrocycle(activePlanning.macrocycle_id);
  const sessionsByType: Record<string, Session[]> = {};

  for (const session of sessions) {
    if (session.session_type && session.status !== "cancelled") {
      if (!sessionsByType[session.session_type]) {
        sessionsByType[session.session_type] = [];
      }
      sessionsByType[session.session_type].push(session);
    }
  }

  return sessionsByType;
}

