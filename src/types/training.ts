export interface TrainingWarmup {
  description: string | null;
  resource?: string | null;
}

export interface TrainingExercise {
  name: string;
  header: Array<string | null>;
  notes: Array<Array<string | null>>;
  series: Array<Array<string | null>>;
  rest: Array<string | null> | null;
}

export interface TrainingSheetData {
  sheet: string;
  phase: string | null;
  title: string | null;
  microcycles: string[];
  warmups: TrainingWarmup[];
  exercises: TrainingExercise[];
}

export type TrainingMap = Record<string, TrainingSheetData>;
