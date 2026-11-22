import { CalendarCheck, Check, Dumbbell, Pencil, Scale } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MUKTO_PROFILE, PAST_GYM_SESSIONS } from '../data/muktoHistory';
import { WEEKLY_SCHEDULE } from '../data/workoutBlueprint';
import type { WorkoutLogsMap } from '../services/storageService';
import type { DayCode } from '../types/workout';

const BODYWEIGHT_KEY = 'hw_bodyweight_v2';

function readStoredWeight(): string {
  try {
    const val = localStorage.getItem(BODYWEIGHT_KEY);
    return val && val.trim() ? val.trim() : MUKTO_PROFILE.latestWeightKg;
  } catch {
    return MUKTO_PROFILE.latestWeightKg;
  }
}

function saveStoredWeight(weight: string): void {
  try {
    localStorage.setItem(BODYWEIGHT_KEY, weight);
  } catch {
    // Ignore storage quota errors cleanly
  }
}

interface AppGymSession {
  key: string;
  bnDate: string;
  routineLabel: string;
  doneSets: number;
  targetSets: number;
  isFull: boolean;
  sortTime: number;
}

interface HistoryViewProps {
  logs: WorkoutLogsMap;
}

export function HistoryView({ logs }: HistoryViewProps) {
  const [weightKg, setWeightKg] = useState<string>(() => readStoredWeight());
  const [editingWeight, setEditingWeight] = useState(false);
  const [draftWeight, setDraftWeight] = useState(weightKg);

  const appSessions = useMemo<AppGymSession[]>(() => {
    const grouped = new Map<
      string,
      {
        dayCode: Exclude<DayCode, 'FRI'>;
        doneSets: number;
        latestIso: string;
      }
    >();

    for (const log of Object.values(logs)) {
      const completedSets = log.sets.filter((s) => s.completed).length;
      const completedCardio = log.cardio?.completed ? 1 : 0;
      const done = completedSets + completedCardio;
      if (done === 0) continue;

      const groupKey = `${log.weekId}__${log.dayCode}`;
      const existing = grouped.get(groupKey);
      if (existing) {
        existing.doneSets += done;
        if (log.updatedAt > existing.latestIso) {
          existing.latestIso = log.updatedAt;
        }
      } else {
        grouped.set(groupKey, {
          dayCode: log.dayCode,
          doneSets: done,
          latestIso: log.updatedAt
        });
      }
    }

    const items: AppGymSession[] = [];
    for (const [key, entry] of grouped.entries()) {
      const schedule = WEEKLY_SCHEDULE.find((d) => d.code === entry.dayCode);
      const dt = new Date(entry.latestIso);
      const validDate = !Number.isNaN(dt.getTime());
      const dateStr = validDate
        ? dt.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })
        : '';
      const targetSets = schedule?.targetSets || entry.doneSets;

      items.push({
        key,
        bnDate: dateStr ? `${dateStr} (${schedule?.shortBn || entry.dayCode})` : schedule?.bnName || entry.dayCode,
        routineLabel: schedule ? `${schedule.splitLabel} • ${schedule.focusTitle}` : 'নতুন রুটিন',
        doneSets: entry.doneSets,
        targetSets,
        isFull: entry.doneSets >= targetSets,
        sortTime: validDate ? dt.getTime() : 0
      });
    }

    return items.sort((a, b) => b.sortTime - a.sortTime);
  }, [logs]);

  const totalGymDays = MUKTO_PROFILE.totalPastDays + appSessions.length;

  const handleSaveWeight = () => {
    const cleaned = draftWeight.trim();
    if (cleaned) {
      setWeightKg(cleaned);
      saveStoredWeight(cleaned);
    } else {
      setDraftWeight(weightKg);
    }
    setEditingWeight(false);
  };

  return (
    <div className="history-view">
      {/* Top 2 Clean KPI Cards */}
      <div className="history-kpi-grid">
        <div className="history-kpi-card">
          <div className="hk-label-row">
            <span className="hk-label">
              <Dumbbell size={15} /> মোট জিম দিন
            </span>
          </div>
          <div className="hk-value">{totalGymDays} দিন</div>
          <div className="hk-sub">
            {MUKTO_PROFILE.totalPastDays} পূর্ববর্তী + {appSessions.length} নতুন
          </div>
        </div>

        <div className="history-kpi-card">
          <div className="hk-label-row">
            <span className="hk-label">
              <Scale size={15} /> সর্বশেষ ওজন
            </span>
            {!editingWeight && (
              <button
                type="button"
                className="hk-edit-btn"
                aria-label="Edit weight"
                onClick={() => {
                  setDraftWeight(weightKg);
                  setEditingWeight(true);
                }}
              >
                <Pencil size={13} />
              </button>
            )}
          </div>

          {editingWeight ? (
            <div className="hk-weight-edit">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={draftWeight}
                onChange={(e) => setDraftWeight(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveWeight();
                }}
                autoFocus
                aria-label="Weight in kg"
              />
              <button
                type="button"
                className="hk-save-btn"
                onClick={handleSaveWeight}
                aria-label="Save weight"
              >
                <Check size={15} />
              </button>
            </div>
          ) : (
            <>
              <div className="hk-value">{weightKg} kg</div>
              <div className="hk-sub">{MUKTO_PROFILE.weightDateBn} বেসলাইন</div>
            </>
          )}
        </div>
      </div>

      {/* New App Sessions (if any) */}
      {appSessions.length > 0 && (
        <section className="history-section">
          <h2 className="hs-title">
            <CalendarCheck size={16} /> অ্যাপে লগ করা সেশন ({appSessions.length})
          </h2>
          <div className="history-list">
            {appSessions.map((item) => (
              <div key={item.key} className="history-row is-new">
                <div className="hr-left">
                  <strong>{item.bnDate}</strong>
                  <span>{item.routineLabel}</span>
                </div>
                <span className={`hr-badge ${item.isFull ? 'done' : ''}`}>
                  {item.isFull ? '✓ সম্পন্ন' : `${item.doneSets}/${item.targetSets} সেট`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Preloaded 14 Past Gym Days */}
      <section className="history-section">
        <h2 className="hs-title">পূর্ববর্তী জিম হিস্ট্রি ({PAST_GYM_SESSIONS.length} দিন)</h2>
        <div className="history-list">
          {PAST_GYM_SESSIONS.map((item) => (
            <div
              key={item.num}
              className={`history-row ${item.highlight ? 'is-highlight' : ''}`}
            >
              <div className="hr-left">
                <strong>
                  #{item.num} • {item.bnDate}
                </strong>
                <span>{item.routineLabel}</span>
              </div>
              <span className={`hr-badge ${item.badgeText ? 'accent' : 'done'}`}>
                {item.badgeText || '✓ সম্পন্ন'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
