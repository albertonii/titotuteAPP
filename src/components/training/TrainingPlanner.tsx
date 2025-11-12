"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/state/auth";
import { useAuthGuard } from "@/lib/hooks/useAuthGuard";
import type { TrainingMap } from "@/types/training";
import { PlanSelector } from "./PlanSelector";
import { MicroSelector } from "./MicroSelector";
import { TrainingHero } from "./TrainingHero";
import { WarmupAccordion } from "./WarmupAccordion";
import { ExerciseCard, type ExerciseStatus } from "./ExerciseCard";

const STORAGE_SHEET_KEY = "training:selectedSheet";
const STORAGE_MICRO_KEY = "training:selectedMicro";

interface TrainingPlannerProps {
  trainings: TrainingMap;
}

export default function TrainingPlanner({ trainings }: TrainingPlannerProps) {
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

  const [selectedSheet, setSelectedSheet] = useState<string>(() => {
    if (typeof window === "undefined") return defaultSheet;
    const stored = window.localStorage.getItem(STORAGE_SHEET_KEY);
    return stored && sheetKeys.includes(stored) ? stored : defaultSheet;
  });

  const [selectedMicro, setSelectedMicro] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const stored = window.localStorage.getItem(STORAGE_MICRO_KEY);
    const parsed = stored ? Number.parseInt(stored, 10) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  });

  const [exerciseStatuses, setExerciseStatuses] = useState<
    Record<string, ExerciseStatus>
  >({});
  const [activeExercise, setActiveExercise] = useState<string | null>(null);

  const { user } = useAuthStore();
  useAuthGuard({
    allowedRoles: ["athlete", "trainer", "admin", "nutritionist"],
  });

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

  if (!training) {
    return (
      <p className="text-sm text-slate-500">
        No se encontró información de entrenamientos.
      </p>
    );
  }

  const totalExercises = training.exercises.length;
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

  const selectedMicrocycleLabel =
    training.microcycles[selectedMicro] ?? training.microcycles[0] ?? "";

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
