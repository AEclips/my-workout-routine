import { MUKTO_PROFILE } from '../data/muktoHistory';
import { ALL_EXERCISES, WEEKLY_SCHEDULE } from '../data/workoutBlueprint';
import type {
  CardCustomization,
  DailyPrepRecoveryLog,
  DayCode,
  ExerciseDefinition,
  ExerciseSessionLog,
  SetLogEntry,
  SyncSettings
} from '../types/workout';

const KEYS = {
  CUSTOMIZATIONS: 'hw_card_customizations_v1',
  LOGS: 'hw_workout_logs_v1',
  RECOVERY: 'hw_prep_recovery_v1',
  SYNC: 'hw_sync_settings_v1'
};

const IDB_NAME = 'HypertrophyWorkoutBD';
const IDB_STORE = 'state_backup';

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function mirrorToIdb(key: string, value: unknown): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
  } catch {
    // Ignore IDB mirror failures; localStorage remains primary synchronous store
  }
}

export async function restoreFromIdbIfEmpty(): Promise<boolean> {
  const db = await openIdb();
  if (!db) return false;
  let restored = false;
  for (const key of Object.values(KEYS)) {
    if (!localStorage.getItem(key)) {
      const val = await new Promise<string | null>((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).get(key);
          req.onsuccess = () => resolve(req.result ? JSON.stringify(req.result) : null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      if (val) {
        localStorage.setItem(key, val);
        restored = true;
      }
    }
  }
  return restored;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    void mirrorToIdb(key, data);
  } catch {
    // Storage quota error ignored safely
  }
}

// ---------- Date & Training Week (Saturday -> Friday) Helpers ----------

export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDayCodeForDate(date = new Date()): DayCode {
  // JS getDay: 0=SUN, 1=MON, 2=TUE, 3=WED, 4=THU, 5=FRI, 6=SAT
  const map: DayCode[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return map[date.getDay()];
}

export function getTrainingWeekInfo(offsetWeeks = 0): {
  weekId: string;
  startKey: string;
  endKey: string;
  label: string;
} {
  const now = new Date();
  const jsDay = now.getDay(); // 6 = SAT -> 0 days since SAT, 0 = SUN -> 1, ..., 5 = FRI -> 6
  const daysSinceSaturday = (jsDay + 1) % 7;
  const satDate = new Date(now);
  satDate.setHours(0, 0, 0, 0);
  satDate.setDate(satDate.getDate() - daysSinceSaturday + offsetWeeks * 7);

  const friDate = new Date(satDate);
  friDate.setDate(satDate.getDate() + 6);

  const startKey = getLocalDateKey(satDate);
  const endKey = getLocalDateKey(friDate);
  const fmt = (d: Date) =>
    d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });

  return {
    weekId: `W_${startKey}`,
    startKey,
    endKey,
    label: `${fmt(satDate)} – ${fmt(friDate)}`
  };
}

export function getRecentWeeks(count = 6) {
  return Array.from({ length: count }, (_, idx) => {
    const info = getTrainingWeekInfo(-idx);
    return {
      ...info,
      isCurrent: idx === 0,
      badge: idx === 0 ? 'চলতি সপ্তাহ' : `${idx} সপ্তাহ আগে`
    };
  });
}

// ---------- Card Customizations ----------

export function getAllCustomizations(): Record<string, CardCustomization> {
  return readJson<Record<string, CardCustomization>>(KEYS.CUSTOMIZATIONS, {});
}

