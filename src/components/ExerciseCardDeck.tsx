import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  TrendingUp,
  Wind,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FRIDAY_CHECKLIST,
  THEME_COLORS
} from '../data/workoutBlueprint';
import {
  getEffectiveExercise,
  getOrInitExerciseLog,
  getProgressionInsight,
  makeSessionKey,
  type WorkoutLogsMap
} from '../services/storageService';
import type {
  CardCustomization,
  DailyPrepRecoveryLog,
  DayCode,
  DaySchedule,
  ExerciseDefinition,
  ExerciseSessionLog
} from '../types/workout';
import { playSetCheckSound, playTimerCompleteChime, triggerHaptic } from '../utils/audioHaptics';

type InnerTab = 'log' | 'guide' | 'customize';

interface ExerciseCardDeckProps {
  day: DaySchedule;
  weekId: string;
  exercises: ExerciseDefinition[];
  customMap: Record<string, CardCustomization>;
  logs: WorkoutLogsMap;
  recoveryLog: DailyPrepRecoveryLog;
  currentCardIdx: number;
  onSelectCardIdx: (idx: number) => void;
  onSaveLog: (log: ExerciseSessionLog, startTimerSeconds?: number, exerciseName?: string) => void;
  onSaveCustomization: (custom: CardCustomization) => void;
  onResetCustomization: (exerciseId: string) => void;
  onToggleFridayItem: (itemId: string) => void;
}

interface TempoPhase {
  label: string;
  seconds: number;
  color: string;
}

function parseTempoPhases(tempoStr: string): TempoPhase[] {
  const nums = tempoStr.split('-').map((n) => parseInt(n.trim(), 10));
  if (nums.length !== 4 || nums.some((n) => Number.isNaN(n))) {
    return [
      { label: 'নামা (Eccentric)', seconds: 2, color: '#38BDF8' },
      { label: 'নিচে থামা (Pause)', seconds: 1, color: '#FBBF24' },
      { label: 'ওঠা (Concentric)', seconds: 1, color: '#FF5A1F' }
    ];
  }
  const labels = [
    { label: 'নামা (Eccentric)', color: '#38BDF8' },
    { label: 'নিচে থামা (Pause)', color: '#FBBF24' },
    { label: 'ওঠা (Concentric)', color: '#FF5A1F' },
    { label: 'ওপরে থামা (Hold)', color: '#2DD4BF' }
  ];
  return nums
    .map((sec, i) => ({ label: labels[i].label, seconds: sec, color: labels[i].color }))
    .filter((p) => p.seconds > 0);
}

