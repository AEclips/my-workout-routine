import { Minus, Pause, Play, Plus, Timer, X } from 'lucide-react';

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
    <div className={`rest-timer-dock ${isCompletedAlert ? 'timer-done' : ''}`}>
      <div className="rt-progress-track">
        <div className="rt-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="rt-content">
        <div className="rt-left">
          <div className="rt-icon-box">
            <Timer size={18} />
          </div>
          <div>
            <div className="rt-label">
              {isCompletedAlert ? 'বিশ্রাম শেষ! পরের সেট শুরু করুন' : `Rest Timer • ${exerciseName}`}
            </div>
            <div className="rt-time">{isCompletedAlert ? '00:00 • READY!' : timeStr}</div>
          </div>
        </div>

        <div className="rt-actions">
          {!isCompletedAlert && (
            <>
              <button
                type="button"
                className="rt-btn"
                onClick={() => onAdjust(-15)}
                title="-15s"
              >
                <Minus size={14} /> 15s
              </button>
              <button
                type="button"
                className="rt-btn"
                onClick={() => onAdjust(15)}
                title="+15s"
              >
                <Plus size={14} /> 15s
              </button>
              <button
                type="button"
                className="rt-btn rt-btn-primary"
                onClick={onTogglePause}
                aria-label={isRunning ? 'Pause timer' : 'Resume timer'}
              >
                {isRunning ? <Pause size={15} /> : <Play size={15} />}
              </button>
            </>
          )}
          <button
            type="button"
            className="rt-btn rt-btn-close"
            onClick={onSkip}
            aria-label="Close timer"
          >
            <X size={15} /> {isCompletedAlert ? 'ওকে' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  );
}
