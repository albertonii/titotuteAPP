"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/state/auth";
import { useAuthGuard } from "@/lib/hooks/useAuthGuard";
import type { TrainingMap } from "@/types/training";
import { getActiveTrainingPlan } from "@/lib/services/training";
import { PlanSelector } from "./PlanSelector";
import { MicroSelector } from "./MicroSelector";
import { TrainingHero } from "./TrainingHero";
import { WarmupAccordion } from "./WarmupAccordion";
import { ExerciseCard, type ExerciseStatus } from "./ExerciseCard";

const STORAGE_SHEET_KEY = "training:selectedSheet";
const STORAGE_MICRO_KEY = "training:selectedMicro";

interface TrainingPlannerProps {
  trainings?: TrainingMap; // Opcional ahora, se carga desde BD si no se proporciona
}

export default function TrainingPlanner({ trainings: initialTrainings }: TrainingPlannerProps) {
  const { user } = useAuthStore();
  const [trainings, setTrainings] = useState<TrainingMap>(initialTrainings || {});
  const [loading, setLoading] = useState(!initialTrainings);
  const sheetKeys = useMemo(() => {
    const keys = Object.keys(trainings);
    const ordered = [
      "ENTRENAMIENTO A",
      "ENTRENAMIENTO B",
      "ENTRENAMIENTO C",
      "ENTRENAMIENTO D",
      "ENTRENAMIENTO E",
    ].filter((key) => keys.includes(key));
    const remaining = keys.filter((key) => !ordered.includes(key));
    return [...ordered, ...remaining];
  }, [trainings]);

  const defaultSheet = sheetKeys[0] ?? "";

  const [selectedSheet, setSelectedSheet] = useState<string>(defaultSheet);
  const [selectedMicro, setSelectedMicro] = useState<number>(0);

  const [exerciseStatuses, setExerciseStatuses] = useState<
    Record<string, ExerciseStatus>
  >({});
  const [activeExercise, setActiveExercise] = useState<string | null>(null);

  useAuthGuard({
    allowedRoles: ["athlete", "trainer", "admin", "nutritionist"],
  });

  // Cargar planificación activa desde la BD
  useEffect(() => {
    const loadActiveTraining = async () => {
      if (!user?.id) return;
      
      try {
        // Cargar el JSON base como fallback
        const response = await fetch("/data/trainings.json");
        if (!response.ok) {
          throw new Error("No se pudo cargar el plan base");
        }
        const baseTrainings: TrainingMap = await response.json();
        
        // Obtener la planificación activa del usuario
        const activeTrainings = await getActiveTrainingPlan(user.id, baseTrainings);
        setTrainings(activeTrainings);
      } catch (error) {
        console.error("Error cargando planificación activa:", error);
        // Si hay error, usar los entrenamientos iniciales o el JSON base
        if (initialTrainings) {
          setTrainings(initialTrainings);
        } else {
          try {
            const response = await fetch("/data/trainings.json");
            const baseTrainings: TrainingMap = await response.json();
            setTrainings(baseTrainings);
          } catch (e) {
            console.error("Error cargando JSON base:", e);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    if (!initialTrainings) {
      loadActiveTraining();
    } else {
      setLoading(false);
    }
  }, [user?.id, initialTrainings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedSheet = window.localStorage.getItem(STORAGE_SHEET_KEY);
    const storedMicro = window.localStorage.getItem(STORAGE_MICRO_KEY);

    if (storedSheet && sheetKeys.includes(storedSheet)) {
      setSelectedSheet(storedSheet);
    }

    if (storedMicro) {
      const parsed = Number.parseInt(storedMicro, 10);
      if (!Number.isNaN(parsed)) {
        setSelectedMicro(parsed);
      }
    }
  }, [sheetKeys]);

  useEffect(() => {
    if (!sheetKeys.length) return;
    if (!sheetKeys.includes(selectedSheet)) {
      const fallback = sheetKeys[0] ?? "";
      setSelectedSheet(fallback);
      setSelectedMicro(0);
    }
  }, [selectedSheet, sheetKeys]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_SHEET_KEY, selectedSheet);
  }, [selectedSheet]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_MICRO_KEY, String(selectedMicro));
  }, [selectedMicro]);

  const training = trainings[selectedSheet];

  useEffect(() => {
    if (!training) return;
    if (selectedMicro < 0 || selectedMicro >= training.microcycles.length) {
      setSelectedMicro(0);
    }
  }, [selectedMicro, training]);

  useEffect(() => {
    setExerciseStatuses({});
    setActiveExercise(null);
  }, [selectedSheet, selectedMicro]);

  const handleExerciseStatusChange = useCallback(
    (exerciseName: string, status: ExerciseStatus) => {
      setExerciseStatuses((prev) => {
        const previous = prev[exerciseName];
        if (
          previous?.completed === status.completed &&
          previous?.lastPerformedAt === status.lastPerformedAt
        ) {
          return prev;
        }
        return { ...prev, [exerciseName]: status };
      });
    },
    []
  );

  // Todos los hooks deben estar antes de cualquier return condicional
  const totalExercises = training?.exercises.length ?? 0;
  const completedExercises = useMemo(() => {
    return Object.values(exerciseStatuses).filter((status) => status.completed)
      .length;
  }, [exerciseStatuses]);

  const latestUpdateIso = useMemo(() => {
    const timestamps = Object.values(exerciseStatuses)
      .map((status) => status.lastPerformedAt)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime());
    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps)).toISOString();
  }, [exerciseStatuses]);

  const selectedMicrocycleLabel = useMemo(() => {
    if (!training) return "";
    return training.microcycles[selectedMicro] ?? training.microcycles[0] ?? "";
  }, [training, selectedMicro]);

  // Ahora sí, los returns condicionales después de todos los hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-slate-500">Cargando planificación...</p>
      </div>
    );
  }

  if (!training || Object.keys(trainings).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm font-medium text-slate-900">
          No hay planificación activa asignada
        </p>
        <p className="text-xs text-slate-500">
          Contacta con tu entrenador para que te asigne una planificación activa.
        </p>
      </div>
    );
  }

  return (
    <section className="w-full">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 sm:py-5 sm:gap-6 sm:px-5 lg:max-w-5xl lg:px-8">
        <MicroSelector
          microcycles={training.microcycles}
          selectedIndex={selectedMicro}
          onSelectIndex={(index) => {
            setSelectedMicro(index);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(STORAGE_MICRO_KEY, String(index));
            }
          }}
          completedExercises={completedExercises}
          totalExercises={totalExercises}
        />

        <PlanSelector
          sheetKeys={sheetKeys}
          selectedSheet={selectedSheet}
          onSelectSheet={(sheet) => {
            setSelectedSheet(sheet);
            setSelectedMicro(0);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(STORAGE_SHEET_KEY, sheet);
              window.localStorage.setItem(STORAGE_MICRO_KEY, "0");
            }
          }}
        />

        <TrainingHero
          title={training.title}
          phase={training.phase}
          microcycle={selectedMicrocycleLabel}
          totalExercises={totalExercises}
          completedExercises={completedExercises}
          lastUpdate={latestUpdateIso}
        />

        <WarmupAccordion warmups={training.warmups} />

        <section className="flex flex-col gap-5">
          {training.exercises.map((exercise) => (
            <ExerciseCard
              key={`${training.sheet}-${exercise.name}`}
              exercise={exercise}
              training={training}
              selectedIndex={selectedMicro}
              userId={user?.id}
              onStatusChange={handleExerciseStatusChange}
              isActive={activeExercise === exercise.name}
              onToggle={(name, isOpen) => {
                setActiveExercise((prev) =>
                  isOpen ? name : prev === name ? null : prev
                );
              }}
            />
          ))}
        </section>
      </div>
    </section>
  );
}
