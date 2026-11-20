import {
  Award,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudOff,
  Dumbbell,
  Filter,
  Search
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { MUKTO_PROFILE, PAST_GYM_SESSIONS } from '../data/muktoHistory';
import {
  ALL_EXERCISES,
  DAY1_EXERCISES,
  DAY2_EXERCISES,
  THEME_COLORS,
  WEEKLY_VOLUME_TARGETS
} from '../data/workoutBlueprint';
import {
  computeWeekStats,
  getEffectiveExercise,
  getProgressionInsight,
  makeSessionKey,
  type WorkoutLogsMap
} from '../services/storageService';
import type { CardCustomization, DayCode } from '../types/workout';

interface WeekOption {
  weekId: string;
  label: string;
  isCurrent: boolean;
  badge: string;
}

interface OfflineAnalyticsViewProps {
  weekId: string;
  weekLabel: string;
  recentWeeks: WeekOption[];
  onSelectWeek: (weekId: string) => void;
  logs: WorkoutLogsMap;
  customMap: Record<string, CardCustomization>;
  onJumpToExercise: (dayCode: DayCode, exerciseIndex: number) => void;
}

export function OfflineAnalyticsView({
  weekId,
  weekLabel,
  recentWeeks,
  onSelectWeek,
  logs,
  customMap,
  onJumpToExercise
}: OfflineAnalyticsViewProps) {
  const [matrixFilter, setMatrixFilter] = useState<'ALL' | 'DAY1' | 'DAY2'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllPastDays, setShowAllPastDays] = useState(false);

  const weekStats = useMemo(
    () => computeWeekStats(logs, weekId, customMap),
    [logs, weekId, customMap]
  );

  const visibleExercises = useMemo(() => {
    const base =
      matrixFilter === 'DAY1'
        ? DAY1_EXERCISES
        : matrixFilter === 'DAY2'
          ? DAY2_EXERCISES
          : ALL_EXERCISES;
    if (!searchTerm.trim()) return base;
    const q = searchTerm.toLowerCase();
    return base.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.muscleCategory.toLowerCase().includes(q) ||
        e.primary.toLowerCase().includes(q)
    );
  }, [matrixFilter, searchTerm]);

  const offlineHistory = useMemo(() => {
    const exMap = new Map(ALL_EXERCISES.map((e) => [e.id, e]));
    return Object.values(logs)
      .filter((l) => l.sets.some((s) => s.completed) || l.cardio?.completed)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((l) => ({ log: l, ex: exMap.get(l.exerciseId) }))
      .filter((item) => Boolean(item.ex));
  }, [logs]);

  const overallPct = Math.min(
    100,
    Math.round((weekStats.completedSets / Math.max(1, weekStats.totalTargetSets)) * 100)
  );

  const displayedPastSessions = showAllPastDays
    ? PAST_GYM_SESSIONS
    : PAST_GYM_SESSIONS.slice(0, 5);

  return (
    <div className="tab-view-container">
      {/* Week Picker Bar */}
      <div className="analytics-week-bar">
        <span>সপ্তাহ নির্বাচন:</span>
        <select
          aria-label="Select training week"
          value={weekId}
          onChange={(e) => onSelectWeek(e.target.value)}
        >
          {recentWeeks.map((w) => (
            <option key={w.weekId} value={w.weekId}>
              {w.isCurrent ? `চলতি সপ্তাহ (${w.label})` : `${w.badge} (${w.label})`}
            </option>
          ))}
        </select>
      </div>

      {/* Top Offline Summary KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-val">{weekStats.completedSets} / {weekStats.totalTargetSets}</div>
          <div className="kpi-lbl">চলতি সপ্তাহের সেট ({overallPct}%)</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-val">{weekStats.totalTonnageKg.toLocaleString()} kg</div>
          <div className="kpi-lbl">মোট তোলা ওজন (Volume)</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-val">{MUKTO_PROFILE.totalPastDays} দিন</div>
          <div className="kpi-lbl">পূর্ববর্তী জিম সেশন (অক্টো–নভে)</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-val">{MUKTO_PROFILE.latestWeightKg} kg</div>
          <div className="kpi-lbl">সর্বশেষ ওজন ({MUKTO_PROFILE.weightDateBn})</div>
        </div>
      </div>

      {/* Integrated Past 14 Gym Days History (Oct-Nov) */}
      <section className="panel-card past-history-card">
        <div className="panel-hdr">
          <div>
            <h3>
              <CalendarCheck size={18} color="#34D399" /> পূর্ববর্তী ১৪ দিনের জিম হিস্ট্রি
            </h3>
            <span>
              অক্টোবর ({MUKTO_PROFILE.octoberDaysCount} দিন) • নভেম্বর ({MUKTO_PROFILE.novemberDaysCount} দিন) • নতুন রুটিন: {MUKTO_PROFILE.newRoutineStartBn}
            </span>
          </div>
          <button
            type="button"
            className="fp-btn"
            onClick={() => setShowAllPastDays((v) => !v)}
          >
            {showAllPastDays ? (
              <>
                কম দেখুন <ChevronUp size={14} />
              </>
            ) : (
              <>
                সব ১৪ দিন <ChevronDown size={14} />
              </>
            )}
          </button>
        </div>

        <div className="past-days-summary-pills">
          <span className="pds-pill">শেষ সেশন: {MUKTO_PROFILE.lastSessionBn}</span>
        </div>

        <div className="past-sessions-list">
          {displayedPastSessions.map((item) => (
            <div
              key={item.num}
              className={`past-session-row ${item.highlight ? 'is-highlight' : ''}`}
            >
              <div className="psr-left">
                <span className="psr-num">#{item.num}</span>
                <div>
                  <strong>{item.bnDate}</strong>
                  <span>{item.routineLabel}</span>
                </div>
              </div>
              {item.badgeText ? (
                <span className="psr-badge">{item.badgeText}</span>
              ) : (
                <span className="psr-done">✓ সম্পন্ন</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Weekly Set Volume Dashboard */}
      <section className="panel-card">
        <div className="panel-hdr">
          <div>
            <h3>
              <BarChart3 size={18} /> সাপ্তাহিক Set Volume ড্যাশবোর্ড
            </h3>
            <span>{weekLabel} • প্রতি Muscle সপ্তাহে ৩ বার (মোট {weekStats.totalTargetSets} সেট)</span>
          </div>
        </div>

        <div className="volume-bars-list">
          {WEEKLY_VOLUME_TARGETS.map((target) => {
            const done = target.categories.reduce(
              (acc, cat) => acc + (weekStats.categoryCompleted[cat] || 0),
              0
            );
            const dynTarget =
              target.categories.reduce(
                (acc, cat) => acc + (weekStats.categoryTargets[cat] || 0),
                0
              ) || target.targetSets;
            const pct = Math.min(100, Math.round((done / dynTarget) * 100));
            return (
              <div key={target.id} className="vb-row">
                <div className="vb-top">
                  <span>{target.label}</span>
                  <strong>
                    {done} / {dynTarget} sets
                    {target.id === 'core' ? ` (+${weekStats.cyclingMinutes}m bike)` : ''}
                  </strong>
                </div>
                <div className="vb-track">
                  <div
                    className="vb-fill"
                    style={{ width: `${pct}%`, background: target.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Offline Routine Matrix */}
      <section className="panel-card">
        <div className="panel-hdr">
          <div>
            <h3>
              <Dumbbell size={18} /> অফলাইন রুটিন ম্যাট্রিক্স
            </h3>
            <span>যেকোনো ব্যায়ামে ট্যাপ করলে সরাসরি ওই কার্ড ওপেন হবে</span>
          </div>
        </div>

        <div className="matrix-controls">
          <div className="filter-pills">
            {(['ALL', 'DAY1', 'DAY2'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`fp-btn ${matrixFilter === f ? 'active' : ''}`}
                onClick={() => setMatrixFilter(f)}
              >
                <Filter size={13} />
                {f === 'ALL' ? 'সব (২০টি)' : f === 'DAY1' ? 'Day 1 (Push)' : 'Day 2 (Pull/Leg)'}
              </button>
            ))}
          </div>
          <div className="search-input-wrap">
            <Search size={15} />
            <input
              type="text"
              value={searchTerm}
              placeholder="ব্যায়াম বা পেশি খুঁজুন..."
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="matrix-list">
          {visibleExercises.map((rawEx) => {
            const eff = getEffectiveExercise(rawEx, customMap);
            const color = THEME_COLORS[rawEx.theme].accent;
            const dayGroupList =
              rawEx.routineType === 'DAY1' ? DAY1_EXERCISES : DAY2_EXERCISES;
            const exIndex = dayGroupList.findIndex((x) => x.id === rawEx.id);
            const insight = getProgressionInsight(logs, weekId, rawEx.sessions[0], eff);

            return (
              <div
                key={rawEx.id}
                className="matrix-ex-card"
                style={{ '--m-accent': color } as React.CSSProperties}
              >
                <div className="mec-head">
                  <div>
                    <span className="mec-badge">
                      {rawEx.routineType === 'DAY1' ? 'D1' : 'D2'} • {rawEx.num}
                    </span>
                    <strong>{rawEx.name}</strong>
                    <span className="mec-sub">{rawEx.muscleCategory}</span>
                  </div>
                  <div className="mec-pr">
                    <Award size={13} /> PR: {insight.bestVolumeSetLabel}
                  </div>
                </div>

                <div className="mec-days">
                  {rawEx.sessions.map((sDay) => {
                    const key = makeSessionKey(weekId, sDay, rawEx.id);
                    const sLog = logs[key];
                    return (
                      <button
                        key={sDay}
                        type="button"
                        className="mec-day-row"
                        onClick={() => onJumpToExercise(sDay, exIndex)}
                      >
                        <span className="mdr-day">{sDay}</span>
                        <div className="mdr-sets">
                          {rawEx.isCardio ? (
                            <span
                              className={`mdr-chip wide ${sLog?.cardio?.completed ? 'done' : ''}`}
                            >
                              {sLog?.cardio?.completed
                                ? `✓ ${sLog.cardio.rpmLevel}`
                                : 'পেন্ডিং (5m Bike)'}
                            </span>
                          ) : (
                            Array.from({ length: eff.numSets }, (_, idx) => {
                              const st = sLog?.sets[idx];
                              const hasData = st && (st.completed || st.weight || st.reps);
                              return (
                                <span
                                  key={idx}
                                  className={`mdr-chip ${st?.completed ? 'done' : ''}`}
                                >
                                  {hasData ? `${st.weight || 'BW'}×${st.reps || '-'}` : `S${idx + 1}`}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Offline Session History */}
      <section className="panel-card">
        <div className="panel-hdr">
          <div>
            <h3>
              <CheckCircle2 size={18} /> নতুন সেশন লগ ({offlineHistory.length})
            </h3>
            <span>অ্যাপে লগ করা সব সেটের বিস্তারিত অফলাইন হিস্ট্রি</span>
          </div>
        </div>

        {offlineHistory.length === 0 ? (
          <div className="empty-state">
            এখনো নতুন রুটিনে কোনো সেট লগ করা হয়নি। শনি ২১ নভেম্বর থেকে কার্ড ট্যাবে সেট টিক দিলেই এখানে জমা হবে!
          </div>
        ) : (
          <div className="history-list">
            {offlineHistory.slice(0, 30).map(({ log, ex }) => {
              if (!ex) return null;
              const summary = ex.isCardio
                ? `${log.cardio?.rpmLevel || '5m Bike'} • ${log.cardio?.hrNotes || 'Completed'}`
                : log.sets
                    .filter((s) => s.completed || s.weight || s.reps)
                    .map((s) => `S${s.setNumber}: ${s.weight || 'BW'}kg×${s.reps || '-'}`)
                    .join(' | ');
              const dateText = new Date(log.updatedAt).toLocaleString('bn-BD', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div key={`${log.weekId}_${log.dayCode}_${log.exerciseId}`} className="hist-item">
                  <div className="hi-left">
                    <div className="hi-title">
                      <span className="hi-day">{log.dayCode}</span>
                      <strong>{ex.name}</strong>
                    </div>
                    <div className="hi-summary">{summary}</div>
                    <div className="hi-meta">
                      {log.weekId.replace('W_', 'সপ্তাহ: ')} • {dateText}
                    </div>
                  </div>
                  <div className={`hi-sync-badge ${log.synced ? 'synced' : 'offline'}`}>
                    {log.synced ? (
                      <>
                        <Cloud size={13} /> সিঙ্কড
                      </>
                    ) : (
                      <>
                        <CloudOff size={13} /> অফলাইন
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
