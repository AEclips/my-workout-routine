import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  HelpCircle,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Wind,
  X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getOrInitExerciseLog, type WorkoutLogsMap } from '../services/storageService';
import type {
  DayCode,
  DaySchedule,
  ExerciseDefinition,
  ExerciseSessionLog
} from '../types/workout';
import { playSetCheckSound, playTimerCompleteChime, triggerHaptic } from '../utils/audioHaptics';

interface ExerciseCardDeckProps {
  day: DaySchedule;
  weekId: string;
  exercises: ExerciseDefinition[];
  logs: WorkoutLogsMap;
  currentCardIdx: number;
  onSelectCardIdx: (idx: number) => void;
  onSaveLog: (log: ExerciseSessionLog, startTimerSeconds?: number, exerciseName?: string) => void;
}

export function ExerciseCardDeck({
  day,
  weekId,
  exercises,
  logs,
  currentCardIdx,
  onSelectCardIdx,
  onSaveLog
}: ExerciseCardDeckProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<{ src: string; caption: string } | null>(null);

  // Touch swipe state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);

  // Stationary Bike 5-min timer state (wall-clock anchored)
  const [bikeSecondsLeft, setBikeSecondsLeft] = useState(300);
  const [bikeRunning, setBikeRunning] = useState(false);
  const bikeEndAtRef = useRef<number | null>(null);

  const safeIdx = Math.min(currentCardIdx, Math.max(0, exercises.length - 1));
  const ex = exercises[safeIdx] || null;

  useEffect(() => {
    setGuideOpen(false);
    setZoomPhoto(null);
  }, [ex?.id, day.code]);

  // Stationary Bike 5-Min Countdown (wall-clock anchored)
  useEffect(() => {
    if (!bikeRunning) return;
    if (!bikeEndAtRef.current) {
      bikeEndAtRef.current = Date.now() + bikeSecondsLeft * 1000;
    }

    const syncBike = () => {
      if (!bikeEndAtRef.current) return;
      const secs = Math.max(0, Math.ceil((bikeEndAtRef.current - Date.now()) / 1000));
      setBikeSecondsLeft(secs);
      if (secs <= 0) {
        bikeEndAtRef.current = null;
        setBikeRunning(false);
        playTimerCompleteChime();
        triggerHaptic([120, 80, 120]);
      }
    };

    const id = window.setInterval(syncBike, 250);
    document.addEventListener('visibilitychange', syncBike);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', syncBike);
    };
  }, [bikeRunning]);

  // Calm Friday Off-Day Screen
  if (day.routineType === 'OFF') {
    return (
      <div className="deck-shell">
        <div className="off-day-card">
          <div className="off-icon-wrap">
            <Moon size={30} />
          </div>
          <h2>শুক্রবার • বিশ্রামের দিন</h2>
          <p>{day.dayEmphasisDesc}</p>

          <div className="off-metrics">
            <div className="off-metric">
              <strong>৭.৫–৯ ঘণ্টা</strong>
              <span>ঘুম</span>
            </div>
            <div className="off-metric">
              <strong>৩–৪ লিটার</strong>
              <span>পানি</span>
            </div>
            <div className="off-metric">
              <strong>১.৬–২.২g/kg</strong>
              <span>প্রোটিন</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!ex) return null;

  const activeDayCode = day.code as Exclude<DayCode, 'FRI'>;
  const sessionLog = getOrInitExerciseLog(logs, weekId, activeDayCode, ex, '');

  const photoFolder = activeDayCode === 'TUE' && ex.tueFolder ? ex.tueFolder : ex.folder;
  const imgStart = `/images/${photoFolder}_0.jpg`;
  const imgFinish = `/images/${photoFolder}_1.jpg`;
  const displayName =
    activeDayCode === 'TUE' && ex.id === 'd2_01_pullups' ? 'Chin-Ups (Tue)' : ex.name;

  const progressPct = Math.round(((safeIdx + 1) / exercises.length) * 100);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, a')) {
      touchStartX.current = null;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > 14) {
      setDragOffsetX(Math.max(-84, Math.min(84, dx * 0.45)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) {
      setDragOffsetX(0);
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    setDragOffsetX(0);

    if (Math.abs(dx) > 58 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0 && safeIdx < exercises.length - 1) {
        triggerHaptic(15);
        onSelectCardIdx(safeIdx + 1);
      } else if (dx > 0 && safeIdx > 0) {
        triggerHaptic(15);
        onSelectCardIdx(safeIdx - 1);
      }
    }
  };

  const handleToggleSet = (setIdx: number) => {
    const prev = sessionLog.sets[setIdx];
    const nextCompleted = !prev.completed;
    const updatedSets = sessionLog.sets.map((s, i) =>
      i === setIdx
        ? {
            ...s,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined
          }
        : s
    );

    if (nextCompleted) {
      playSetCheckSound();
      triggerHaptic(25);
      onSaveLog({ ...sessionLog, sets: updatedSets }, ex.defaultRestSeconds, displayName);
    } else {
      triggerHaptic(12);
      onSaveLog({ ...sessionLog, sets: updatedSets });
    }
  };

  const handleToggleCardioDone = () => {
    const cur = sessionLog.cardio || {
      completed: false,
      rpmLevel: '75 RPM / Level 4',
      hrNotes: '',
      durationSeconds: 300
    };
    const nextCompleted = !cur.completed;
    const nextCardio = {
      ...cur,
      completed: nextCompleted,
      durationSeconds: 300 - bikeSecondsLeft || 300,
      completedAt: nextCompleted ? new Date().toISOString() : undefined
    };

    if (nextCompleted) {
      playSetCheckSound();
      triggerHaptic(30);
      onSaveLog({ ...sessionLog, cardio: nextCardio }, ex.defaultRestSeconds, displayName);
    } else {
      triggerHaptic(12);
      onSaveLog({ ...sessionLog, cardio: nextCardio });
    }
  };

  const completedCount = ex.isCardio
    ? sessionLog.cardio?.completed
      ? 1
      : 0
    : sessionLog.sets.filter((s) => s.completed).length;
  const totalCount = ex.isCardio ? 1 : sessionLog.sets.length;

  return (
    <div className="deck-shell">
      {/* Slim Progress Header */}
      <div className="deck-progress-head">
        <div className="dph-meta">
          <span className="dph-focus">
            {day.splitLabel} • {day.focusTitle}
          </span>
          <span className="dph-count">
            {safeIdx + 1} / {exercises.length}
          </span>
        </div>
        <div className="dph-track">
          <div className="dph-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Main Single Exercise Card */}
      <article
        className="min-card"
        style={{
          transform: dragOffsetX !== 0 ? `translateX(${dragOffsetX}px)` : undefined
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header with Exercise Title & ? Guide Button */}
        <div className="mc-head">
          <div className="mc-head-left">
            <span className="mc-meta-label">
              #{ex.num} • {ex.muscleCategory} • {ex.equipment}
            </span>
            <h2 className="mc-title">{displayName}</h2>
            <p className="mc-rx">
              {ex.setsText} &nbsp;•&nbsp; {ex.repsText} &nbsp;•&nbsp; Rest {ex.defaultRestSeconds}s
            </p>
          </div>
          <button
            type="button"
            className="mc-guide-btn"
            aria-label="ব্যায়ামের নিয়ম দেখুন"
            onClick={() => {
              triggerHaptic(12);
              setGuideOpen(true);
            }}
          >
            <HelpCircle size={20} />
          </button>
        </div>

        {/* Clean 2-Photo Reference Strip */}
        <div className="mc-photos">
          <button
            type="button"
            className="mc-photo-btn"
            onClick={() =>
              setZoomPhoto({ src: imgStart, caption: `${displayName} — Start` })
            }
          >
            <img src={imgStart} alt={`${displayName} start`} />
            <span>START</span>
          </button>
          <button
            type="button"
            className="mc-photo-btn"
            onClick={() =>
              setZoomPhoto({ src: imgFinish, caption: `${displayName} — Peak` })
            }
          >
            <img src={imgFinish} alt={`${displayName} peak`} />
            <span>PEAK</span>
          </button>
        </div>

        {/* Checklist Action Area */}
        {ex.isCardio ? (
          <div className="mc-cardio-box">
            <div className="mc-bike-row">
              <div className="mc-bike-time">
                {String(Math.floor(bikeSecondsLeft / 60)).padStart(2, '0')}:
                {String(bikeSecondsLeft % 60).padStart(2, '0')}
              </div>
              <div className="mc-bike-btns">
                <button
                  type="button"
                  className="mc-bike-action primary"
                  onClick={() => {
                    if (bikeRunning) {
                      bikeEndAtRef.current = null;
                      setBikeRunning(false);
                    } else {
                      const startSecs = bikeSecondsLeft > 0 ? bikeSecondsLeft : 300;
                      if (bikeSecondsLeft === 0) setBikeSecondsLeft(300);
                      bikeEndAtRef.current = Date.now() + startSecs * 1000;
                      setBikeRunning(true);
                    }
                  }}
                >
                  {bikeRunning ? <Pause size={16} /> : <Play size={16} />}
                  {bikeRunning ? 'বিরতি' : 'শুরু'}
                </button>
                <button
                  type="button"
                  className="mc-bike-action"
                  onClick={() => {
                    bikeEndAtRef.current = null;
                    setBikeRunning(false);
                    setBikeSecondsLeft(300);
                  }}
                  aria-label="Reset bike timer"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            <button
              type="button"
              className={`set-tick-btn full ${sessionLog.cardio?.completed ? 'done' : ''}`}
              onClick={handleToggleCardioDone}
            >
              <span className="st-circle">
                {sessionLog.cardio?.completed ? <Check size={18} strokeWidth={3} /> : null}
              </span>
              <span className="st-label">
                {sessionLog.cardio?.completed ? '৫ মি. সাইক্লিং সম্পন্ন' : 'সাইক্লিং সম্পন্ন মার্ক করুন'}
              </span>
            </button>
          </div>
        ) : (
          <div className="mc-sets-area">
            <div className="mc-sets-status">
              <span>সেট চেকলিস্ট</span>
              <span>
                {completedCount} / {totalCount} সম্পন্ন
              </span>
            </div>
            <div className="set-tick-grid">
              {sessionLog.sets.map((setItem, idx) => (
                <button
                  key={setItem.setNumber}
                  type="button"
                  className={`set-tick-btn ${setItem.completed ? 'done' : ''}`}
                  onClick={() => handleToggleSet(idx)}
                >
                  <span className="st-circle">
                    {setItem.completed ? <Check size={17} strokeWidth={3} /> : null}
                  </span>
                  <span className="st-label">Set {setItem.setNumber}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Card Bottom Prev / Next */}
        <div className="mc-nav-row">
          <button
            type="button"
            className="mc-nav-btn"
            disabled={safeIdx === 0}
            onClick={() => {
              triggerHaptic(12);
              onSelectCardIdx(Math.max(0, safeIdx - 1));
            }}
          >
            <ArrowLeft size={17} /> আগেরটি
          </button>

          <button
            type="button"
            className="mc-nav-btn primary"
            disabled={safeIdx >= exercises.length - 1}
            onClick={() => {
              triggerHaptic(12);
              onSelectCardIdx(Math.min(exercises.length - 1, safeIdx + 1));
            }}
          >
            পরেরটি <ArrowRight size={17} />
          </button>
        </div>
      </article>

      {/* Bangla Form Guide Bottom-Sheet Modal */}
      {guideOpen && (
        <div className="sheet-backdrop" onClick={() => setGuideOpen(false)}>
          <div
            className="guide-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${displayName} করার নিয়ম`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gs-head">
              <div>
                <span className="gs-eyebrow">বাংলা নিয়ম ও ফর্ম গাইড</span>
                <h3>{displayName}</h3>
              </div>
              <button
                type="button"
                className="gs-close-btn"
                aria-label="বন্ধ করুন"
                onClick={() => setGuideOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="gs-body">
              <div className="gs-block">
                <h4>ধাপে ধাপে করার নিয়ম</h4>
                <ol className="gs-steps">
                  {ex.steps.map((step, i) => (
                    <li key={i}>
                      <span className="gs-num">{i + 1}</span>
                      <p>{step}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="gs-block gs-cue">
                <h4>
                  <Wind size={15} /> শ্বাস-প্রশ্বাস ও ফোকাস
                </h4>
                <p>
                  <strong>শ্বাস:</strong> {ex.breathing}
                </p>
                <p>
                  <strong>ফোকাস:</strong> {ex.mindMuscle}
                </p>
              </div>

              {ex.mistakes.length > 0 && (
                <div className="gs-block gs-mistakes">
                  <h4>
                    <AlertTriangle size={15} /> সাধারণ ভুল ও সমাধান
                  </h4>
                  {ex.mistakes.map((m, i) => (
                    <div key={i} className="gs-mistake-row">
                      <div className="gm-bad">× {m.mistake}</div>
                      <div className="gm-fix">→ {m.fix}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox */}
      {zoomPhoto && (
        <div className="lightbox-backdrop" onClick={() => setZoomPhoto(null)}>
          <div className="lightbox-box" onClick={(e) => e.stopPropagation()}>
            <div className="lb-head">
              <span>{zoomPhoto.caption}</span>
              <button
                type="button"
                aria-label="Close photo"
                onClick={() => setZoomPhoto(null)}
              >
                <X size={20} />
              </button>
            </div>
            <img src={zoomPhoto.src} alt={zoomPhoto.caption} />
          </div>
        </div>
      )}
    </div>
  );
}
