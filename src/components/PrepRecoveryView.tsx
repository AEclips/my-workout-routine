import {
  Check,
  Droplets,
  Flame,
  Moon,
  Plus,
  RotateCcw,
  Utensils
} from 'lucide-react';
import { useState } from 'react';
import {
  FRIDAY_CHECKLIST,
  WARMUP_ROUTINES
} from '../data/workoutBlueprint';
import type { DailyPrepRecoveryLog, RoutineType } from '../types/workout';
import { triggerHaptic } from '../utils/audioHaptics';

interface PrepRecoveryViewProps {
  routineType: RoutineType;
  recovery: DailyPrepRecoveryLog;
  onUpdateRecovery: (updated: DailyPrepRecoveryLog) => void;
  onToggleWarmupItem: (itemId: string) => void;
  onToggleFridayItem: (itemId: string) => void;
}

export function PrepRecoveryView({
  routineType,
  recovery,
  onUpdateRecovery,
  onToggleWarmupItem,
  onToggleFridayItem
}: PrepRecoveryViewProps) {
  const [warmupTab, setWarmupTab] = useState<'DAY1' | 'DAY2'>(
    routineType === 'DAY2' ? 'DAY2' : 'DAY1'
  );

  const weightNum = parseFloat(recovery.bodyWeightKg || '0');
  const proteinMin = !Number.isNaN(weightNum) && weightNum > 0 ? Math.round(weightNum * 1.6) : 107;
  const proteinMax = !Number.isNaN(weightNum) && weightNum > 0 ? Math.round(weightNum * 2.2) : 147;
  const waterLiters = (recovery.waterMl / 1000).toFixed(2);
  const waterPct = Math.min(100, Math.round((recovery.waterMl / 3500) * 100));

  const activeWarmupItems = warmupTab === 'DAY1' ? WARMUP_ROUTINES.DAY1 : WARMUP_ROUTINES.DAY2;
  const warmupDoneCount = activeWarmupItems.filter((w) =>
    recovery.warmupDoneIds.includes(w.id)
  ).length;

  return (
    <div className="tab-view-container">
      {/* Daily Water Hydration Tracker */}
      <section className="panel-card">
        <div className="panel-hdr">
          <div>
            <h3>
              <Droplets size={18} color="#38BDF8" /> দৈনিক পানি (৩–৪ লিটার)
            </h3>
            <span>বেশি ঘামলে এক চিমটি লবণ বা ইলেক্ট্রোলাইট নিন</span>
          </div>
          <strong className="water-readout">{waterLiters} L</strong>
        </div>

        <div className="vb-track" style={{ height: '10px', marginBottom: '6px' }}>
          <div
            className="vb-fill"
            style={{ width: `${waterPct}%`, background: '#38BDF8' }}
          />
        </div>

        <div className="water-btn-row">
          <button
            type="button"
            className="quick-add-btn"
            onClick={() => {
              triggerHaptic(15);
              onUpdateRecovery({ ...recovery, waterMl: recovery.waterMl + 250 });
            }}
          >
            <Plus size={16} /> ২৫০ ml
          </button>
          <button
            type="button"
            className="quick-add-btn"
            onClick={() => {
              triggerHaptic(15);
              onUpdateRecovery({ ...recovery, waterMl: recovery.waterMl + 500 });
            }}
          >
            <Plus size={16} /> ৫০০ ml
          </button>
          <button
            type="button"
            className="quick-reset-btn"
            onClick={() => onUpdateRecovery({ ...recovery, waterMl: 0 })}
          >
            <RotateCcw size={15} /> রিসেট
          </button>
        </div>
      </section>

      {/* Protein, Sleep & Nutrition Plan */}
      <section className="panel-card">
        <div className="panel-hdr">
          <div>
            <h3>
              <Utensils size={18} color="#FF5A1F" /> দৈনিক পুষ্টি, Protein ও ঘুম
            </h3>
            <span>প্রতি কেজি ওজনে ১.৬ – ২.২ গ্রাম Protein</span>
          </div>
        </div>

        <div className="nutrition-inputs-grid">
          <label className="cust-field">
            <span>ওজন (kg)</span>
            <input
              type="number"
              step="0.1"
              value={recovery.bodyWeightKg}
              placeholder="66.6"
              onChange={(e) =>
                onUpdateRecovery({ ...recovery, bodyWeightKg: e.target.value })
              }
            />
          </label>
          <label className="cust-field">
            <span>আজকের Protein (g)</span>
            <input
              type="number"
              value={recovery.proteinGrams}
              placeholder={`${proteinMin}–${proteinMax}`}
              onChange={(e) =>
                onUpdateRecovery({ ...recovery, proteinGrams: e.target.value })
              }
            />
          </label>
          <label className="cust-field">
            <span>ঘুম (ঘণ্টা)</span>
            <input
              type="number"
              step="0.5"
              value={recovery.sleepHours}
              placeholder="৭.৫–৯"
              onChange={(e) =>
                onUpdateRecovery({ ...recovery, sleepHours: e.target.value })
              }
            />
          </label>
        </div>

        <div className="protein-target-callout">
          <strong>দৈনিক Protein লক্ষ্যমাত্রা:</strong>{' '}
          {weightNum > 0
            ? `${weightNum} kg ওজনের জন্য প্রতিদিন ${proteinMin} – ${proteinMax} গ্রাম Protein (ডিম, মুরগি, মাছ, ডাল, দই, Whey)`
            : 'ওজন লিখুন — অটোমেটিক দৈনিক Protein টার্গেট হিসাব হবে (১.৬–২.২g/kg)'}
        </div>

        <div className="meal-checks">
          <button
            type="button"
            className={`meal-check-btn ${recovery.preWorkoutMealDone ? 'done' : ''}`}
            onClick={() => {
              triggerHaptic(15);
              onUpdateRecovery({
                ...recovery,
                preWorkoutMealDone: !recovery.preWorkoutMealDone
              });
            }}
          >
            <span className="fc-check">
              {recovery.preWorkoutMealDone ? <Check size={15} /> : null}
            </span>
            <div>
              <strong>Pre-Workout (৬০–৯০ মি. আগে)</strong>
              <span>সহজ Carbs + Protein (কলা + ওটস বা ভাত + ডিম)</span>
            </div>
          </button>

          <button
            type="button"
            className={`meal-check-btn ${recovery.postWorkoutMealDone ? 'done' : ''}`}
            onClick={() => {
              triggerHaptic(15);
              onUpdateRecovery({
                ...recovery,
                postWorkoutMealDone: !recovery.postWorkoutMealDone
              });
            }}
          >
            <span className="fc-check">
              {recovery.postWorkoutMealDone ? <Check size={15} /> : null}
            </span>
            <div>
              <strong>Post-Workout (১–২ ঘণ্টার মধ্যে)</strong>
              <span>২৫–৪০ গ্রাম Protein + Carbs</span>
            </div>
          </button>
        </div>
      </section>

      {/* Dynamic Warm-Up Checklist (Moved cleanly from Workout Card screen) */}
      <section className="panel-card">
        <div className="panel-hdr">
          <div>
            <h3>
              <Flame size={18} color="#FBBF24" /> সেশন পূর্ববর্তী Warm-Up (5–8m)
            </h3>
            <span>{warmupDoneCount}/{activeWarmupItems.length} সম্পন্ন</span>
          </div>
          <div className="filter-pills">
            <button
              type="button"
              className={`fp-btn ${warmupTab === 'DAY1' ? 'active' : ''}`}
              onClick={() => setWarmupTab('DAY1')}
            >
              Day 01
            </button>
            <button
              type="button"
              className={`fp-btn ${warmupTab === 'DAY2' ? 'active' : ''}`}
              onClick={() => setWarmupTab('DAY2')}
            >
              Day 02
            </button>
          </div>
        </div>

        <div className="wu-check-list">
          {activeWarmupItems.map((item) => {
            const done = recovery.warmupDoneIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`wu-check-item ${done ? 'done' : ''}`}
                onClick={() => {
                  triggerHaptic(15);
                  onToggleWarmupItem(item.id);
                }}
              >
                <span className="wu-box">{done ? <Check size={14} /> : null}</span>
                <span>{item.text}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Friday Off-Day Checklist */}
      <section className="panel-card friday-panel">
        <div className="panel-hdr">
          <div>
            <h3>
              <Moon size={18} color="#34D399" /> Friday Off-Day Recovery চেকলিস্ট
            </h3>
            <span>বিশ্রামেই Muscle বাড়ে — শুক্রবার ওয়েট রুমে যাবেন না</span>
          </div>
        </div>

        <div className="friday-checklist">
          {FRIDAY_CHECKLIST.map((item) => {
            const checked = recovery.fridayChecklistIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`fc-item ${checked ? 'is-checked' : ''}`}
                onClick={() => {
                  triggerHaptic(18);
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
      </section>
    </div>
  );
}
