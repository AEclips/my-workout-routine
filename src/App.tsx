import {
  BarChart3,
  Cloud,
  CloudOff,
  Dumbbell,
  Settings
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExerciseCardDeck } from './components/ExerciseCardDeck';
import { GoogleSheetsSyncView } from './components/GoogleSheetsSyncView';
import { OfflineAnalyticsView } from './components/OfflineAnalyticsView';
import { PrepRecoveryView } from './components/PrepRecoveryView';
import { RestTimerBar } from './components/RestTimerBar';
import {
  DAY1_EXERCISES,
  DAY2_EXERCISES,
  WEEKLY_SCHEDULE
} from './data/workoutBlueprint';
import { buildSyncPayload, pushToGoogleSheets } from './services/googleSheetsService';
import {
  computeWeekStats,
  getAllCustomizations,
  getAllRecoveryLogs,
  getAllWorkoutLogs,
  getDayCodeForDate,
  getEffectiveExercise,
  getLocalDateKey,
  getRecentWeeks,
  getRecoveryForDate,
  getSyncSettings,
  importFullBackupJson,
  makeSessionKey,
  markAllLogsSynced,
  resetCustomization,
  restoreFromIdbIfEmpty,
  saveCustomization,
  saveExerciseLog,
  saveRecoveryLog,
  saveSyncSettings,
  type WorkoutLogsMap
} from './services/storageService';
import type {
  CardCustomization,
  DailyPrepRecoveryLog,
  DayCode,
  ExerciseSessionLog,
  SyncSettings
} from './types/workout';
import {
  playTimerCompleteChime,
  setAudioHapticsEnabled,
  triggerHaptic
} from './utils/audioHaptics';

type AppTab = 'workout' | 'progress' | 'settings';

