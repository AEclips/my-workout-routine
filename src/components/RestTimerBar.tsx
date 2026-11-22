import { Pause, Play, Plus, Timer } from 'lucide-react';

interface RestTimerBarProps {
  remainingSeconds: number;
  totalSeconds: number;
  exerciseName: string;
  isRunning: boolean;
  isCompletedAlert: boolean;
  onTogglePause: () => void;
  onAdjust: (delta: number) => void;
  onSkip: () => void;
}

export function RestTimerBar({
  remainingSeconds,
  totalSeconds,
  exerciseName,
  isRunning,
  isCompletedAlert,
  onTogglePause,
  onAdjust,
  onSkip
}: RestTimerBarProps) {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(100, (remainingSeconds / totalSeconds) * 100)) : 0;

  return (
    <div className={`rest-dock ${isCompletedAlert ? 'done' : ''}`}>
      <div className="rd-track">
        <div className="rd-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="rd-row">
        <div className="rd-info">
          <div className="rd-icon">
            <Timer size={16} />
          </div>
          <div className="rd-text">
            <div className="rd-clock">{isCompletedAlert ? '00:00' : timeStr}</div>
            <div className="rd-sub">
              {isCompletedAlert ? 'বিশ্রাম শেষ • পরের সেট' : `Rest • ${exerciseName}`}
            </div>
          </div>
        </div>

        <div className="rd-actions">
          {!isCompletedAlert && (
            <>
              <button
                type="button"
                className="rd-btn"
                onClick={() => onAdjust(15)}
                aria-label="Add 15 seconds"
              >
                <Plus size={14} /> 15s
              </button>
              <button
                type="button"
                className="rd-btn icon"
                onClick={onTogglePause}
                aria-label={isRunning ? 'Pause timer' : 'Resume timer'}
              >
                {isRunning ? <Pause size={15} /> : <Play size={15} />}
              </button>
            </>
          )}
          <button
            type="button"
            className="rd-btn skip"
            onClick={onSkip}
          >
            {isCompletedAlert ? 'ওকে' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  );
}