export function ExerciseCardDeck({
  day,
  weekId,
  exercises,
  customMap,
  logs,
  recoveryLog,
  currentCardIdx,
  onSelectCardIdx,
  onSaveLog,
  onSaveCustomization,
  onResetCustomization,
  onToggleFridayItem
}: ExerciseCardDeckProps) {
  const [innerTab, setInnerTab] = useState<InnerTab>('log');
  const [rampUpExpanded, setRampUpExpanded] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<{ src: string; caption: string } | null>(null);

  // Touch swipe state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);

  // Tempo pacer state (single combined state prevents React StrictMode double phase skips)
  const [tempoActive, setTempoActive] = useState(false);
  const [tempoState, setTempoState] = useState({ phaseIdx: 0, secLeft: 0 });

  // Stationary Bike 5-min timer state (wall-clock anchored)
  const [bikeSecondsLeft, setBikeSecondsLeft] = useState(300);
  const [bikeRunning, setBikeRunning] = useState(false);
  const bikeEndAtRef = useRef<number | null>(null);

  // Customize draft state
  const rawEx = exercises[Math.min(currentCardIdx, Math.max(0, exercises.length - 1))];
  const effectiveEx = useMemo(
    () => (rawEx ? getEffectiveExercise(rawEx, customMap) : null),
    [rawEx, customMap]
  );

  const [draftSets, setDraftSets] = useState(3);
  const [draftRepsText, setDraftRepsText] = useState('');
  const [draftMinReps, setDraftMinReps] = useState(8);
  const [draftMaxReps, setDraftMaxReps] = useState(12);
  const [draftTargetWeight, setDraftTargetWeight] = useState('');
  const [draftRestSec, setDraftRestSec] = useState(60);
  const [draftTempo, setDraftTempo] = useState('2-1-1-0');
  const [draftVariation, setDraftVariation] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (!effectiveEx) return;
    setDraftSets(effectiveEx.numSets);
    setDraftRepsText(effectiveEx.repsText);
    setDraftMinReps(effectiveEx.minReps);
    setDraftMaxReps(effectiveEx.maxReps);
    setDraftTargetWeight(effectiveEx.targetWeight);
    setDraftRestSec(effectiveEx.restSeconds);
    setDraftTempo(effectiveEx.tempo);
    setDraftVariation(effectiveEx.selectedVariation);
    setDraftNotes(effectiveEx.customNotes);
    setTempoActive(false);
    setSavedNotice(false);
  }, [effectiveEx?.id, effectiveEx?.numSets, effectiveEx?.restSeconds, effectiveEx?.targetWeight]);

  // Tempo Pacer Loop
  const tempoPhases = useMemo(
    () => parseTempoPhases(effectiveEx?.tempo || '2-1-1-0'),
    [effectiveEx?.tempo]
  );

  useEffect(() => {
    if (!tempoActive || tempoPhases.length === 0) return;
    const id = window.setInterval(() => {
      setTempoState((prev) => {
        if (prev.secLeft > 1) {
          return { ...prev, secLeft: prev.secLeft - 1 };
        }
        const nextIdx = (prev.phaseIdx + 1) % tempoPhases.length;
        return {
          phaseIdx: nextIdx,
          secLeft: tempoPhases[nextIdx].seconds
        };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [tempoActive, tempoPhases]);

  useEffect(() => {
    if (tempoActive) {
      triggerHaptic(15);
    }
  }, [tempoActive, tempoState.phaseIdx]);

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

  // Off Day (Friday) Screen
  if (day.routineType === 'OFF') {
    return (
      <div className="deck-container">
        <div className="friday-hero-card">
          <div className="fh-top">
            <span className="fh-badge">FRIDAY • FULL RECOVERY & GROWTH DAY</span>
            <h2>শুক্রবার = সম্পূর্ণ বিশ্রাম ও Muscle Growth</h2>
            <p>{day.dayEmphasisDesc}</p>
          </div>
          <div className="fh-kpis">
            <div className="fh-kpi">
              <strong>৭.৫ – ৯ ঘণ্টা</strong>
              <span>গভীর ঘুম</span>
            </div>
            <div className="fh-kpi">
              <strong>৩ – ৪ লিটার</strong>
              <span>পানি ও ইলেক্ট্রোলাইট</span>
            </div>
            <div className="fh-kpi">
              <strong>১.৬–২.২g/kg</strong>
              <span>দৈনিক Protein</span>
            </div>
          </div>

          <div className="friday-checklist">
            <div className="fc-title">Friday Off-Day Recovery চেকলিস্ট</div>
            {FRIDAY_CHECKLIST.map((item) => {
              const checked = recoveryLog.fridayChecklistIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`fc-item ${checked ? 'is-checked' : ''}`}
                  onClick={() => {
                    triggerHaptic(20);
                    onToggleFridayItem(item.id);
                  }}
                >
                  <span className="fc-check">{checked ? <Check size={15} /> : null}</span>
                  <div className="fc-text">
                    <strong>{item.title}</strong>
                    <span>{item.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!effectiveEx) return null;

  const activeDayCode = day.code as Exclude<DayCode, 'FRI'>;
  const themeStyle = THEME_COLORS[effectiveEx.theme];
  const sessionLog = getOrInitExerciseLog(
    logs,
    weekId,
    activeDayCode,
    effectiveEx,
    effectiveEx.targetWeight
  );

  const insight = getProgressionInsight(logs, weekId, activeDayCode, effectiveEx);

  // On Tuesday, Pull-Ups card uses Chin-Up photos as specified in routine
  const photoFolder =
    activeDayCode === 'TUE' && effectiveEx.tueFolder
      ? effectiveEx.tueFolder
      : effectiveEx.folder;
  const imgStart = `/images/${photoFolder}_0.jpg`;
  const imgFinish = `/images/${photoFolder}_1.jpg`;

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') {
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
      setDragOffsetX(Math.max(-90, Math.min(90, dx * 0.45)));
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

    if (Math.abs(dx) > 62 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0 && currentCardIdx < exercises.length - 1) {
        triggerHaptic(18);
        onSelectCardIdx(currentCardIdx + 1);
      } else if (dx > 0 && currentCardIdx > 0) {
        triggerHaptic(18);
        onSelectCardIdx(currentCardIdx - 1);
      }
    }
  };

  const handleSetFieldChange = (setIdx: number, field: 'weight' | 'reps', value: string) => {
    const updatedSets = sessionLog.sets.map((s, i) =>
      i === setIdx ? { ...s, [field]: value } : s
    );
    onSaveLog({ ...sessionLog, sets: updatedSets });
  };

  const handleStepField = (setIdx: number, field: 'weight' | 'reps', delta: number) => {
    const currentVal = parseFloat(sessionLog.sets[setIdx]?.[field] || '0');
    const safeVal = Number.isNaN(currentVal) ? 0 : currentVal;
    const next = Math.max(0, Math.round((safeVal + delta) * 10) / 10);
    handleSetFieldChange(setIdx, field, String(next));
    triggerHaptic(12);
  };

  const handleToggleSetComplete = (setIdx: number) => {
    const prevSet = sessionLog.sets[setIdx];
    const nextCompleted = !prevSet.completed;
    const fallbackWeight =
      prevSet.weight ||
      effectiveEx.targetWeight ||
      insight.previousLog?.sets[setIdx]?.weight ||
      '';
    const fallbackReps =
      prevSet.reps ||
      insight.previousLog?.sets[setIdx]?.reps ||
      String(effectiveEx.minReps);

    const updatedSets = sessionLog.sets.map((s, i) =>
      i === setIdx
        ? {
            ...s,
            weight: fallbackWeight,
            reps: fallbackReps,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined
          }
        : s
    );

    if (nextCompleted) {
      playSetCheckSound();
      triggerHaptic(30);
      onSaveLog(
        { ...sessionLog, sets: updatedSets },
        effectiveEx.restSeconds,
        effectiveEx.name
      );
    } else {
      onSaveLog({ ...sessionLog, sets: updatedSets });
    }
  };

  const handleCardioUpdate = (patch: Partial<NonNullable<ExerciseSessionLog['cardio']>>) => {
    const cur = sessionLog.cardio || {
      completed: false,
      rpmLevel: '75 RPM / Level 4',
      hrNotes: '',
      durationSeconds: 300
    };
    const nextCardio = {
      ...cur,
      ...patch,
      completedAt: patch.completed ? new Date().toISOString() : cur.completedAt
    };
    if (patch.completed) {
      playSetCheckSound();
      triggerHaptic(35);
      onSaveLog(
        { ...sessionLog, cardio: nextCardio },
        effectiveEx.restSeconds,
        effectiveEx.name
      );
    } else {
      onSaveLog({ ...sessionLog, cardio: nextCardio });
    }
  };

  const workingWeightNum = parseFloat(
    sessionLog.sets[0]?.weight || effectiveEx.targetWeight || String(insight.bestWeightKg || 0)
  );
  const ramp45 = !Number.isNaN(workingWeightNum) && workingWeightNum > 0
    ? `${Math.round((workingWeightNum * 0.45) / 2.5) * 2.5} kg`
    : '~45%';
  const ramp70 = !Number.isNaN(workingWeightNum) && workingWeightNum > 0
    ? `${Math.round((workingWeightNum * 0.7) / 2.5) * 2.5} kg`
    : '~70%';

  const handleSaveCustomization = () => {
    onSaveCustomization({
      exerciseId: effectiveEx.id,
      numSets: Math.max(1, Math.min(6, draftSets)),
      repsText: draftRepsText.trim() || effectiveEx.repsText,
      minReps: Math.max(1, draftMinReps),
      maxReps: Math.max(draftMinReps, draftMaxReps),
      targetWeight: draftTargetWeight.trim(),
      restSeconds: Math.max(15, Math.min(300, draftRestSec)),
      tempo: draftTempo.trim() || effectiveEx.tempo,
      selectedVariation: draftVariation.trim(),
      customNotes: draftNotes.trim(),
      updatedAt: new Date().toISOString()
    });
    triggerHaptic(25);
    setSavedNotice(true);
    window.setTimeout(() => {
      setSavedNotice(false);
      setInnerTab('log');
    }, 700);
  };

  const activeTempoPhase = tempoPhases[tempoState.phaseIdx % Math.max(1, tempoPhases.length)];

  return (
    <div className="deck-container">
      {/* Quick-Jump Exercise Strip */}
      <div className="quick-jump-strip" aria-label="Exercise quick jump">
        {exercises.map((ex, idx) => {
          const eff = getEffectiveExercise(ex, customMap);
          const key = makeSessionKey(weekId, activeDayCode, ex.id);
          const l = logs[key];
          const isComplete = ex.isCardio
            ? Boolean(l?.cardio?.completed)
            : Boolean(l && l.sets.filter((s) => s.completed).length >= eff.numSets);
          const hasPartial =
            !isComplete && Boolean(l && l.sets.some((s) => s.completed));
          const isCurrent = idx === currentCardIdx;
          const color = THEME_COLORS[ex.theme].accent;

          return (
            <button
              key={ex.id}
              type="button"
              className={`qj-pill ${isCurrent ? 'active' : ''} ${isComplete ? 'completed' : ''} ${hasPartial ? 'partial' : ''}`}
              style={{ '--pill-accent': color } as React.CSSProperties}
              onClick={() => {
                triggerHaptic(12);
                onSelectCardIdx(idx);
              }}
            >
              <span className="qj-num">{ex.num}</span>
              {isComplete && <Check size={11} className="qj-tick" />}
            </button>
          );
        })}
      </div>

      {/* Swipeable Main Exercise Card */}
      <article
        className="exercise-card"
        style={
          {
            '--card-accent': themeStyle.accent,
            '--card-soft': themeStyle.bgSoft,
            transform: dragOffsetX !== 0 ? `translateX(${dragOffsetX}px)` : undefined
          } as React.CSSProperties
        }
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Card Header (Clean & Uncluttered) */}
        <div className="ec-header">
          <div className="ec-title-row">
            <span className="ec-num-badge">{effectiveEx.num}</span>
            <div className="ec-title-text">
              <div className="ec-name-line">
                <h2>
                  {activeDayCode === 'TUE' && effectiveEx.id === 'd2_01_pullups'
                    ? 'Chin-Ups (Tue)'
                    : effectiveEx.name}
                </h2>
                {effectiveEx.isCustomized && (
                  <span className="ec-custom-badge">কাস্টম</span>
                )}
              </div>
              <p className="ec-sub">
                {themeStyle.labelBn} • {effectiveEx.equipment}
              </p>
            </div>
          </div>

          {/* 3 Clean Rx Pills */}
          <div className="ec-rx-row">
            <span className="rx-pill rx-sets">{effectiveEx.setsText}</span>
            <span className={`rx-pill ${effectiveEx.exactReps ? 'rx-exact' : 'rx-rec'}`}>
              {effectiveEx.repsText}
            </span>
            <span className="rx-pill">
              Rest {effectiveEx.restSeconds}s • {effectiveEx.rpe}
            </span>
          </div>
        </div>

        {/* Hybrid Inner Card Tabs */}
        <div className="card-inner-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={innerTab === 'log'}
            className={`cit-btn ${innerTab === 'log' ? 'active' : ''}`}
            onClick={() => setInnerTab('log')}
          >
            <Dumbbell size={16} /> লগ ও ছবি
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={innerTab === 'guide'}
            className={`cit-btn ${innerTab === 'guide' ? 'active' : ''}`}
            onClick={() => setInnerTab('guide')}
          >
            <BookOpen size={16} /> নিয়ম
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={innerTab === 'customize'}
            className={`cit-btn ${innerTab === 'customize' ? 'active' : ''}`}
            onClick={() => setInnerTab('customize')}
          >
            <Sliders size={16} /> কাস্টম
          </button>
        </div>

        {/* TAB 1: WORKOUT ENTRY & PHOTOS */}
        {innerTab === 'log' && (
          <div className="ec-tab-body">
            {/* Start & Peak Photos */}
            <div className="ec-photos-grid">
              <button
                type="button"
                className="ec-photo-frame"
                onClick={() =>
                  setZoomPhoto({
                    src: imgStart,
                    caption: `${effectiveEx.name} — 1. START POSITION`
                  })
                }
              >
                <img src={imgStart} alt={`${effectiveEx.name} start position`} />
                <span className="photo-badge">1. START POSITION</span>
              </button>
              <button
                type="button"
                className="ec-photo-frame"
                onClick={() =>
                  setZoomPhoto({
                    src: imgFinish,
                    caption: `${effectiveEx.name} — 2. PEAK / FINISH`
                  })
                }
              >
                <img src={imgFinish} alt={`${effectiveEx.name} peak position`} />
                <span className="photo-badge badge-peak">2. PEAK / FINISH</span>
              </button>
            </div>

            {/* Personal Note / Selected Alternative Reminder */}
            {(effectiveEx.selectedVariation || effectiveEx.customNotes) && (
              <div className="custom-note-callout">
                <Sparkles size={14} />
                <div>
                  {effectiveEx.selectedVariation && (
                    <div><strong>বিকল্প:</strong> {effectiveEx.selectedVariation}</div>
                  )}
                  {effectiveEx.customNotes && (
                    <div><strong>আমার নোট:</strong> {effectiveEx.customNotes}</div>
                  )}
                </div>
              </div>
            )}

            {/* Double Progression / PR Banner (only shown when previous data or PR exists) */}
            {(insight.previousLog !== null || insight.bestVolumeSetLabel !== '—') && (
              <div className={`dp-banner ${insight.shouldIncreaseWeight ? 'dp-ready' : ''}`}>
                <div className="dp-top">
                  <span className="dp-tag">
                    {insight.shouldIncreaseWeight ? (
                      <>
                        <TrendingUp size={15} /> ওজন বাড়ানোর সিগন্যাল!
                      </>
                    ) : (
                      <>
                        <Award size={15} /> PR: {insight.bestVolumeSetLabel}
                      </>
                    )}
                  </span>
                  {insight.previousLog && (
                    <span className="dp-prev">{insight.previousLabel}</span>
                  )}
                </div>
                {insight.shouldIncreaseWeight && (
                  <div className="dp-alert-msg">{insight.reasonBn}</div>
                )}
              </div>
            )}

            {/* Ramp-Up Warm-Up Sets for Compound Lifts */}
            {effectiveEx.rampUpEligible && !effectiveEx.isCardio && (
              <div className="rampup-box">
                <button
                  type="button"
                  className="rampup-toggle"
                  onClick={() => setRampUpExpanded((v) => !v)}
                >
                  <span>
                    <Activity size={14} /> Ramp-Up সেট (মূল সেটের আগে করুন)
                  </span>
                  {rampUpExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {rampUpExpanded && (
                  <div className="rampup-rows">
                    <div className="ru-row">
                      <strong>Warm-Up 1 (~45%)</strong>
                      <span>{ramp45} × 8–10 reps</span>
                      <em>জয়েন্ট সচল করা</em>
                    </div>
                    <div className="ru-row">
                      <strong>Warm-Up 2 (~70%)</strong>
                      <span>{ramp70} × 3–5 reps</span>
                      <em>স্নায়ুতন্ত্র প্রস্তুত</em>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cardio 5-Min Bike Logger OR Set Logger Rows */}
            {effectiveEx.isCardio ? (
              <div className="cardio-logger-box">
                <div className="bike-timer-face">
                  <div className="bt-time">
                    {String(Math.floor(bikeSecondsLeft / 60)).padStart(2, '0')}:
                    {String(bikeSecondsLeft % 60).padStart(2, '0')}
                  </div>
                  <div className="bt-sub">5-Minute Leg Prep • 70-85 RPM • Zone 2</div>
                  <div className="bt-controls">
                    <button
                      type="button"
                      className="bt-btn bt-primary"
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
                      {bikeRunning ? 'বিরতি' : '৫ মি. শুরু করুন'}
                    </button>
                    <button
                      type="button"
                      className="bt-btn"
                      onClick={() => {
                        bikeEndAtRef.current = null;
                        setBikeRunning(false);
                        setBikeSecondsLeft(300);
                      }}
                    >
                      <RotateCcw size={15} /> রিসেট
                    </button>
                  </div>
                </div>

                <div className="cardio-fields">
                  <label>
                    <span>RPM / Resistance Level</span>
                    <input
                      type="text"
                      value={sessionLog.cardio?.rpmLevel || ''}
                      placeholder="যেমন: 78 RPM / Level 4"
                      onChange={(e) => handleCardioUpdate({ rpmLevel: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Avg HR / Notes</span>
                    <input
                      type="text"
                      value={sessionLog.cardio?.hrNotes || ''}
                      placeholder="যেমন: 125 bpm, হাঁটু ফ্রি লাগছে"
                      onChange={(e) => handleCardioUpdate({ hrNotes: e.target.value })}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className={`cardio-done-btn ${sessionLog.cardio?.completed ? 'done' : ''}`}
                  onClick={() =>
                    handleCardioUpdate({
                      completed: !sessionLog.cardio?.completed,
                      durationSeconds: 300 - bikeSecondsLeft || 300
                    })
                  }
                >
                  <Check size={18} />
                  {sessionLog.cardio?.completed
                    ? '✓ ৫ মিনিট সাইক্লিং সম্পন্ন (অফলাইনে সেভড)'
                    : 'সাইক্লিং সম্পন্ন মার্ক করুন (✓ Done)'}
                </button>
              </div>
            ) : (
              <div className="sets-logger">
                <div className="sets-hdr-row">
                  <span>সেট</span>
                  <span>ওজন (kg)</span>
                  <span>রেপস (Reps)</span>
                  <span>সম্পন্ন</span>
                </div>

                {sessionLog.sets.map((setItem, idx) => {
                  const prevSet = insight.previousLog?.sets[idx];
                  const isBodyweight =
                    effectiveEx.equipment.toLowerCase().includes('bodyweight') ||
                    effectiveEx.id === 'd2_01_pullups';
                  const weightPlaceholder =
                    effectiveEx.targetWeight ||
                    prevSet?.weight ||
                    (isBodyweight ? 'BW' : 'kg');
                  const repsPlaceholder =
                    prevSet?.reps || String(effectiveEx.maxReps);

                  return (
                    <div
                      key={setItem.setNumber}
                      className={`set-row ${setItem.completed ? 'set-completed' : ''}`}
                    >
                      <div className="sr-badge">S{setItem.setNumber}</div>

                      <div className="sr-input-group">
                        <button
                          type="button"
                          className="step-btn"
                          onClick={() => handleStepField(idx, 'weight', -2.5)}
                          aria-label="Decrease weight"
                        >
                          <Minus size={15} />
                        </button>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          value={setItem.weight}
                          placeholder={weightPlaceholder}
                          onChange={(e) =>
                            handleSetFieldChange(idx, 'weight', e.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="step-btn"
                          onClick={() => handleStepField(idx, 'weight', 2.5)}
                          aria-label="Increase weight"
                        >
                          <Plus size={15} />
                        </button>
                      </div>

                      <div className="sr-input-group">
                        <button
                          type="button"
                          className="step-btn"
                          onClick={() => handleStepField(idx, 'reps', -1)}
                          aria-label="Decrease reps"
                        >
                          <Minus size={15} />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={setItem.reps}
                          placeholder={repsPlaceholder}
                          onChange={(e) =>
                            handleSetFieldChange(idx, 'reps', e.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="step-btn"
                          onClick={() => handleStepField(idx, 'reps', 1)}
                          aria-label="Increase reps"
                        >
                          <Plus size={15} />
                        </button>
                      </div>

                      <button
                        type="button"
                        className={`sr-check-btn ${setItem.completed ? 'checked' : ''}`}
                        onClick={() => handleToggleSetComplete(idx)}
                        aria-label={`Complete set ${setItem.setNumber}`}
                      >
                        <Check size={20} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FORM GUIDE, TEMPO PACER, ANATOMY & MISTAKES */}
        {innerTab === 'guide' && (
          <div className="ec-tab-body guide-tab">
            {/* Interactive Tempo Pacer */}
            {!effectiveEx.isCardio && (
              <div className="tempo-pacer-card">
                <div className="tp-top">
                  <div>
                    <div className="tp-title">
                      <Clock size={14} /> Tempo পেসার ({effectiveEx.tempo})
                    </div>
                    <div className="tp-sub">ফর্ম ঠিক রাখতে নিচের ছন্দ অনুসরণ করুন</div>
                  </div>
                  <button
                    type="button"
                    className={`tp-toggle-btn ${tempoActive ? 'running' : ''}`}
                    onClick={() => {
                      if (tempoActive) {
                        setTempoActive(false);
                      } else {
                        setTempoState({ phaseIdx: 0, secLeft: tempoPhases[0]?.seconds || 2 });
                        setTempoActive(true);
                      }
                    }}
                  >
                    {tempoActive ? <Pause size={14} /> : <Play size={14} />}
                    {tempoActive ? 'থামান' : 'পেসার চালু'}
                  </button>
                </div>

                {tempoActive && activeTempoPhase && (
                  <div
                    className="tp-live-banner"
                    style={{ borderColor: activeTempoPhase.color }}
                  >
                    <strong style={{ color: activeTempoPhase.color }}>
                      {activeTempoPhase.label}
                    </strong>
                    <span className="tp-counter">{tempoState.secLeft}s</span>
                  </div>
                )}
              </div>
            )}

            {/* Compact Target Muscle Pill */}
            <div className="target-muscle-line">
              <span>টার্গেট পেশি:</span>
              <strong>{effectiveEx.primary}</strong>
            </div>

            {/* Step-by-Step Execution */}
            <div className="guide-section">
              <div className="gs-title">ধাপে ধাপে করার নিয়ম</div>
              <ol className="steps-ol">
                {effectiveEx.steps.map((step, i) => (
                  <li key={i}>
                    <span className="step-num">{i + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Common Mistakes & Fixes */}
            <div className="guide-section mistakes-section">
              <div className="gs-title">
                <AlertTriangle size={15} /> সাধারণ ভুল ও সমাধান
              </div>
              <div className="mistakes-list">
                {effectiveEx.mistakes.map((m, i) => (
                  <div key={i} className="mistake-item">
                    <div className="m-bad">× {m.mistake}</div>
                    <div className="m-fix">→ {m.fix}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Breathing & Mind-Muscle */}
            <div className="guide-section breath-section">
              <div className="gs-title">
                <Wind size={15} /> শ্বাস-প্রশ্বাস ও টিপস
              </div>
              <p>
                <strong>শ্বাস:</strong> {effectiveEx.breathing}
              </p>
              <p>
                <strong>টিপস:</strong> {effectiveEx.mindMuscle}
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: MEDIUM CUSTOMIZATION */}
        {innerTab === 'customize' && (
          <div className="ec-tab-body customize-tab">
            <div className="cust-intro">
              এই কার্ডের সেট, রেপস, টার্গেট ওজন, Rest টাইম এবং নিজের নোটস কাস্টমাইজ করুন — সবকিছু ফোনে অফলাইনে সেভ থাকবে।
            </div>

            <div className="cust-grid">
              {!effectiveEx.isCardio && (
                <>
                  <label className="cust-field">
                    <span>সেট সংখ্যা (Sets: {draftSets})</span>
                    <div className="cust-stepper">
                      <button
                        type="button"
                        onClick={() => setDraftSets((s) => Math.max(1, s - 1))}
                      >
                        <Minus size={15} />
                      </button>
                      <strong>{draftSets} Sets</strong>
                      <button
                        type="button"
                        onClick={() => setDraftSets((s) => Math.min(6, s + 1))}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </label>

                  <label className="cust-field">
                    <span>ডিফল্ট / টার্গেট ওজন (kg)</span>
                    <input
                      type="number"
                      step="0.5"
                      value={draftTargetWeight}
                      placeholder="যেমন: 20"
                      onChange={(e) => setDraftTargetWeight(e.target.value)}
                    />
                  </label>

                  <label className="cust-field">
                    <span>টার্গেট রেপস লেবেল</span>
                    <input
                      type="text"
                      value={draftRepsText}
                      onChange={(e) => setDraftRepsText(e.target.value)}
                    />
                  </label>

                  <div className="cust-two-col">
                    <label className="cust-field">
                      <span>সর্বনিম্ন Reps</span>
                      <input
                        type="number"
                        value={draftMinReps}
                        onChange={(e) =>
                          setDraftMinReps(Math.max(1, parseInt(e.target.value || '1', 10)))
                        }
                      />
                    </label>
                    <label className="cust-field">
                      <span>Double Prog. Max Reps</span>
                      <input
                        type="number"
                        value={draftMaxReps}
                        onChange={(e) =>
                          setDraftMaxReps(Math.max(1, parseInt(e.target.value || '1', 10)))
                        }
                      />
                    </label>
                  </div>
                </>
              )}

              <div className="cust-field">
                <span>অটো Rest টাইমার (সেকেন্ড): {draftRestSec}s</span>
                <div className="rest-preset-pills">
                  {[45, 60, 75, 90, 120].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      className={`rp-pill ${draftRestSec === sec ? 'active' : ''}`}
                      onClick={() => setDraftRestSec(sec)}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={draftRestSec}
                  onChange={(e) =>
                    setDraftRestSec(Math.max(15, parseInt(e.target.value || '60', 10)))
                  }
                />
              </div>

              {!effectiveEx.isCardio && (
                <label className="cust-field">
                  <span>Tempo (নামা-থামা-ওঠা-ওপরে)</span>
                  <input
                    type="text"
                    value={draftTempo}
                    onChange={(e) => setDraftTempo(e.target.value)}
                  />
                </label>
              )}

              <label className="cust-field">
                <span>পছন্দের বিকল্প ব্যায়াম (যদি মেশিন বদলান)</span>
                <input
                  type="text"
                  value={draftVariation}
                  placeholder={effectiveEx.variations.slice(0, 60) + '...'}
                  onChange={(e) => setDraftVariation(e.target.value)}
                />
              </label>

              <label className="cust-field">
                <span>ব্যক্তিগত নোট (সিট নং, গ্রিপ, ফর্ম টিপস)</span>
                <textarea
                  rows={2}
                  value={draftNotes}
                  placeholder="যেমন: বেঞ্চ নং ৩, সীট লেভেল ৪..."
                  onChange={(e) => setDraftNotes(e.target.value)}
                />
              </label>
            </div>

            <div className="cust-actions">
              <button
                type="button"
                className="cust-save-btn"
                onClick={handleSaveCustomization}
              >
                <Check size={17} />
                {savedNotice ? 'কাস্টমাইজেশন সেভ হয়েছে!' : 'কাস্টমাইজেশন সেভ করুন'}
              </button>
              <button
                type="button"
                className="cust-reset-btn"
                onClick={() => {
                  onResetCustomization(effectiveEx.id);
                  triggerHaptic(20);
                }}
              >
                <RotateCcw size={15} /> ডিফল্ট রিসেট
              </button>
            </div>
          </div>
        )}

        {/* Card Footer: Swipe Prev / Next Navigation */}
        <div className="ec-footer-nav">
          <button
            type="button"
            className="nav-card-btn"
            disabled={currentCardIdx === 0}
            onClick={() => {
              triggerHaptic(15);
              onSelectCardIdx(Math.max(0, currentCardIdx - 1));
            }}
          >
            <ArrowLeft size={16} /> আগের কার্ড
          </button>

          <div className="swipe-hint-pill">
            {currentCardIdx + 1} / {exercises.length}
          </div>

          <button
            type="button"
            className="nav-card-btn nav-card-next"
            disabled={currentCardIdx >= exercises.length - 1}
            onClick={() => {
              triggerHaptic(15);
              onSelectCardIdx(Math.min(exercises.length - 1, currentCardIdx + 1));
            }}
          >
            পরের কার্ড <ArrowRight size={16} />
          </button>
        </div>
      </article>

      {/* Fullscreen Photo Lightbox */}
      {zoomPhoto && (
        <div className="photo-modal-backdrop" onClick={() => setZoomPhoto(null)}>
          <div className="photo-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="pm-header">
              <span>{zoomPhoto.caption}</span>
              <button type="button" onClick={() => setZoomPhoto(null)}>
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