export function getEffectiveExercise(
  ex: ExerciseDefinition,
  customMap: Record<string, CardCustomization>
): ExerciseDefinition & {
  targetWeight: string;
  restSeconds: number;
  customNotes: string;
  selectedVariation: string;
  isCustomized: boolean;
} {
  const c = customMap[ex.id];
  if (!c) {
    return {
      ...ex,
      targetWeight: '',
      restSeconds: ex.defaultRestSeconds,
      customNotes: '',
      selectedVariation: '',
      isCustomized: false
    };
  }
  return {
    ...ex,
    numSets: c.numSets,
    setsText: ex.isCardio ? ex.setsText : `${c.numSets} Sets`,
    repsText: c.repsText || ex.repsText,
    minReps: c.minReps,
    maxReps: c.maxReps,
    tempo: c.tempo || ex.tempo,
    defaultRestSeconds: c.restSeconds,
    restText: `${c.restSeconds}s`,
    targetWeight: c.targetWeight || '',
    restSeconds: c.restSeconds,
    customNotes: c.customNotes || '',
    selectedVariation: c.selectedVariation || '',
    isCustomized: true
  };
}

export function saveCustomization(custom: CardCustomization): Record<string, CardCustomization> {
  const map = getAllCustomizations();
  map[custom.exerciseId] = { ...custom, updatedAt: new Date().toISOString() };
  writeJson(KEYS.CUSTOMIZATIONS, map);
  return map;
}

export function resetCustomization(exerciseId: string): Record<string, CardCustomization> {
  const map = getAllCustomizations();
  delete map[exerciseId];
  writeJson(KEYS.CUSTOMIZATIONS, map);
  return map;
}

// ---------- Workout Session Logs ----------

export type WorkoutLogsMap = Record<string, ExerciseSessionLog>;

export function makeSessionKey(
  weekId: string,
  dayCode: Exclude<DayCode, 'FRI'>,
  exerciseId: string
): string {
  return `${weekId}__${dayCode}__${exerciseId}`;
}

export function getAllWorkoutLogs(): WorkoutLogsMap {
  return readJson<WorkoutLogsMap>(KEYS.LOGS, {});
}

export function buildDefaultSets(numSets: number, targetWeight = ''): SetLogEntry[] {
  return Array.from({ length: numSets }, (_, idx) => ({
    setNumber: idx + 1,
    weight: targetWeight,
    reps: '',
    completed: false,
    synced: false
  }));
}

export function getOrInitExerciseLog(
  logs: WorkoutLogsMap,
  weekId: string,
  dayCode: Exclude<DayCode, 'FRI'>,
  exercise: ExerciseDefinition,
  targetWeight = ''
): ExerciseSessionLog {
  const key = makeSessionKey(weekId, dayCode, exercise.id);
  const existing = logs[key];
  if (existing) {
    // Adapt set array length if user customized numSets
    if (!exercise.isCardio && existing.sets.length !== exercise.numSets) {
      const adjusted: SetLogEntry[] = Array.from({ length: exercise.numSets }, (_, idx) => {
        const old = existing.sets[idx];
        return (
          old || {
            setNumber: idx + 1,
            weight: targetWeight,
            reps: '',
            completed: false,
            synced: false
          }
        );
      });
      return { ...existing, sets: adjusted };
    }
    return existing;
  }

  return {
    weekId,
    dayCode,
    exerciseId: exercise.id,
    sets: exercise.isCardio ? [] : buildDefaultSets(exercise.numSets, targetWeight),
    cardio: exercise.isCardio
      ? {
          completed: false,
          rpmLevel: '75 RPM / Level 4',
          hrNotes: '',
          durationSeconds: 300,
          synced: false
        }
      : undefined,
    updatedAt: new Date().toISOString(),
    synced: false
  };
}

export function saveExerciseLog(log: ExerciseSessionLog): WorkoutLogsMap {
  const map = getAllWorkoutLogs();
  const key = makeSessionKey(log.weekId, log.dayCode, log.exerciseId);
  map[key] = {
    ...log,
    updatedAt: new Date().toISOString(),
    synced: false
  };
  writeJson(KEYS.LOGS, map);
  return map;
}

export function markAllLogsSynced(logs: WorkoutLogsMap): WorkoutLogsMap {
  const updated: WorkoutLogsMap = {};
  for (const [k, entry] of Object.entries(logs)) {
    updated[k] = {
      ...entry,
      synced: true,
      sets: entry.sets.map((s) => ({ ...s, synced: true })),
      cardio: entry.cardio ? { ...entry.cardio, synced: true } : undefined
    };
  }
  writeJson(KEYS.LOGS, updated);
  return updated;
}

