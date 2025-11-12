import { promises as fs } from "fs";
import path from "path";
import TrainingPlanner from "@/components/training/TrainingPlanner";
import type { TrainingMap } from "@/types/training";

async function loadTrainings(): Promise<TrainingMap> {
  const filePath = path.join(process.cwd(), "public", "data", "trainings.json");
  const buffer = await fs.readFile(filePath, "utf-8");
  return JSON.parse(buffer) as TrainingMap;
}

export default async function TrainingPage() {
  const trainings = await loadTrainings();
  return (
    <main className="sm:space-y-6">
      <TrainingPlanner trainings={trainings} />
    </main>
  );
}
