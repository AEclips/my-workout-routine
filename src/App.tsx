import { Dumbbell, History } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ExerciseCardDeck } from './components/ExerciseCardDeck';
import { HistoryView } from './components/HistoryView';
import { RestTimerBar } from './components/RestTimerBar';
import {
  DAY1_EXERCISES,
  DAY2_EXERCISES,
  WEEKLY_SCHEDULE
} from './data/workoutBlueprint';
import {
  getAllWorkoutLogs,
  getDayCodeForDate,
  getRecentWeeks,
  restoreFromIdbIfEmpty,
  saveExerciseLog,
  type WorkoutLogsMap
} from './services/storageService';
import type { DayCode, ExerciseSessionLog } from './types/workout';
import {
  playTimerCompleteChime,
  setAudioHapticsEnabled,
  triggerHaptic
} from './utils/audioHaptics';

type AppTab = 'workout' | 'history';

export default function App() {
  const currentWeekId = useMemo(() => getRecentWeeks(1)[0].weekId, []);
  const [selectedDayCode, setSelectedDayCode] = useState<DayCode>(() => getDayCodeForDate());
  const [activeTab, setActiveTab] = useState<AppTab>('workout');
  const [cardIdx, setCardIdx] = useState<number>(0);
  const [logs, setLogs] = useState<WorkoutLogsMap>(() => getAllWorkoutLogs());

  // Rest Timer state (wall-clock anchored)
  const [timerActive, setTimerActive] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerTotal, setTimerTotal] = useState(60);
  const [timerExerciseName, setTimerExerciseName] = useState('');
  const [timerDoneAlert, setTimerDoneAlert] = useState(false);
  const timerEndAtRef = useRef<number | null>(null);

  useEffect(() => {
    setAudioHapticsEnabled(true);
    void restoreFromIdbIfEmpty().then((restored) => {
      if (restored) {
        setLogs(getAllWorkoutLogs());
      }
    });
  }, []);

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
  };

  const handleSelectDay = (code: DayCode) => {
    setSelectedDayCode(code);
    setCardIdx(0);
    triggerHaptic(12);
  };

  return (
    <div className="app-shell">
      {/* Minimal Top Bar */}
      <header className="minimal-top-bar">
        {activeTab === 'workout' ? (
          <div className="day-strip" role="tablist" aria-label="সাপ্তাহিক রুটিন">
            {WEEKLY_SCHEDULE.map((d) => {
              const active = d.code === selectedDayCode;
              const tag =
                d.routineType === 'OFF'
                  ? 'OFF'
                  : d.routineType === 'DAY1'
                    ? 'D1'
                    : 'D2';
              return (
                <button
                  key={d.code}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`day-pill ${d.routineType === 'OFF' ? 'is-off' : ''} ${active ? 'active' : ''}`}
                  onClick={() => handleSelectDay(d.code)}
                >
                  <span className="dp-day">{d.shortBn}</span>
                  <span className="dp-tag">{tag}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="history-top-title">হিস্ট্রি ও ওজন</div>
        )}
      </header>

      {/* Main Content */}
      <main className="main-scroll">
        {activeTab === 'workout' ? (
          <ExerciseCardDeck
            day={activeDay}
            weekId={currentWeekId}
            exercises={dayExercises}
            logs={logs}
            currentCardIdx={cardIdx}
            onSelectCardIdx={setCardIdx}
            onSaveLog={handleSaveLog}
          />
        ) : (
          <HistoryView logs={logs} />
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

      {/* Minimal 2-Tab Bottom Navigation */}
      <nav className="bottom-nav" aria-label="প্রধান মেনু">
        <button
          type="button"
          className={`bn-btn ${activeTab === 'workout' ? 'active' : ''}`}
          onClick={() => setActiveTab('workout')}
        >
          <Dumbbell size={20} />
          <span>ওয়ার্কআউট</span>
        </button>
        <button
          type="button"
          className={`bn-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={20} />
          <span>হিস্ট্রি</span>
        </button>
      </nav>
    </div>
  );
}