// ---------- Double Progression & Personal Records ----------

export interface ProgressionInsight {
  previousLog: ExerciseSessionLog | null;
  previousLabel: string;
  shouldIncreaseWeight: boolean;
  reasonBn: string;
  bestWeightKg: number;
  bestVolumeSetLabel: string;
}

export function getProgressionInsight(
  logs: WorkoutLogsMap,
  currentWeekId: string,
  currentDayCode: Exclude<DayCode, 'FRI'>,
  exercise: ExerciseDefinition
): ProgressionInsight {
  const allForExercise = Object.values(logs)
    .filter((l) => l.exerciseId === exercise.id)
    .filter((l) => !(l.weekId === currentWeekId && l.dayCode === currentDayCode))
    .filter((l) =>
      exercise.isCardio
        ? Boolean(l.cardio?.completed)
        : l.sets.some((s) => s.completed || s.weight !== '' || s.reps !== '')
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  let bestWeight = 0;
  let bestRepsWhenBw = 0;
  let bestLabel = '—';
  const currentKey = makeSessionKey(currentWeekId, currentDayCode, exercise.id);
  const allIncludingCurrent = [...allForExercise, ...(logs[currentKey] ? [logs[currentKey]] : [])];

  for (const log of allIncludingCurrent) {
    for (const s of log.sets) {
      const w = parseFloat(s.weight || '0');
      const r = parseInt(s.reps || '0', 10);
      if (!s.completed && r <= 0) continue;
      if (!Number.isNaN(w) && w > 0) {
        if (w > bestWeight) {
          bestWeight = w;
          bestLabel = `${w}kg × ${r || '?'}`;
        }
      } else if (bestWeight === 0 && !Number.isNaN(r) && r > bestRepsWhenBw) {
        bestRepsWhenBw = r;
        bestLabel = `BW × ${r}`;
      }
    }
  }

  const prev = allForExercise[0] || null;
  if (!prev) {
    return {
      previousLog: null,
      previousLabel: 'প্রথম সেশন — বেসলাইন ওজন সেট করুন',
      shouldIncreaseWeight: false,
      reasonBn: '',
      bestWeightKg: bestWeight,
      bestVolumeSetLabel: bestLabel
    };
  }

  if (exercise.isCardio) {
    return {
      previousLog: prev,
      previousLabel: `${prev.dayCode} (${prev.weekId.replace('W_', '')}): ${prev.cardio?.rpmLevel || 'Done'}`,
      shouldIncreaseWeight: false,
      reasonBn: '',
      bestWeightKg: bestWeight,
      bestVolumeSetLabel: bestLabel
    };
  }

  const completedSets = prev.sets.filter((s) => s.completed);
  const summary = prev.sets
    .map((s) => `${s.weight || 'BW'}×${s.reps || '-'}`)
    .join(' | ');

  const allCompleted = completedSets.length >= exercise.numSets;
  const hitMaxReps =
    allCompleted &&
    completedSets.every((s) => {
      const r = parseInt(s.reps || '0', 10);
      return !Number.isNaN(r) && r >= exercise.maxReps;
    });

  return {
    previousLog: prev,
    previousLabel: `আগের লগ (${prev.dayCode}): ${summary}`,
    shouldIncreaseWeight: hitMaxReps,
    reasonBn: hitMaxReps
      ? `আগের সেশনে সব ${exercise.numSets} সেটে ${exercise.maxReps}+ রেপ পূর্ণ হয়েছে! আজ ১–২.৫ kg ওজন বাড়ান (Double Progression)।`
      : '',
    bestWeightKg: bestWeight,
    bestVolumeSetLabel: bestLabel
  };
}

// ---------- Weekly Metrics & Volume ----------

export function computeWeekStats(
  logs: WorkoutLogsMap,
  weekId: string,
  customMap: Record<string, CardCustomization>
) {
  let completedSets = 0;
  let totalTargetSets = 0;
  let totalTonnageKg = 0;
  let cyclingMinutes = 0;
  let unsyncedCount = 0;

  const dayTrainingOrder = WEEKLY_SCHEDULE.filter((d) => d.routineType !== 'OFF') as Array<
    (typeof WEEKLY_SCHEDULE)[number] & { code: Exclude<DayCode, 'FRI'> }
  >;

  const categoryCompleted: Record<string, number> = {
    Legs: 0,
    Back: 0,
    Chest: 0,
    Shoulders: 0,
    Triceps: 0,
    Biceps: 0,
    'Core / Abs': 0,
    Cardio: 0
  };

  const categoryTargets: Record<string, number> = {
    Legs: 0,
    Back: 0,
    Chest: 0,
    Shoulders: 0,
    Triceps: 0,
    Biceps: 0,
    'Core / Abs': 0,
    Cardio: 0
  };

  for (const day of dayTrainingOrder) {
    const dayExercises = ALL_EXERCISES.filter((e) => e.routineType === day.routineType);
    for (const rawEx of dayExercises) {
      const ex = getEffectiveExercise(rawEx, customMap);
      if (!ex.isCardio) {
        totalTargetSets += ex.numSets;
        categoryTargets[ex.muscleCategory] = (categoryTargets[ex.muscleCategory] || 0) + ex.numSets;
      } else {
        categoryTargets.Cardio = (categoryTargets.Cardio || 0) + 1;
      }

      const key = makeSessionKey(weekId, day.code, ex.id);
      const log = logs[key];
      if (!log) continue;
      if (!log.synced && (log.sets.some((s) => s.completed) || log.cardio?.completed)) {
        unsyncedCount += 1;
      }

      if (ex.isCardio) {
        if (log.cardio?.completed) {
          cyclingMinutes += Math.round((log.cardio.durationSeconds || 300) / 60);
          categoryCompleted.Cardio += 1;
        }
      } else {
        for (const s of log.sets) {
          if (s.completed) {
            completedSets += 1;
            categoryCompleted[ex.muscleCategory] = (categoryCompleted[ex.muscleCategory] || 0) + 1;
            const w = parseFloat(s.weight || '0');
            const r = parseInt(s.reps || '0', 10);
            if (!Number.isNaN(w) && !Number.isNaN(r)) {
              totalTonnageKg += w * r;
            }
          }
        }
      }
    }
  }

  return {
    completedSets,
    totalTargetSets,
    totalTonnageKg: Math.round(totalTonnageKg),
    cyclingMinutes,
    categoryCompleted,
    categoryTargets,
    unsyncedCount
  };
}

// ---------- Prep & Recovery Logs ----------

export function getAllRecoveryLogs(): Record<string, DailyPrepRecoveryLog> {
  return readJson<Record<string, DailyPrepRecoveryLog>>(KEYS.RECOVERY, {});
}

export function getRecoveryForDate(dateKey = getLocalDateKey()): DailyPrepRecoveryLog {
  const map = getAllRecoveryLogs();
  return (
    map[dateKey] || {
      dateKey,
      warmupDoneIds: [],
      waterMl: 0,
      bodyWeightKg: MUKTO_PROFILE.latestWeightKg,
      proteinGrams: '',
      sleepHours: '',
      preWorkoutMealDone: false,
      postWorkoutMealDone: false,
      fridayChecklistIds: [],
      notes: '',
      updatedAt: new Date().toISOString(),
      synced: false
    }
  );
}

export function saveRecoveryLog(entry: DailyPrepRecoveryLog): Record<string, DailyPrepRecoveryLog> {
  const map = getAllRecoveryLogs();
  map[entry.dateKey] = {
    ...entry,
    updatedAt: new Date().toISOString(),
    synced: false
  };
  writeJson(KEYS.RECOVERY, map);
  return map;
}

// ---------- Sync Settings ----------

export function getSyncSettings(): SyncSettings {
  const saved = readJson<Partial<SyncSettings>>(KEYS.SYNC, {});
  return {
    webAppUrl: saved.webAppUrl || '',
    sheetUrl: saved.sheetUrl || MUKTO_PROFILE.defaultSheetUrl,
    autoSync: saved.autoSync ?? false,
    lastSyncAt: saved.lastSyncAt ?? null,
    history: saved.history ?? [],
    googleSignedIn: saved.googleSignedIn ?? false,
    googleEmail: saved.googleEmail || MUKTO_PROFILE.email,
    googleName: saved.googleName || MUKTO_PROFILE.name,
    soundHapticsEnabled: saved.soundHapticsEnabled ?? true
  };
}

export function saveSyncSettings(settings: SyncSettings): SyncSettings {
  writeJson(KEYS.SYNC, settings);
  return settings;
}

// ---------- Full Export / Restore ----------

export function exportFullBackupJson(): string {
  return JSON.stringify(
    {
      app: 'Hypertrophy Guide BD',
      version: 1,
      exportedAt: new Date().toISOString(),
      customizations: getAllCustomizations(),
      workoutLogs: getAllWorkoutLogs(),
      recoveryLogs: getAllRecoveryLogs(),
      syncSettings: getSyncSettings()
    },
    null,
    2
  );
}

export function importFullBackupJson(jsonText: string): {
  customizations: Record<string, CardCustomization>;
  workoutLogs: WorkoutLogsMap;
  recoveryLogs: Record<string, DailyPrepRecoveryLog>;
} {
  const parsed = JSON.parse(jsonText) as {
    customizations?: Record<string, CardCustomization>;
    workoutLogs?: WorkoutLogsMap;
    recoveryLogs?: Record<string, DailyPrepRecoveryLog>;
  };

  const customizations = { ...getAllCustomizations(), ...(parsed.customizations || {}) };
  const workoutLogs = { ...getAllWorkoutLogs(), ...(parsed.workoutLogs || {}) };
  const recoveryLogs = { ...getAllRecoveryLogs(), ...(parsed.recoveryLogs || {}) };

  writeJson(KEYS.CUSTOMIZATIONS, customizations);
  writeJson(KEYS.LOGS, workoutLogs);
  writeJson(KEYS.RECOVERY, recoveryLogs);

  return { customizations, workoutLogs, recoveryLogs };
}

export function exportWorkoutCsv(logs: WorkoutLogsMap): string {
  const headers = [
    'Week',
    'Day',
    'Routine',
    'Exercise No',
    'Exercise Name',
    'Muscle Group',
    'Set / Type',
    'Weight (kg)',
    'Reps / RPM',
    'Completed',
    'Timestamp'
  ];

  const exMap = new Map(ALL_EXERCISES.map((e) => [e.id, e]));
  const rows: string[][] = [headers];

  const sortedLogs = Object.values(logs).sort((a, b) => a.weekId.localeCompare(b.weekId));
  for (const log of sortedLogs) {
    const ex = exMap.get(log.exerciseId);
    if (!ex) continue;
    if (ex.isCardio && log.cardio) {
      rows.push([
        log.weekId,
        log.dayCode,
        ex.routineType,
        ex.num,
        ex.name,
        ex.muscleCategory,
        'Cardio 5m',
        log.cardio.hrNotes || '-',
        log.cardio.rpmLevel || '-',
        log.cardio.completed ? 'YES' : 'NO',
        log.cardio.completedAt || log.updatedAt
      ]);
    } else {
      for (const s of log.sets) {
        if (!s.completed && !s.weight && !s.reps) continue;
        rows.push([
          log.weekId,
          log.dayCode,
          ex.routineType,
          ex.num,
          ex.name,
          ex.muscleCategory,
          `S${s.setNumber}`,
          s.weight || '0',
          s.reps || '0',
          s.completed ? 'YES' : 'NO',
          s.completedAt || log.updatedAt
        ]);
      }
    }
  }

  const csvBody = rows
    .map((cols) =>
      cols
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');

  // UTF-8 BOM for clean Bengali display in Google Sheets & Excel
  return '\uFEFF' + csvBody;
}