export default function App() {
  const recentWeeks = useMemo(() => getRecentWeeks(6), []);
  const [selectedWeekId, setSelectedWeekId] = useState<string>(recentWeeks[0].weekId);
  const [selectedDayCode, setSelectedDayCode] = useState<DayCode>(() => getDayCodeForDate());
  const [activeTab, setActiveTab] = useState<AppTab>('workout');
  const [progressSubTab, setProgressSubTab] = useState<'history' | 'prep'>('history');
  const [cardIdx, setCardIdx] = useState<number>(0);

  const [customMap, setCustomMap] = useState<Record<string, CardCustomization>>(() =>
    getAllCustomizations()
  );
  const [logs, setLogs] = useState<WorkoutLogsMap>(() => getAllWorkoutLogs());
  const [recoveryMap, setRecoveryMap] = useState<Record<string, DailyPrepRecoveryLog>>(() =>
    getAllRecoveryLogs()
  );
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(() => getSyncSettings());

  // Rest Timer state (wall-clock anchored so screen lock/background never drifts)
  const [timerActive, setTimerActive] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerTotal, setTimerTotal] = useState(60);
  const [timerExerciseName, setTimerExerciseName] = useState('');
  const [timerDoneAlert, setTimerDoneAlert] = useState(false);
  const timerEndAtRef = useRef<number | null>(null);

  const todayDateKey = getLocalDateKey();
  const todayRecovery = useMemo(
    () => recoveryMap[todayDateKey] || getRecoveryForDate(todayDateKey),
    [recoveryMap, todayDateKey]
  );

  useEffect(() => {
    void restoreFromIdbIfEmpty().then((restored) => {
      if (restored) {
        setCustomMap(getAllCustomizations());
        setLogs(getAllWorkoutLogs());
        setRecoveryMap(getAllRecoveryLogs());
        setSyncSettings(getSyncSettings());
      }
    });
  }, []);

  useEffect(() => {
    setAudioHapticsEnabled(syncSettings.soundHapticsEnabled ?? true);
  }, [syncSettings.soundHapticsEnabled]);

  // Rest Timer Countdown Effect (wall-clock anchored)
  useEffect(() => {
    if (!timerActive || !timerRunning) return;
    if (!timerEndAtRef.current) {
      timerEndAtRef.current = Date.now() + timerRemaining * 1000;
    }

    const syncClock = () => {
      if (!timerEndAtRef.current) return;
      const secsLeft = Math.max(0, Math.ceil((timerEndAtRef.current - Date.now()) / 1000));
      setTimerRemaining(secsLeft);
      if (secsLeft <= 0) {
        timerEndAtRef.current = null;
        setTimerRunning(false);
        setTimerDoneAlert(true);
        playTimerCompleteChime();
        triggerHaptic([160, 80, 160]);
      }
    };

    const id = window.setInterval(syncClock, 250);
    document.addEventListener('visibilitychange', syncClock);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', syncClock);
    };
  }, [timerActive, timerRunning]);

  const activeDay = useMemo(
    () => WEEKLY_SCHEDULE.find((d) => d.code === selectedDayCode) || WEEKLY_SCHEDULE[0],
    [selectedDayCode]
  );

  const dayExercises = useMemo(() => {
    if (activeDay.routineType === 'DAY1') return DAY1_EXERCISES;
    if (activeDay.routineType === 'DAY2') return DAY2_EXERCISES;
    return [];
  }, [activeDay.routineType]);

  const weekStats = useMemo(
    () => computeWeekStats(logs, selectedWeekId, customMap),
    [logs, selectedWeekId, customMap]
  );

  const currentWeekInfo = useMemo(
    () => recentWeeks.find((w) => w.weekId === selectedWeekId) || recentWeeks[0],
    [recentWeeks, selectedWeekId]
  );

  // Day session progress
  const dayProgress = useMemo(() => {
    if (activeDay.routineType === 'OFF') return { done: 0, total: 0 };
    const dCode = activeDay.code as Exclude<DayCode, 'FRI'>;
    let done = 0;
    let total = 0;
    for (const rawEx of dayExercises) {
      const eff = getEffectiveExercise(rawEx, customMap);
      const l = logs[makeSessionKey(selectedWeekId, dCode, rawEx.id)];
      if (rawEx.isCardio) {
        total += 1;
        if (l?.cardio?.completed) done += 1;
      } else {
        total += eff.numSets;
        if (l) done += l.sets.filter((s) => s.completed).length;
      }
    }
    return { done, total };
  }, [activeDay, dayExercises, customMap, logs, selectedWeekId]);

  const triggerAutoSyncIfEnabled = useCallback(
    (
      nextCustom: Record<string, CardCustomization>,
      nextLogs: WorkoutLogsMap,
      nextRec: Record<string, DailyPrepRecoveryLog>
    ) => {
      if (!syncSettings.autoSync || !syncSettings.webAppUrl || !navigator.onLine) return;
      const payload = buildSyncPayload(nextCustom, nextLogs, nextRec);
      void pushToGoogleSheets(syncSettings.webAppUrl, payload)
        .then((res) => {
          if (res.ok) {
            setLogs((prev) => markAllLogsSynced(prev));
          }
        })
        .catch(() => {
          // Keep locally marked offline if request fails silently
        });
    },
    [syncSettings.autoSync, syncSettings.webAppUrl]
  );

  const handleSaveLog = (
    updatedLog: ExerciseSessionLog,
    startRestSeconds?: number,
    exerciseName?: string
  ) => {
    const nextLogs = saveExerciseLog(updatedLog);
    setLogs(nextLogs);

    if (startRestSeconds && startRestSeconds > 0) {
      timerEndAtRef.current = Date.now() + startRestSeconds * 1000;
      setTimerTotal(startRestSeconds);
      setTimerRemaining(startRestSeconds);
      setTimerExerciseName(exerciseName || '');
      setTimerDoneAlert(false);
      setTimerActive(true);
      setTimerRunning(true);
    }

    if (startRestSeconds) {
      triggerAutoSyncIfEnabled(customMap, nextLogs, recoveryMap);
    }
  };

  const handleSaveCustomization = (custom: CardCustomization) => {
    const next = saveCustomization(custom);
    setCustomMap(next);

    if (activeDay.routineType !== 'OFF') {
      const dCode = activeDay.code as Exclude<DayCode, 'FRI'>;
      const key = makeSessionKey(selectedWeekId, dCode, custom.exerciseId);
      const existing = logs[key];
      if (existing && existing.sets.length > 0) {
        const resizedSets = Array.from({ length: custom.numSets }, (_, idx) => {
          const old = existing.sets[idx];
          if (old) {
            const shouldPrefill = !old.completed && old.weight === '' && custom.targetWeight !== '';
            return shouldPrefill ? { ...old, weight: custom.targetWeight } : old;
          }
          return {
            setNumber: idx + 1,
            weight: custom.targetWeight,
            reps: '',
            completed: false,
            synced: false
          };
        });
        setLogs(saveExerciseLog({ ...existing, sets: resizedSets }));
      }
    }
  };

  const handleResetCustomization = (exerciseId: string) => {
    const next = resetCustomization(exerciseId);
    setCustomMap(next);
  };

  const handleUpdateRecovery = (updated: DailyPrepRecoveryLog) => {
    const next = saveRecoveryLog(updated);
    setRecoveryMap(next);
  };

  const handleToggleWarmupItem = (itemId: string) => {
    const exists = todayRecovery.warmupDoneIds.includes(itemId);
    const warmupDoneIds = exists
      ? todayRecovery.warmupDoneIds.filter((id) => id !== itemId)
      : [...todayRecovery.warmupDoneIds, itemId];
    handleUpdateRecovery({ ...todayRecovery, warmupDoneIds });
  };

  const handleToggleFridayItem = (itemId: string) => {
    const exists = todayRecovery.fridayChecklistIds.includes(itemId);
    const fridayChecklistIds = exists
      ? todayRecovery.fridayChecklistIds.filter((id) => id !== itemId)
      : [...todayRecovery.fridayChecklistIds, itemId];
    handleUpdateRecovery({ ...todayRecovery, fridayChecklistIds });
  };

  const handleSelectDay = (code: DayCode) => {
    setSelectedDayCode(code);
    setCardIdx(0);
    triggerHaptic(12);
  };

  const handleJumpToExercise = (dayCode: DayCode, exerciseIndex: number) => {
    setSelectedDayCode(dayCode);
    setCardIdx(Math.max(0, exerciseIndex));
    setActiveTab('workout');
  };

  const handleImportFullBackup = (jsonText: string) => {
    const res = importFullBackupJson(jsonText);
    setCustomMap(res.customizations);
    setLogs(res.workoutLogs);
    setRecoveryMap(res.recoveryLogs);
  };

  return (
    <div className="app-shell">
      {/* Slim Minimal Top Header */}
      <header className="top-header">
        <div className="th-top-row">
          <div className="th-brand">
            <div className="th-logo" aria-hidden="true">
              <svg viewBox="0 0 64 64" width="24" height="24" fill="none">
                <circle cx="32" cy="32" r="26" stroke="url(#hdrRing)" strokeWidth="3.5" strokeDasharray="115 48" strokeLinecap="round" />
                <rect x="11" y="25" width="4.5" height="14" rx="2" fill="#FF6B2B" />
                <rect x="17.5" y="20" width="6" height="24" rx="2.5" fill="#FF8A4C" />
                <rect x="40.5" y="20" width="6" height="24" rx="2.5" fill="#38BDF8" />
                <rect x="48.5" y="25" width="4.5" height="14" rx="2" fill="#2DD4BF" />
                <rect x="23.5" y="29" width="17" height="6" rx="2" fill="#F8FAFC" />
                <defs>
                  <linearGradient id="hdrRing" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FF5A1F" />
                    <stop offset="1" stopColor="#2DD4BF" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="th-title-block">
              <h1>My Workout Routine</h1>
              <div className="th-sub">
                {activeTab === 'workout'
                  ? activeDay.routineType === 'OFF'
                    ? `${activeDay.bnName} • বিশ্রাম ও Recovery`
                    : `${activeDay.bnName} • ${activeDay.focusTitle} • ${dayProgress.done}/${dayProgress.total} সেট`
                  : activeTab === 'progress'
                    ? 'প্রগ্রেস, ১৪ দিনের হিস্ট্রি ও পুষ্টি'
                    : 'সেটিংস ও Google Sheets সিঙ্ক'}
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`net-status-pill ${weekStats.unsyncedCount === 0 ? 'online' : 'offline'}`}
            onClick={() => setActiveTab('settings')}
            aria-label="Sync status"
          >
            {weekStats.unsyncedCount > 0 ? (
              <>
                <CloudOff size={14} /> {weekStats.unsyncedCount}
              </>
            ) : (
              <>
                <Cloud size={14} />
              </>
            )}
          </button>
        </div>

        {/* 7-Day Split Selector (Shown cleanly ONLY on Workout tab) */}
        {activeTab === 'workout' && (
          <div className="day-strip" role="tablist" aria-label="Weekly training split">
            {WEEKLY_SCHEDULE.map((d) => {
              const active = d.code === selectedDayCode;
              const cls =
                d.routineType === 'DAY1'
                  ? 'is-d1'
                  : d.routineType === 'DAY2'
                    ? 'is-d2'
                    : 'is-off';
              return (
                <button
                  key={d.code}
                  type="button"
                  className={`day-chip ${cls} ${active ? 'active' : ''}`}
                  onClick={() => handleSelectDay(d.code)}
                >
                  <span className="dc-bn">{d.shortBn}</span>
                  <span className="dc-split">
                    {d.routineType === 'OFF' ? 'OFF' : d.splitLabel.replace('DAY 0', 'D')}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Body */}
      <main className="main-scroll">
        {activeTab === 'workout' && (
          <ExerciseCardDeck
            day={activeDay}
            weekId={selectedWeekId}
            exercises={dayExercises}
            customMap={customMap}
            logs={logs}
            recoveryLog={todayRecovery}
            currentCardIdx={cardIdx}
            onSelectCardIdx={setCardIdx}
            onSaveLog={handleSaveLog}
            onSaveCustomization={handleSaveCustomization}
            onResetCustomization={handleResetCustomization}
            onToggleFridayItem={handleToggleFridayItem}
          />
        )}

        {activeTab === 'progress' && (
          <div className="tab-view-container">
            <div className="subtab-segment" role="tablist">
              <button
                type="button"
                className={`seg-btn ${progressSubTab === 'history' ? 'active' : ''}`}
                onClick={() => setProgressSubTab('history')}
              >
                হিস্ট্রি ও ভলিউম
              </button>
              <button
                type="button"
                className={`seg-btn ${progressSubTab === 'prep' ? 'active' : ''}`}
                onClick={() => setProgressSubTab('prep')}
              >
                পানি, পুষ্টি ও Prep
              </button>
            </div>

            {progressSubTab === 'history' ? (
              <OfflineAnalyticsView
                weekId={selectedWeekId}
                weekLabel={currentWeekInfo.label}
                recentWeeks={recentWeeks}
                onSelectWeek={setSelectedWeekId}
                logs={logs}
                customMap={customMap}
                onJumpToExercise={handleJumpToExercise}
              />
            ) : (
              <PrepRecoveryView
                routineType={activeDay.routineType}
                recovery={todayRecovery}
                onUpdateRecovery={handleUpdateRecovery}
                onToggleWarmupItem={handleToggleWarmupItem}
                onToggleFridayItem={handleToggleFridayItem}
              />
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <GoogleSheetsSyncView
            syncSettings={syncSettings}
            customizations={customMap}
            workoutLogs={logs}
            recoveryLogs={recoveryMap}
            todayRecovery={todayRecovery}
            unsyncedCount={weekStats.unsyncedCount}
            onUpdateSyncSettings={(next) => setSyncSettings(saveSyncSettings(next))}
            onUpdateRecovery={handleUpdateRecovery}
            onMarkLogsSynced={() => setLogs((prev) => markAllLogsSynced(prev))}
            onImportFullBackup={handleImportFullBackup}
          />
        )}
      </main>

      {/* Floating Rest Timer Overlay */}
      {timerActive && (
        <RestTimerBar
          remainingSeconds={timerRemaining}
          totalSeconds={timerTotal}
          exerciseName={timerExerciseName}
          isRunning={timerRunning}
          isCompletedAlert={timerDoneAlert}
          onTogglePause={() => {
            if (timerRunning) {
              timerEndAtRef.current = null;
              setTimerRunning(false);
            } else {
              timerEndAtRef.current = Date.now() + timerRemaining * 1000;
              setTimerRunning(true);
            }
          }}
          onAdjust={(delta) => {
            const nextSecs = Math.max(5, timerRemaining + delta);
            setTimerRemaining(nextSecs);
            if (timerRunning) {
              timerEndAtRef.current = Date.now() + nextSecs * 1000;
            }
          }}
          onSkip={() => {
            timerEndAtRef.current = null;
            setTimerActive(false);
            setTimerRunning(false);
            setTimerDoneAlert(false);
          }}
        />
      )}

      {/* Minimal 3-Tab Bottom Navigation */}
      <nav className="bottom-nav bottom-nav-3" aria-label="Main navigation">
        <button
          type="button"
          className={`bn-item ${activeTab === 'workout' ? 'active' : ''}`}
          onClick={() => setActiveTab('workout')}
        >
          <Dumbbell size={21} />
          <span>ওয়ার্কআউট</span>
        </button>
        <button
          type="button"
          className={`bn-item ${activeTab === 'progress' ? 'active' : ''}`}
          onClick={() => setActiveTab('progress')}
        >
          <BarChart3 size={21} />
          <span>প্রগ্রেস</span>
        </button>
        <button
          type="button"
          className={`bn-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={21} />
          <span>সেটিংস</span>
        </button>
      </nav>
    </div>
  );
}
