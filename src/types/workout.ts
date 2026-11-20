export type DayCode = 'SAT' | 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';
export type RoutineType = 'DAY1' | 'DAY2' | 'OFF';
export type MuscleTheme =
  | 'chest'
  | 'triceps'
  | 'shoulders'
  | 'core'
  | 'back'
  | 'biceps'
  | 'cardio'
  | 'legs';

export interface DaySchedule {
  code: DayCode;
  bnName: string;
  shortBn: string;
  enName: string;
  routineType: RoutineType;
  splitLabel: string;
  focusTitle: string;
  musclesText: string;
  summaryText: string;
  dayEmphasisTitle: string;
  dayEmphasisDesc: string;
  targetSets: number;
}

export interface ExerciseMistake {
  mistake: string;
  fix: string;
}

export interface ExerciseDefinition {
  id: string;
  routineType: 'DAY1' | 'DAY2';
  num: string;
  name: string;
  bnSubtitle?: string;
  theme: MuscleTheme;
  muscleCategory: 'Chest' | 'Triceps' | 'Shoulders' | 'Core / Abs' | 'Back' | 'Biceps' | 'Cardio' | 'Legs';
  folder: string;
  tueFolder?: string;
  jointAction: string;
  mechanic: 'Compound' | 'Isolation' | 'Cardio Warm-Up';
  equipment: string;
  numSets: number;
  setsText: string;
  repsText: string;
  minReps: number;
  maxReps: number;
  exactReps: boolean;
  tempo: string;
  restText: string;
  defaultRestSeconds: number;
  rpe: string;
  isCardio?: boolean;
  rampUpEligible?: boolean;
  primary: string;
  secondary: string;
  stabilizers: string;
  variations: string;
  steps: string[];
  mistakes: ExerciseMistake[];
  breathing: string;
  mindMuscle: string;
  sessions: Exclude<DayCode, 'FRI'>[];
  sessionHeader: string;
}

export interface CardCustomization {
  exerciseId: string;
  numSets: number;
  repsText: string;
  minReps: number;
  maxReps: number;
  targetWeight: string;
  restSeconds: number;
  tempo: string;
  selectedVariation: string;
  customNotes: string;
  updatedAt: string;
}

export interface SetLogEntry {
  setNumber: number;
  weight: string;
  reps: string;
  completed: boolean;
  completedAt?: string;
  rpe?: string;
  synced?: boolean;
}

export interface CardioLogEntry {
  completed: boolean;
  rpmLevel: string;
  hrNotes: string;
  durationSeconds: number;
  completedAt?: string;
  synced?: boolean;
}

export interface ExerciseSessionLog {
  weekId: string;
  dayCode: Exclude<DayCode, 'FRI'>;
  exerciseId: string;
  sets: SetLogEntry[];
  cardio?: CardioLogEntry;
  notes?: string;
  updatedAt: string;
  synced: boolean;
}

export interface DailyPrepRecoveryLog {
  dateKey: string; // YYYY-MM-DD
  warmupDoneIds: string[];
  waterMl: number;
  bodyWeightKg: string;
  proteinGrams: string;
  sleepHours: string;
  preWorkoutMealDone: boolean;
  postWorkoutMealDone: boolean;
  fridayChecklistIds: string[];
  notes: string;
  updatedAt: string;
  synced?: boolean;
}

export interface SyncHistoryItem {
  id: string;
  timestamp: string;
  action: 'push' | 'pull' | 'export';
  status: 'success' | 'error';
  message: string;
  rowsCount?: number;
}

export interface SyncSettings {
  webAppUrl: string;
  sheetUrl: string;
  autoSync: boolean;
  lastSyncAt: string | null;
  history: SyncHistoryItem[];
  googleSignedIn?: boolean;
  googleEmail?: string;
  googleName?: string;
  soundHapticsEnabled?: boolean;
}

export interface WeeklyVolumeTarget {
  id: string;
  label: string;
  bnLabel: string;
  targetSets: number;
  targetText: string;
  color: string;
  categories: ExerciseDefinition['muscleCategory'][];
}
